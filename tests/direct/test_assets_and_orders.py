"""The infrastructure registry and work orders: the enforced half of the
constitution, checked in code, and the treasury commitments that follow."""
import json

import pytest

from conftest import (FOUNDER, GEN, INSPECTOR, PROVIDER, STEWARD2, STRANGER, active_order, as_, asset_view,
                      authorize, commission, create_org, enrol, err, order, org, set_now, terms)


def test_asset_enrolment_and_derived_status(module, c):
    oid = create_org(module, c)
    aid = enrol(module, c, oid)
    a = asset_view(c, aid)
    assert a["status"] == "MONITORING" and a["next_service_due"] == "2027-03-19T09:00:00Z"
    set_now("2027-03-20T00:00:00Z")
    assert asset_view(c, aid)["status"] == "SERVICE_DUE"
    with pytest.raises(err(module), match="does not support water system"):
        enrol(module, c, oid, asset_type="WATER_SYSTEM")
    with pytest.raises(err(module), match="must not be a steward"):
        enrol(module, c, oid, inspector=STEWARD2)
    with pytest.raises(err(module), match="YYYY-MM-DD"):
        enrol(module, c, oid, installation_date="May 2024")
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only a steward"):
        c.register_asset(oid, "{}")


def test_inspector_accepts_and_retirement(module, c):
    oid = create_org(module, c)
    aid = enrol(module, c, oid, inspector=INSPECTOR)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the inspector"):
        c.accept_inspector_role(aid)
    as_(module, INSPECTOR)
    c.accept_inspector_role(aid)
    authorize(module, c, oid)
    wid = commission(module, c, aid)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="open work orders"):
        c.retire_asset(aid, "replaced")
    c.cancel_work_order(wid, "not needed")
    c.retire_asset(aid, "replaced by a new bank")
    assert asset_view(c, aid)["status"] == "RETIRED"
    with pytest.raises(err(module), match="retired"):
        commission(module, c, aid)


def test_commitment_binds_version_and_counts(module, c):
    oid = create_org(module, c, escrow=6 * GEN)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    wid = commission(module, c, aid)
    w = order(c, wid)
    assert w["state"] == "PROPOSED" and w["constitution_version"] == 1 and w["committed_wei"] == str(2 * GEN)
    o = org(c, oid)
    assert o["committed_wei"] == str(2 * GEN) and o["open_work_orders"] == 1
    assert asset_view(c, aid)["status"] == "UNDER_MAINTENANCE"
    assert json.loads(c.work_orders_of(PROVIDER, 0, 5))["total"] == 1


@pytest.mark.parametrize("over, phrase", [
    ({"maintenance_type": "ELECTRICAL_REPAIR"}, "does not fund electrical repair"),
    ({"budget_wei": str(4 * GEN), "payment_wei": str(2 * GEN)}, "exceeds the constitution's limit"),
    ({"payment_wei": str(3 * GEN), "budget_wei": str(2 * GEN)}, "cannot exceed the budget"),
    ({"acceptance_criteria": []}, "between one and"),
    ({"deadline": "2026-10-20T12:00:00"}, "with its timezone"),
    ({"deadline": "2026-09-01T00:00:00Z"}, "already passed"),
    ({"payment_wei": 2e18}, "whole number"),
    ({"required_evidence": [{"type": "DRONE"}]}, "not an evidence requirement"),
])
def test_terms_are_checked_in_code(module, c, over, phrase):
    oid = create_org(module, c)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    with pytest.raises(err(module), match=phrase):
        commission(module, c, aid, **over)


def test_emergency_work_has_its_own_cap(module, c):
    oid = create_org(module, c, escrow=10 * GEN)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    wid = commission(module, c, aid, maintenance_type="EMERGENCY_REPAIR", budget_wei=str(5 * GEN),
                     payment_wei=str(4 * GEN))
    assert order(c, wid)["emergency"] is True
    with pytest.raises(err(module), match="exceeds"):
        commission(module, c, aid, maintenance_type="EMERGENCY_REPAIR", budget_wei=str(6 * GEN),
                   payment_wei=str(4 * GEN))


def test_the_reserve_and_the_open_order_cap(module, c):
    oid = create_org(module, c, escrow=4 * GEN)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    commission(module, c, aid, payment_wei=str(GEN), budget_wei=str(GEN))
    commission(module, c, aid, payment_wei=str(GEN), budget_wei=str(GEN))
    with pytest.raises(err(module), match="breaching its reserve"):
        commission(module, c, aid, payment_wei=str(2 * GEN), budget_wei=str(2 * GEN))
    oid2 = create_org(module, c, escrow=20 * GEN)
    authorize(module, c, oid2)
    aid2 = enrol(module, c, oid2)
    for _ in range(4):
        commission(module, c, aid2, payment_wei=str(GEN), budget_wei=str(GEN))
    with pytest.raises(err(module), match="limit on open work orders"):
        commission(module, c, aid2, payment_wei=str(GEN), budget_wei=str(GEN))


def test_acceptance_revision_and_cancellation(module, c):
    oid, aid, wid = active_order(module, c)
    assert order(c, wid)["state"] == "ACTIVE"
    as_(module, FOUNDER)
    c.propose_version(wid, terms(payment_wei=str(GEN), budget_wei=str(GEN)))
    assert order(c, wid)["committed_wei"] == str(2 * GEN)
    as_(module, STRANGER)
    with pytest.raises(err(module), match="only the assigned provider"):
        c.accept_work_order(wid, 2)
    as_(module, PROVIDER)
    c.accept_work_order(wid, 2)
    assert order(c, wid)["committed_wei"] == str(GEN) and org(c, oid)["committed_wei"] == str(GEN)
    as_(module, FOUNDER)
    with pytest.raises(err(module), match="not accepted can be cancelled"):
        c.cancel_work_order(wid, "x")


def test_the_proposed_terms_expire(module, c):
    oid = create_org(module, c)
    authorize(module, c, oid)
    aid = enrol(module, c, oid)
    wid = commission(module, c, aid, deadline="2026-09-21T00:00:00Z")
    with pytest.raises(err(module), match="not expired"):
        c.close_work_order(wid)
    set_now("2026-09-21T00:00:01Z")
    as_(module, PROVIDER)
    with pytest.raises(err(module), match="deadline has passed"):
        c.accept_work_order(wid, 1)
    out = json.loads(c.close_work_order(wid))
    assert out["released_wei"] == str(2 * GEN) and org(c, oid)["open_work_orders"] == 0


def test_a_later_amendment_never_reaches_an_existing_order(module, c):
    oid, aid, wid = active_order(module, c)
    as_(module, FOUNDER)
    from conftest import BENEFICIARY, constitution
    c.propose_amendment(oid, constitution([FOUNDER, STEWARD2], BENEFICIARY, eligibility_rules={
        "approved_maintenance_types": ["INSPECTION"], "inspection_report_required_for": []}))
    set_now("2026-09-20T10:00:01Z")
    c.enact_motion(oid)
    as_(module, FOUNDER)
    c.propose_version(wid, terms())
    assert order(c, wid)["constitution_version"] == 1
    with pytest.raises(err(module), match="provider is not authorised|does not fund"):
        commission(module, c, aid)
