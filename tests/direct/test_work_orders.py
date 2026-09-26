"""Assets and work orders: the enforced half of the constitution, checked in
code at the write it governs, and the treasury commitments that follow."""
import json

import pytest

from conftest import (FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, as_, active_order,
                      create_order, create_org, err, order, org, register, set_now, terms)


# ── assets ───────────────────────────────────────────────────────────────────

def test_steward_registers_a_supported_asset(module, c):
    oid = create_org(module, c)
    aid = register(module, c, oid, who=STEWARD2)
    a = json.loads(c.get_asset(aid))
    assert a["infrastructure_type"] == "COMMUNITY_SOLAR" and a["status"] == "MONITORING"
    assert a["constitution_version"] == 1
    assert json.loads(c.list_assets(oid, 0, 10))["total"] == 1


def test_unsupported_type_is_refused_in_code(module, c):
    oid = create_org(module, c)
    with pytest.raises(err(module), match="does not support water system"):
        register(module, c, oid, infrastructure_type="WATER_SYSTEM")
    with pytest.raises(err(module), match="must be one of"):
        register(module, c, oid, infrastructure_type="BRIDGE")


def test_only_stewards_register_and_not_while_paused(module, c):
    oid = create_org(module, c)
    with pytest.raises(err(module), match="only a steward"):
        register(module, c, oid, who=STRANGER)
    as_(module, FOUNDER)
    c.pause_organization(oid, "x")
    with pytest.raises(err(module), match="paused"):
        register(module, c, oid)


def test_inspector_must_be_independent_and_must_accept(module, c):
    oid = create_org(module, c)
    with pytest.raises(err(module), match="must not be a steward"):
        register(module, c, oid, inspector=STEWARD2)
    aid = register(module, c, oid, inspector=INSPECTOR)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the inspector named"):
        c.accept_inspector_role(aid)
    as_(module, INSPECTOR)
    c.accept_inspector_role(aid)
    assert json.loads(c.get_asset(aid))["inspector_accepted_at"]
    with pytest.raises(err(module), match="already accepted"):
        c.accept_inspector_role(aid)


# ── work orders and the enforced half ────────────────────────────────────────

def test_creation_commits_the_payment_and_binds_the_constitution(module, c):
    oid = create_org(module, c, escrow=5 * GEN)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    w = order(c, wid)
    assert w["state"] == "PROPOSED" and w["constitution_version"] == 1
    assert w["committed_wei"] == str(2 * GEN)
    o = org(c, oid)
    assert o["committed_wei"] == str(2 * GEN) and o["available_wei"] == str(3 * GEN)
    assert o["open_work_orders"] == 1
    assert json.loads(c.get_asset(aid))["status"] == "UNDER_MAINTENANCE"
    mine = json.loads(c.work_orders_of(PROVIDER, 0, 10))
    assert mine["total"] == 1 and mine["work_orders"][0]["work_order_id"] == wid


def test_maintenance_type_outside_the_constitution_is_refused(module, c):
    oid = create_org(module, c)
    aid = register(module, c, oid)
    with pytest.raises(err(module), match="does not fund emergency repair"):
        create_order(module, c, aid, maintenance_type="EMERGENCY_REPAIR")


def test_payment_above_the_constitutions_cap_is_refused(module, c):
    oid = create_org(module, c, escrow=20 * GEN)
    aid = register(module, c, oid)
    with pytest.raises(err(module), match="exceeds the constitution's limit"):
        create_order(module, c, aid, payment_wei=str(4 * GEN))
    with pytest.raises(err(module), match="at least 0.01 GEN"):
        create_order(module, c, aid, payment_wei="1")


def test_open_work_order_cap_is_enforced(module, c):
    oid = create_org(module, c, escrow=20 * GEN)
    aid = register(module, c, oid)
    for _ in range(3):
        create_order(module, c, aid)
    with pytest.raises(err(module), match="limit on open work orders"):
        create_order(module, c, aid)


def test_treasury_cannot_fund_two_orders_from_the_same_gen(module, c):
    oid = create_org(module, c, escrow=3 * GEN)
    aid = register(module, c, oid)
    create_order(module, c, aid)
    with pytest.raises(err(module), match="less uncommitted"):
        create_order(module, c, aid)


def test_provider_cannot_be_a_steward_or_the_inspector(module, c):
    oid = create_org(module, c)
    aid = register(module, c, oid, inspector=INSPECTOR)
    with pytest.raises(err(module), match="steward cannot be the provider"):
        create_order(module, c, aid, provider=STEWARD2)
    with pytest.raises(err(module), match="inspector cannot be the provider"):
        create_order(module, c, aid, provider=INSPECTOR)


def test_inspection_report_rule_needs_an_inspector_on_the_asset(module, c):
    oid = create_org(module, c, evidence_rules={"min_images": 1, "inspection_report_required": True})
    aid = register(module, c, oid)
    with pytest.raises(err(module), match="names no inspector"):
        create_order(module, c, aid)


@pytest.mark.parametrize("over, phrase", [
    ({"acceptance_criteria": []}, "at least one acceptance criterion"),
    ({"title": ""}, "needs a title"),
    ({"requirements": "short"}, "at least 20 characters"),
    ({"deadline": "2026-09-19T00:00:00Z"}, "already passed"),
    ({"deadline": "2028-01-01T00:00:00Z"}, "more than a year"),
    ({"deadline": "soon"}, "ISO 8601"),
    ({"required_evidence": [{"type": "DRONE", "min_count": 1}]}, "type must be one of"),
    ({"required_evidence": [{"type": "IMAGE"}, {"type": "IMAGE"}]}, "names image twice"),
    ({"maintenance_type": "PAINTING"}, "maintenance type must be one of"),
])
def test_terms_validation_speaks(module, c, over, phrase):
    oid = create_org(module, c)
    aid = register(module, c, oid)
    with pytest.raises(err(module), match=phrase):
        create_order(module, c, aid, **over)


def test_a_later_amendment_does_not_reach_an_existing_order(module, c):
    """Terms proposed on an old order are validated against its own version."""
    oid = create_org(module, c, escrow=20 * GEN)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    as_(module, FOUNDER)
    c.propose_amendment(oid, json.dumps({**json.loads(
        __import__("conftest").constitution([FOUNDER, STEWARD2])),
        "approved_maintenance_types": ["INSPECTION"]}))
    set_now("2026-09-20T10:00:01Z")
    c.ratify_amendment(oid)
    assert org(c, oid)["constitution_version"] == 2
    as_(module, FOUNDER)
    out = json.loads(c.propose_version(wid, terms(payment_wei=str(GEN))))
    assert out["version"] == 2
    with pytest.raises(err(module), match="does not fund inverter repair"):
        create_order(module, c, aid)


# ── signing, versions, cancellation ──────────────────────────────────────────

def test_provider_signs_and_the_order_awaits_evidence(module, c):
    oid, aid, wid = active_order(module, c)
    w = order(c, wid)
    assert w["state"] == "AWAITING_EVIDENCE" and w["current_version"] == 1
    assert w["provider_accepted_at"]


def test_only_the_provider_signs_the_pending_version(module, c):
    oid = create_org(module, c)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the provider"):
        c.accept_work_order(wid, 1)
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="not the one awaiting"):
        c.accept_work_order(wid, 2)


def test_new_version_moves_the_commitment_when_signed(module, c):
    oid, aid, wid = active_order(module, c, escrow=10 * GEN)
    as_(module, FOUNDER)
    out = json.loads(c.propose_version(wid, terms(payment_wei=str(3 * GEN))))
    assert out["pending"] and order(c, wid)["committed_wei"] == str(2 * GEN)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 2)
    assert order(c, wid)["committed_wei"] == str(3 * GEN)
    assert org(c, oid)["committed_wei"] == str(3 * GEN)


def test_version_the_treasury_cannot_back_is_refused(module, c):
    oid, aid, wid = active_order(module, c, escrow=2 * GEN)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="less uncommitted"):
        c.propose_version(wid, terms(payment_wei=str(3 * GEN)))


def test_cancel_only_before_the_provider_signs(module, c):
    oid = create_org(module, c, escrow=5 * GEN)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward"):
        c.cancel_work_order(wid, "x")
    as_(module, STEWARD2)
    out = json.loads(c.cancel_work_order(wid, "Provider unavailable"))
    assert out["released_wei"] == str(2 * GEN)
    o = org(c, oid)
    assert o["committed_wei"] == "0" and o["open_work_orders"] == 0
    assert json.loads(c.get_asset(aid))["status"] == "MONITORING"
    wid2 = create_order(module, c, aid)
    as_(module, PROVIDER)
    c.accept_work_order(wid2, 1)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="not signed can be cancelled"):
        c.cancel_work_order(wid2, "x")


def test_paused_organisation_creates_no_orders_but_signing_continues(module, c):
    oid = create_org(module, c)
    aid = register(module, c, oid)
    wid = create_order(module, c, aid)
    as_(module, FOUNDER)
    c.pause_organization(oid, "x")
    with pytest.raises(err(module), match="paused"):
        create_order(module, c, aid)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 1)
    assert order(c, wid)["state"] == "AWAITING_EVIDENCE"
