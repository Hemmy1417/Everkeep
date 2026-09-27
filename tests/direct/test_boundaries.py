"""Both sides of every window and gate the mutation sweep showed the suite
was not yet pinning."""
import json

import pytest

from conftest import (BENEFICIARY, FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_,
                      assess, authorize, commission, constitution, create_org, decision, document, enrol, err,
                      forge_leader, judgment, llm, order, org, photo, prints, ratings, refund, seen, set_now,
                      standard_file)


def test_a_named_inspector_files_only_after_accepting(module, c):
    oid = create_org(module, c)
    authorize(module, c, oid)
    aid = enrol(module, c, oid, inspector=INSPECTOR)
    wid = commission(module, c, aid)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 1)
    with pytest.raises(err(module), match="only the assigned provider"):
        photo(module, c, wid, who=INSPECTOR, view="SITE")
    as_(module, INSPECTOR)
    c.accept_inspector_role(aid)
    photo(module, c, wid, who=INSPECTOR, view="SITE")


def test_assessment_is_refused_after_the_deadline(module, c):
    oid, aid, wid = active_order(module, c, deadline="2026-09-21T00:00:00Z")
    standard_file(module, c, wid)
    set_now("2026-09-21T00:00:01Z")
    with pytest.raises(err(module), match="deadline has passed; the work order can only be closed"):
        assess(module, c, wid)


def test_an_appeal_is_refused_after_its_window(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    assess(module, c, wid, judge=judgment(ratings(P1="NOT_SATISFIED")))
    set_now("2026-09-20T10:00:01Z")
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="appeal window has closed"):
        c.open_appeal(wid, "late")


def test_an_objection_is_refused_after_the_window(module, c):
    oid = create_org(module, c)
    as_(module, FOUNDER)
    c.propose_amendment(oid, constitution([FOUNDER, STEWARD2], BENEFICIARY))
    set_now("2026-09-20T10:00:01Z")
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="window has closed"):
        c.object_motion(oid, "too late")


def test_a_dissolving_treasury_takes_no_funds(module, c):
    oid = create_org(module, c)
    as_(module, FOUNDER)
    c.propose_dissolution(oid, "wind up")
    set_now("2026-09-20T10:00:01Z")
    c.enact_motion(oid)
    as_(module, STRANGER, GEN)
    out = json.loads(c.fund_treasury(oid))
    assert out["refused"] and "dissolving" in out["reason"]
    assert refund(c, STRANGER) == GEN and org(c, oid)["escrow_wei"] == str(10 * GEN)


def test_a_leader_result_with_an_unknown_rating_is_refused(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    llm(look=seen(2), judge=judgment(ratings()))
    rs = {i: "SATISFIED" for i in ("P1", "P3", "C1", "C2", "S1")}
    rs.update({"S2": "NOT_APPLICABLE", "S3": "GREAT"})
    forge_leader({"seen": True, "ratings": rs, "sufficient": True, "conflicts": False, "outcome": "ACCEPTED",
                  "notes": {}})
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="did not agree"):
        c.request_assessment(wid)
    assert any("did not rate every requirement" in p for p in prints())


def test_a_reading_that_never_says_seen_is_blind(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    silent = {"images": [{"n": 1, "shows": "A controller."}, {"n": 2, "shows": "A display."}]}
    with pytest.raises(err(module), match="did not agree"):
        assess(module, c, wid, look=silent, v_look=seen(2))


def test_validators_disagree_with_a_failed_leader(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    with pytest.raises(err(module), match="disagreed with the leader's failure"):
        assess(module, c, wid, judge=["not json", "still not json"])
    assert any("assessment failed" in p for p in prints())


def test_a_forged_leaders_notes_are_cut_to_shape(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    llm(look=seen(2), judge=judgment(ratings()), basis_default="ev-000001")
    rs = {i: "SATISFIED" for i in ("P1", "P3", "C1", "C2", "S1")}
    rs.update({"S2": "NOT_APPLICABLE", "S3": "NOT_APPLICABLE"})
    forge_leader({"seen": True, "ratings": rs, "sufficient": True, "conflicts": False, "outcome": "ACCEPTED",
                  "notes": {"reasoning": "y" * 9000, "injected": "x" * 90000, "raw": {"C1": "SATISFIED", "Z9": "HACK"}}})
    as_(module, PROVIDER)
    out = json.loads(c.request_assessment(wid))
    notes = decision(c, out["decision_id"])["notes"]
    assert "injected" not in notes and len(notes["reasoning"]) <= 1200 and notes["raw"] == {"C1": "SATISFIED"}
