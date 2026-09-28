"""The brief's contract invariants, checked after every action of a randomized
walk: value conserved, commitments matching open work, counters matching
states, constitutions, decisions, snapshots and evidence immutable once
written, and no payment without a finalized acceptance."""
import json
import random

import pytest

from conftest import (BENEFICIARY, FOUNDER, GEN, INSPECTOR, PROVIDER, PROVIDER2, STEWARD2, STRANGER, as_,
                      asset, constitution, jfif, judgment, llm, provider_profile, seen, set_now,
                      terms, transfers)

ACTORS = (FOUNDER, STEWARD2, PROVIDER, PROVIDER2, INSPECTOR, STRANGER, BENEFICIARY)
CLOCK = ["2026-09-20T09:00:00Z", "2026-09-20T11:00:00Z", "2026-09-22T09:00:00Z", "2026-09-24T12:00:00Z",
         "2026-10-21T09:00:00Z", "2026-10-26T09:00:00Z"]
OPEN = ("PROPOSED", "ACTIVE", "DECIDED", "UNDER_APPEAL", "PAYMENT_RELEASABLE")


class World:
    def __init__(self, module, c):
        self.module, self.c = module, c
        self.orgs, self.assets, self.orders = [], [], []
        self.sent = 0
        self.frozen = {}          # key -> record once it may no longer change
        self.states, self.did = set(), {}

    def freeze(self, key, value):
        assert self.frozen.setdefault(key, value) == value, f"{key} changed after it was fixed"

    def check(self):
        c = self.c
        held = 0
        paid_out = sum(t["wei"] for t in transfers())
        owed = sum(int(json.loads(c.get_refund(a))["owed"]) for a in ACTORS)
        for oid in self.orgs:
            o = json.loads(c.get_organization(oid))
            esc, com, rel = int(o["escrow_wei"]), int(o["committed_wei"]), int(o["releasable_wei"])
            held += esc
            assert 0 <= rel <= com <= esc, f"{oid}: releasable {rel} committed {com} held {esc}"
            assert int(o["funded_wei"]) == esc + int(o["paid_wei"]) + int(o["returned_wei"])
            orders = []
            for wid in self.orders:
                w = json.loads(c.get_work_order(wid))
                if w["organization_id"] == oid:
                    orders.append(w)
            assert com == sum(int(w["committed_wei"]) for w in orders), f"{oid} commitment drifted"
            assert rel == sum(int(w["committed_wei"]) for w in orders if w["state"] == "PAYMENT_RELEASABLE")
            assert o["open_work_orders"] == sum(1 for w in orders if w["state"] in OPEN)
            assert o["pending_decisions"] == sum(1 for w in orders if w["state"] == "DECIDED")
            assert o["open_appeals"] == sum(1 for w in orders if w["state"] == "UNDER_APPEAL")
            assert int(o["paid_wei"]) == sum(int(w["settlement"]["wei"]) for w in orders if w["settlement"])
            for v in range(1, o["constitution_count"] + 1):
                cv = json.loads(c.get_constitution(oid, v))
                if cv["effective_at"]:
                    self.freeze(f"{oid}|v{v}", cv)
            for w in orders:
                self.states.add(w["state"])
                if w["state"] in ("SETTLED", "PAYMENT_RELEASABLE"):
                    d = json.loads(c.get_decision(w["current_decision_id"]))
                    assert d["outcome"] == "ACCEPTED" and d["lifecycle"] == "FINALIZED", "paid without acceptance"
                if w["state"] in ("SETTLED", "CLOSED_UNPAID", "CANCELLED"):
                    assert w["committed_wei"] == "0"
                for did in w["decisions"]:
                    d = json.loads(c.get_decision(did))
                    assert d["constitution_version"] == w["constitution_version"]
                    core = {k: d[k] for k in ("outcome", "requirements", "snapshot_id", "work_order_version",
                                              "constitution_version", "appeal_of", "decided_at")}
                    self.freeze(did, core)
                    self.freeze(d["snapshot_id"], json.loads(c.get_snapshot(d["snapshot_id"])))
                    if d["lifecycle"] == "FINALIZED":
                        self.freeze(did + "|final", d["finalized_at"])
                for v, items in w["evidence"].items():
                    for it in items:
                        self.freeze(it["evidence_id"], it)
        assert held + owed + paid_out == self.sent, "value was created or destroyed"


IDS = ["P1", "P2", "P3", "C1", "C2", "S1", "S2", "S3"]


def _progress(w, rng):
    """The next sensible act for one work order, so the walk reaches the
    states that matter while the order of acts stays random."""
    c, m = w.c, w.module
    live = [x for x in w.orders if json.loads(c.get_work_order(x))["state"] not in
            ("SETTLED", "CLOSED_UNPAID", "CANCELLED")]
    if not live and w.orgs:
        oid = rng.choice(w.orgs)
        as_(m, FOUNDER)
        aid = json.loads(c.register_asset(oid, asset()))["asset_id"]
        w.assets.append(aid)
        c.authorize_provider(oid, PROVIDER, provider_profile())
        wid = json.loads(c.create_work_order(aid, PROVIDER, terms()))["work_order_id"]
        w.orders.append(wid)
        _landed(w, "create_work_order")
        return
    if not live:
        return
    wid = rng.choice(live)
    o = json.loads(c.get_work_order(wid))
    v = str(o["current_version"])
    imgs = [it["evidence_id"] for it in o["evidence"].get(v, []) if it["kind"] == "IMAGE"]
    views = [it.get("view") for it in o["evidence"].get(v, []) if it["kind"] == "IMAGE"]
    state = o["state"]
    if state == "PROPOSED" and rng.randrange(3) == 0:
        as_(m, FOUNDER)
        c.cancel_work_order(wid, "not needed")
        _landed(w, "cancel_work_order")
    elif state == "PROPOSED":
        as_(m, o["provider"])
        c.accept_work_order(wid, int(o["pending_version"]))
        _landed(w, "accept_work_order")
    elif state in ("ACTIVE", "UNDER_APPEAL") and ("AFTER" not in views or "METER_DISPLAY" not in views):
        as_(m, o["provider"])
        view = "AFTER" if "AFTER" not in views else "METER_DISPLAY"
        c.submit_image(wid, json.dumps({"view": view}), jfif(f"{view}{rng.random()}".encode()))
        _landed(w, "submit_image")
    elif state == "ACTIVE":
        rs = {i: rng.choice(["SATISFIED", "SATISFIED", "SATISFIED", "NOT_SATISFIED", "NOT_ESTABLISHED"]) for i in IDS}
        llm(look=[seen(2), seen(2), seen(2)], judge=judgment(rs, sufficient=rng.random() < .85),
            basis_default=imgs[0])
        as_(m, o["provider"])
        c.request_assessment(wid)
        _landed(w, "request_assessment")
    elif state == "DECIDED":
        d = json.loads(c.get_decision(o["current_decision_id"]))
        if d["appeals_left"] > 0 and rng.randrange(2):
            as_(m, FOUNDER if d["outcome"] == "ACCEPTED" else o["provider"])
            c.open_appeal(wid, "grounds")
            _landed(w, "open_appeal")
        else:
            _bump_clock(w, d["appeal_window_ends"])
            c.finalize(wid)
            _landed(w, "finalize")
    elif state == "UNDER_APPEAL":
        rs = {i: rng.choice(["SATISFIED", "NOT_SATISFIED"]) for i in IDS}
        llm(look=[seen(2), seen(2), seen(2), seen(2)], judge=judgment(rs), basis_default=imgs[0])
        as_(m, o["appeal"]["opened_by"])
        c.readjudicate(wid)
        _landed(w, "readjudicate")
    elif state == "PAYMENT_RELEASABLE":
        as_(m, rng.choice(ACTORS))
        c.settle(wid)
        _landed(w, "settle")


def _bump_clock(w, iso):
    """Move time just past a window, never backwards."""
    from datetime import datetime, timedelta
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")) + timedelta(seconds=1)
    cur = w.module.datetime.now()
    if t > cur:
        set_now(t.strftime("%Y-%m-%dT%H:%M:%SZ"))


def _landed(w, name):
    w.did[name] = w.did.get(name, 0) + 1


def _step(w, rng):
    c, m = w.c, w.module
    who = rng.choice(ACTORS)
    as_(m, who, 0)
    r = rng.randrange(26)
    if not w.orgs or (r == 0 and len(w.orgs) < 4):
        wei = rng.choice([0, 12 * GEN, 12 * GEN])
        as_(m, rng.choice([FOUNDER, FOUNDER, FOUNDER, STRANGER]), wei)
        out = json.loads(c.create_organization(constitution([FOUNDER, STEWARD2], BENEFICIARY, appeal_rules={
            "appeal_window_seconds": 3600, "evidence_period_seconds": 3600,
            "max_appeals_per_work_order": rng.choice([0, 1, 2])})))
        w.sent += wei
        if not out["refused"]:
            w.orgs.append(out["organization_id"])
            _landed(w, "create_organization")
        return
    oid = rng.choice(w.orgs)
    steward = rng.choice([FOUNDER, STEWARD2, STRANGER]) if rng.randrange(5) else who
    wid = rng.choice(w.orders) if w.orders else None
    if r == 1:
        wei = rng.choice([GEN, 3 * GEN])
        as_(m, who, wei)
        c.fund_treasury(oid)
        w.sent += wei
        _landed(w, "fund_treasury")
    elif r == 2:
        as_(m, steward)
        c.authorize_provider(oid, rng.choice([PROVIDER, PROVIDER2]), provider_profile())
        _landed(w, "authorize_provider")
    elif r == 3:
        as_(m, steward)
        out = json.loads(c.register_asset(oid, asset(inspector=rng.choice(["", INSPECTOR]))))
        w.assets.append(out["asset_id"])
        _landed(w, "register_asset")
    elif r in (4, 5, 6) and w.assets:
        aid = rng.choice(w.assets)
        home = json.loads(c.get_asset(aid))["organization_id"]
        prov = rng.choice([PROVIDER, PROVIDER2])
        if rng.randrange(4):
            as_(m, FOUNDER)
            try:
                c.authorize_provider(home, prov, provider_profile())
            except m.gl.vm.UserError:
                pass
        as_(m, FOUNDER if rng.randrange(4) else steward)
        out = json.loads(c.create_work_order(aid, prov, terms(
            payment_wei=str(rng.choice([GEN, 2 * GEN])), budget_wei=str(2 * GEN),
            maintenance_type=rng.choice(["COMPONENT_REPLACEMENT", "BATTERY_SERVICE", "EMERGENCY_REPAIR"]),
            deadline=rng.choice(["2026-10-20T12:00:00Z", "2026-09-22T12:00:00Z"]))))
        w.orders.append(out["work_order_id"])
        _landed(w, "create_work_order")
    elif r in (24, 25) and wid:
        o = json.loads(c.get_work_order(wid))
        as_(m, o["provider"])
        c.accept_work_order(wid, int(o["pending_version"] or 1))
        _landed(w, "accept_work_order")
    elif r in (7, 8) and wid:
        o = json.loads(c.get_work_order(wid))
        as_(m, rng.choice([o["provider"], o["provider"], INSPECTOR, STEWARD2]))
        view = rng.choice(["AFTER", "METER_DISPLAY", "BEFORE", "SITE"])
        c.submit_image(wid, json.dumps({"view": view}), jfif(f"{view}{rng.random()}".encode()))
        _landed(w, "submit_image")
    elif r == 9 and wid:
        o = json.loads(c.get_work_order(wid))
        as_(m, rng.choice([o["provider"], INSPECTOR]))
        c.submit_document(wid, json.dumps({"doc_type": rng.choice(["TECHNICAL_REPORT", "INSPECTION_REPORT",
                                                                   "METER_READING"])}), "12.5 V after the work.")
        _landed(w, "submit_document")
    elif r in (10, 11) and wid:
        o = json.loads(c.get_work_order(wid))
        v = str(o["current_version"])
        imgs = [it["evidence_id"] for it in o["evidence"].get(v, []) if it["kind"] == "IMAGE"]
        n = len(imgs)
        rs = {i: rng.choice(["SATISFIED", "SATISFIED", "NOT_SATISFIED", "NOT_ESTABLISHED"])
              for i in ["P1", "P2", "P3", "C1", "C2", "S1", "S2", "S3"]}
        llm(look=[seen(2), seen(2), seen(2), seen(1)], judge=judgment(rs, sufficient=rng.random() < .8,
                                                                       conflicts=rng.random() < .1),
            basis_default=imgs[0] if imgs else "ev-000001")
        as_(m, o["provider"])
        c.request_assessment(wid)
        _landed(w, "request_assessment")
        assert n >= 0
    elif r == 12 and wid:
        o = json.loads(c.get_work_order(wid))
        as_(m, rng.choice([o["provider"], FOUNDER, STEWARD2]))
        c.open_appeal(wid, "grounds")
        _landed(w, "open_appeal")
    elif r == 13 and wid:
        o = json.loads(c.get_work_order(wid))
        imgs = [it["evidence_id"] for it in o["evidence"].get(str(o["current_version"]), []) if it["kind"] == "IMAGE"]
        llm(look=[seen(2), seen(2), seen(2), seen(2), seen(1)],
            judge=judgment({i: rng.choice(["SATISFIED", "NOT_SATISFIED"]) for i in
                            ["P1", "P2", "P3", "C1", "C2", "S1", "S2", "S3"]}),
            basis_default=imgs[0] if imgs else "ev-000001")
        as_(m, (o.get("appeal") or {}).get("opened_by") or STRANGER)
        c.readjudicate(wid)
        _landed(w, "readjudicate")
    elif r in (14, 15) and wid:
        name = rng.choice(["finalize", "settle", "close_work_order"])
        getattr(c, name)(wid)
        _landed(w, name)
    elif r == 16 and wid:
        as_(m, steward)
        if rng.randrange(2):
            c.cancel_work_order(wid, "x")
            _landed(w, "cancel_work_order")
        else:
            c.propose_version(wid, terms(payment_wei=str(GEN), budget_wei=str(GEN)))
            _landed(w, "propose_version")
    elif r == 17 and rng.randrange(3) == 0:
        as_(m, steward)
        if rng.randrange(2):
            c.propose_amendment(oid, constitution([FOUNDER, STEWARD2], BENEFICIARY))
            _landed(w, "propose_amendment")
        else:
            c.propose_dissolution(oid, "wind up")
            _landed(w, "propose_dissolution")
    elif r == 18:
        if rng.randrange(2):
            as_(m, steward)
            c.object_motion(oid, "no")
            _landed(w, "object_motion")
        else:
            c.enact_motion(oid)
            _landed(w, "enact_motion")
    elif r == 19 and rng.randrange(3) == 0:
        c.complete_dissolution(oid)
        _landed(w, "complete_dissolution")
    elif r == 20:
        c.claim_refund()
        _landed(w, "claim_refund")
    elif r == 21:
        as_(m, steward)
        name = rng.choice(["pause_organization", "resume_organization"])
        getattr(c, name)(oid, "x") if name == "pause_organization" else c.resume_organization(oid)
        _landed(w, name)
    elif r == 22 and w.assets:
        as_(m, INSPECTOR)
        c.accept_inspector_role(rng.choice(w.assets))
        _landed(w, "accept_inspector_role")
    elif r == 23 and w.assets and rng.randrange(10) == 0:
        as_(m, steward)
        c.retire_asset(rng.choice(w.assets), "x")
        _landed(w, "retire_asset")


def _walk(module, c, seed, steps=150):
    rng = random.Random(seed)
    w = World(module, c)
    set_now(CLOCK[0])
    now = 0
    for step in range(steps):
        if rng.randrange(12) == 0 and now < len(CLOCK) - 1:
            now = min(len(CLOCK) - 1, now + rng.choice([0, 1]))
            _bump_clock(w, CLOCK[now])
        try:
            _progress(w, rng) if rng.randrange(2) else _step(w, rng)
        except module.gl.vm.UserError:
            pass
        except (KeyError, TypeError, ValueError, IndexError, AttributeError) as e:
            raise AssertionError(f"step {step}: {type(e).__name__} escaped instead of a refusal: {e}")
        w.check()
    return w


@pytest.mark.parametrize("seed", range(6))
def test_invariants_hold_under_random_play(module, c, seed):
    _walk(module, c, seed)


def test_the_walk_reaches_the_whole_machine(module, c):
    best = None
    for seed in range(200, 212):
        from conftest import _reset, _fresh_instance
        _reset()
        inst = _fresh_instance(module)
        w = _walk(module, inst, seed, steps=900)
        if best is None or len(w.states) > len(best[0]):
            best = (w.states, seed, w.did)
        if w.states == set(module.WORK_ORDER_STATES):
            break
    assert best[0] == set(module.WORK_ORDER_STATES), (best[1], sorted(best[0]))
