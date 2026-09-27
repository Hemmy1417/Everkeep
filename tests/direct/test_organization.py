"""The organisation: founding under a first constitution, governance motions
(amendment and dissolution), pause, and the provider registry."""
import json

import pytest

from conftest import (BENEFICIARY, FOUNDER, GEN, PROVIDER, PROVIDER2, STEWARD2, STRANGER, as_,
                      authorize, commission, constitution, create_org, enrol, err, org, refund, set_now)


def test_founding_ratifies_v1_and_funds(module, c):
    oid = create_org(module, c, escrow=6 * GEN)
    o = org(c, oid)
    assert o["state"] == "ACTIVE" and o["constitution_version"] == 1
    assert o["escrow_wei"] == str(6 * GEN) and o["available_wei"] == str(6 * GEN)
    assert o["spendable_wei"] == str(5 * GEN), "the reserve floor is held back"
    v1 = json.loads(c.get_constitution(oid, 1))
    assert v1["effective_at"] and [p["id"] for p in v1["maintenance_principles"]] == ["P1", "P2", "P3"]
    assert v1["maintenance_principles"][1]["applies_to"] == ["BATTERY_SERVICE"]


def test_founder_must_be_a_steward_and_a_refusal_refunds(module, c):
    as_(module, FOUNDER, 2 * GEN)
    out = json.loads(c.create_organization(constitution([STEWARD2], BENEFICIARY)))
    assert out["refused"] and "founder must be among the stewards" in out["reason"]
    assert refund(c, FOUNDER) == 2 * GEN
    as_(module, FOUNDER, 0)
    assert json.loads(c.create_organization("{")) ["refused"]


@pytest.mark.parametrize("field, value, phrase", [
    ("maintenance_principles", [], "between one and"),
    ("supported_infrastructure_types", ["BRIDGE"], "not recognised"),
    ("eligibility_rules", {"approved_maintenance_types": []}, "between 1 and"),
    ("funding_rules", {"max_payment_wei": 2.5e18}, "whole number"),
    ("appeal_rules", {"appeal_window_seconds": 5, "evidence_period_seconds": 3600}, "appeal window"),
    ("evidence_requirements", [{"type": "DRONE_FOOTAGE"}], "not an evidence requirement"),
    ("governance", {"stewards": [FOUNDER], "motion_window_seconds": 3600}, "dissolution beneficiary"),
])
def test_constitution_validation_speaks(module, c, field, value, phrase):
    as_(module, FOUNDER, 0)
    out = json.loads(c.create_organization(constitution([FOUNDER], BENEFICIARY, **{field: value})))
    assert out["refused"] and phrase in out["reason"], out


def test_anyone_funds_and_a_dissolving_org_takes_nothing(module, c):
    oid = create_org(module, c, escrow=2 * GEN)
    as_(module, STRANGER, GEN)
    assert json.loads(c.fund_treasury(oid))["refused"] is False
    assert org(c, oid)["escrow_wei"] == str(3 * GEN)
    as_(module, STRANGER, 0)
    assert json.loads(c.fund_treasury(oid))["refused"] is True


# ── motions ──────────────────────────────────────────────────────────────────

def _amend(module, c, oid, who=FOUNDER, **over):
    as_(module, who)
    return json.loads(c.propose_amendment(oid, constitution([FOUNDER, STEWARD2, STRANGER], BENEFICIARY, **over)))


def test_amendment_waits_its_window_then_anyone_enacts(module, c):
    oid = create_org(module, c)
    out = _amend(module, c, oid)
    assert out["version"] == 2 and out["window_ends"] == "2026-09-20T10:00:00Z"
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="still open"):
        c.enact_motion(oid)
    set_now("2026-09-20T10:00:01Z")
    c.enact_motion(oid)
    o = org(c, oid)
    assert o["constitution_version"] == 2 and STRANGER in o["stewards"]
    assert o["motions"][-1]["state"] == "ENACTED" and o["motions"][-1]["enacted_by"] == PROVIDER


def test_one_steward_withdraws_a_motion_inside_its_window(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward"):
        c.object_motion(oid, "no")
    as_(module, STEWARD2)
    c.object_motion(oid, "It adds a steward nobody vetted.")
    o = org(c, oid)
    assert o["constitution_version"] == 1 and o["motion"]["state"] == "WITHDRAWN"
    assert _amend(module, c, oid)["version"] == 3, "withdrawn version numbers are not reused"


def test_one_motion_at_a_time_and_none_while_paused(module, c):
    oid = create_org(module, c)
    _amend(module, c, oid)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="already pending"):
        c.propose_dissolution(oid, "wind up")
    oid2 = create_org(module, c)
    as_(module, FOUNDER)
    c.pause_organization(oid2, "audit")
    with pytest.raises(err(module), match="paused organisation cannot take amendments"):
        _amend(module, c, oid2)


def test_dissolution_winds_down_and_refunds_the_beneficiary(module, c):
    oid = create_org(module, c, escrow=6 * GEN)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    wid = commission(module, c, aid)
    as_(module, STEWARD2)
    with pytest.raises(err(module), match="state the reason"):
        c.propose_dissolution(oid, " ")
    c.propose_dissolution(oid, "The site is being handed to the county.")
    set_now("2026-09-20T10:00:01Z")
    as_(module, STRANGER)
    c.enact_motion(oid)
    assert org(c, oid)["state"] == "DISSOLVING"
    with pytest.raises(err(module), match="dissolving organisation cannot commission"):
        commission(module, c, aid)
    with pytest.raises(err(module), match="work orders are still open"):
        c.complete_dissolution(oid)
    as_(module, FOUNDER)
    c.cancel_work_order(wid, "dissolving")
    as_(module, STRANGER)
    out = json.loads(c.complete_dissolution(oid))
    assert out["returned_wei"] == str(6 * GEN) and out["to"] == BENEFICIARY
    o = org(c, oid)
    assert o["state"] == "DISSOLVED" and o["escrow_wei"] == "0" and o["returned_wei"] == str(6 * GEN)
    assert refund(c, BENEFICIARY) == 6 * GEN


def test_pause_stops_new_commitments(module, c):
    oid = create_org(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward"):
        c.pause_organization(oid, "x")
    as_(module, FOUNDER)
    c.pause_organization(oid, "audit")
    for act in (lambda: enrol(module, c, oid), lambda: authorize(module, c, oid)):
        with pytest.raises(err(module), match="paused"):
            act()
    as_(module, FOUNDER)
    c.resume_organization(oid)
    enrol(module, c, oid)


# ── providers ────────────────────────────────────────────────────────────────

def test_provider_registry(module, c):
    oid = create_org(module, c)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward"):
        c.authorize_provider(oid, PROVIDER, '{"name": "x", "maintenance_types": ["INSPECTION"]}')
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="steward cannot be one of"):
        c.authorize_provider(oid, STEWARD2, '{"name": "x", "maintenance_types": ["INSPECTION"]}')
    with pytest.raises(err(module), match="does not fund"):
        c.authorize_provider(oid, PROVIDER, '{"name": "x", "maintenance_types": ["PREVENTIVE_MAINTENANCE"]}')
    authorize(module, c, oid)
    authorize(module, c, oid, who=PROVIDER2, maintenance_types=["INSPECTION"])
    listing = json.loads(c.list_providers(oid))
    assert listing["total"] == 2 and listing["providers"][0]["name"] == "Brightline Solar Services"
    as_(module, FOUNDER)
    c.revoke_provider(oid, PROVIDER2)
    with pytest.raises(err(module), match="not currently authorised"):
        c.revoke_provider(oid, PROVIDER2)


def test_a_revoked_or_unauthorised_provider_cannot_be_assigned(module, c):
    oid = create_org(module, c)
    aid = enrol(module, c, oid)
    with pytest.raises(err(module), match="not authorised by this organisation"):
        commission(module, c, aid)
    authorize(module, c, oid, maintenance_types=["INSPECTION"])
    with pytest.raises(err(module), match="provider is not authorised for component replacement"):
        commission(module, c, aid)
    authorize(module, c, oid)
    as_(module, FOUNDER)
    c.revoke_provider(oid, PROVIDER)
    with pytest.raises(err(module), match="not authorised by this organisation"):
        commission(module, c, aid)


def test_views_and_events(module, c):
    oid = create_org(module, c)
    ev = json.loads(c.get_events(oid, 0, 10))["events"]
    assert [e["kind"] for e in ev][::-1][:2] == ["ORGANIZATION_FOUNDED", "CONSTITUTION_IN_FORCE"]
    assert json.loads(c.list_organizations(0, 5))["total"] == 1
    cfg = json.loads(c.get_config())
    assert cfg["ruleset"] == "everkeep-rules-2" and len(cfg["system_requirements"]) == 3
