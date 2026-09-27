"""After the first decision: appeal and readjudication with history kept,
finalization, settlement, closing, refunds, and the maintenance cycle that
returns the asset to monitoring so the next work order can follow."""
import json

import pytest

from conftest import (FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_, assess,
                      asset_view, commission, decision, document, err, judgment, llm, order, org, photo,
                      ratings, refund, seen, set_now, standard_file, transfers)


def decided(module, c, outcome="ACCEPTED", **kw):
    oid, aid, wid = active_order(module, c, **kw)
    standard_file(module, c, wid)
    j = {"ACCEPTED": judgment(ratings()), "REJECTED": judgment(ratings(P1="NOT_SATISFIED")),
         "UNDETERMINED": judgment(ratings(C2="NOT_ESTABLISHED"))}[outcome]
    out = assess(module, c, wid, judge=j)
    assert out["outcome"] == outcome
    return oid, aid, wid, out["decision_id"]


# ── finalization and settlement ──────────────────────────────────────────────

def test_an_acceptance_finalizes_after_its_window_then_settles(module, c):
    oid, aid, wid, did = decided(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="appeal window is still open"):
        c.finalize(wid)
    with pytest.raises(err(module), match="only a finalized acceptance"):
        c.settle(wid)
    set_now("2026-09-20T10:00:01Z")
    c.finalize(wid)
    assert decision(c, did)["lifecycle"] == "FINALIZED"
    o = org(c, oid)
    assert order(c, wid)["state"] == "PAYMENT_RELEASABLE" and o["releasable_wei"] == str(2 * GEN)
    a = asset_view(c, aid)
    assert a["status"] == "MONITORING" and a["last_serviced_at"] == "2026-09-20T10:00:01Z"
    assert a["service_log"][-1]["outcome"] == "ACCEPTED"
    assert a["next_service_due"] == "2027-03-19T10:00:01Z"
    out = json.loads(c.settle(wid))
    assert out["paid_wei"] == str(2 * GEN) and transfers() == [{"to": PROVIDER, "wei": 2 * GEN}]
    o = org(c, oid)
    assert o["escrow_wei"] == str(8 * GEN) and o["committed_wei"] == "0" and o["paid_wei"] == str(2 * GEN)
    assert o["releasable_wei"] == "0" and o["open_work_orders"] == 0
    assert order(c, wid)["settlement"]["to"] == PROVIDER
    with pytest.raises(err(module), match="only a finalized acceptance"):
        c.settle(wid)


def test_the_cycle_continues_after_settlement(module, c):
    oid, aid, wid, did = decided(module, c)
    set_now("2026-09-20T10:00:01Z")
    c.finalize(wid)
    c.settle(wid)
    wid2 = commission(module, c, aid, title="Six-month preventive inspection", maintenance_type="INSPECTION",
                      payment_wei=str(GEN), budget_wei=str(GEN))
    assert order(c, wid2)["state"] == "PROPOSED" and asset_view(c, aid)["status"] == "UNDER_MAINTENANCE"


def test_a_rejection_finalizes_unpaid_and_returns_the_commitment(module, c):
    oid, aid, wid, did = decided(module, c, "REJECTED")
    set_now("2026-09-20T10:00:01Z")
    c.finalize(wid)
    assert order(c, wid)["state"] == "CLOSED_UNPAID"
    o = org(c, oid)
    assert o["committed_wei"] == "0" and o["escrow_wei"] == str(10 * GEN) and o["open_work_orders"] == 0
    assert asset_view(c, aid)["service_log"][-1]["outcome"] == "REJECTED"
    assert asset_view(c, aid)["last_serviced_at"] is None


# ── appeals ──────────────────────────────────────────────────────────────────

def test_who_appeals_what(module, c):
    oid, aid, wid, did = decided(module, c)
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="only a steward appeals an acceptance"):
        c.open_appeal(wid, "more please")
    oid2, aid2, wid2, did2 = decided(module, c, "UNDETERMINED")
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="only the provider appeals"):
        c.open_appeal(wid2, "x")
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="state the grounds"):
        c.open_appeal(wid2, " ")
    out = json.loads(c.open_appeal(wid2, "The display reading was cropped; a clearer one follows."))
    assert out["appeal_of"] == did2 and decision(c, did2)["lifecycle"] == "APPEALED"
    assert order(c, wid2)["state"] == "UNDER_APPEAL" and org(c, oid2)["open_appeals"] == 1


def test_readjudication_links_and_preserves_history(module, c):
    oid, aid, wid, did = decided(module, c, "UNDETERMINED")
    as_(module, PROVIDER)
    c.open_appeal(wid, "A clearer reading follows.")
    new = photo(module, c, wid, view="METER_DISPLAY", description="Close-up of the display: 12.5 V")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the appellant"):
        c.readjudicate(wid)
    llm(look=[seen(2), seen(1)], judge=judgment(ratings()))
    as_(module, PROVIDER)
    out = json.loads(c.readjudicate(wid))
    assert out["appeal_of"] == did and out["outcome"] == "ACCEPTED"
    first, second = decision(c, did), decision(c, out["decision_id"])
    assert first["lifecycle"] == "SUPERSEDED" and first["superseded_by"] == second["decision_id"]
    assert first["outcome"] == "UNDETERMINED", "the original decision is never overwritten"
    assert second["kind"] == "READJUDICATION" and second["appeal_of"] == did
    assert second["appeal"]["reason"] == "A clearer reading follows."
    assert second["constitution_version"] == first["constitution_version"]
    snap = json.loads(c.get_snapshot(second["snapshot_id"]))
    assert [e["evidence_id"] for e in snap["evidence"] if e["new_on_appeal"]] == [new]
    assert second["appeals_left"] == 0, "the constitution allows one appeal"
    as_(module, STRANGER)
    c.finalize(wid)  # no appeal left: final at once
    assert order(c, wid)["state"] == "PAYMENT_RELEASABLE"


def test_a_steward_contests_an_acceptance_and_files_during_their_appeal(module, c):
    oid, aid, wid, did = decided(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "The reading is from a different controller.")
    photo(module, c, wid, who=STEWARD2, view="SITE", description="The board today")
    photo(module, c, wid, who=STEWARD2, view="SITE", description="Another angle")
    with pytest.raises(err(module), match="at most 2 new photographs"):
        photo(module, c, wid, who=STEWARD2, view="SITE")
    with pytest.raises(err(module), match="only the assigned provider"):
        photo(module, c, wid, who=FOUNDER, view="SITE")
    set_now("2026-09-20T10:00:01Z")
    with pytest.raises(err(module), match="evidence period has ended"):
        photo(module, c, wid, view="SITE")
    llm(look=[seen(2), seen(2)], judge=judgment(ratings(P1="NOT_SATISFIED")))
    as_(module, STRANGER)
    out = json.loads(c.readjudicate(wid))
    assert out["outcome"] == "REJECTED"


def test_one_appeal_then_final(module, c):
    oid, aid, wid, did = decided(module, c, "REJECTED")
    as_(module, PROVIDER)
    c.open_appeal(wid, "grounds")
    set_now("2026-09-20T10:00:01Z")
    llm(look=seen(2), judge=judgment(ratings(P1="NOT_SATISFIED")))
    as_(module, STRANGER)
    c.readjudicate(wid)
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="no further appeal"):
        c.open_appeal(wid, "again")


def test_an_appeal_nobody_decides_closes_unpaid(module, c):
    oid, aid, wid, did = decided(module, c, "REJECTED")
    as_(module, PROVIDER)
    c.open_appeal(wid, "grounds")
    set_now("2026-09-20T10:00:01Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="three days"):
        c.close_work_order(wid)
    with pytest.raises(err(module), match="finalized, not closed|no standing decision"):
        c.finalize(wid)
    set_now("2026-09-23T10:00:01Z")
    c.close_work_order(wid)
    assert order(c, wid)["state"] == "CLOSED_UNPAID" and org(c, oid)["open_appeals"] == 0
    assert decision(c, did)["notes"]["finalized_undecided_on_appeal"] is True
    assert decision(c, did)["lifecycle"] == "FINALIZED"


def test_a_decided_order_is_finalized_not_closed_and_terms_are_frozen(module, c):
    oid, aid, wid, did = decided(module, c, "UNDETERMINED")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="finalized, not closed"):
        c.close_work_order(wid)
    as_(module, FOUNDER)
    from conftest import terms
    with pytest.raises(err(module), match="once the work has been assessed"):
        c.propose_version(wid, terms())
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="assessment is requested once"):
        c.request_assessment(wid)


def test_active_work_closes_after_its_deadline(module, c):
    oid, aid, wid = active_order(module, c, deadline="2026-09-21T00:00:00Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="deadline has not passed"):
        c.close_work_order(wid)
    set_now("2026-09-21T00:00:01Z")
    assert json.loads(c.close_work_order(wid))["released_wei"] == str(2 * GEN)
    assert asset_view(c, aid)["service_log"][-1]["outcome"] == "CLOSED"


def test_emergency_work_uses_its_own_window(module, c):
    oid, aid, wid = active_order(module, c, maintenance_type="EMERGENCY_REPAIR")
    standard_file(module, c, wid)
    out = assess(module, c, wid, judge=json.loads(json.dumps(
        {"reasoning": "x", "requirements": [{"id": i, "status": "SATISFIED", "basis": ["ev-000001"]}
                                            for i in ("P1", "C1", "C2", "S1")],
         "evidence_sufficient": True, "conflicts_detected": False})))
    assert out["appeal_window_ends"] == "2026-09-20T09:30:00Z"


def test_refunds_are_drawn_once(module, c):
    as_(module, STRANGER, GEN)
    c.fund_treasury("org-09999")
    assert refund(c, STRANGER) == GEN
    json.loads(c.claim_refund())
    assert transfers() == [{"to": STRANGER, "wei": GEN}] and refund(c, STRANGER) == 0
    with pytest.raises(err(module), match="nothing is refundable"):
        c.claim_refund()
