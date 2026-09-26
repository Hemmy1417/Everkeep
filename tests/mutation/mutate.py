"""Mutation check: break each safety floor of contracts/everkeep.py and prove
the direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py
Exit status 0 only if every mutant is killed and the control passes. The
sweep works on a temporary copy of contracts/ and tests/, so the repository's
own files are never touched. A floor guarded in two places is broken in both
at once (a list of replacements), or one of the two mutants is equivalent and
would report a false pin.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "everkeep.py").read_text(encoding="utf-8")

MUTATIONS = [
    # ── blindness: a node votes only on evidence it says it saw ─────────────
    ("a node that never claims to have seen the image counts as a reader",
     '                readable = bool(row.get("readable", False)) and bool(row.get("shows"))',
     '                readable = bool(row.get("readable", True)) and bool(row.get("shows"))'),
    ("a reading with nothing in it counts as a reader",
     '                readable = bool(row.get("readable", False)) and bool(row.get("shows"))',
     '                readable = bool(row.get("readable", False))'),
    ("a blind leader is agreed with",
     '            if not theirs.get("images_received"):', "            if False:"),
    ("a blind validator agrees anyway",
     '            if not mine["images_received"]:', "            if False:"),
    ("a failed leader is agreed with",
     '                print("[DISAGREE] the leader\'s round failed")\n                return False',
     '                print("mutant")\n                return True'),
    ("a malformed leader result is agreed with",
     '                print("[DISAGREE] the leader\'s result is malformed")\n                return False',
     '                print("mutant")\n                return True'),
    ("a validator whose own reading failed agrees",
     '                print("[DISAGREE] this validator could not judge the evidence: " + str(e)[:200])\n'
     "                return False",
     '                print("mutant")\n                return True'),

    # ── grounding: the floors and their mirrors, which are the product ──────
    ("a criterion is decided on paperwork alone (met and not met)",
     '        if status in ("MET", "NOT_MET") and not _observed(', "        if False and _observed("),
    ("a principle is decided on paperwork alone (satisfied and violated)",
     '        if status in ("SATISFIED", "VIOLATED") and not _observed(', "        if False and _observed("),
    ("a party's own document counts as an observation",
     '        if kind_of[e] == "DOCUMENT" and role_of[e] == "INSPECTOR" \\\n'
     '                and doc_type_of.get(e) == "INSPECTION_REPORT":',
     '        if kind_of[e] == "DOCUMENT":'),
    ("the inspector's other paperwork counts as an observation",
     '                and doc_type_of.get(e) == "INSPECTION_REPORT":', "                and True:"),
    ("grounding reads a basis the round never held",
     "        if e not in kind_of:\n            continue", "        if False:\n            continue"),
    ("an unrated principle is read as satisfied, with grounding off too", [
        ('            principles[pid] = status if status in PRINCIPLE_STATUSES else "UNCLEAR"',
         '            principles[pid] = status if status in PRINCIPLE_STATUSES else "SATISFIED"'),
        ('        if status in ("SATISFIED", "VIOLATED") and not _observed(', "        if False and _observed(")]),
    ("an unrated criterion is read as met, with grounding off too", [
        ('            criteria[cid] = status if status in CRITERION_STATUSES else "UNCLEAR"',
         '            criteria[cid] = status if status in CRITERION_STATUSES else "MET"'),
        ('        if status in ("MET", "NOT_MET") and not _observed(', "        if False and _observed(")]),

    # ── derivation: doubt and conflict never pay ────────────────────────────
    ("conflicts no longer undetermine",
     '    if conflicts:\n        return "UNDETERMINED"\n    crit_values',
     '    if False:\n        return "UNDETERMINED"\n    crit_values'),
    ("a violated principle or unmet criterion no longer rejects",
     '    if any(v == "NOT_MET" for v in crit_values) or any(v == "VIOLATED" for v in prin_values):',
     "    if False:"),
    ("doubt pays",
     '    if any(v != "MET" for v in crit_values) or any(v != "SATISFIED" for v in prin_values):',
     "    if False:"),
    ("a violated principle hides behind not applicable",
     '    prin_values = [v for v in principles.values() if v != "NOT_APPLICABLE"]',
     '    prin_values = [v for v in principles.values() if v not in ("NOT_APPLICABLE", "VIOLATED")]'),
    ("the receipt calls insufficient evidence sufficient",
     '    if any(v == "UNCLEAR" for v in criteria.values()) \\\n'
     '            or any(v == "UNCLEAR" for v in principles.values()):',
     "    if False:"),

    # ── consensus: what a validator must reproduce ──────────────────────────
    ("an acceptance stands without the validator's own acceptance",
     '    if leader_decision == "ACCEPTED" and my_decision != "ACCEPTED":', "    if False:"),
    ("a rejection stands on a criterion the validator does not reproduce",
     '            if tc[cid] == "NOT_MET" and mc[cid] != "NOT_MET":', "            if False:"),
    ("a rejection stands on a principle the validator does not reproduce",
     '            if tp[pid] == "VIOLATED" and mp[pid] != "VIOLATED":', "            if False:"),
    ("a rejection ignores a conflict the validator sees",
     "        if mine_conflicts:\n            return \"this node sees a conflict",
     "        if False:\n            return \"this node sees a conflict"),
    ("a leader withholds an acceptance a validator would grant",
     '    if leader_decision == "UNDETERMINED" and my_decision == "ACCEPTED":', "    if False:"),
    ("a conflict the leader alone reports is recorded",
     "    if theirs_conflicts and not mine_conflicts:", "    if False:"),
    ("a leader that does not rate every principle stands",
     "    if any(v not in PRINCIPLE_STATUSES for v in tp.values()):", "    if False:"),
    ("a leader that does not rate every criterion stands",
     "    if any(v not in CRITERION_STATUSES for v in tc.values()):", "    if False:"),
    ("the record overstates what was decisive",
     '        return {"criteria": [k for k, v in criteria.items() if v == "NOT_MET"],\n'
     '                "principles": [k for k, v in principles.items() if v == "VIOLATED"]}',
     '        return {"criteria": list(criteria), "principles": list(principles)}'),

    # ── the prompt: blind reading, fences, and what never reaches it ────────
    ("the reading step is told what to expect",
     '        head = ("You are reading photographs from a community infrastructure site: "',
     '        head = ("Expect a replacement inverter, a labelled isolator and no exposed conductors. "'),
    ("fences can be forged",
     '    return str(text or "").replace("<<<", "< <<").replace(">>>", ">> >").replace("END ITEM", "END_ITEM")',
     '    return str(text or "")'),
    ("a declaration or reference reaches a round, past both gates", [
        ('            elif it["kind"] == "DOCUMENT":\n                doc_type_of[eid]',
         '            elif it["kind"] != "IMAGE":\n                doc_type_of[eid]'),
        ('                  if e not in chosen and self._item(e)["role"] != "PROVIDER"\n'
         '                  and self._item(e)["kind"] in ("IMAGE", "DOCUMENT")]',
         '                  if e not in chosen and self._item(e)["role"] != "PROVIDER"]')]),
    ("an appeal reads a declaration filed since",
     '                   and self._item(e)["kind"] in ("IMAGE", "DOCUMENT")]\n        eids = recorded + new_ids',
     '                   ]\n        eids = recorded + new_ids'),

    # ── the enforced half: rules code checks, never a panel ─────────────────
    ("an unsupported infrastructure type is registered",
     '        if infra not in c["supported_infrastructure_types"]:', "        if False:"),
    ("an unfunded maintenance type is commissioned",
     '    if maintenance_type not in constitution["approved_maintenance_types"]:', "    if False:"),
    ("a payment above the constitution's cap",
     '    if payment > int(constitution["funding_rules"]["max_payment_wei"]):', "    if False:"),
    ("the open work order cap is ignored",
     '        if self._open_count(o) >= int(c["funding_rules"]["max_open_work_orders"]):', "        if False:"),
    ("the minimum images rule is not enforced",
     '    if counts["IMAGE"] < rules["min_images"]:', "    if False:"),
    ("the inspection report rule is not enforced",
     '    if rules["inspection_report_required"] and counts["INSPECTION_REPORT"] < 1:', "    if False:"),
    ("a work order's own evidence requirement is not enforced",
     '        if counts[req["type"]] < req["min_count"]:', "        if False:"),
    ("the provider's own inspection report satisfies the rule",
     '            if dt == "INSPECTION_REPORT" and it["role"] == "INSPECTOR":',
     '            if dt == "INSPECTION_REPORT":'),
    ("anyone files an inspection report",
     '            if doc_type == "INSPECTION_REPORT" and who != "INSPECTOR":', "            if False:"),
    ("a constitution with nothing to judge",
     "    if not principles:\n        _refuse(\"the constitution needs at least one maintenance principle; \"",
     "    if False:\n        _refuse(\"the constitution needs at least one maintenance principle; \""),
    ("a work order with nothing to judge",
     "    if not criteria:\n        _refuse(\"a work order needs at least one acceptance criterion\")",
     "    if False:\n        _refuse(\"a work order needs at least one acceptance criterion\")"),
    ("a deadline in the past",
     '    if deadline <= now:\n        _refuse("the deadline has already passed")',
     '    if False:\n        _refuse("the deadline has already passed")'),
    ("a steward is the provider of the organisation's own order",
     '        if prov in c["stewards"]:', "        if False:"),
    ("a steward is the inspector",
     '            if inspector in c["stewards"]:', "            if False:"),

    # ── governance: who governs, and when an amendment takes effect ─────────
    ("a stranger acts as a steward",
     "        if not self._is_steward(o, addr):\n            _refuse(", "        if False:\n            _refuse("),
    ("a founder keeps power outside the stewards list",
     '        if sender not in constitution["stewards"]:', "        if False:"),
    ("an amendment takes effect inside its window",
     '        if now <= _parse_iso(a["window_ends"]):\n            _refuse("the amendment window is still open")',
     '        if False:\n            _refuse("the amendment window is still open")'),
    ("an objection lands after the window",
     '        if now > _parse_iso(a["window_ends"]):\n            _refuse("the amendment window has closed',
     '        if False:\n            _refuse("the amendment window has closed'),
    ("a second amendment replaces a pending one",
     '        if o.get("amendment") and o["amendment"]["state"] == "PROPOSED":', "        if False:"),
    ("an amendment reaches an existing work order",
     '        c = self._constitution(o["organization_id"], int(w["constitution_version"]))\n        terms = _validate_terms(raw, c)',
     '        c = self._effective(o)\n        terms = _validate_terms(raw, c)'),
    ("a paused organisation commissions work",
     '        if o["state"] != "ACTIVE":\n            _refuse("a paused organisation creates no work orders")',
     '        if False:\n            _refuse("a paused organisation creates no work orders")'),

    # ── evidence: who may file, and what is read ───────────────────────────
    ("a stranger files evidence",
     '        if not who:\n            _refuse("only a steward, the provider and the asset\'s accepted inspector file evidence")',
     '        if False:\n            _refuse("only a steward, the provider and the asset\'s accepted inspector file evidence")'),
    ("evidence is filed against a standing acceptance",
     '        if w["state"] == "ACCEPTED":\n            _refuse("the acceptance stands; to contest it, open an appeal, "',
     '        if False:\n            _refuse("the acceptance stands; to contest it, open an appeal, "'),
    ("a party files past its quota",
     "        if len(mine) >= quota:", "        if False:"),
    ("an appeal reads unbounded new evidence",
     "        if len(added) >= limit:", "        if False:"),
    ("an image the runner cannot read is stored",
     '            _refuse("the runtime reads PNG and JFIF JPEG only; re-save the image and file it again")',
     "            pass"),
    ("the provider hides the counterparty's evidence",
     '        others = [e for e in on_version\n                  if e not in chosen and self._item(e)["role"] != "PROVIDER"',
     '        others = [e for e in on_version\n                  if False and e not in chosen and self._item(e)["role"] != "PROVIDER"'),
    ("one round reads unbounded evidence from the provider",
     '            if counts[_bucket(it["kind"])] > MAX_NAMED[_bucket(it["kind"])]:', "            if False:"),
    ("an unaccepted inspector's report counts as the inspector's",
     '        if a.get("inspector") and addr == a["inspector"] and a.get("inspector_accepted_at"):',
     '        if a.get("inspector") and addr == a["inspector"]:'),

    # ── money and the state machine ────────────────────────────────────────
    ("a work order commits treasury another order holds",
     '        if payment > self._available(o):\n            _refuse("the treasury has less uncommitted than this work order would pay")',
     '        if False:\n            _refuse("the treasury has less uncommitted than this work order would pay")'),
    ("new terms commit treasury the organisation does not hold",
     '        if extra > self._available(o):', "        if False:"),
    ("an acceptance pays inside its appeal window",
     '        if standing["appealable"] and _now() <= _parse_iso(standing["window_ends"]):\n'
     '            _refuse("the appeal window is still open")',
     '        if False:\n            _refuse("the appeal window is still open")'),
    ("a work order closes before its deadline",
     '            if now <= _parse_iso(self._terms(w, version)["deadline"]):\n'
     '                _refuse("the deadline has not passed")',
     '            if False:\n                _refuse("the deadline has not passed")'),
    ("a close kills terms the provider can still sign",
     '        if pending and _parse_iso(self._terms(w, int(pending))["deadline"]) > now:',
     "        if False:"),
    ("a close ignores a standing appeal window",
     '                    and now <= _parse_iso(standing["window_ends"]):\n'
     '                _refuse("a decision\'s appeal window is still open")',
     '                    and False:\n                _refuse("a decision\'s appeal window is still open")'),
    ("a signed order is cancelled",
     '        if w["state"] != "PROPOSED":\n            _refuse("only an order the provider has not signed can be cancelled")',
     '        if False:\n            _refuse("only an order the provider has not signed can be cancelled")'),
    ("a version is signed after its own deadline",
     '        if _parse_iso(terms["deadline"]) <= _now():\n            _refuse("that version\'s deadline has passed; a steward proposes new terms")',
     '        if False:\n            _refuse("that version\'s deadline has passed; a steward proposes new terms")'),
    ("an appeal opens outside its window",
     '        if now > _parse_iso(standing["window_ends"]):\n            _refuse("the appeal window has closed")',
     '        if False:\n            _refuse("the appeal window has closed")'),
    ("the wrong party appeals",
     "        if who != allowed:", "        if False:"),
    ("a readjudication runs during the evidence period",
     '        if _now() <= _parse_iso(appeal["evidence_ends"]):\n            _refuse("the appeal\'s evidence period is still open")',
     '        if False:\n            _refuse("the appeal\'s evidence period is still open")'),
    ("an appeal lapses early",
     '        if _now() <= _parse_iso(appeal["evidence_ends"]) + timedelta(seconds=APPEAL_LAPSE_SECONDS):',
     "        if False:"),
    ("a refused creation keeps the value",
     '            if wei:\n                self._credit(sender, wei)\n            return json.dumps({"refused": True,\n'
     '                               "reason": f"{str(e).replace(ERROR_EXPECTED + \' \', \'\')}; "\n'
     '                                         "any value sent is claimable back"})\n\n    def _create_organization',
     '            return json.dumps({"refused": True,\n'
     '                               "reason": f"{str(e).replace(ERROR_EXPECTED + \' \', \'\')}; "\n'
     '                                         "any value sent is claimable back"})\n\n    def _create_organization'),
    ("a claim is paid before the balance is cleared",
     '        row["claimable"] = "0"\n        row["claimed"] = str(int(row["claimed"]) + amount)',
     '        row["claimed"] = str(int(row["claimed"]) + amount)'),
    ("assessments are unbounded per version",
     '        if int(w["version_assessments"]) >= MAX_ASSESSMENTS_PER_VERSION:', "        if False:"),
    ("the finalized payment is not taken from the treasury",
     '        o["escrow_wei"] = str(int(o["escrow_wei"]) - payment)', "        pass"),
    ("a lapsed appeal leaves the money committed to nobody", [
        ('        w["state"] = "UNDETERMINED"\n        w["standing"] = {"round": int(appeal["reviewed_round"]), "decision": "UNDETERMINED",',
         '        w["state"] = "CLOSED"\n        w["standing"] = {"round": int(appeal["reviewed_round"]), "decision": "UNDETERMINED",')]),
    ("a round forgets which constitution it applied",
     '            "constitution_version": int(w["constitution_version"]),\n            "at": _iso(now), "requested_by"',
     '            "constitution_version": 0,\n            "at": _iso(now), "requested_by"'),
]


def suite_passes(work: pathlib.Path) -> tuple:
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/direct/", "-q", "-x",
                        "--tb=no", "-p", "no:cacheprovider"],
                       cwd=work, capture_output=True, text=True)
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    return r.returncode == 0, tail[0]


def apply(text: str, edits: list):
    for old, new in edits:
        if text.count(old) != 1:
            return None
        text = text.replace(old, new)
    return text


def main() -> int:
    survivors = []
    with tempfile.TemporaryDirectory(prefix="everkeep-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests",
                        ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        target = work / "contracts" / "everkeep.py"
        for entry in MUTATIONS:
            name = entry[0]
            edits = entry[1] if isinstance(entry[1], list) else [(entry[1], entry[2])]
            mutant = apply(TEXT, edits)
            if mutant is None:
                print(f"SKIPPED  {name}: a target is missing or ambiguous", flush=True)
                survivors.append(name)
                continue
            target.write_text(mutant, encoding="utf-8", newline="\n")
            passed, tail = suite_passes(work)
            print(f"{'SURVIVED' if passed else 'killed  '} {name}  ({tail})", flush=True)
            if passed:
                survivors.append(name)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = suite_passes(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(MUTATIONS) - len(survivors)}/{len(MUTATIONS)} mutants killed")
    if survivors:
        print("survivors: " + "; ".join(survivors))
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())
