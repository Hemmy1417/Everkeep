"""What an adversarial reading of the rebuilt contract found before the
deployment of record, each finding pinned so it cannot come back."""
import json

import pytest

from conftest import (BENEFICIARY, FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_,
                      assess, commission, constitution, decision, err, judgment, order, org, photo, ratings,
                      set_now, standard_file, terms)


def test_a_criterion_can_never_be_waived_as_not_applicable(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    out = assess(module, c, wid, judge=judgment(ratings(C1="NOT_APPLICABLE", C2="NOT_APPLICABLE",
                                                       P1="NOT_APPLICABLE", P3="NOT_APPLICABLE")))
    assert out["outcome"] == "UNDETERMINED"
    d = decision(c, out["decision_id"])
    rs = {r["id"]: r["status"] for r in d["requirements"]}
    assert rs["C1"] == rs["C2"] == "NOT_ESTABLISHED" and rs["P1"] == "NOT_APPLICABLE"


def test_an_acceptance_left_undecided_on_appeal_still_pays(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    did = assess(module, c, wid)["decision_id"]
    as_(module, STEWARD2)
    c.open_appeal(wid, "I doubt it")
    set_now("2026-09-23T10:00:01Z")
    as_(module, STRANGER)
    assert json.loads(c.close_work_order(wid))["state"] == "PAYMENT_RELEASABLE"
    assert decision(c, did)["lifecycle"] == "FINALIZED"
    assert json.loads(c.settle(wid))["paid_wei"] == str(2 * GEN)
    assert org(c, oid)["open_appeals"] == 0


def test_a_provider_who_used_their_quota_can_still_answer_an_appeal(module, c):
    oid, aid, wid = active_order(module, c)
    for view in ("AFTER", "METER_DISPLAY", "SITE", "SITE", "SITE", "SITE"):
        photo(module, c, wid, view=view)
    out = assess(module, c, wid, judge=judgment(ratings(C2="NOT_ESTABLISHED")), look=[{"images": [
        {"n": i, "seen": True, "shows": "x", "text": [], "readings": []} for i in (1, 2)]}] * 3)
    as_(module, PROVIDER)
    c.open_appeal(wid, "A clearer reading follows.")
    photo(module, c, wid, view="METER_DISPLAY")


def test_independence_is_checked_against_the_stewards_in_force(module, c):
    oid, aid, wid = active_order(module, c, inspector=INSPECTOR)
    as_(module, FOUNDER)
    c.propose_amendment(oid, constitution([FOUNDER, STEWARD2, INSPECTOR, PROVIDER], BENEFICIARY))
    set_now("2026-09-20T10:00:01Z")
    c.enact_motion(oid)
    with pytest.raises(err(module), match="only the assigned provider"):
        photo(module, c, wid, who=INSPECTOR, view="SITE")
    with pytest.raises(err(module), match="steward cannot be paid"):
        commission(module, c, aid)


def test_no_larger_commitment_while_paused(module, c):
    oid, aid, wid = active_order(module, c)
    as_(module, FOUNDER)
    c.propose_version(wid, terms(payment_wei=str(3 * GEN), budget_wei=str(3 * GEN)))
    c.pause_organization(oid, "audit")
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="paused organisation takes on no larger commitment"):
        c.accept_work_order(wid, 2)


def test_a_pending_revision_does_not_hold_an_expired_order_open(module, c):
    oid, aid, wid = active_order(module, c, deadline="2026-09-21T00:00:00Z")
    as_(module, FOUNDER)
    c.propose_version(wid, terms(deadline="2027-09-01T00:00:00Z"))
    set_now("2026-09-21T00:00:01Z")
    as_(module, STRANGER)
    assert json.loads(c.close_work_order(wid))["state"] == "CLOSED_UNPAID"


def test_required_evidence_must_be_a_list(module, c):
    oid, aid, wid = active_order(module, c)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="must be a list"):
        c.propose_version(wid, terms(required_evidence=5))


def test_the_leaders_notes_are_cut_to_shape(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    big = judgment(ratings())
    big["reasoning"] = "x" * 50_000
    out = assess(module, c, wid, judge=big)
    notes = decision(c, out["decision_id"])["notes"]
    assert len(notes["reasoning"]) <= 1200 and set(notes) == {
        "reasoning", "conflict_note", "raw", "basis", "requirement_notes", "observations"}
