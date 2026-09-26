"""The domain half of the harness: a constitution with enforced rules and
judged principles, work order terms with acceptance criteria, and the model
answers a round reads. Imported into conftest so every test file gets them
without an import line."""
import json

DEADLINE = "2026-10-20T12:00:00Z"

PRINCIPLES = [
    {"text": "Replacement equipment is of equal or greater rating than what it replaces."},
    {"text": "Every d.c. isolator is fitted, closed and labelled after the work."},
    {"text": "The site is left with no exposed conductors and every enclosure cover refitted."},
]
CRITERIA = [
    {"text": "The failed inverter is replaced and the replacement shows a normal operating display."},
    {"text": "The array is producing, shown by an inverter or meter display reading above zero."},
]


def constitution(stewards, **over):
    c = {
        "organization_name": "Kisumu Community Solar Fund",
        "mission": "Keep the community solar arrays of the county producing, by funding "
                   "maintenance that meets the rules the community ratified.",
        "supported_infrastructure_types": ["COMMUNITY_SOLAR", "BATTERY_STORAGE"],
        "approved_maintenance_types": ["INSPECTION", "PREVENTIVE_MAINTENANCE",
                                       "CORRECTIVE_MAINTENANCE", "COMPONENT_REPLACEMENT",
                                       "INVERTER_REPAIR"],
        "principles": PRINCIPLES,
        "evidence_rules": {"min_images": 2, "inspection_report_required": False},
        "funding_rules": {"max_payment_wei": str(3 * 10**18), "max_open_work_orders": 3},
        "windows": {"appeal_window_seconds": 3600, "amendment_window_seconds": 3600},
        "stewards": stewards,
    }
    c.update(over)
    return json.dumps(c)


def terms(**over):
    t = {"maintenance_type": "INVERTER_REPAIR",
         "title": "Replace the failed string inverter at the clinic array",
         "description": "The 5 kW inverter at the clinic array faulted; replace it with an "
                        "equivalent unit and return the array to production.",
         "requirements": "Replace the faulted inverter with a unit of equal or greater rating, "
                         "commission it, and leave the array producing.",
         "acceptance_criteria": CRITERIA,
         "required_evidence": [{"type": "IMAGE", "min_count": 2}],
         "payment_wei": str(2 * 10**18), "deadline": DEADLINE}
    t.update(over)
    return json.dumps(t)


def asset(**over):
    a = {"infrastructure_type": "COMMUNITY_SOLAR", "name": "Clinic array, Ahero",
         "location": "Ahero health centre roof",
         "technical_profile": "5 kW string inverter, 12 modules, grid-tied.",
         "inspector": ""}
    a.update(over)
    return json.dumps(a)


# ── model answers ────────────────────────────────────────────────────────────

def look_answer(images, received=True):
    """images: list of {shows, labels, concerns} dicts, one per image read."""
    return {"images": [{"n": i + 1, "readable": received,
                        "shows": row.get("shows", "A wall-mounted string inverter with its display lit."),
                        "labels": row.get("labels", []),
                        "concerns": row.get("concerns", [])}
                       for i, row in enumerate(images)]}


def look_all(n_images=2, labels=None, received=True, shows=None):
    row = {"labels": labels or [], "shows": shows or "A wall-mounted string inverter with its display lit."}
    return look_answer([dict(row) for _ in range(n_images)], received=received)


def judge_answer(principles, criteria=None, conflicts=False, note="", basis=None, notes=None):
    """principles: {P1: SATISFIED|...}; criteria: {C1: MET|NOT_MET|UNCLEAR}."""
    b = basis if basis is not None else {}
    default = ["*"]  # resolved by the harness to the round's first named item
    return {
        "reasoning": "Applied the principles and the criteria to what the images show.",
        "principles": [{"id": k, "status": v, "basis": b.get(k, default),
                        "note": (notes or {}).get(k, "")} for k, v in principles.items()],
        "criteria": [{"id": k, "status": v, "basis": b.get(k, default),
                      "note": (notes or {}).get(k, "")} for k, v in (criteria or {}).items()],
        "conflicts_detected": conflicts, "conflict_note": note,
    }


def judge_all(prin_status="SATISFIED", crit_status="MET", n_principles=3, n_criteria=2,
              conflicts=False, basis=None):
    return judge_answer({f"P{i + 1}": prin_status for i in range(n_principles)},
                        {f"C{i + 1}": crit_status for i in range(n_criteria)},
                        conflicts=conflicts, basis=basis)
