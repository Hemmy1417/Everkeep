"""After the decision: the one appeal, its lapse, finalization as a claim,
closing after the deadline, and the claim itself. Money is checked at every
step against the treasury it came from."""
import json

import pytest

from conftest import (FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_,
                      assess, claimable, document, err, image, judge_all, judge_answer, llm,
                      look_all, order, org, prompts, rounds, set_now, transfers)


def accepted(module, c, **kw):
    oid, aid, wid = active_order(module, c, **kw)
    items = [image(module, c, wid, crit="C1"), image(module, c, wid, crit="C2")]
    assess(module, c, wid, items)
    return oid, aid, wid, items


def rejected(module, c, **kw):
    oid, aid, wid = active_order(module, c, **kw)
    items = [image(module, c, wid, crit="C1"), image(module, c, wid, crit="C2")]
    assess(module, c, wid, items, judge=judge_all(crit_status="NOT_MET"))
    return oid, aid, wid, items


# ── finalize and claim ───────────────────────────────────────────────────────

def test_finalize_waits_for_the_window_then_credits_a_claim(module, c):
    oid, aid, wid, _ = accepted(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="window is still open"):
        c.finalize(wid)
    set_now("2026-09-20T10:00:01Z")
    out = json.loads(c.finalize(wid))
    assert out["credited_wei"] == str(2 * GEN) and out["to"] == PROVIDER
    assert claimable(c, PROVIDER) == 2 * GEN
    o = org(c, oid)
    assert o["escrow_wei"] == str(8 * GEN) and o["committed_wei"] == "0"
    assert o["paid_wei"] == str(2 * GEN) and o["open_work_orders"] == 0
    assert order(c, wid)["state"] == "FINALIZED"
    assert json.loads(c.get_asset(aid))["status"] == "MONITORING"
    assert json.loads(c.get_stats())["paid_wei"] == str(2 * GEN)
    with pytest.raises(err(module), match="only a standing acceptance"):
        c.finalize(wid)


def test_claim_pays_the_ledger_and_only_once(module, c):
    oid, aid, wid, _ = accepted(module, c)
    set_now("2026-09-20T10:00:01Z")
    c.finalize(wid)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="nothing is claimable"):
        c.claim()
    as_(module, PROVIDER)
    out = json.loads(c.claim())
    assert out["wei"] == str(2 * GEN)
    assert transfers() == [{"to": PROVIDER, "wei": 2 * GEN}]
    assert claimable(c, PROVIDER) == 0
    assert json.loads(c.get_balance(PROVIDER))["claimed"] == str(2 * GEN)
    with pytest.raises(err(module), match="nothing is claimable"):
        c.claim()


def test_nothing_finalizes_a_rejection_or_doubt(module, c):
    oid, aid, wid, _ = rejected(module, c)
    set_now("2026-09-20T10:00:01Z")
    with pytest.raises(err(module), match="only a standing acceptance"):
        c.finalize(wid)


def test_no_filing_against_a_standing_acceptance(module, c):
    oid, aid, wid, _ = accepted(module, c)
    with pytest.raises(err(module), match="open an appeal"):
        image(module, c, wid, who=STEWARD2)
    with pytest.raises(err(module), match="acceptance stands"):
        assess(module, c, wid, [])


# ── the appeal ───────────────────────────────────────────────────────────────

def test_a_steward_appeals_an_acceptance_the_provider_a_rejection(module, c):
    oid, aid, wid, _ = accepted(module, c)
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="only a steward appeals an acceptance"):
        c.open_appeal(wid, "I want more.")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward appeals"):
        c.open_appeal(wid, "x")
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="state the grounds"):
        c.open_appeal(wid, " ")
    out = json.loads(c.open_appeal(wid, "The photographs show the old inverter still fitted."))
    assert out["against"] == "ACCEPTED" and out["evidence_ends"] == "2026-09-20T10:00:00Z"
    w = order(c, wid)
    assert w["state"] == "APPEALED" and w["standing"]["appealed"] is True
    assert w["appeal"]["by"] == "STEWARD" and w["appeal"]["opened_by"] == STEWARD2

    oid2, aid2, wid2, _ = rejected(module, c)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="only the provider appeals a rejection"):
        c.open_appeal(wid2, "x")
    as_(module, PROVIDER)
    assert json.loads(c.open_appeal(wid2, "The display reads 4.1 kW."))["against"] == "REJECTED"


def test_appeal_window_and_once_only(module, c):
    oid, aid, wid, _ = accepted(module, c)
    set_now("2026-09-20T10:00:01Z")
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="window has closed"):
        c.open_appeal(wid, "late")
    oid2, aid2, wid2, items = accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid2, "grounds")
    with pytest.raises(err(module), match="already appealed"):
        c.open_appeal(wid2, "again")


def test_doubt_is_not_appealable(module, c):
    oid, aid, wid = active_order(module, c)
    items = [image(module, c, wid), image(module, c, wid)]
    assess(module, c, wid, items, judge=judge_all(crit_status="UNCLEAR"))
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="no decision open to appeal"):
        c.open_appeal(wid, "x")
    # the provider files more and asks again instead
    new = image(module, c, wid)
    out = assess(module, c, wid, items + [new], look=[look_all(), look_all(1)])
    assert out["decision"] == "ACCEPTED" and out["round"] == 2


def test_appeal_rereads_the_record_plus_new_items_under_the_same_constitution(module, c):
    oid, aid, wid, items = accepted(module, c, inspector=INSPECTOR)
    as_(module, STEWARD2)
    c.open_appeal(wid, "The isolator is not labelled.")
    new_img = image(module, c, wid, who=STEWARD2, caption="Unlabelled isolator")
    rep = document(module, c, wid, who=INSPECTOR, doc_type="INSPECTION_REPORT",
                   text="The d.c. isolator carries no label.")
    from conftest import declaration
    decl = declaration(module, c, wid, who=PROVIDER, text="It was labelled when I left.")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="evidence period is still open"):
        c.decide_appeal(wid)
    set_now("2026-09-20T10:00:01Z")
    llm(look=[look_all(), look_all(1)],
        judge=judge_answer({"P1": "SATISFIED", "P2": "VIOLATED", "P3": "SATISFIED"},
                           {"C1": "MET", "C2": "MET"}, basis={"P2": [rep]}),
        default_basis=items[0])
    out = json.loads(c.decide_appeal(wid))
    assert out["decision"] == "REJECTED" and out["reviewed_round"] == 1
    assert out["new_items"] == [new_img, rep]
    r = rounds(c, wid, 2)
    assert r["kind"] == "APPEAL" and r["constitution_version"] == 1
    assert [row["item_id"] for row in r["evidence"]] == items + [new_img, rep]
    assert decl not in [row["item_id"] for row in r["evidence"]]
    judge = prompts("judge", "leader")[-1]["prompt"]
    assert "APPEAL of round 1" in judge and "The isolator is not labelled." in judge
    w = order(c, wid)
    assert w["state"] == "REJECTED" and w["appeal"] is None
    assert w["standing"]["appealable"] is False
    set_now("2026-10-20T12:00:01Z")
    out = json.loads(c.close_work_order(wid))
    assert out["released_wei"] == str(2 * GEN)
    assert org(c, oid)["committed_wei"] == "0"


def test_an_upheld_acceptance_finalizes_at_once(module, c):
    oid, aid, wid, items = accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "grounds")
    set_now("2026-09-20T10:00:01Z")
    llm(look=look_all(), judge=judge_all(), default_basis=items[0])
    out = json.loads(c.decide_appeal(wid))
    assert out["decision"] == "ACCEPTED"
    w = order(c, wid)
    assert w["state"] == "ACCEPTED" and w["standing"]["appealable"] is False
    assert json.loads(c.finalize(wid))["credited_wei"] == str(2 * GEN)


def test_appeal_additions_are_bounded(module, c):
    oid, aid, wid, items = accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "grounds")
    image(module, c, wid, who=PROVIDER)
    image(module, c, wid, who=PROVIDER)
    with pytest.raises(err(module), match="at most 2 new images"):
        image(module, c, wid, who=PROVIDER)
    document(module, c, wid, who=PROVIDER)
    document(module, c, wid, who=PROVIDER)
    with pytest.raises(err(module), match="at most 2 new documents"):
        document(module, c, wid, who=PROVIDER)
    from conftest import declaration
    declaration(module, c, wid, who=PROVIDER)  # never read, never counted
    set_now("2026-09-20T10:00:01Z")
    with pytest.raises(err(module), match="evidence period has ended"):
        image(module, c, wid, who=STEWARD2)


def test_appeal_lapses_into_doubt_and_the_order_closes_at_the_deadline(module, c):
    oid, aid, wid, items = accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "grounds")
    set_now("2026-09-20T10:00:01Z")
    with pytest.raises(err(module), match="three days"):
        c.lapse_appeal(wid)
    with pytest.raises(err(module), match="appeal is open"):
        c.close_work_order(wid)
    set_now("2026-09-23T10:00:01Z")
    out = json.loads(c.lapse_appeal(wid))
    assert out["state"] == "UNDETERMINED"
    w = order(c, wid)
    assert w["standing"]["kind"] == "APPEAL_LAPSED" and w["appeal"] is None
    with pytest.raises(err(module), match="only a standing acceptance"):
        c.finalize(wid)
    assert order(c, wid)["committed_wei"] == str(2 * GEN)
    set_now("2026-10-20T12:00:01Z")
    assert json.loads(c.close_work_order(wid))["released_wei"] == str(2 * GEN)
    assert org(c, oid)["available_wei"] == str(10 * GEN)


def test_a_failed_readjudication_leaves_the_appeal_open(module, c):
    oid, aid, wid, items = accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "grounds")
    set_now("2026-09-20T10:00:01Z")
    llm(look=look_all(), judge=judge_all(), v_judge=judge_all(crit_status="UNCLEAR"),
        default_basis=items[0])
    with pytest.raises(err(module), match="did not agree"):
        c.decide_appeal(wid)
    assert order(c, wid)["state"] == "APPEALED"


# ── close ────────────────────────────────────────────────────────────────────

def test_close_needs_the_deadline_and_the_window_to_pass(module, c):
    oid, aid, wid, _ = rejected(module, c)
    with pytest.raises(err(module), match="deadline has not passed"):
        c.close_work_order(wid)
    set_now("2026-10-20T12:00:01Z")
    out = json.loads(c.close_work_order(wid))
    assert out["state"] == "CLOSED"
    with pytest.raises(err(module), match="already settled"):
        c.close_work_order(wid)


def test_close_refuses_a_standing_acceptance(module, c):
    oid, aid, wid, _ = accepted(module, c)
    set_now("2026-10-20T12:00:01Z")
    with pytest.raises(err(module), match="finalized, not closed"):
        c.close_work_order(wid)


def test_close_waits_for_a_pending_version_with_a_live_deadline(module, c):
    oid, aid, wid = active_order(module, c, deadline="2026-09-21T00:00:00Z")
    from conftest import terms
    as_(module, FOUNDER)
    c.propose_version(wid, terms(deadline="2026-09-25T00:00:00Z"))
    set_now("2026-09-21T00:00:01Z")
    with pytest.raises(err(module), match="await the provider's signature"):
        c.close_work_order(wid)
    set_now("2026-09-25T00:00:01Z")
    assert json.loads(c.close_work_order(wid))["state"] == "CLOSED"


def test_close_an_unsigned_order_after_its_deadline(module, c):
    from conftest import create_org, register, create_order
    oid = create_org(module, c)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    with pytest.raises(err(module), match="await the provider's signature"):
        c.close_work_order(wid)
    set_now("2026-10-20T12:00:01Z")
    assert json.loads(c.close_work_order(wid))["released_wei"] == str(2 * GEN)
    assert org(c, oid)["open_work_orders"] == 0


def test_close_within_a_rejections_window_after_deadline_waits(module, c):
    oid, aid, wid = active_order(module, c, deadline="2026-09-20T09:30:00Z")
    items = [image(module, c, wid), image(module, c, wid)]
    set_now("2026-09-20T09:20:00Z")
    assess(module, c, wid, items, judge=judge_all(crit_status="NOT_MET"))
    set_now("2026-09-20T09:31:00Z")
    with pytest.raises(err(module), match="appeal window is still open"):
        c.close_work_order(wid)
    set_now("2026-09-20T10:20:01Z")
    assert json.loads(c.close_work_order(wid))["state"] == "CLOSED"
