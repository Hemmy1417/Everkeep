// Mutation sweep for the web rules (pnpm mutate): break one rule at a time
// in web/lib, run the tests that cover it, and require a failure. Every
// rule in lib/acts.ts mirrors a guard in contracts/everkeep.py; each mutant
// here breaks one mirror. Every file is restored in a finally block, and the
// run ends by comparing each one against its contents before the sweep.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const NODE = process.execPath;
const VITEST = join(WEB, "node_modules/vitest/vitest.mjs");

const M = [
  ["acts", "an unaccepted inspector files", '  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at && !isSteward(stewards, addr)) {',
   '  if (asset.inspector && same(addr, asset.inspector) && !isSteward(stewards, addr)) {'],
  ["acts", "a steward-inspector files as independent", '  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at && !isSteward(stewards, addr)) {',
   '  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at) {'],
  ["acts", "any steward files during an appeal", "  if (order.appeal && same(addr, order.appeal.opened_by)) return \"STEWARD\";",
   "  if (order.appeal) return \"STEWARD\";"],
  ["acts", "addresses compare case-sensitively", "const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();",
   "const same = (a?: string | null, b?: string | null) => !!a && !!b && a === b;"],
  ["acts", "an expired version is accepted", "    accept: same(addr, w.provider) && open && !!pending && t(pending.deadline) > now",
   "    accept: same(addr, w.provider) && open && !!pending"],
  ["acts", "a paused organisation grows a commitment", "      && !(delta > 0n && o.state !== \"ACTIVE\"),", "      ,"],
  ["acts", "terms change after a decision", "    proposeTerms: steward && o.state === \"ACTIVE\" && open && w.decisions.length === 0",
   "    proposeTerms: steward && o.state === \"ACTIVE\" && open"],
  ["acts", "terms change while paused", "    proposeTerms: steward && o.state === \"ACTIVE\" && open", "    proposeTerms: steward && open"],
  ["acts", "anyone assesses", "    assess: same(addr, w.provider) && w.state === \"ACTIVE\"", "    assess: w.state === \"ACTIVE\""],
  ["acts", "a second assessment", "    assess: same(addr, w.provider) && w.state === \"ACTIVE\"",
   "    assess: same(addr, w.provider) && (w.state === \"ACTIVE\" || w.state === \"DECIDED\")"],
  ["acts", "assessment after the deadline", " && !!current && now <= t(current.deadline),", " && !!current,"],
  ["acts", "appeals beyond the constitution", "    appeal: w.state === \"DECIDED\" && !!d && d.appeals_left > 0 && now <= t(d.appeal_window_ends)",
   "    appeal: w.state === \"DECIDED\" && !!d && now <= t(d.appeal_window_ends)"],
  ["acts", "an appeal after its window", "    appeal: w.state === \"DECIDED\" && !!d && d.appeals_left > 0 && now <= t(d.appeal_window_ends)",
   "    appeal: w.state === \"DECIDED\" && !!d && d.appeals_left > 0"],
  ["acts", "the wrong party appeals", "      && (d.outcome === \"ACCEPTED\" ? steward : same(addr, w.provider)),", "      && !!addr,"],
  ["acts", "anyone readjudicates during the evidence period",
   "      && (same(addr, w.appeal.opened_by) || now > t(w.appeal.evidence_ends)),", "      ,"],
  ["acts", "finalize inside the window", "    finalize: w.state === \"DECIDED\" && !!d && !(d.appeals_left > 0 && now <= t(d.appeal_window_ends)),",
   "    finalize: w.state === \"DECIDED\" && !!d,"],
  ["acts", "settle without finality", "    settle: w.state === \"PAYMENT_RELEASABLE\",", "    settle: w.state === \"PAYMENT_RELEASABLE\" || w.state === \"DECIDED\","],
  ["acts", "active work closes early", "  else if (w.state === \"ACTIVE\" && current) close = now > t(current.deadline);",
   "  else if (w.state === \"ACTIVE\" && current) close = true;"],
  ["acts", "an open appeal closes early", "  else if (w.state === \"UNDER_APPEAL\" && w.appeal) close = now > t(w.appeal.evidence_ends) + STALE_APPEAL_MS;",
   "  else if (w.state === \"UNDER_APPEAL\" && w.appeal) close = now > t(w.appeal.evidence_ends);"],
  ["acts", "a stranger objects to a motion", "    objectMotion: steward && !!m && now <= t(m.window_ends),", "    objectMotion: !!m && now <= t(m.window_ends),"],
  ["acts", "a motion is enacted inside its window", "    enactMotion: !!addr && !!m && now > t(m.window_ends)", "    enactMotion: !!addr && !!m"],
  ["acts", "two motions at once", "    proposeDissolution: steward && (active || o.state === \"PAUSED\") && !m,",
   "    proposeDissolution: steward && (active || o.state === \"PAUSED\"),"],
  ["acts", "dissolution completes with work open", "    completeDissolution: !!addr && o.state === \"DISSOLVING\" && o.open_work_orders === 0,",
   "    completeDissolution: !!addr && o.state === \"DISSOLVING\","],
  ["acts", "a dissolving treasury takes funds", "    fund: !!addr && o.state !== \"DISSOLVING\" && o.state !== \"DISSOLVED\",", "    fund: !!addr,"],
  ["acts", "the open-order cap is ignored", "    createWorkOrder: steward && active && o.open_work_orders < c.funding_rules.max_open_work_orders,",
   "    createWorkOrder: steward && active,"],
  ["acts", "a busy asset retires", "    retire: isSteward(o.stewards, addr) && !a.retired_at && a.open_work_orders === 0,",
   "    retire: isSteward(o.stewards, addr) && !a.retired_at,"],
  ["acts", "an upheld decision reads as still open", '      return `${word}${how}. The decision can be finalized now.`;', '      return `${word}${how}. It may still be appealed.`;'],
  ["present", "validators' evidence ids reach the page", String.raw`    .replace(/ev-0*(\d+)/gi, (_m, d: string) => ` + "`evidence ${parseInt(d, 10)}`)", ""],
  ["present", "raw principle ids reach the page", String.raw`    .replace(/\bP(\d{1,2})\b/g, (_m, d: string) => ` + "`principle ${d}`)", ""],
  ["present", "fractions of GEN vanish", '  if (frac > 0n) text += `.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;', ""],
  ["present", "a cut note looks whole", "  return wasCut(text) ? `${body}… (the record keeps the first 200 characters)` : body;", "  return body;"],
];

const files = { acts: "lib/acts.ts", present: "lib/present.ts" };
const tests = {
  acts: "tests/acts.test.ts",
  present: "tests/present.test.ts",
};

const [MAJOR, MINOR] = process.versions.node.split(".").map(Number);
const NEEDS_FLAG = MAJOR < 22 || (MAJOR === 22 && MINOR < 12);
const ENV = NEEDS_FLAG
  ? { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --experimental-require-module`.trim() }
  : process.env;

function run(testFiles) {
  const r = spawnSync(NODE, [VITEST, "run", ...testFiles.split(" ")], { cwd: WEB, encoding: "utf8", env: ENV });
  const tail = `${r.stdout}${r.stderr}`.match(/Tests\s+[^\n]+/)?.[0] ?? "no summary";
  return { ok: r.status === 0, tail: tail.replace(/\s+/g, " ").trim() };
}

const snapshot = Object.fromEntries(
  Object.values(files).map((f) => [f, readFileSync(join(WEB, f), "utf8")]),
);

let killed = 0;
const survivors = [];
for (const [area, name, from, to] of M) {
  const path = join(WEB, files[area]);
  const original = readFileSync(path, "utf8");
  const count = original.split(from).length - 1;
  if (count !== 1) {
    console.log(`BAD      ${name}: pattern found ${count} times`);
    survivors.push(name);
    continue;
  }
  try {
    writeFileSync(path, original.replace(from, to));
    const r = run(tests[area]);
    if (r.ok) {
      survivors.push(name);
      console.log(`SURVIVED ${name}  (${r.tail})`);
    } else {
      killed++;
      console.log(`killed   ${name}  (${r.tail})`);
    }
  } finally {
    writeFileSync(path, original);
  }
}

const control = run("tests");
console.log(`control, the code as written: ${control.ok ? "passes" : "FAILS"} (${control.tail})`);

const changed = Object.entries(snapshot)
  .filter(([f, text]) => readFileSync(join(WEB, f), "utf8") !== text)
  .map(([f]) => f);
console.log(`files after restore: ${changed.length ? `CHANGED ${changed.join(", ")}` : "as they were"}`);
console.log(`${killed}/${M.length} mutants killed${survivors.length ? `; survivors: ${survivors.join(", ")}` : ""}`);

if (survivors.length || !control.ok || changed.length) process.exit(1);
