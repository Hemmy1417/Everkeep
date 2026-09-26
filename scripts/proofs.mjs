/**
 * Live proofs on an EVERKEEP deployment. Every claim a proof makes is an
 * assertion here: if the contract or the panel behaves otherwise, the run
 * stops and says which assertion failed. Observations that are not asserted
 * are recorded as observations.
 *
 *   node scripts/proofs.mjs 0x…            run every proof in order (resumable)
 *
 * Results, with every transaction hash, go to .data/proofs-<address>.json;
 * a finished run is copied to docs/proofs/ by hand after review. Signers are
 * the roles in .data/keys.json (gitignored, never printed).
 *
 * What is proved, in order:
 *   the enforced half   four rules the constitution states as facts are
 *                       refused in code, with no panel asked
 *   the flagship        a rating plate that reads the model the order named
 *                       is accepted, and pays only after its window
 *   the paper floor     the same wall with the model named on paper only
 *                       does not pay (negative control for a criterion)
 *   the mismatch        a plate reading another product does not pay
 *   the principle       an inverter shown without any plate breaks the
 *                       constitution's identification principle
 *   the appeal          a steward contests an acceptance; a fresh panel
 *                       re-reads the record, citing the same constitution
 *   settlement          the provider claims exactly what was committed
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER, GEN, chain, dumpReceipt, leaderOf, loadKeys, plainFees, resultText, rpc, sleep,
         transferFees, waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node scripts/proofs.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/proofs-${ADDRESS}.json`, import.meta.url));
const IMG = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../fixtures/images/${name}.jpg`, import.meta.url))));
const KEYS = loadKeys();
const run = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { address: ADDRESS, steps: {} };
const save = () => writeFileSync(OUT, JSON.stringify(run, null, 2));
const say = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const clientFor = (role) => createClient({ chain, account: createAccount(KEYS[role].pk) });
const reader = createClient({ chain, account: createAccount(KEYS.STRANGER.pk) });

function assert(cond, message) {
  if (!cond) {
    say(`ASSERTION FAILED: ${message}`);
    process.exit(2);
  }
}

function jsonFrom(text) {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
}

async function read(fn, args) {
  for (let i = 0; i < 6; i++) {
    try {
      return await reader.readContract({ address: ADDRESS, functionName: fn, args });
    } catch (e) {
      if (i === 5) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}

async function readJson(fn, args) {
  return JSON.parse(await read(fn, args));
}

async function balance(role) {
  const b = await rpc("eth_getBalance", [KEYS[role].addr, "latest"]);
  return BigInt(b.result ?? "0x0");
}

const ROUNDS = new Set(["request_assessment", "decide_appeal"]);
const ROUND_ATTEMPTS = 3;

/**
 * One signed write, remembered by name so a rerun skips what already landed.
 * The hash is saved the moment it is sent: a rerun after a timeout waits on
 * the same transaction instead of sending a second one. A round that reaches
 * no majority recorded nothing, so it is asked again, and every such attempt
 * is kept in run.no_consensus so the log reports the rounds that failed.
 */
async function step(name, role, fn, args, { value = 0n, transfer = false, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier (${run.steps[name].hash})`);
    return run.steps[name];
  }
  run.pending ??= {};
  const attempts = ROUNDS.has(fn) ? ROUND_ATTEMPTS : 1;
  let hash, t, secs;
  for (let ask = 1; ; ask++) {
    hash = run.pending[name];
    if (hash) {
      say(`${name}: waiting again on ${hash}, sent earlier`);
    } else {
      for (let attempt = 0; ; attempt++) {
        try {
          const client = clientFor(role);
          const fees = transfer
            ? await transferFees(client, { address: ADDRESS, functionName: fn, args, value })
            : await plainFees(client);
          hash = await client.writeContract({ address: ADDRESS, functionName: fn, args, value, fees });
          break;
        } catch (e) {
          if (attempt >= 4) throw e;
          say(`${name}: send failed (${String(e.message).slice(0, 80)}), retrying`);
          await sleep(8000 * (attempt + 1));
        }
      }
      run.pending[name] = hash;
      save();
      say(`${name}: ${role} ${fn} ${hash}`);
    }
    const t0 = Date.now();
    try {
      t = await waitFinal(hash, { label: name, tries: ROUNDS.has(fn) ? 450 : 150 });
      secs = Math.round((Date.now() - t0) / 1000);
      break;
    } catch (e) {
      if (!/UNDETERMINED|CANCELED/.test(e.message)) throw e;
      delete run.pending[name];
      (run.no_consensus ??= []).push({ name, hash, at: new Date().toISOString() });
      save();
      if (ask >= attempts) throw e;
      say(`${name}: no majority, so nothing was recorded; asking again `
        + `(${ask + 1} of ${attempts})`);
      await sleep(15000);
    }
  }
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  say(`${name}: ${t.status} ${t.result_name} leader=${leader?.execution_result} in ${secs} s`);
  if (refused) {
    assert(!ok, `${name} should have been refused`);
    assert(text.includes(refused), `${name} refusal should say "${refused}", said "${text.slice(0, 200)}"`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 300)}`);
  }
  const rec = { name, role, fn, hash, secs, ok, text: text.slice(0, 600), explorer: `${EXPLORER}/tx/${hash}`,
                rotations: t.consensus_history?.consensus_results?.length ?? null };
  run.steps[name] = rec;
  save();
  return rec;
}

async function waitUntil(iso, label) {
  const target = Date.parse(iso) + 5000;
  while (Date.now() < target) {
    say(`waiting for ${label} (${Math.ceil((target - Date.now()) / 1000)} s)`);
    await sleep(Math.min(60000, target - Date.now()));
  }
}

// ── the demonstration ────────────────────────────────────────────────────────
//
// One organisation, one constitution, and nothing asked of a photograph that
// the photograph does not contain. The images are two views of one Growatt
// string inverter on a plant room wall (the unit and its rating plate), a
// Kostal inverter with no plate in frame, and an off-grid power room; see
// fixtures/ATTRIBUTION.md.

const CONSTITUTION = JSON.stringify({
  organization_name: "Demonstration community solar fund",
  mission: "Keep the demonstration's community solar sites producing by funding maintenance "
    + "that meets the rules written here. A demonstration of how the record works, not "
    + "anyone's organisation.",
  supported_infrastructure_types: ["COMMUNITY_SOLAR", "MICROGRID"],
  approved_maintenance_types: ["INSPECTION", "CORRECTIVE_MAINTENANCE", "COMPONENT_REPLACEMENT",
                               "INVERTER_REPAIR"],
  principles: [
    { text: "Equipment installed under a work order is mounted on a wall or a rack, with its "
            + "cabling made off at the unit, never left loose." },
    { text: "Every inverter installed or replaced under a work order is identifiable from its "
            + "own rating plate in the evidence." },
    { text: "The site is left with enclosure covers fitted and no exposed conductors." },
  ],
  evidence_rules: { min_images: 1, inspection_report_required: false },
  funding_rules: { max_payment_wei: (3n * GEN).toString(), max_open_work_orders: 8 },
  windows: { appeal_window_seconds: 600, amendment_window_seconds: 600 },
  stewards: [KEYS.FOUNDER.addr, KEYS.STEWARD.addr],
});

function terms({ title, criteria, type = "INVERTER_REPAIR", images = 1, payment = 2n * GEN, days = 14 }) {
  return JSON.stringify({
    maintenance_type: type,
    title,
    description: "Demonstration work order, photographed on site for settlement.",
    requirements: "The failed string inverter is replaced by the unit these terms name, mounted "
      + "on the plant room wall, and the replacement is identifiable from its rating plate.",
    acceptance_criteria: criteria,
    required_evidence: [{ type: "IMAGE", min_count: images }],
    payment_wei: payment.toString(),
    deadline: new Date(Date.now() + days * 86400000).toISOString().replace(/\.\d+Z$/, "Z"),
  });
}

const GROWATT_CRITERION = [{ text: "A Growatt MOD 4000TL3-X inverter is installed on the plant room "
                                   + "wall, identified by its rating plate." }];
const WRONG_CRITERION = [{ text: "A Growatt MOD 10KTL3-X inverter is installed on the plant room "
                                 + "wall, identified by its rating plate." }];
const KOSTAL_CRITERION = [{ text: "The replacement inverter is installed on the wall with its "
                                  + "cabling connected." }];

async function workOrder(key, aid, termsJson) {
  const created = await step(`${key}.create`, "FOUNDER", "create_work_order",
                             [aid, KEYS.PROVIDER.addr, termsJson]);
  const wid = jsonFrom(created.text)?.work_order_id;
  assert(wid, `${key}: no work order id`);
  await step(`${key}.sign`, "PROVIDER", "accept_work_order", [wid, 1]);
  return wid;
}

async function image(key, role, wid, file, caption, { crit = "C1", origin = "PHOTO" } = {}) {
  const meta = JSON.stringify({ criterion_id: crit, caption, origin,
                                claimed_capture: "September 2026",
                                claimed_location: "Demonstration site" });
  const rec = await step(key, role, "submit_image", [wid, meta, IMG(file)]);
  return jsonFrom(rec.text)?.item_id;
}

const SIGHTED_ATTEMPTS = 3;

/**
 * Ask a panel to assess a work order, and report what it found. A case
 * passed `sighted` is asked again, within the assessments the terms allow,
 * until a panel that actually read the evidence reports on it: a finding
 * from a blind panel demonstrates the network, not the rule under test.
 */
async function assessment(key, wid, items, { sighted = false } = {}) {
  for (let ask = 1; ; ask++) {
    const name = ask === 1 ? key : `${key}.again-${ask}`;
    const rec = await step(name, "PROVIDER", "request_assessment", [wid, JSON.stringify(items)]);
    const round = await readJson("get_round", [wid, jsonFrom(rec.text).round]);
    if (!run.steps[name].nodes) {
      const { nodes } = await dumpReceipt(rec.hash);
      run.steps[name].nodes = nodes.map((n) => ({ rotation: n.rotation, from: n.from,
                                                  vote: n.vote, model: n.model }));
      save();
    }
    const readings = round.notes?.images ?? [];
    const unread = readings.filter((r) => !r.readable).length;
    say(`${name}: ${round.decision}  principles ${JSON.stringify(round.principles)}  `
      + `criteria ${JSON.stringify(round.criteria)}  quality ${round.quality}`
      + (readings.length ? `  read ${readings.length - unread} of ${readings.length} images` : ""));
    if (!sighted || !unread) return round;
    assert(ask < SIGHTED_ATTEMPTS,
           `${key}: the panel never read the evidence in ${ask} assessments, `
           + "so this case proves nothing about what the images show");
    say(`${key}: the panel did not read ${unread} of ${readings.length} images; `
      + `asking again (${ask + 1} of ${SIGHTED_ATTEMPTS})`);
  }
}

// ── the proofs ───────────────────────────────────────────────────────────────

say(`proofs on ${ADDRESS}`);
const cfg = await readJson("get_config", []);
assert(cfg.ruleset === "everkeep-rules-1", "unexpected ruleset");

// 0. The organisation: the founder ratifies v1 and funds the treasury in one act.
const created = await step("org.create", "FOUNDER", "create_organization", [CONSTITUTION],
                           { value: 9n * GEN });
const OID = jsonFrom(created.text)?.organization_id;
assert(OID, "no organisation id");
const org0 = await readJson("get_organization", [OID]);
assert(org0.constitution_version === 1 && org0.escrow_wei === (9n * GEN).toString(),
       `the organisation did not start as expected: ${JSON.stringify(org0)}`);

const asset = JSON.stringify({
  infrastructure_type: "COMMUNITY_SOLAR", name: "Plant room array (demonstration)",
  location: "Demonstration site", technical_profile: "Grid-tied array with one string inverter "
    + "on the plant room wall.", inspector: "",
});
const registered = await step("asset.register", "FOUNDER", "register_asset", [OID, asset]);
const AID = jsonFrom(registered.text)?.asset_id;
assert(AID, "no asset id");

// 1. The enforced half: rules the constitution states as facts are refused in
//    code, before any panel exists to ask. Each is a negative control for a
//    rule the README says is enforced.
await step("enforced.unsupported_type", "FOUNDER", "register_asset",
           [OID, JSON.stringify({ infrastructure_type: "WATER_SYSTEM", name: "Borehole pump" })],
           { refused: "does not support water system" });
await step("enforced.unfunded_type", "FOUNDER", "create_work_order",
           [AID, KEYS.PROVIDER.addr, terms({ title: "Emergency call-out", type: "EMERGENCY_REPAIR",
                                             criteria: GROWATT_CRITERION })],
           { refused: "does not fund emergency repair" });
await step("enforced.payment_cap", "FOUNDER", "create_work_order",
           [AID, KEYS.PROVIDER.addr, terms({ title: "Overpriced repair", criteria: GROWATT_CRITERION,
                                             payment: 4n * GEN })],
           { refused: "exceeds the constitution's limit" });
await step("enforced.stranger_commissions", "STRANGER", "create_work_order",
           [AID, KEYS.PROVIDER.addr, terms({ title: "Uninvited repair", criteria: GROWATT_CRITERION })],
           { refused: "only a steward named in the constitution" });

// 2. The flagship: the plate on the wall reads the model the order named.
const flagWid = await workOrder("flagship", AID, terms({
  title: "Replace the failed string inverter, plant room", criteria: GROWATT_CRITERION, images: 2 }));
const flagFront = await image("flagship.inverter", "PROVIDER", flagWid, "growatt-inverter",
                              "The replacement inverter on the plant room wall");
await step("enforced.min_images", "PROVIDER", "request_assessment", [flagWid, JSON.stringify([flagFront])],
           { refused: "requires at least 2 image" });
const flagPlate = await image("flagship.plate", "PROVIDER", flagWid, "growatt-nameplate",
                              "The rating plate on the same unit", { origin: "NAMEPLATE" });
const flagRound = await assessment("flagship.assess", flagWid, [flagFront, flagPlate]);
assert(flagRound.decision === "ACCEPTED",
       `flagship: ${flagRound.decision}, principles ${JSON.stringify(flagRound.principles)}, `
       + `criteria ${JSON.stringify(flagRound.criteria)}`);
assert(flagRound.criteria.C1 === "MET", "flagship: the criterion was not established");
assert(flagRound.constitution_version === 1, "flagship: the round does not cite constitution v1");
assert(flagRound.quality === "SUFFICIENT", "flagship: evidence not recorded as sufficient");

// The walls that only stand while the flagship's window is open.
await step("walls.finalize_early", "STRANGER", "finalize", [flagWid],
           { refused: "the appeal window is still open" });
await step("walls.provider_appeals_own_acceptance", "PROVIDER", "open_appeal",
           [flagWid, "We would like more money."],
           { refused: "only a steward appeals an acceptance" });
await step("walls.files_against_acceptance", "STEWARD", "submit_document",
           [flagWid, JSON.stringify({ title: "Objection", doc_type: "OTHER" }), "We object."],
           { refused: "to contest it, open an appeal" });

// 2b. A second acceptance, kept for the appeal, so that contesting a decision
//     never depends on which way another case happened to fail.
const appealWid = await workOrder("appealcase", AID, terms({
  title: "Replace the failed string inverter, contested", criteria: GROWATT_CRITERION, images: 2 }));
const appealFront = await image("appealcase.inverter", "PROVIDER", appealWid, "growatt-inverter",
                                "The replacement inverter on the plant room wall");
const appealPlate = await image("appealcase.plate", "PROVIDER", appealWid, "growatt-nameplate",
                                "The rating plate on the same unit", { origin: "NAMEPLATE" });
const appealFirst = await assessment("appealcase.assess", appealWid, [appealFront, appealPlate]);
assert(appealFirst.decision === "ACCEPTED", `the appeal case did not accept: ${appealFirst.decision}`);
await step("appeal.open", "STEWARD", "open_appeal",
           [appealWid, "The unit on the wall is not the one the order specified."]);

// 3. The floor: the same wall, and only a document names the model.
const paperWid = await workOrder("paper", AID, terms({
  title: "Replace the failed string inverter, identified on paper", criteria: GROWATT_CRITERION }));
const paperFront = await image("paper.inverter", "PROVIDER", paperWid, "growatt-inverter",
                               "The replacement inverter on the wall");
const paperDoc = await step("paper.datasheet", "PROVIDER", "submit_document",
           [paperWid, JSON.stringify({ title: "Inverter datasheet", doc_type: "TECHNICAL_REPORT",
                                       reference: "DS-MOD4000", criterion_id: "C1" }),
            "Growatt PV Grid Inverter. Model name MOD 4000TL3-X. Max output power 4000 W. "
            + "The unit supplied and installed under this work order is the model named above."]);
const paperRound = await assessment("paper.assess", paperWid,
                                    [paperFront, jsonFrom(paperDoc.text).item_id], { sighted: true });
assert(paperRound.decision !== "ACCEPTED", `a paper identification paid: ${paperRound.decision}`);
assert(paperRound.criteria.C1 !== "MET", `the criterion stood on a document: ${paperRound.criteria.C1}`);

// 4. The mismatch: same manufacturer, different product. The plate settles it.
const wrongWid = await workOrder("mismatch", AID, terms({
  title: "Replace the failed inverter with a ten kilowatt unit", criteria: WRONG_CRITERION, images: 2 }));
const wrongFront = await image("mismatch.inverter", "PROVIDER", wrongWid, "growatt-inverter",
                               "The inverter on the wall");
const wrongPlate = await image("mismatch.plate", "PROVIDER", wrongWid, "growatt-nameplate",
                               "The rating plate on the same unit", { origin: "NAMEPLATE" });
const wrongRound = await assessment("mismatch.assess", wrongWid, [wrongFront, wrongPlate], { sighted: true });
assert(wrongRound.decision !== "ACCEPTED", `a plate reading another product paid: ${wrongRound.decision}`);

// 5. The principle: the order's own criterion is met by a wall-mounted unit,
//    but the constitution says every inverter must be identifiable from its
//    plate, and no plate is in frame. The judged half withholds the payment.
const prinWid = await workOrder("principle", AID, terms({
  title: "Replace the failed inverter, no plate photographed", criteria: KOSTAL_CRITERION,
  type: "COMPONENT_REPLACEMENT" }));
const prinPhoto = await image("principle.inverter", "PROVIDER", prinWid, "kostal-inverter",
                              "The replacement inverter on the wall");
const prinRound = await assessment("principle.assess", prinWid, [prinPhoto], { sighted: true });
assert(prinRound.decision !== "ACCEPTED",
       `an inverter with no plate in evidence paid: ${prinRound.decision}`);
assert(prinRound.principles.P2 !== "SATISFIED",
       `principle P2 stood without a plate: ${prinRound.principles.P2}`);

// 6. More walls, in the contract's own words.
await step("walls.stranger_files", "STRANGER", "submit_document",
           [flagWid, JSON.stringify({ title: "Note" }), "Let me in."],
           { refused: "only a steward, the provider and the asset's accepted inspector" });
await step("walls.stranger_assessment", "STRANGER", "request_assessment",
           [prinWid, JSON.stringify([prinPhoto])],
           { refused: "only the provider requests an assessment" });
await step("walls.provider_inspection_report", "PROVIDER", "submit_document",
           [prinWid, JSON.stringify({ title: "My own inspection", doc_type: "INSPECTION_REPORT" }),
            "I inspected my own work and it is fine."],
           { refused: "only the asset's accepted inspector files an inspection report" });

// 7. The appeal: a steward contested an acceptance on the same evidence that
//    produced it. A fresh panel re-reads the record under the same constitution.
const contested = await readJson("get_work_order", [appealWid]);
assert(contested.state === "APPEALED", `the appeal did not open: ${contested.state}`);
await waitUntil(contested.appeal.evidence_ends, "the appeal's evidence period");
const appealRec = await step("appeal.decide", "STRANGER", "decide_appeal", [appealWid]);
const appealRecord = await readJson("get_round", [appealWid, jsonFrom(appealRec.text).round]);
assert(appealRecord.kind === "APPEAL", "the appeal did not record an appeal round");
assert(appealRecord.reviewed_round === 1, "the appeal did not name the round it reviewed");
assert(appealRecord.constitution_version === 1, "the appeal did not cite the same constitution");
assert((await readJson("get_work_order", [appealWid])).state !== "APPEALED",
       "the appeal is still open after its readjudication");
say(`appeal: reviewed round 1, decided ${appealRecord.decision}, `
  + `principles ${JSON.stringify(appealRecord.principles)} criteria ${JSON.stringify(appealRecord.criteria)}`);

// 8. Settlement: the flagship pays once it can no longer be contested, and the
//    treasury moves by exactly the committed amount.
const standing = (await readJson("get_work_order", [flagWid])).standing;
await waitUntil(standing.window_ends, "the flagship's appeal window");
const orgBefore = await readJson("get_organization", [OID]);
await step("flagship.finalize", "STRANGER", "finalize", [flagWid]);
const orgAfter = await readJson("get_organization", [OID]);
assert(BigInt(orgBefore.escrow_wei) - BigInt(orgAfter.escrow_wei) === 2n * GEN,
       "the treasury did not move by the committed payment");
assert(BigInt(orgAfter.paid_wei) - BigInt(orgBefore.paid_wei) === 2n * GEN, "paid_wei drifted");
const owed = BigInt((await readJson("get_balance", [KEYS.PROVIDER.addr])).claimable);
assert(owed >= 2n * GEN, `the provider is owed ${owed}`);
const before = await balance("PROVIDER");
await step("flagship.claim", "PROVIDER", "claim", [], { transfer: true });
const after = await balance("PROVIDER");
assert(after > before, "the claim did not reach the wallet");
say(`the provider's wallet received ${after - before} wei`);
assert((await readJson("get_balance", [KEYS.PROVIDER.addr])).claimable === "0",
       "the ledger still owes after a claim");

say(`stats ${JSON.stringify(await readJson("get_stats", []))}`);
const missed = run.no_consensus ?? [];
if (missed.length) {
  say(`${missed.length} round(s) reached no majority and were asked again:`);
  for (const r of missed) say(`  ${r.name} ${r.hash}`);
} else {
  say("every round reached a majority on its first asking");
}
say("every proof passed");
