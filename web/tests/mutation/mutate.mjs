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
  ["acts", "the inspector files before accepting the role",
   `if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at) return "INSPECTOR";`,
   `if (asset.inspector && same(addr, asset.inspector)) return "INSPECTOR";`],
  ["acts", "a steward outranks the inspector",
   `  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at) return "INSPECTOR";\n  if (isSteward(stewards, addr)) return "STEWARD";`,
   `  if (isSteward(stewards, addr)) return "STEWARD";\n  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at) return "INSPECTOR";`],
  ["acts", "addresses compare case-sensitively",
   `const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();`,
   `const same = (a?: string | null, b?: string | null) => !!a && !!b && a === b;`],
  ["acts", "an expired version can be signed",
   `    && t(pendingTerms.deadline) > nowMs;`, `;`],
  ["acts", "a steward signs the terms", `  const sign = seat === "PROVIDER"`, `  const sign = seat !== ""`],
  ["acts", "new terms while paused", `  const proposeTerms = isStewardHere && org.state === "ACTIVE"`, `  const proposeTerms = isStewardHere`],
  ["acts", "new terms replace a standing acceptance",
   `  const proposeTerms = isStewardHere && org.state === "ACTIVE" && !has(TERMS_LOCKED, s)`,
   `  const proposeTerms = isStewardHere && org.state === "ACTIVE"`],
  ["acts", "a signed order can be withdrawn", `  const cancel = isStewardHere && s === "PROPOSED";`, `  const cancel = isStewardHere;`],
  ["acts", "filing against a standing acceptance",
   `  if (order.state === "ACCEPTED") return "An acceptance stands.`, `  if (false) return "An acceptance stands.`],
  ["acts", "filing after the deadline",
   `  if (nowMs > t(order.versions[order.current_version - 1]!.deadline)) {`, `  if (false) {`],
  ["acts", "a stranger files", `  const file = seat !== "" && fileClosed === "";`, `  const file = fileClosed === "";`],
  ["acts", "re-assessment after a decided appeal",
   `    && !(standing && (standing.appealed || standing.kind !== "ASSESSMENT"))`, ``],
  ["acts", "assessments are unbounded", `    && order.version_assessments < MAX_ASSESSMENTS;`, `;`],
  ["acts", "the wrong party appeals",
   `    && seat === (standing.decision === "ACCEPTED" ? "STEWARD" : "PROVIDER");`, `    && seat !== "";`],
  ["acts", "an appeal opens after its window", `    && nowMs <= t(standing.window_ends)\n`, `\n`],
  ["acts", "a readjudication runs during the evidence period",
   `  const decideAppeal = s === "APPEALED" && !!order.appeal && nowMs > t(order.appeal.evidence_ends);`,
   `  const decideAppeal = s === "APPEALED";`],
  ["acts", "an appeal lapses early",
   `    && nowMs > t(order.appeal.evidence_ends) + APPEAL_LAPSE_MS;`, `    && nowMs > t(order.appeal.evidence_ends);`],
  ["acts", "an acceptance settles inside its window",
   `    && !(standing.appealable && nowMs <= t(standing.window_ends));`, `;`],
  ["acts", "an open appeal settles", `  const finalize = s === "ACCEPTED" && !!standing`, `  const finalize = (s === "ACCEPTED" || s === "APPEALED") && !!standing`],
  ["acts", "an acceptance is closed", `  let close = !has(SETTLED, s) && s !== "ACCEPTED" && s !== "APPEALED";`, `  let close = !has(SETTLED, s) && s !== "APPEALED";`],
  ["acts", "a close ignores a live pending version",
   `  if (close && pendingTerms && t(pendingTerms.deadline) > nowMs) close = false;`, ``],
  ["acts", "a close ignores a standing window",
   `    if (standing && standing.appealable && standing.window_ends && nowMs <= t(standing.window_ends)) close = false;`, ``],
  ["acts", "a stranger objects to an amendment",
   `    objectAmendment: steward && pending && nowMs <= t(a!.window_ends),`, `    objectAmendment: pending && nowMs <= t(a!.window_ends),`],
  ["acts", "an amendment is ratified inside its window",
   `    ratifyAmendment: !!addr && pending && nowMs > t(a!.window_ends),`, `    ratifyAmendment: !!addr && pending,`],
  ["acts", "a second amendment while one is pending",
   `    proposeAmendment: steward && org.state === "ACTIVE" && !pending,`, `    proposeAmendment: steward && org.state === "ACTIVE",`],
  ["acts", "the open-order cap is ignored",
   `      && org.open_work_orders < constitution.funding_rules.max_open_work_orders,`, `,`],
  ["acts", "a paused organisation commissions work",
   `    createWorkOrder: steward && org.state === "ACTIVE"`, `    createWorkOrder: steward`],
  ["acts", "a stranger registers assets", `    registerAsset: steward && org.state === "ACTIVE",`, `    registerAsset: org.state === "ACTIVE",`],
  ["acts", "an upheld appeal reads as still contestable",
   `        ? "Accepted on appeal. Final, and ready to settle."`, `        ? "Accepted. A steward may still appeal."`],
  ["present", "a panel's item ids reach the page",
   "    .replace(/ev-0*(\\d+)/gi, (_m, d: string) => `item ${parseInt(d, 10)}`)", ""],
  ["present", "raw principle ids reach the page",
   "    .replace(/\\bP(\\d{1,2})\\b/g, (_m, d: string) => `principle ${d}`)", ""],
  ["present", "fractions of GEN vanish",
   `  if (frac > 0n) text += \`.\${frac.toString().padStart(4, "0").replace(/0+$/, "")}\`;`, ``],
  ["present", "the refusal loses the contract's tag stripping",
   '    .replace(/\\[EXPECTED\\]|\\[LLM_ERROR\\]/g, "")', ""],
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
