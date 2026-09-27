"""The domain half of the harness: the flagship constitution, an enrolled
asset, work order terms, and the model answers an adjudication reads."""
import json

DEADLINE = "2026-10-20T12:00:00Z"
GEN = 10**18

PRINCIPLES = [
    {"text": "Equipment installed or replaced is fixed in place, and its cabling is landed in its "
             "own terminals rather than left loose.", "applies_to": []},
    {"text": "Temporary clip leads are never left on battery terminals as a permanent connection.",
     "applies_to": ["BATTERY_SERVICE"]},
    {"text": "Restoration work leaves the system reporting a normal operating reading.",
     "applies_to": ["SYSTEM_RESTORATION", "COMPONENT_REPLACEMENT"]},
]
CRITERIA = [
    {"text": "A new charge controller is mounted on the equipment board and wired to the battery bank."},
    {"text": "The controller's display shows the battery bank at a normal charging voltage."},
]


def constitution(stewards, beneficiary, **over):
    c = {
        "organization_name": "Lakeside Community Energy Trust",
        "mission": "Maintain essential community infrastructure by continuously funding and verifying "
                   "legitimate maintenance work according to transparent, predefined rules.",
        "supported_infrastructure_types": ["COMMUNITY_SOLAR", "BATTERY_STORAGE", "MICROGRID"],
        "eligibility_rules": {
            "approved_maintenance_types": ["INSPECTION", "COMPONENT_REPLACEMENT", "BATTERY_SERVICE",
                                           "SYSTEM_RESTORATION", "EMERGENCY_REPAIR", "INVERTER_REPAIR"],
            "inspection_report_required_for": [],
        },
        "maintenance_principles": PRINCIPLES,
        "evidence_requirements": [{"maintenance_type": "ALL", "type": "AFTER_PHOTO", "min_count": 1}],
        "funding_rules": {"max_payment_wei": str(3 * GEN), "max_open_work_orders": 4,
                          "reserve_floor_wei": str(GEN)},
        "emergency_rules": {"emergency_max_payment_wei": str(5 * GEN), "emergency_appeal_window_seconds": 1800},
        "appeal_rules": {"appeal_window_seconds": 3600, "evidence_period_seconds": 3600,
                         "max_appeals_per_work_order": 1},
        "governance": {"stewards": stewards, "motion_window_seconds": 3600,
                       "dissolution_beneficiary": beneficiary},
    }
    c.update(over)
    return json.dumps(c)


def asset(**over):
    a = {"asset_type": "COMMUNITY_SOLAR", "name": "Lakeside battery bank",
         "description": "Off-grid solar battery bank serving the community workshop.",
         "location_reference": "Lakeside workshop, equipment bay", "operator": "Lakeside volunteers",
         "technical_profile": "PWM charge controller, two 12 V deep-cycle batteries, 1 kW inverter.",
         "installation_date": "2024-05-01", "maintenance_interval_days": 180, "inspector": ""}
    a.update(over)
    return json.dumps(a)


def provider_profile(**over):
    p = {"name": "Brightline Solar Services",
         "maintenance_types": ["COMPONENT_REPLACEMENT", "BATTERY_SERVICE", "SYSTEM_RESTORATION",
                               "EMERGENCY_REPAIR", "INSPECTION"]}
    p.update(over)
    return json.dumps(p)


def terms(**over):
    t = {"maintenance_type": "COMPONENT_REPLACEMENT",
         "title": "Replace the failed charge controller",
         "description": "The charge controller stopped regulating; the battery bank is not charging.",
         "requirements": "Replace the failed charge controller with a working unit, wire it to the "
                         "battery bank and panels, and return the system to charging.",
         "specification": "12/24 V PWM solar charge controller with display.",
         "acceptance_criteria": CRITERIA,
         "required_evidence": [{"type": "OPERATIONAL_READING", "min_count": 1}],
         "budget_wei": str(2 * GEN), "payment_wei": str(2 * GEN), "deadline": DEADLINE}
    t.update(over)
    return json.dumps(t)


# ── model answers ────────────────────────────────────────────────────────────

def seen(n=2, shows="A charge controller mounted on a board, wired, display lit.", seen_flag=True,
         readings=None, doubts=""):
    return {"images": [{"n": i + 1, "seen": seen_flag, "shows": shows if seen_flag else "",
                        "text": ["SOLAR CHARGE CONTROLLER"],
                        "readings": readings if readings is not None else [{"quantity": "battery", "value": "12.5", "unit": "V"}],
                        "same_asset_doubts": doubts, "change": ""} for i in range(n)]}


def judgment(ratings, basis=None, sufficient=True, conflicts=False, note=""):
    b = basis or {}
    return {"reasoning": "Weighed the photographs and documents against each requirement.",
            "requirements": [{"id": k, "status": v, "basis": b.get(k, ["*"]), "note": ""}
                             for k, v in ratings.items()],
            "evidence_sufficient": sufficient, "conflicts_detected": conflicts, "conflict_note": note}


def all_ids(principles=("P1", "P3"), criteria=("C1", "C2")):
    return list(principles) + list(criteria) + ["S1", "S2", "S3"]


def ratings(status="SATISFIED", **over):
    r = {i: status for i in all_ids()}
    r.update(over)
    return r
