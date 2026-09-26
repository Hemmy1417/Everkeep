"""The organisation and its constitution: creation, the payable refusal path,
amendments through a window, objections, pause and resume, and the fact that
no owner or administrator exists."""
import json

import pytest

from conftest import (FOUNDER, GEN, PROVIDER, STEWARD2, STRANGER, as_, claimable, constitution,
                      create_org, err, org, set_now)


def test_founder_ratifies_v1_and_funds_in_one_act(module, c):
    oid = create_org(module, c, escrow=4 * GEN)
    o = org(c, oid)
    assert o["state"] == "ACTIVE"
    assert o["constitution_version"] == 1
    assert o["escrow_wei"] == str(4 * GEN)
    assert o["available_wei"] == str(4 * GEN)
    assert o["stewards"] == [FOUNDER, STEWARD2]
    v1 = json.loads(c.get_constitution(oid, 1))
    assert v1["effective_at"] and v1["ratified_by"] == FOUNDER
    assert [p["id"] for p in v1["principles"]] == ["P1", "P2", "P3"]


def test_founder_must_sit_among_the_stewards(module, c):
    as_(module, FOUNDER, 2 * GEN)
    out = json.loads(c.create_organization(constitution([STEWARD2])))
    assert out["refused"] is True
    assert "founder must be among the stewards" in out["reason"]


def test_refused_creation_credits_the_value_back(module, c):
    as_(module, FOUNDER, 2 * GEN)
    out = json.loads(c.create_organization("not json"))
    assert out["refused"] is True and "claimable back" in out["reason"]
    assert claimable(c, FOUNDER) == 2 * GEN
    assert json.loads(c.get_stats())["organizations"] == 0


@pytest.mark.parametrize("field, value, phrase", [
    ("principles", [], "at least one maintenance principle"),
    ("principles", [{"text": "short"}], "at least 12 characters"),
    ("supported_infrastructure_types", ["BRIDGES"], "not one of"),
    ("approved_maintenance_types", [], "between one and"),
    ("stewards", [], "between one and"),
    ("mission", "too short", "at least 20 characters"),
    ("funding_rules", {"max_payment_wei": "1", "max_open_work_orders": 1}, "maximum payment"),
    ("funding_rules", {"max_payment_wei": str(GEN), "max_open_work_orders": 99}, "open work orders"),
    ("windows", {"appeal_window_seconds": 5, "amendment_window_seconds": 3600}, "appeal window"),
    ("windows", {"appeal_window_seconds": 3600, "amendment_window_seconds": 5}, "amendment window"),
    ("evidence_rules", {"min_images": 0}, "minimum number of images"),
])
def test_constitution_validation_speaks(module, c, field, value, phrase):
    as_(module, FOUNDER, 0)
    doc = constitution(value) if field == "stewards" else constitution([FOUNDER], **{field: value})
    out = json.loads(c.create_organization(doc))
    assert out["refused"] is True
    assert phrase in out["reason"], out


def test_no_method_reads_the_deployer(module, c):
    """There is no owner: the deployer's address appears nowhere a rule reads."""
    src = open(module.__file__, encoding="utf-8").read()
    body = src.split("def __init__(self):", 1)[1]
    assert "self.deployer" not in body.split("def _sender", 1)[1]


def test_anyone_may_fund_and_nothing_withdraws(module, c):
    oid = create_org(module, c, escrow=GEN)
    as_(module, STRANGER, 3 * GEN)
    out = json.loads(c.fund_treasury(oid))
    assert out["refused"] is False
    assert org(c, oid)["escrow_wei"] == str(4 * GEN)
    assert not hasattr(c, "withdraw_treasury") and not hasattr(c, "withdraw_escrow")


def test_funding_nothing_or_an_unknown_org_credits_back(module, c):
    oid = create_org(module, c, escrow=GEN)
    as_(module, STRANGER, 0)
    assert json.loads(c.fund_treasury(oid))["refused"] is True
    as_(module, STRANGER, GEN)
    out = json.loads(c.fund_treasury("org-09999"))
    assert out["refused"] is True
    assert claimable(c, STRANGER) == GEN


# ── amendments ───────────────────────────────────────────────────────────────

def _amend(module, c, oid, who=FOUNDER, **over):
    as_(module, who)
    return json.loads(c.propose_amendment(oid, constitution([FOUNDER, STEWARD2, PROVIDER], **over)))


def test_only_a_steward_proposes(module, c):
    oid = create_org(module, c)
    with pytest.raises(err(module), match="only a steward"):
        _amend(module, c, oid, who=STRANGER)


def test_amendment_takes_effect_after_the_window_by_anyone(module, c):
    oid = create_org(module, c)
    out = _amend(module, c, oid)
    assert out["version"] == 2 and out["window_ends"] == "2026-09-20T10:00:00Z"
    assert org(c, oid)["constitution_version"] == 1
    as_(module, STRANGER)
    with pytest.raises(err(module), match="still open"):
        c.ratify_amendment(oid)
    set_now("2026-09-20T10:00:01Z")
    out = json.loads(c.ratify_amendment(oid))
    assert out["constitution_version"] == 2
    o = org(c, oid)
    assert o["constitution_version"] == 2 and o["amendment"]["state"] == "EFFECTIVE"
    assert o["stewards"] == [FOUNDER, STEWARD2, PROVIDER]
    v2 = json.loads(c.get_constitution(oid, 2))
    assert v2["ratified_by"] == STRANGER and v2["effective_at"] == "2026-09-20T10:00:01Z"


def test_ratify_needs_a_window_that_has_passed_not_merely_a_pending_one(module, c):
    oid = create_org(module, c)
    with pytest.raises(err(module), match="no amendment is pending"):
        c.ratify_amendment(oid)


def test_a_stewards_objection_withdraws_inside_the_window(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="state the objection"):
        c.object_amendment(oid, "  ")
    out = json.loads(c.object_amendment(oid, "The new steward list drops the treasurer."))
    assert out["state"] == "WITHDRAWN"
    assert org(c, oid)["constitution_version"] == 1
    set_now("2026-09-20T11:00:00Z")
    with pytest.raises(err(module), match="no amendment is pending"):
        c.ratify_amendment(oid)


def test_objection_after_the_window_is_too_late(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    set_now("2026-09-20T10:00:01Z")
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="window has closed"):
        c.object_amendment(oid, "Too late but trying.")


def test_a_stranger_or_a_future_steward_cannot_object(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    for who in (STRANGER, PROVIDER):
        as_(module, who)
        with pytest.raises(err(module), match="only a steward"):
            c.object_amendment(oid, "I object.")


def test_one_pending_amendment_at_a_time(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    with pytest.raises(err(module), match="already pending"):
        _amend(module, c, oid)


def test_withdrawn_amendment_keeps_its_version_number(module, c):
    """Versions are never reused: a withdrawn v2 leaves the next proposal v3."""
    oid = create_org(module, c)
    _amend(module, c, oid)
    as_(module, STEWARD2)
    c.object_amendment(oid, "No.")
    assert _amend(module, c, oid)["version"] == 3


def test_amendment_window_is_the_current_constitutions(module, c):
    oid = create_org(module, c, windows={"appeal_window_seconds": 3600,
                                         "amendment_window_seconds": 7200})
    out = _amend(module, c, oid, windows={"appeal_window_seconds": 3600,
                                          "amendment_window_seconds": 600})
    assert out["window_ends"] == "2026-09-20T11:00:00Z"


def test_new_stewards_govern_only_once_effective(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    set_now("2026-09-20T10:00:01Z")
    c.ratify_amendment(oid)
    as_(module, PROVIDER)
    out = json.loads(c.pause_organization(oid, "audit"))
    assert out["state"] == "PAUSED"


# ── pause ────────────────────────────────────────────────────────────────────

def test_pause_refuses_new_commitments_and_resume_restores(module, c):
    oid = create_org(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward"):
        c.pause_organization(oid, "x")
    as_(module, STEWARD2)
    c.pause_organization(oid, "Treasury audit")
    assert org(c, oid)["state"] == "PAUSED"
    with pytest.raises(err(module), match="paused"):
        _amend(module, c, oid)
    with pytest.raises(err(module), match="already paused"):
        c.pause_organization(oid, "again")
    c.resume_organization(oid)
    assert org(c, oid)["state"] == "ACTIVE"
    with pytest.raises(err(module), match="not paused"):
        c.resume_organization(oid)


def test_events_and_listing(module, c):
    oid = create_org(module, c)
    ev = json.loads(c.get_events(oid, 0, 10))["events"]
    assert [e["kind"] for e in ev][::-1][:2] == ["ORGANIZATION_CREATED", "CONSTITUTION_EFFECTIVE"]
    listing = json.loads(c.list_organizations(0, 10))
    assert listing["total"] == 1 and listing["organizations"][0]["organization_id"] == oid
    cfg = json.loads(c.get_config())
    assert cfg["ruleset"] == "everkeep-rules-1"
    assert "COMMUNITY_SOLAR" in cfg["infrastructure_types"]
