"""A randomized walk over the whole contract, checking after every accepted
action that the things which must always be true still are.

Scripted tests prove the paths somebody thought of. This one drives actions in
orders nobody wrote down, and asserts conservation, immutability and the state
machine after each step."""
import json
import random

import pytest

from conftest import (  # noqa: F401
    FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, as_, asset, constitution, err,
    jfif, judge_all, judge_answer, llm, look_all, set_now, terms, transfers,
)

ACTORS = (FOUNDER, STEWARD2, PROVIDER, INSPECTOR, STRANGER)
CLOCK = ["2026-09-20T09:00:00Z", "2026-09-20T10:30:00Z", "2026-09-24T09:00:00Z",
         "2026-10-21T09:00:00Z", "2026-10-25T09:00:00Z", "2026-11-05T09:00:00Z"]
OPEN = ("PROPOSED", "AWAITING_EVIDENCE", "ACCEPTED", "REJECTED", "UNDETERMINED", "APPEALED")


class World:
    def __init__(self, module, c):
        self.module, self.c = module, c
        self.orgs, self.assets, self.orders, self.items = [], [], [], []
        self.funded = 0            # every wei ever sent into the contract
        self.settled = {}          # wid -> the record at the moment it settled
        self.rounds = {}           # "wid|n" -> the record when it was written
        self.constitutions = {}    # "oid|v" -> the constitution once effective
        self.filed = {}            # eid -> (meta, body)
        self.states = set()
        self.did = {}

    def check(self):
        c = self.c
        held, credited, claimed = 0, 0, 0
        for who in ACTORS:
            row = json.loads(c.get_balance(who))
            assert int(row["claimable"]) >= 0
            credited += int(row["claimable"])
            claimed += int(row["claimed"])
        assert sum(t["wei"] for t in transfers()) == claimed, "a transfer without a claim"

        paid_total = 0
        for oid in self.orgs:
            o = json.loads(c.get_organization(oid))
            escrow, committed = int(o["escrow_wei"]), int(o["committed_wei"])
            held += escrow
            assert 0 <= committed <= escrow, f"{oid} committed more than it holds"
            assert int(o["funded_wei"]) == escrow + int(o["paid_wei"])
            assert int(o["available_wei"]) == escrow - committed
            assert o["state"] in ("ACTIVE", "PAUSED")
            # a constitution once effective never changes, and the one in force is effective
            for v in range(1, int(o["constitution_count"]) + 1):
                cv = json.loads(c.get_constitution(oid, v))
                if cv["effective_at"]:
                    assert self.constitutions.setdefault(f"{oid}|{v}", cv) == cv
            assert json.loads(c.get_constitution(oid, o["constitution_version"]))["effective_at"]
            orders = [_recordform(json.loads(c.get_work_order(wid)))
                      for wid in self.orders if wid.startswith("wo-")
                      and json.loads(c.get_work_order(wid))["organization_id"] == oid]
            assert committed == sum(int(w["committed_wei"]) for w in orders), f"{oid} commitment drifted"
            assert o["open_work_orders"] == sum(1 for w in orders if w["state"] in OPEN)
            paid_here = 0
            for w in orders:
                self.states.add(w["state"])
                assert w["state"] in self.module.WORK_ORDER_STATES
                assert w["constitution_version"] <= int(o["constitution_count"])
                if w["state"] in ("FINALIZED", "CLOSED", "CANCELLED"):
                    assert w["committed_wei"] == "0"
                    assert self.settled.setdefault(w["work_order_id"], w) == w, \
                        f"{w['work_order_id']} changed after it settled"
                else:
                    # the commitment follows the signed terms; an unsigned order
                    # holds what it was created with until the provider signs
                    cur = int(w["current_version"] or 0) or 1
                    assert int(w["committed_wei"]) == int(w["versions"][cur - 1]["payment_wei"])
                if w["state"] == "FINALIZED":
                    paid_here += int(w["versions"][int(w["current_version"]) - 1]["payment_wei"])
                if w["state"] == "APPEALED":
                    assert w["appeal"] and w["standing"]["appealed"] is True
                if w["state"] == "ACCEPTED":
                    assert w["standing"]["decision"] == "ACCEPTED"
                for n in range(1, int(w["rounds_count"]) + 1):
                    key = f"{w['work_order_id']}|{n}"
                    rec = json.loads(c.get_round(w["work_order_id"], n))
                    assert self.rounds.setdefault(key, rec) == rec, f"round {key} changed"
                    assert rec["constitution_version"] == w["constitution_version"]
                with pytest.raises(err(self.module)):
                    c.get_round(w["work_order_id"], int(w["rounds_count"]) + 1)
            assert int(o["paid_wei"]) == paid_here, f"{oid} paid does not match its orders"
            paid_total += int(o["paid_wei"])

        assert held + credited + claimed == self.funded, "value was created or destroyed"
        assert int(json.loads(c.get_stats())["paid_wei"]) == paid_total
        for eid, before in self.filed.items():
            assert (json.loads(c.get_item(eid)), self._body(eid)) == before, f"{eid} changed"

    def _body(self, eid):
        it = json.loads(self.c.get_item(eid))
        return self.c.get_image(eid) if it["kind"] == "IMAGE" else None

    def remember_item(self, eid):
        self.items.append(eid)
        self.filed[eid] = (json.loads(self.c.get_item(eid)), self._body(eid))


def _recordform(w):
    w.pop("now", None)
    w.pop("evidence", None)
    return w


def _landed(w, name):
    w.did[name] = w.did.get(name, 0) + 1


def _progress(w, rng):
    """Do the next sensible thing for one work order, so the walk reaches the
    states that matter while its order stays varied."""
    c, module = w.c, w.module
    if not w.orders:
        return
    wid = rng.choice(w.orders)
    wo = json.loads(c.get_work_order(wid))
    version = int(wo["current_version"] or 0)
    if wo["state"] == "PROPOSED":
        as_(module, PROVIDER, 0)
        c.accept_work_order(wid, int(wo["pending_version"]))
        _landed(w, "accept_work_order")
        return
    if wo["state"] in ("FINALIZED", "CLOSED", "CANCELLED"):
        return
    mine = [it for it in wo["evidence"].get(str(version), [])
            if it["role"] == "PROVIDER" and it["kind"] == "IMAGE"]
    if wo["state"] in ("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED", "APPEALED") and len(mine) < 2:
        as_(module, PROVIDER, 0)
        eid = json.loads(c.submit_image(wid, json.dumps(
            {"criterion_id": rng.choice(["", "C1", "C2"]), "caption": f"view {len(w.items)}",
             "origin": rng.choice(["PHOTO", "NAMEPLATE", "METER_DISPLAY"])}),
            jfif(str(len(w.items)).encode())))["item_id"]
        w.remember_item(eid)
        _landed(w, "submit_image")
        return
    if wo["state"] in ("AWAITING_EVIDENCE", "REJECTED", "UNDETERMINED"):
        ids = [it["item_id"] for it in mine][:4]
        prin = {f"P{i}": rng.choice(["SATISFIED", "SATISFIED", "VIOLATED", "NOT_APPLICABLE", "UNCLEAR"])
                for i in (1, 2, 3)}
        crit = {f"C{i}": rng.choice(["MET", "MET", "NOT_MET", "UNCLEAR"]) for i in (1, 2)}
        llm(look=look_all(n_images=2),
            judge=judge_answer(prin, crit, basis={k: ids for k in list(prin) + list(crit)}))
        as_(module, PROVIDER, 0)
        c.request_assessment(wid, json.dumps(ids))
        _landed(w, "request_assessment")
        after = json.loads(c.get_work_order(wid))
        standing = after.get("standing") or {}
        if standing.get("appealable") and rng.randrange(3) == 0:
            who = rng.choice([FOUNDER, STEWARD2]) if standing["decision"] == "ACCEPTED" else PROVIDER
            as_(module, who, 0)
            c.open_appeal(wid, "The photographs show the isolator labelled.")
            _landed(w, "open_appeal")
        return
    if wo["state"] in ("ACCEPTED", "REJECTED") and wo["standing"]["appealable"] \
            and not wo["standing"]["appealed"] and rng.randrange(2):
        who = rng.choice([FOUNDER, STEWARD2]) if wo["standing"]["decision"] == "ACCEPTED" else PROVIDER
        as_(module, who, 0)
        c.open_appeal(wid, "The photographs show the isolator labelled.")
        _landed(w, "open_appeal")
        return
    if wo["state"] == "APPEALED":
        llm(look=look_all(n_images=2), judge=judge_all(basis={}),
            default_basis=(mine[0]["item_id"] if mine else "ev-000001"))
        as_(module, rng.choice(ACTORS), 0)
        rng.choice([lambda: (c.decide_appeal(wid), _landed(w, "decide_appeal")),
                    lambda: (c.lapse_appeal(wid), _landed(w, "lapse_appeal"))])()
        return
    if wo["state"] == "ACCEPTED":
        as_(module, rng.choice(ACTORS), 0)
        c.finalize(wid)
        _landed(w, "finalize")
        return
    as_(module, rng.choice(ACTORS), 0)
    c.close_work_order(wid)
    _landed(w, "close_work_order")


def _act(w, rng):
    c, module = w.c, w.module
    who = rng.choice(ACTORS)
    choice = rng.randrange(16)
    if w.orders and rng.randrange(2) == 0:
        return _progress(w, rng)
    # a steward's act is mostly attempted by a steward: a walk made only of
    # strangers' refusals would never reach the states that matter
    if choice in (2, 3, 12, 13, 14, 15) and rng.randrange(4):
        who = rng.choice([FOUNDER, STEWARD2])
    as_(module, who, 0)

    if choice == 0 or not w.orgs:
        wei = rng.choice([0, 3 * GEN, 8 * GEN])
        as_(module, who, wei)
        stewards = rng.choice([[FOUNDER, STEWARD2], [who], [FOUNDER]])
        out = json.loads(c.create_organization(constitution(
            stewards, funding_rules={"max_payment_wei": str(3 * GEN), "max_open_work_orders": 6},
            windows={"appeal_window_seconds": rng.choice([600, 3600]),
                               "amendment_window_seconds": 3600},
            evidence_rules={"min_images": rng.choice([1, 2]), "inspection_report_required": False})))
        w.funded += wei
        if out["refused"] is False:
            w.orgs.append(out["organization_id"])
            _landed(w, "create_organization")
        return

    oid = rng.choice(w.orgs)
    aid = rng.choice(w.assets) if w.assets else None
    wid = rng.choice(w.orders) if w.orders else None

    if choice == 1:
        wei = rng.choice([GEN, 3 * GEN])
        as_(module, who, wei)
        json.loads(c.fund_treasury(oid))
        w.funded += wei
        _landed(w, "fund_treasury")
    elif choice == 2:
        out = json.loads(c.register_asset(oid, asset(
            infrastructure_type=rng.choice(["COMMUNITY_SOLAR", "BATTERY_STORAGE", "WATER_SYSTEM"]),
            inspector=rng.choice(["", INSPECTOR]))))
        w.assets.append(out["asset_id"])
        _landed(w, "register_asset")
    elif choice == 3 and aid:
        out = json.loads(c.create_work_order(aid, rng.choice([PROVIDER, STRANGER]), terms(
            payment_wei=str(rng.choice([GEN, 2 * GEN])),
            deadline=rng.choice(["2026-10-20T12:00:00Z", "2026-10-24T12:00:00Z"]))))
        w.orders.append(out["work_order_id"])
        _landed(w, "create_work_order")
    elif choice == 4 and aid:
        c.accept_inspector_role(aid)
        _landed(w, "accept_inspector_role")
    elif choice == 5 and wid:
        eid = json.loads(c.submit_image(wid, json.dumps(
            {"criterion_id": rng.choice(["", "C1"]), "caption": f"view {len(w.items)}",
             "origin": rng.choice(["PHOTO", "NAMEPLATE"])}),
            jfif(str(len(w.items)).encode())))["item_id"]
        w.remember_item(eid)
        _landed(w, "submit_image")
    elif choice == 6 and wid:
        eid = json.loads(c.submit_document(wid, json.dumps(
            {"title": "Report", "doc_type": rng.choice(["TECHNICAL_REPORT", "INSPECTION_REPORT",
                                                        "MAINTENANCE_LOG"])}),
            "Replaced the inverter with a 6 kW unit."))["item_id"]
        w.remember_item(eid)
        _landed(w, "submit_document")
    elif choice == 7 and wid:
        wo = json.loads(c.get_work_order(wid))
        version = int(wo["current_version"] or 0)
        mine = [it["item_id"] for it in wo["evidence"].get(str(version), [])
                if it["role"] == "PROVIDER" and it["kind"] in ("IMAGE", "DOCUMENT")][:4]
        prin = {f"P{i}": rng.choice(["SATISFIED", "VIOLATED", "UNCLEAR"]) for i in (1, 2, 3)}
        crit = {f"C{i}": rng.choice(["MET", "NOT_MET", "UNCLEAR"]) for i in (1, 2)}
        llm(look=look_all(n_images=2),
            judge=judge_answer(prin, crit, basis={k: mine for k in list(prin) + list(crit)}))
        c.request_assessment(wid, json.dumps(mine))
        _landed(w, "request_assessment")
    elif choice == 8 and wid:
        c.open_appeal(wid, "The isolator is labelled in the second photograph.")
        _landed(w, "open_appeal")
    elif choice == 9 and wid:
        llm(look=look_all(n_images=2), judge=judge_all(basis={}))
        c.decide_appeal(wid)
        _landed(w, "decide_appeal")
    elif choice == 10 and wid:
        settle = rng.choice(["finalize", "close_work_order", "lapse_appeal"])
        getattr(c, settle)(wid)
        _landed(w, settle)
    elif choice == 11:
        if rng.randrange(2):
            c.claim()
            _landed(w, "claim")
        elif wid:
            c.cancel_work_order(wid, "withdrawn")
            _landed(w, "cancel_work_order")
    elif choice == 12:
        out = json.loads(c.propose_amendment(oid, constitution(
            rng.choice([[FOUNDER, STEWARD2, STRANGER], [FOUNDER, STEWARD2]]),
            windows={"appeal_window_seconds": 600, "amendment_window_seconds": 600})))
        _landed(w, "propose_amendment")
    elif choice == 13:
        act = rng.choice(["ratify_amendment", "object_amendment"])
        if act == "ratify_amendment":
            c.ratify_amendment(oid)
        else:
            c.object_amendment(oid, "We object.")
        _landed(w, act)
    elif choice == 14:
        act = rng.choice(["pause_organization", "resume_organization"])
        if act == "pause_organization":
            c.pause_organization(oid, "audit")
        else:
            c.resume_organization(oid)
        _landed(w, act)
    elif choice == 15 and wid:
        c.propose_version(wid, terms(payment_wei=str(rng.choice([GEN, 3 * GEN]))))
        _landed(w, "propose_version")
        wo = json.loads(c.get_work_order(wid))
        if wo["pending_version"] and rng.randrange(2):
            as_(module, PROVIDER, 0)
            c.accept_work_order(wid, int(wo["pending_version"]))
            _landed(w, "accept_work_order")


@pytest.mark.parametrize("seed", range(6))
def test_random_play_preserves_every_invariant(module, c, seed):
    _walk(module, c, seed)


def test_the_walk_actually_reaches_the_whole_state_machine(module, c):
    w = _walk(module, c, seed=103, steps=1100)
    assert w.states == set(module.WORK_ORDER_STATES), sorted(w.states)
    for action in ("create_organization", "fund_treasury", "register_asset", "create_work_order",
                   "accept_work_order", "accept_inspector_role", "submit_image", "submit_document",
                   "request_assessment", "open_appeal", "decide_appeal", "finalize",
                   "close_work_order", "lapse_appeal", "claim", "cancel_work_order",
                   "propose_amendment", "ratify_amendment", "object_amendment",
                   "pause_organization", "resume_organization", "propose_version"):
        assert w.did.get(action, 0) >= 1, f"the walk never landed {action}: {w.did}"


def _walk(module, c, seed, steps=120):
    rng = random.Random(seed)
    w = World(module, c)
    set_now(CLOCK[0])
    for step in range(steps):
        if rng.randrange(14) == 0:
            set_now(CLOCK[min(len(CLOCK) - 1, rng.randrange(len(CLOCK)))])
        try:
            _act(w, rng)
        except module.gl.vm.UserError:
            pass          # a refusal is a legitimate outcome
        except KeyError as e:
            raise AssertionError(f"step {step}: a missing key escaped as a crash: {e}")
        except (TypeError, ValueError, IndexError, AttributeError) as e:
            raise AssertionError(f"step {step}: {type(e).__name__} escaped instead of "
                                 f"a refusal in words: {e}")
        w.check()
    return w
