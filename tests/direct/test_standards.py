"""The judges' standards this ruleset answers, each pinned by a test.

S42 and S8/S27, interested-party floors, mirrored: no finding rests only on
the photographs of the party it favours when anything else could carry it.
S22: insufficiency gates every conclusive verdict. S35: one piece of
evidence counts once. S16: the record obeys the rating rules whoever wrote
it. S21: the record says what consensus bound. S43: a steward is recorded
only on their own acceptance. S26: an abandoned organisation can dissolve.
S30: two orders cannot both draw on money that funds one. S31/S44: the
panel is told labels are claims and what a conflict is.
"""
import json

import pytest

from conftest import (FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_, assess, asset_view,
                      commission, create_org, authorize, decision, document, enrol, err, jfif, judgment, llm,
                      network_accepts, order, org, photo, prompts, ratings, seen, set_now, standard_file)


def _accepted(module, c, **kw):
    oid, aid, wid = active_order(module, c, **kw)
    standard_file(module, c, wid)
    out = assess(module, c, wid)
    assert out["outcome"] == "ACCEPTED"
    return oid, aid, wid, out["decision_id"]


# ── S42: the payer's own photographs cannot sink the payment alone ──────────

def test_a_stewards_own_photographs_alone_cannot_fail_a_requirement(module, c):
    oid, aid, wid, did = _accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "The board shows a different controller.")
    s1 = photo(module, c, wid, who=STEWARD2, view="SITE", description="Another board")
    s2 = photo(module, c, wid, who=STEWARD2, view="SITE", description="Another angle")
    llm(look=[seen(2), seen(2)], judge=judgment(ratings(P1="NOT_SATISFIED"), basis={"P1": [s1, s2]}))
    as_(module, STEWARD2)
    out = json.loads(c.readjudicate(wid))
    d = decision(c, out["decision_id"])
    assert d["outcome"] == "UNDETERMINED" and "P1" in d["not_established"] and d["failed"] == []


def test_a_stewards_photographs_beside_the_providers_can_fail_it(module, c):
    oid, aid, wid, did = _accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "The provider's own photograph shows loose cabling.")
    s1 = photo(module, c, wid, who=STEWARD2, view="SITE", description="The loose cable")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings(P1="NOT_SATISFIED"), basis={"P1": [s1, "ev-000001"]}))
    as_(module, STEWARD2)
    out = json.loads(c.readjudicate(wid))
    assert out["outcome"] == "REJECTED" and decision(c, out["decision_id"])["failed"] == ["P1"]


def test_a_stewards_photographs_can_confirm_the_work(module, c):
    """Against their own interest, a steward's photographs count in full."""
    oid, aid, wid, did = _accepted(module, c)
    as_(module, STEWARD2)
    c.open_appeal(wid, "Checking the mounting myself.")
    s1 = photo(module, c, wid, who=STEWARD2, view="SITE", description="The board today")
    llm(look=[seen(2), seen(1)], judge=judgment(ratings(), basis={i: [s1] for i in ratings()}))
    as_(module, STEWARD2)
    assert json.loads(c.readjudicate(wid))["outcome"] == "ACCEPTED"


# ── S8 / S27: the provider's photographs alone cannot pass it past an inspector

def test_with_an_inspector_the_providers_photographs_alone_do_not_accept(module, c):
    oid, aid, wid = active_order(module, c, inspector=INSPECTOR)
    standard_file(module, c, wid)
    out = assess(module, c, wid)
    d = decision(c, out["decision_id"])
    assert d["outcome"] == "UNDETERMINED"
    assert set(d["not_established"]) == {i for i in ratings() if i[0] in "PC"}


def test_with_an_inspector_their_observation_carries_the_acceptance(module, c):
    oid, aid, wid = active_order(module, c, inspector=INSPECTOR)
    standard_file(module, c, wid)
    rep = document(module, c, wid, who=INSPECTOR, doc_type="INSPECTION_CHECKLIST",
                   text="Controller fixed to the board, cables landed, display reads 12.5 V.")
    backed = {i: ["ev-000001", rep] for i in ratings() if i[0] in "PC"}
    assert assess(module, c, wid, judge=judgment(ratings(), basis=backed))["outcome"] == "ACCEPTED"


def test_without_an_inspector_the_providers_photographs_are_the_record(module, c):
    oid, aid, wid, did = _accepted(module, c)
    assert decision(c, did)["outcome"] == "ACCEPTED"


# ── S22: no conclusive verdict on evidence found not enough ──────────────────

def test_a_failure_on_insufficient_evidence_is_undetermined_not_rejected(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    out = assess(module, c, wid, judge=judgment(ratings(P1="NOT_SATISFIED"), sufficient=False))
    d = decision(c, out["decision_id"])
    assert d["outcome"] == "UNDETERMINED" and d["evidence_sufficient"] is False


def test_the_published_rule_puts_insufficiency_first(module, c):
    rule = json.loads(c.get_config())["decision_rule"]
    assert rule[0].startswith("conflicting evidence, or evidence insufficient")


# ── S35: one piece of evidence counts once ───────────────────────────────────

def test_the_same_photograph_cannot_be_filed_twice(module, c):
    oid, aid, wid = active_order(module, c)
    data = jfif(b"one photograph")
    photo(module, c, wid, view="BEFORE", data=data)
    with pytest.raises(err(module), match="already on file as ev-000001"):
        photo(module, c, wid, view="AFTER", data=data)


def test_the_same_document_cannot_be_filed_twice(module, c):
    oid, aid, wid = active_order(module, c)
    document(module, c, wid, text="Replaced the controller.")
    with pytest.raises(err(module), match="already on file"):
        document(module, c, wid, doc_type="INVOICE", text="Replaced the controller.")


# ── S16 + S21: the record obeys the rules and names what was bound ───────────

def test_a_leader_cannot_record_a_criterion_as_not_applicable(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    forged = ratings(C1="NOT_APPLICABLE", C2="NOT_APPLICABLE")
    forged.update({"S1": "SATISFIED", "S2": "NOT_APPLICABLE", "S3": "NOT_APPLICABLE"})
    network_accepts({"seen": True, "ratings": forged, "sufficient": True, "conflicts": False,
                     "notes": {"basis": {i: ["ev-000001"] for i in forged}}})
    as_(module, PROVIDER)
    out = json.loads(c.request_assessment(wid))
    d = decision(c, out["decision_id"])
    assert d["outcome"] == "UNDETERMINED"
    assert {"C1", "C2"} <= set(d["not_established"])


def test_a_rejection_records_the_requirements_every_validator_failed(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    rej = decision(c, assess(module, c, wid, judge=judgment(ratings(P1="NOT_SATISFIED")))["decision_id"])
    assert rej["bound"] == {"outcome": True, "requirements": ["P1"], "ratings_by": "leader"}


def test_an_acceptance_records_that_no_requirement_is_unmet(module, c):
    oid, aid, wid, did = _accepted(module, c)
    acc = decision(c, did)
    assert acc["bound"]["requirements"] == [r["id"] for r in acc["requirements"]]


def test_doubt_binds_only_the_outcome(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    und = decision(c, assess(module, c, wid, judge=judgment(ratings(C2="NOT_ESTABLISHED")))["decision_id"])
    assert und["bound"]["requirements"] == []


# ── S43: a steward is recorded only on their own acceptance ──────────────────

def test_a_named_steward_holds_no_power_until_they_accept(module, c):
    oid = create_org(module, c, accept=False)
    assert org(c, oid)["accepted_stewards"] == [FOUNDER]
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="who has accepted the role"):
        c.pause_organization(oid, "")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a wallet the constitution in force names"):
        c.accept_steward_role(oid)
    as_(module, STEWARD2)
    c.accept_steward_role(oid)
    with pytest.raises(err(module), match="already accepted"):
        c.accept_steward_role(oid)
    assert set(org(c, oid)["accepted_stewards"]) == {FOUNDER, STEWARD2}
    c.pause_organization(oid, "")
    assert org(c, oid)["state"] == "PAUSED"


def test_a_named_steward_is_never_the_independent_inspector(module, c):
    """Independence uses everyone named, accepted or not."""
    oid = create_org(module, c, accept=False)
    authorize(module, c, oid)
    as_(module, FOUNDER)
    with pytest.raises(err(module)):
        enrol(module, c, oid, inspector=STEWARD2)


# ── S26: an abandoned organisation does not strand its treasury ──────────────

def test_an_abandoned_organisation_can_be_dissolved_by_anyone(module, c):
    set_now("2026-09-01T00:00:00Z")
    oid = create_org(module, c)
    as_(module, STRANGER)
    set_now("2027-08-01T00:00:00Z")
    with pytest.raises(err(module), match="within the last 365 days"):
        c.dissolve_abandoned(oid)
    set_now("2027-09-03T00:00:00Z")
    assert json.loads(c.dissolve_abandoned(oid))["state"] == "DISSOLVING"
    out = json.loads(c.complete_dissolution(oid))
    assert out["state"] == "DISSOLVED" and int(out["returned_wei"]) == 10 * GEN


def test_any_steward_act_keeps_it_alive(module, c):
    set_now("2026-09-01T00:00:00Z")
    oid = create_org(module, c)
    set_now("2027-06-01T00:00:00Z")
    as_(module, FOUNDER)
    c.pause_organization(oid, "")
    set_now("2027-09-03T00:00:00Z")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="within the last 365 days"):
        c.dissolve_abandoned(oid)


# ── S30: two orders cannot both draw on money that funds one ────────────────

def test_two_orders_cannot_both_commit_the_last_free_money(module, c):
    oid = create_org(module, c, escrow=4 * GEN)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    free = int(org(c, oid)["spendable_wei"])
    first = commission(module, c, aid, payment_wei=str(free), budget_wei=str(free))
    assert order(c, first)["state"] == "PROPOSED"
    with pytest.raises(err(module)):
        commission(module, c, aid, payment_wei=str(free), budget_wei=str(free))
    o = org(c, oid)
    assert int(o["committed_wei"]) == free and int(o["spendable_wei"]) == 0


# ── S31 / S44: what the panel is told ────────────────────────────────────────

def test_the_panel_is_told_labels_are_claims_and_what_a_conflict_is(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    assess(module, c, wid)
    judge = prompts("judge", "leader")[-1]["prompt"]
    assert "counts against the filer's claim, never for it" in judge
    assert "name two specific pieces of evidence, by id" in judge
    assert "enough to decide this work order either way" in judge
    assert "interested party's evidence" in judge


# ── S10: records keep a bounded history ──────────────────────────────────────

def test_the_service_log_keeps_a_running_total(module, c):
    oid, aid, wid, did = _accepted(module, c)
    a = asset_view(c, aid)
    assert a["work_order_total"] == 1 and len(a["work_orders"]) == 1


# ── the vote itself, not only the record ─────────────────────────────────────
# The record is reshaped after consensus, so these pin the rules where they
# change a validator's vote: a validator whose model waives a criterion or an
# S check must not see an acceptance the leader rightly withholds.

def test_a_validator_cannot_waive_a_criterion_into_an_acceptance(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    llm(look=seen(2), judge=judgment(ratings(C1="NOT_ESTABLISHED")),
        v_look=seen(2), v_judge=judgment(ratings(C1="NOT_APPLICABLE")))
    as_(module, PROVIDER)
    out = json.loads(c.request_assessment(wid))
    assert out["outcome"] == "UNDETERMINED"


def test_a_validator_cannot_waive_a_system_check_into_an_acceptance(module, c):
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    llm(look=seen(2), judge=judgment(ratings(S1="NOT_ESTABLISHED")),
        v_look=seen(2), v_judge=judgment(ratings(S1="NOT_APPLICABLE")))
    as_(module, PROVIDER)
    out = json.loads(c.request_assessment(wid))
    assert out["outcome"] == "UNDETERMINED"


def test_an_inspector_who_never_accepted_does_not_raise_the_floor(module, c):
    """Named but not accepted, the inspector is not on the asset's record as
    independent: the provider's photographs remain the site record."""
    oid = create_org(module, c)
    authorize(module, c, oid)
    as_(module, FOUNDER)
    aid = enrol(module, c, oid, inspector=INSPECTOR)
    wid = commission(module, c, aid)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 1)
    standard_file(module, c, wid)
    assert assess(module, c, wid)["outcome"] == "ACCEPTED"


# ── the examination looks before it reads the claim ─────────────────────────

def test_the_examination_never_sees_the_submitters_description(module, c):
    """Shown the claim, a node can repeat it instead of looking; live, one
    described a charge controller in a photograph of a solar panel's back."""
    oid, aid, wid = active_order(module, c)
    photo(module, c, wid, view="AFTER", description="The new charge controller fixed to the board")
    photo(module, c, wid, view="METER_DISPLAY", description="Controller display reading")
    assess(module, c, wid)
    look = prompts("look", "leader")[-1]["prompt"]
    assert "The new charge controller fixed to the board" not in look
    assert "if it shows something else, say what it actually shows" in look
    judge = prompts("judge", "leader")[-1]["prompt"]
    assert "the filer's own description, a claim" in judge and "The new charge controller fixed to the board" in judge


def test_the_panel_is_told_what_s1_and_a_small_reading_difference_mean(module, c):
    """Live, S1 split panels that read it as proof of identity, and a
    reading of 12.8 V beside a report of 12.5 V was raised as a conflict."""
    oid, aid, wid = active_order(module, c)
    standard_file(module, c, wid)
    assess(module, c, wid)
    judge = prompts("judge", "leader")[-1]["prompt"]
    assert "It does not ask for proof of identity" in judge
    assert "a reading that differs slightly but meets the same requirement" in judge
