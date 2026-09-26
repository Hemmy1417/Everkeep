"""What an adversarial reading of the contract found before the final deploy,
pinned: a decided or lapsed appeal is final, a panel is not asked the same
question twice, the bound on additions runs from the decision, a new
signature clears the old decision, deadlines carry their zone, money is a
whole number, a pause takes no re-priced terms, and a model's malformed
answer cannot crash a leader."""
import json

import pytest

from conftest import (FOUNDER, GEN, PROVIDER, STEWARD2, STRANGER, active_order, as_, assess,
                      declaration, document, err, image, judge_all, llm, look_all, order, org,
                      prompts, rounds, set_now, terms)


def rejected(module, c, **kw):
    oid, aid, wid = active_order(module, c, **kw)
    items = [image(module, c, wid, crit="C1"), image(module, c, wid, crit="C2")]
    assess(module, c, wid, items, judge=judge_all(crit_status="NOT_MET"))
    return oid, aid, wid, items


# ── finality ─────────────────────────────────────────────────────────────────

def test_a_decided_appeal_is_final_for_these_terms(module, c):
    oid, aid, wid, items = rejected(module, c)
    as_(module, PROVIDER)
    c.open_appeal(wid, "The display reads 4.1 kW.")
    new = image(module, c, wid, caption="Display reading")
    set_now("2026-09-20T10:00:01Z")
    llm(look=[look_all(), look_all(1)], judge=judge_all(crit_status="NOT_MET"), default_basis=items[0])
    c.decide_appeal(wid)
    assert order(c, wid)["state"] == "REJECTED"
    another = image(module, c, wid, caption="Yet another view")
    with pytest.raises(err(module), match="appealed and is final"):
        assess(module, c, wid, items + [new, another])
    # new terms reopen the question, under a fresh signature
    as_(module, FOUNDER)
    c.propose_version(wid, terms())
    as_(module, PROVIDER)
    c.accept_work_order(wid, 2)
    w = order(c, wid)
    assert w["state"] == "AWAITING_EVIDENCE" and w["standing"] is None
    fresh = [image(module, c, wid), image(module, c, wid)]
    assert assess(module, c, wid, fresh)["decision"] == "ACCEPTED"


def test_a_lapsed_appeal_is_final_too(module, c):
    oid, aid, wid, items = rejected(module, c)
    as_(module, PROVIDER)
    c.open_appeal(wid, "grounds")
    set_now("2026-09-23T10:00:01Z")
    c.lapse_appeal(wid)
    new = image(module, c, wid)
    with pytest.raises(err(module), match="appealed and is final"):
        assess(module, c, wid, items + [new])
    set_now("2026-10-20T12:00:01Z")
    assert json.loads(c.close_work_order(wid))["released_wei"] == str(2 * GEN)


def test_a_panel_is_not_asked_the_same_question_twice(module, c):
    oid, aid, wid, items = rejected(module, c)
    with pytest.raises(err(module), match="not asked the same question twice"):
        assess(module, c, wid, items)
    # a steward's new document counts as something new, even unnamed
    document(module, c, wid, who=STEWARD2, title="Site note")
    out = assess(module, c, wid, items, judge=judge_all(crit_status="UNCLEAR"))
    assert out["round"] == 2
    with pytest.raises(err(module), match="not asked the same question twice"):
        assess(module, c, wid, items, judge=judge_all(crit_status="UNCLEAR"))
    # a declaration is never read, so it is not something new
    declaration(module, c, wid)
    with pytest.raises(err(module), match="not asked the same question twice"):
        assess(module, c, wid, items, judge=judge_all(crit_status="UNCLEAR"))
    new = image(module, c, wid)
    assert assess(module, c, wid, items + [new], look=[look_all(), look_all(1)])["round"] == 3


def test_additions_are_bounded_from_the_decision_not_the_appeal(module, c):
    oid, aid, wid, items = rejected(module, c)
    image(module, c, wid)
    image(module, c, wid)
    with pytest.raises(err(module), match="after a decision each party adds at most 2 new images"):
        image(module, c, wid)
    as_(module, PROVIDER)
    c.open_appeal(wid, "grounds")
    with pytest.raises(err(module), match="at most 2 new images"):
        image(module, c, wid)
    # the other parties have their own allowance
    image(module, c, wid, who=STEWARD2)
    set_now("2026-09-20T10:00:01Z")
    llm(look=[look_all(), look_all(), look_all(1)], judge=judge_all(), default_basis=items[0])
    out = json.loads(c.decide_appeal(wid))
    assert len(out["new_items"]) == 3


def test_a_new_signature_clears_the_old_decision_and_its_window(module, c):
    oid, aid, wid, items = rejected(module, c, deadline="2026-09-20T09:30:00Z")
    as_(module, FOUNDER)
    c.propose_version(wid, terms(deadline="2026-09-20T09:40:00Z"))
    as_(module, PROVIDER)
    c.accept_work_order(wid, 2)
    w = order(c, wid)
    assert w["standing"] is None and w["state"] == "AWAITING_EVIDENCE"
    # the old rejection's window (until 10:00) no longer holds the close
    set_now("2026-09-20T09:40:01Z")
    assert json.loads(c.close_work_order(wid))["state"] == "CLOSED"


# ── inputs ───────────────────────────────────────────────────────────────────

def test_a_deadline_without_a_timezone_is_refused(module, c):
    from conftest import create_org, register, create_order
    oid = create_org(module, c)
    aid = register(module, c, oid)
    with pytest.raises(err(module), match="with its timezone"):
        create_order(module, c, aid, deadline="2026-10-20T12:00:00")
    create_order(module, c, aid, deadline="2026-10-20T14:00:00+02:00")
    assert order(c, "wo-00001")["versions"][0]["deadline"] == "2026-10-20T12:00:00Z"


@pytest.mark.parametrize("value", [2.5e18, True, None, [1], "2e18"])
def test_money_is_a_whole_number_or_a_digit_string(module, c, value):
    from conftest import create_org, register, create_order
    oid = create_org(module, c)
    aid = register(module, c, oid)
    with pytest.raises(err(module), match="payment"):
        create_order(module, c, aid, payment_wei=value)
    as_(module, FOUNDER, 0)
    out = json.loads(c.create_organization(__import__("conftest").constitution(
        [FOUNDER], funding_rules={"max_payment_wei": value, "max_open_work_orders": 3})))
    assert out["refused"] is True and "whole number" in out["reason"]


def test_a_requirement_the_provider_could_never_present_alone_is_refused(module, c):
    from conftest import create_org, register, create_order
    oid = create_org(module, c)
    aid = register(module, c, oid)
    with pytest.raises(err(module), match="between 1 and 4"):
        create_order(module, c, aid, required_evidence=[{"type": "IMAGE", "min_count": 6}])


def test_a_pause_takes_no_re_priced_terms_but_a_pending_signature_stands(module, c):
    oid, aid, wid = active_order(module, c, escrow=10 * GEN)
    as_(module, FOUNDER)
    c.propose_version(wid, terms(payment_wei=str(3 * GEN)))
    c.pause_organization(oid, "audit")
    with pytest.raises(err(module), match="paused organisation proposes no new terms"):
        c.propose_version(wid, terms(payment_wei=str(GEN)))
    as_(module, PROVIDER)
    c.accept_work_order(wid, 2)
    assert org(c, oid)["committed_wei"] == str(3 * GEN)


# ── a model's answer cannot crash a node ─────────────────────────────────────

def test_malformed_reading_fields_are_read_as_nothing(module, c):
    oid, aid, wid = active_order(module, c)
    items = [image(module, c, wid), image(module, c, wid)]
    odd = {"images": [{"n": "1", "readable": True, "shows": "An inverter.", "labels": "MOD 4000",
                       "concerns": {"a": 1}},
                      {"n": [2], "readable": True, "shows": "A plate.", "labels": ["MOD 4000TL3-X"]}]}
    # image 2's number is unreadable, so that image counts as unread and the
    # node is blind to it: the round fails in words rather than crashing
    with pytest.raises(err(module), match="did not agree"):
        assess(module, c, wid, items, look=odd)
    assert not any("Traceback" in p or "TypeError" in p or "ValueError" in p for p in prompts())
    good = {"images": [{"n": "1", "readable": True, "shows": "An inverter.", "labels": "MOD 4000"},
                       {"n": 2.0, "readable": True, "shows": "A plate.", "labels": ["MOD 4000TL3-X"]}]}
    out = assess(module, c, wid, items, look=good)
    assert out["decision"] == "ACCEPTED"
    readings = rounds(c, wid, 1)["notes"]["images"]
    assert readings[0]["labels"] == [] and readings[1]["labels"] == ["MOD 4000TL3-X"]


def test_malformed_judgment_fields_fall_to_doubt_not_a_crash(module, c):
    oid, aid, wid = active_order(module, c)
    items = [image(module, c, wid), image(module, c, wid)]
    odd = {"reasoning": "x", "principles": "SATISFIED", "criteria": [{"id": "C1", "status": "MET",
                                                                       "basis": items[0]}],
           "conflicts_detected": False}
    out = assess(module, c, wid, items, judge=odd)
    assert out["decision"] == "UNDETERMINED"
    r = rounds(c, wid, 1)
    assert r["principles"] == {"P1": "UNCLEAR", "P2": "UNCLEAR", "P3": "UNCLEAR"}
    assert r["criteria"]["C1"] == "UNCLEAR"       # a string basis is no basis
