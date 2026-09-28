"""Mutation sweep: break each rule of contracts/everkeep.py in a scratch copy
and prove the direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py
Exit status 0 only if every mutant is killed and the control passes.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "everkeep.py").read_text(encoding="utf-8")

F = "        if False:"
MUTATIONS = [
    # ── the outcome and its grounds ─────────────────────────────────────────
    ("conflicts no longer withhold payment", '    if conflicts or not sufficient:',
     '    if not sufficient:'),
    ("S22: a failure on insufficient evidence rejects", '    if conflicts or not sufficient:',
     '    if conflicts:'),
    ("an unsatisfied requirement no longer rejects",
     '    if any(v == "NOT_SATISFIED" for v in values):', "    if False:"),
    ("doubt pays", '    if any(v == "NOT_ESTABLISHED" for v in values):', "    if False:"),
    ("insufficiency alone no longer withholds", '    if conflicts or not sufficient:',
     '    if conflicts or False:'),
    ("a datasheet establishes a requirement",
     '            out[rid] = status if seen else "NOT_ESTABLISHED"', "            out[rid] = status"),
    ("any document counts as an observation",
     '        if kinds[e] == "IMAGE" or (kinds[e] == "DOCUMENT" and roles[e] == "INSPECTOR"\n'
     '                                   and docs.get(e) in INSPECTOR_DOCUMENTS):',
     '        if kinds[e] in ("IMAGE", "DOCUMENT"):'),
    # ── the judges' standards this ruleset answers ──────────────────────────
    ("S42: a steward's own photographs can fail a requirement",
     '        return any(roles[e] != "STEWARD" for e in seen)', "        return True"),
    ("S8: past an inspector, the provider's photographs alone accept",
     '        return any(roles[e] in ("INSPECTOR", "STEWARD") for e in seen)', "        return True"),
    ("S8: the inspector floor reaches the S checks too",
     'seen = _witnessed(cited, kinds, roles, docs, status, inspected, rid[:1] in ("P", "C"))',
     'seen = _witnessed(cited, kinds, roles, docs, status, inspected, True)'),
    ("S8: an unaccepted inspector counts as one",
     '        inspected = bool(a.get("inspector") and a.get("inspector_accepted_at")',
     '        inspected = bool(a.get("inspector")'),
    ("S35: the same bytes count twice",
     '                if self._item(e)["content_hash"] == digest:', "                if False:"),
    ("S16: the record keeps the leader's shape",
     '        ratings = _ground(_shape(result.get("ratings"), ids, case["inapplicable"]), notes["basis"],',
     '        ratings = _ground({i: result["ratings"][i] for i in ids}, notes["basis"],'),
    ("S16: a criterion can be recorded not applicable",
     '        elif v not in REQUIREMENT_STATUSES or (v == "NOT_APPLICABLE" and not i.startswith("P")):',
     '        elif v not in REQUIREMENT_STATUSES:'),
    ("S21: a rejection binds nothing",
     '                                       else [i for i, v in ratings.items() if v == "NOT_SATISFIED"]',
     '                                       else []'),
    ("S43: a named steward acts without accepting",
     '        return [s for s in self._named_stewards(o) if self.counters.get(f"steward|{oid}|{s}") == "1"]',
     '        return list(self._named_stewards(o))'),
    ("S43: anyone accepts a steward role",
     '        if sender not in self._named_stewards(o):\n            _refuse("only a wallet the constitution',
     '        if False:\n            _refuse("only a wallet the constitution'),
    ("S26: an active organisation dissolves as abandoned at once",
     '        if _now() <= _parse_iso(last) + timedelta(days=ABANDONED_AFTER_DAYS):', "        if False:"),
    ("S26: steward acts no longer keep it alive",
     "        self.counters[f\"stewarded|{o['organization_id']}\"] = _iso(_now())\n\n    def _require_state",
     "        pass\n\n    def _require_state"),
    ("S39: the examination is shown the submitter's claim",
     '            lines.append(f"Image {n} occupies the {it[\'view\'].lower().replace(\'_\', \' \')} slot")',
     '            lines.append(f"Image {n} occupies the {it[\'view\'].lower().replace(\'_\', \' \')} slot; '
     'the submitter describes it as: {_fence(it.get(\'description\', \'\'))}")'),
    ("S31: the panel is not told labels are claims",
     '"filer\'s claim, never for it.', '"filer\'s claim.'),
    ("a basis outside the file grounds a finding", "        if e not in kinds:\n            continue",
     "        if False:\n            continue"),
    ("consistency needs no provider document", "            seen = seen and paper", "            seen = seen"),
    # ("an unrated requirement reads as satisfied") alone is equivalent: an
    # unrated requirement has no basis, so grounding turns SATISFIED back into
    # NOT_ESTABLISHED. Paired with grounding switched off, it is a real test.
    ("an unrated requirement reads as satisfied, with grounding off", [
        ('            elif status not in REQUIREMENT_STATUSES:\n                status = "NOT_ESTABLISHED"',
         '            elif status not in REQUIREMENT_STATUSES:\n                status = "SATISFIED"'),
        ('            out[rid] = status if seen else "NOT_ESTABLISHED"', "            out[rid] = status")]),
    ("a criterion is waived as not applicable",
     '            elif status == "NOT_APPLICABLE" and not rid.startswith("P"):',
     '            elif status == "NOT_APPLICABLE" and rid.startswith("S"):'),
    ("a system requirement is waived by the model",
     '            elif status == "NOT_APPLICABLE" and not rid.startswith("P"):', "            elif False:"),
    ("evidence sufficiency read loosely", '        sufficient = out.get("evidence_sufficient") is True',
     '        sufficient = bool(out.get("evidence_sufficient"))'),
    ("before and after applicability decided by the model",
     '            status = "NOT_APPLICABLE"\n            elif status not in', '            pass\n            elif status not in'),
    # ── consensus ───────────────────────────────────────────────────────────
    ("an acceptance stands without the validator's own",
     '    if lo == "ACCEPTED" and mo != "ACCEPTED":', "    if False:"),
    ("a rejection stands on grounds the validator does not see",
     '            if tr[i] == "NOT_SATISFIED" and mine["ratings"][i] != "NOT_SATISFIED":', "            if False:"),
    ("a rejection ignores the validator's conflict", "        if mine[\"conflicts\"]:\n            return \"this node sees",
     "        if False:\n            return \"this node sees"),
    ("a leader withholds an acceptance", '    if lo == "UNDETERMINED" and mo == "ACCEPTED":', "    if False:"),
    ("a leader invents a conflict", '    if bool(theirs.get("conflicts")) and not mine["conflicts"]:', "    if False:"),
    ("a leader rates only some requirements",
     "    if any(tr.get(i) not in REQUIREMENT_STATUSES for i in ids):", "    if False:"),
    ("a blind leader is agreed with", '            if not theirs.get("seen"):', "            if False:"),
    ("a blind validator agrees", '            if not mine["seen"]:', "            if False:"),
    ("a node that never says it saw counts as seeing",
     '                seen = bool(row.get("seen", False)) and bool(_clean(row.get("shows"), LONG_MAX))',
     '                seen = bool(row.get("seen", True)) and bool(_clean(row.get("shows"), LONG_MAX))'),
    ("a failed leader is agreed with",
     '                print("[DISSENT] the leader\'s assessment failed")\n                return False',
     '                print("x")\n                return True'),
    # ── what the panel is shown ─────────────────────────────────────────────
    ("principles out of scope are put to the panel",
     "            if not p[\"applies_to\"] or maintenance_type in p[\"applies_to\"]]", "            if True]"),
    ("declarations reach the panel, past both gates", [
        ('            elif it["kind"] == "DOCUMENT":\n                docs[eid]',
         '            elif it["kind"] != "IMAGE":\n                docs[eid] = it.get("doc_type", "")\n                texts.append((it, self.evidence_text.get(eid) or ""))\n            if False:\n                docs[eid]'),
        ('        return [e for e in self._items(wid, version) if self._item(e)["kind"] in ("IMAGE", "DOCUMENT")]',
         '        return list(self._items(wid, version))')]),
    ("fences can be forged",
     '    return (str(text or "").replace("<<<", "< <<").replace(">>>", ">> >")',
     '    return (str(text or "")'),
    ("before and after are not examined together",
     '        images.sort(key=lambda p: (order.get(p[0]["view"], 2), _seq(p[0]["evidence_id"])))', "        pass"),
    # ── preflight and the enforced half ─────────────────────────────────────
    ("evidence rules are not checked before the panel", "        if gap:\n            _refuse(gap)\n        if not any",
     "        if False:\n            _refuse(gap)\n        if not any"),
    # ("the inspector rule counts anyone's report") is left out: filing
    # already refuses an inspection report or checklist from anyone but the
    # accepted, independent inspector, so no other role's report reaches the
    # preflight count. The role check there is a second lock on a locked door.
    ("a meter display does not count as a reading",
     '        return (kind == "IMAGE" and view == "METER_DISPLAY") or (kind == "DOCUMENT" and doc == "METER_READING")',
     '        return kind == "DOCUMENT" and doc == "METER_READING"'),
    ("an unfunded kind of work is commissioned",
     '    if mtype not in constitution["eligibility_rules"]["approved_maintenance_types"]:', "    if False:"),
    ("a provider is assigned outside their work", "    if provider_types and mtype not in provider_types:", "    if False:"),
    ("the payment cap is ignored", "    if budget > cap:", "    if False:"),
    ("the payment exceeds the budget", "    if budget < payment:", "    if False:"),
    ("emergency work uses the ordinary cap",
     '    limit_key = "emergency_max_payment_wei" if mtype == "EMERGENCY_REPAIR" else None', "    limit_key = None"),
    ("the reserve floor is ignored",
     '        return self._available(o) - int(self._in_force(o)["funding_rules"]["reserve_floor_wei"])',
     "        return self._available(o)"),
    ("the open-order cap is ignored",
     '        if self._open_orders(o["organization_id"]) >= int(c["funding_rules"]["max_open_work_orders"]):',
     "        if False:"),
    ("an unauthorised provider is assigned", '        if not p or p.get("revoked_at"):\n            _refuse("the provider is not authorised by this organisation")',
     '        if False:\n            _refuse("the provider is not authorised by this organisation")'),
    ("unsupported infrastructure is enrolled", '        if atype not in c["supported_infrastructure_types"]:', F),
    ("a steward inspects their own work", '            if inspector in c["governance"]["stewards"]:', "            if False:"),
    ("a retired asset takes work", '        if a.get("retired_at"):\n            _refuse("the asset is retired")',
     '        if False:\n            _refuse("the asset is retired")'),
    ("a naive deadline is accepted", '    if parsed.tzinfo is None:\n        raise ValueError("no timezone")',
     "    if False:\n        pass"),
    ("money arrives as a float", "    if isinstance(raw, bool) or not isinstance(raw, (int, str)):", "    if False:"),
    # ── who may act ─────────────────────────────────────────────────────────
    ("anyone acts as a steward", '        if self._sender() not in self._stewards(o):', F),
    ("the founder need not be a steward",
     '            if sender not in c["governance"]["stewards"]:', "            if False:"),
    ("a stranger files evidence", '            _refuse("only the assigned provider, the asset\'s accepted inspector, or a steward "',
     '            role = "PROVIDER"\n            if False: _refuse("only the assigned provider, the asset\'s accepted inspector, or a steward "'),
    ("an unaccepted inspector files",
     '        elif a.get("inspector") and sender == a["inspector"] and a.get("inspector_accepted_at") \\\n',
     '        elif a.get("inspector") and sender == a["inspector"] \\\n'),
    ("a provider files an inspection report", '        if doc in INSPECTOR_DOCUMENTS and role != "INSPECTOR":', F),
    ("anyone requests an assessment", '        if self._sender() != w["provider"]:\n            _refuse("only the assigned provider requests an assessment")',
     '        if False:\n            _refuse("only the assigned provider requests an assessment")'),
    ("the provider appeals their own acceptance", '            if sender not in self._stewards(o):\n                _refuse("only a steward appeals an acceptance")',
     '            if False:\n                _refuse("only a steward appeals an acceptance")'),
    ("a steward appeals against the provider's interest", '            if sender != w["provider"]:\n                _refuse("only the provider appeals',
     '            if False:\n                _refuse("only the provider appeals'),
    ("anyone readjudicates during the evidence period",
     '        if self._sender() != appeal["opened_by"] and _now() <= _parse_iso(appeal["evidence_ends"]):', F),
    # ── time and finality ───────────────────────────────────────────────────
    ("filing after the deadline", '            if now > _parse_iso(self._terms(w, w["current_version"])["deadline"]):\n                _refuse("the deadline has passed")',
     '            if False:\n                _refuse("the deadline has passed")'),
    ("filing after the appeal's evidence period", '            if now > _parse_iso(appeal["evidence_ends"]):\n                _refuse("the appeal\'s evidence period has ended")',
     '            if False:\n                _refuse("the appeal\'s evidence period has ended")'),
    ("assessment after the deadline", '        if _now() > _parse_iso(terms["deadline"]):\n            _refuse("the deadline has passed; the work order can only be closed")',
     '        if False:\n            _refuse("the deadline has passed; the work order can only be closed")'),
    ("a second first-assessment", '        if w["state"] != "ACTIVE":\n            _refuse("an assessment is requested once',
     '        if w["state"] not in ("ACTIVE", "DECIDED"):\n            _refuse("an assessment is requested once'),
    ("an appeal after the window", '        if now > _parse_iso(d["appeal_window_ends"]):\n            _refuse("the appeal window has closed")',
     '        if False:\n            _refuse("the appeal window has closed")'),
    ("appeals are unlimited", '        if d["appeals_left"] <= 0:', F),
    ("a decision finalizes inside its window",
     '        if d["appeals_left"] > 0 and now <= _parse_iso(d["appeal_window_ends"]):', F),
    ("the appeals counter never moves", '        w["appeals_used"] = int(w["appeals_used"]) + 1', "        pass"),
    ("the original decision is not marked superseded",
     '        prior["lifecycle"], prior["superseded_by"] = "SUPERSEDED", d["decision_id"]', "        pass"),
    ("terms change after a decision", '        if w["state"] not in ("PROPOSED", "ACTIVE") or w["decisions"]:',
     '        if w["state"] not in ("PROPOSED", "ACTIVE", "DECIDED"):'),
    ("an expired version is accepted", '        if _parse_iso(terms["deadline"]) <= _now():\n            _refuse("that version\'s deadline has passed")',
     '        if False:\n            _refuse("that version\'s deadline has passed")'),
    ("active work closes before its deadline", '            if now <= _parse_iso(self._terms(w, w["current_version"])["deadline"]):\n                _refuse("the deadline has not passed")',
     '            if False:\n                _refuse("the deadline has not passed")'),
    ("an open appeal closes early",
     '            if now <= stale:', "            if False:"),
    ("a motion is enacted inside its window",
     '        if now <= _parse_iso(m["window_ends"]):\n            _refuse("the motion\'s window is still open")',
     '        if False:\n            _refuse("the motion\'s window is still open")'),
    ("an objection after the window",
     '        if _now() > _parse_iso(m["window_ends"]):\n            _refuse("the motion\'s window has closed', F + '\n            _refuse("the motion\'s window has closed'),
    ("two motions at once", '        if o.get("motion") and o["motion"]["state"] == "PENDING":', F),
    # ── money ───────────────────────────────────────────────────────────────
    ("settlement without finality", '        if w["state"] != "PAYMENT_RELEASABLE":\n            _refuse("only a finalized acceptance is settled")',
     '        if w["state"] not in ("PAYMENT_RELEASABLE", "DECIDED"):\n            _refuse("only a finalized acceptance is settled")'),
    ("settlement leaves the treasury untouched", '        o["escrow_wei"] = str(int(o["escrow_wei"]) - pay)', "        pass"),
    ("a rejection pays", '        if d["outcome"] == "ACCEPTED":\n            pay = int(w["committed_wei"])',
     '        if d["outcome"] in ("ACCEPTED", "REJECTED"):\n            pay = int(w["committed_wei"])'),
    ("a closed order keeps its commitment", '        released = self._release(o, w)\n        w["closed_at"], w["close_reason"] = _iso(now), "closed without',
     '        released = 0\n        w["closed_at"], w["close_reason"] = _iso(now), "closed without'),
    ("dissolution completes with work open", '        if self._open_orders(o["organization_id"]) > 0:', F),
    ("dissolution refunds nobody", "        if remaining > 0:\n            self._refund(beneficiary, remaining)",
     "        if False:\n            self._refund(beneficiary, remaining)"),
    ("a dissolving organisation takes funds", '            if o["state"] in ("DISSOLVING", "DISSOLVED"):', "            if False:"),
    ("a refused founding keeps the value", "            if wei:\n                self._refund(sender, wei)\n            return json.dumps({\"refused\": True, \"reason\": str(e).replace(ERROR_EXPECTED + \" \", \"\")\n                               + (\"; the value sent is refundable\" if wei else \"\")})\n\n    @gl.public.write.payable",
     "            return json.dumps({\"refused\": True, \"reason\": str(e).replace(ERROR_EXPECTED + \" \", \"\")\n                               + (\"; the value sent is refundable\" if wei else \"\")})\n\n    @gl.public.write.payable"),
    ("a refund is paid before it is cleared", '        row["owed"], row["paid"] = "0", str(int(row["paid"]) + owed)',
     '        row["paid"] = str(int(row["paid"]) + owed)'),
    ("an acceptance left undecided on appeal closes unpaid",
     '            if prior["outcome"] == "ACCEPTED":\n                pay = int(w["committed_wei"])',
     '            if False:\n                pay = int(w["committed_wei"])'),
    ("the ordinary quota blocks an appeal answer",
     '        elif len(in_bucket) >= QUOTAS[role][bucket]:',
     '        if len(in_bucket) >= QUOTAS[role][bucket]:'),
    ("a steward-inspector still files as independent",
     '                and sender not in self._named_stewards(self._org(w["organization_id"])):', "                and True:"),
    ("a steward is paid for the organisation's work",
     '        if addr in c["governance"]["stewards"]:\n            _refuse("a steward cannot be paid', '        if False:\n            _refuse("a steward cannot be paid'),
    ("a paused organisation grows a commitment", '        if delta > 0 and o["state"] != "ACTIVE":', "        if False:"),
    ("the leader's notes are stored as sent",
     '        notes = _clean_notes(result.get("notes"), ids, len(case["images"]))',
     '        notes = dict(_clean_notes(result.get("notes"), ids, len(case["images"])), **result["notes"])'),
    ("the asset never returns to monitoring", '        if old in WORK_STATES and new not in WORK_STATES:', F),
    ("service is not recorded", '        if outcome == "ACCEPTED":\n            a["last_serviced_at"] = now',
     '        if False:\n            a["last_serviced_at"] = now'),
]


def run(work: pathlib.Path) -> tuple:
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/direct/", "-q", "-x", "--tb=no",
                        "-p", "no:cacheprovider", "--deselect",
                        "tests/direct/test_invariants.py::test_the_walk_reaches_the_whole_machine"],
                       cwd=work, capture_output=True, text=True)
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    return r.returncode == 0, tail[0]


def main() -> int:
    survivors = []
    with tempfile.TemporaryDirectory(prefix="everkeep-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests", ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        target = work / "contracts" / "everkeep.py"
        for entry in MUTATIONS:
            name = entry[0]
            edits = entry[1] if isinstance(entry[1], list) else [(entry[1], entry[2])]
            if any(TEXT.count(old) != 1 for old, _ in edits):
                print(f"SKIPPED  {name}: a target is missing or repeated", flush=True)
                survivors.append(name)
                continue
            mutant = TEXT
            for old, new in edits:
                mutant = mutant.replace(old, new)
            target.write_text(mutant, encoding="utf-8", newline="\n")
            passed, tail = run(work)
            print(f"{'SURVIVED' if passed else 'killed  '} {name}  ({tail})", flush=True)
            if passed:
                survivors.append(name)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = run(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(MUTATIONS) - len(survivors)}/{len(MUTATIONS)} mutants killed")
    if survivors:
        print("survivors: " + "; ".join(survivors))
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())
