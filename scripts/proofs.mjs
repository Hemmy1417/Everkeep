/**
 * Live proofs on an EVERKEEP deployment: the brief's flagship story on the
 * chain. Every claim is an assertion; if the contract or the panel behaves
 * otherwise, the run stops and says which. Resumable: each step is kept by
 * name with its transaction hash in .data/proofs-<address>.json.
 *
 *   node scripts/proofs.mjs 0x…
 *
 * The story: an organisation with a constitution and a funded treasury; a
 * provider registry; an enrolled asset with an independent inspector; the
 * enforced half refused in code; a charge controller replacement accepted on
 * photographs, a reading, a technician report and the inspector's
 * checklist; a battery service rejected for temporary clip leads on the
 * terminals; a restoration undetermined on paper and decided again on
 * appeal with new evidence; finality, settlement to the provider, the asset
 * back to monitoring, and the next cycle's work order.
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

const ROUNDS = new Set(["request_assessment", "readjudicate"]);
const ROUND_ATTEMPTS = 4;

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
// One organisation, one enrolled asset, one authorised provider and an
// independent inspector. The photographs are three public-domain views of a
// small off-grid solar battery installation (fixtures/ATTRIBUTION.md): an
// overview of the equipment board, a close-up of the charge controller with
// its display, and the battery terminals. Nothing is asked of a photograph
// that it does not contain.

const CONSTITUTION = JSON.stringify({
  organization_name: "Lakeside Community Energy Trust (demonstration)",
  mission: "Maintain essential community infrastructure by continuously funding and verifying "
    + "legitimate maintenance work according to transparent, predefined rules. A demonstration of "
    + "how the record works, not anyone's organisation.",
  supported_infrastructure_types: ["COMMUNITY_SOLAR", "BATTERY_STORAGE", "MICROGRID"],
  eligibility_rules: {
    approved_maintenance_types: ["INSPECTION", "COMPONENT_REPLACEMENT", "BATTERY_SERVICE",
                                 "SYSTEM_RESTORATION", "EMERGENCY_REPAIR"],
    inspection_report_required_for: [],
  },
  maintenance_principles: [
    { text: "Equipment installed or replaced is fixed in place, and its cabling is landed in its own "
            + "terminals rather than left loose.", applies_to: [] },
    { text: "Temporary clip leads are never left on battery terminals as a permanent connection.",
      applies_to: ["BATTERY_SERVICE"] },
    { text: "Restoration work leaves the system reporting a normal operating reading.",
      applies_to: ["SYSTEM_RESTORATION", "COMPONENT_REPLACEMENT"] },
  ],
  evidence_requirements: [{ maintenance_type: "ALL", type: "AFTER_PHOTO", min_count: 1 }],
  funding_rules: { max_payment_wei: (3n * GEN).toString(), max_open_work_orders: 6,
                   reserve_floor_wei: GEN.toString() },
  emergency_rules: { emergency_max_payment_wei: (4n * GEN).toString(), emergency_appeal_window_seconds: 600 },
  appeal_rules: { appeal_window_seconds: 600, evidence_period_seconds: 600, max_appeals_per_work_order: 1 },
  governance: { stewards: [KEYS.FOUNDER.addr, KEYS.STEWARD.addr], motion_window_seconds: 600,
                dissolution_beneficiary: KEYS.BENEFICIARY.addr },
});

const ASSET = JSON.stringify({
  asset_type: "COMMUNITY_SOLAR", name: "Workshop battery bank (demonstration)",
  description: "Off-grid solar supply for a community workshop: a PWM charge controller, two 12 V "
    + "deep-cycle batteries and an inverter on one equipment board.",
  location_reference: "Workshop equipment bay", operator: "Workshop volunteers",
  technical_profile: "PWM solar charge controller with LCD display; two 12 V flooded deep-cycle "
    + "batteries; portable inverter.",
  installation_date: "2024-05-01", maintenance_interval_days: 180, inspector: KEYS.INSPECTOR.addr,
});

const deadline = (days) => new Date(Date.now() + days * 86400000).toISOString().replace(/\.\d+Z$/, "Z");

function terms({ type, title, requirements, criteria, required = [], payment = 2n * GEN, spec = "" }) {
  return JSON.stringify({
    maintenance_type: type, title, requirements, specification: spec,
    description: "Demonstration work order, photographed on site.",
    acceptance_criteria: criteria.map((text) => ({ text })), required_evidence: required,
    budget_wei: payment.toString(), payment_wei: payment.toString(), deadline: deadline(14),
  });
}

async function image(key, role, wid, file, view, description) {
  const meta = JSON.stringify({ view, description, capture_timestamp: "as filed by the submitter",
                                location_reference: "Workshop equipment bay" });
  return jsonFrom((await step(key, role, "submit_image", [wid, meta, IMG(file)])).text)?.evidence_id;
}

async function doc(key, role, wid, doc_type, title, text) {
  return jsonFrom((await step(key, role, "submit_document", [wid, JSON.stringify({ doc_type, title }), text])).text)?.evidence_id;
}

async function workOrder(key, t) {
  const rec = await step(`${key}.create`, "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr, t]);
  const wid = jsonFrom(rec.text)?.work_order_id;
  assert(wid, `${key}: no work order id`);
  await step(`${key}.accept`, "PROVIDER", "accept_work_order", [wid, 1]);
  return wid;
}

/** Ask for a decision and read it back; a case passed `seen` insists the panel saw every photograph. */
async function decide(key, fn, wid, role = "PROVIDER") {
  for (let ask = 1; ; ask++) {
    const name = ask === 1 ? key : `${key}.again-${ask}`;
    const rec = await step(name, role, fn, [wid]);
    const d = await readJson("get_decision", [jsonFrom(rec.text).decision_id]);
    if (!run.steps[name].nodes) {
      const { nodes } = await dumpReceipt(rec.hash, ["[ASSESS]", "[DISSENT]"]);
      run.steps[name].nodes = nodes.map((n) => ({ rotation: n.rotation, vote: n.vote, model: n.model }));
      save();
    }
    const rs = Object.fromEntries(d.requirements.map((r) => [r.id, r.status]));
    say(`${name}: ${d.outcome} ${JSON.stringify(rs)} sufficient=${d.evidence_sufficient}`);
    return d;
  }
}

/**
 * The app's own rules (web/lib/acts.ts), run against chain state. Before a
 * write the script asserts the page would offer it to that wallet; before a
 * refusal, that the page would not. A mismatch fails the run.
 */
const { orderActs, orgActs, seatOn, preflightGap, currentTerms } = await import("../web/lib/acts.ts");
async function offered(label, wid, role, act, expected) {
  // Checked once, at the moment it belongs to; a resumed run keeps the result.
  if (run.app?.[label]) return;
  const w = await readJson("get_work_order", [wid]);
  const o = await readJson("get_organization", [w.organization_id]);
  const a = await readJson("get_asset", [w.asset_id]);
  const c = await readJson("get_constitution", [w.organization_id, w.constitution_version]);
  const d = w.current_decision_id ? await readJson("get_decision", [w.current_decision_id]) : null;
  const addr = KEYS[role].addr;
  const items = (w.evidence[String(w.current_version || 1)] ?? []).filter((it) => it.kind === "IMAGE" || it.kind === "DOCUMENT");
  const gap = w.current_version ? preflightGap(c, currentTerms(w), items) : "";
  const now = Date.parse(w.now);
  const got = orderActs(w, o, d, seatOn(w, a, o.stewards, addr), addr, now, gap)[act];
  run.app = run.app ?? {};
  run.app[label] = { role, act, expected, got };
  save();
  assert(got === expected, `the app ${expected ? "does not offer" : "offers"} ${act} to ${role} at ${label}`);
}
async function orgOffered(label, role, act, expected) {
  if (run.app?.[label]) return;
  const o = await readJson("get_organization", [OID]);
  const c = await readJson("get_constitution", [OID, o.constitution_version]);
  const got = orgActs(o, c, KEYS[role].addr, Date.parse(o.now))[act];
  run.app = run.app ?? {};
  run.app[label] = { role, act, expected, got };
  save();
  assert(got === expected, `the app ${expected ? "does not offer" : "offers"} ${act} to ${role} at ${label}`);
}

say(`proofs on ${ADDRESS}`);
const cfg = await readJson("get_config", []);
assert(cfg.ruleset === "everkeep-rules-3", "unexpected ruleset");

// 0. The organisation, its provider registry and its infrastructure.
const founded = await step("org.found", "FOUNDER", "create_organization", [CONSTITUTION], { value: 14n * GEN });
const OID = jsonFrom(founded.text)?.organization_id;
assert(OID && !jsonFrom(founded.text).refused, `founding failed: ${founded.text}`);
await orgOffered("steward.before_accepting", "STEWARD", "pause", false);
await step("walls.unaccepted_steward", "STEWARD", "pause_organization", [OID, ""],
           { refused: "who has accepted the role" });
await orgOffered("steward.accept_offered", "STEWARD", "acceptSteward", true);
await step("steward.accept", "STEWARD", "accept_steward_role", [OID]);
await orgOffered("steward.after_accepting", "STEWARD", "acceptSteward", false);
await step("provider.authorize", "FOUNDER", "authorize_provider", [OID, KEYS.PROVIDER.addr,
  JSON.stringify({ name: "Brightline Solar Services (demonstration)",
                   maintenance_types: ["COMPONENT_REPLACEMENT", "BATTERY_SERVICE", "SYSTEM_RESTORATION"] })]);
const AID = jsonFrom((await step("asset.enrol", "FOUNDER", "register_asset", [OID, ASSET])).text)?.asset_id;
assert(AID, "no asset id");
await step("inspector.accept", "INSPECTOR", "accept_inspector_role", [AID]);
let asset = await readJson("get_asset", [AID]);
// A state check belongs to its moment: a resumed run past it skips it.
if (!run.steps["flagship.create"]) assert(asset.status === "MONITORING", `a new asset should be monitored: ${asset.status}`);

// 1. The enforced half, refused in code with no panel asked.
await step("enforced.unsupported_asset", "FOUNDER", "register_asset",
           [OID, JSON.stringify({ asset_type: "WATER_SYSTEM", name: "Borehole pump" })],
           { refused: "does not support water system" });
await step("enforced.unfunded_work", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr,
  terms({ type: "ELECTRICAL_REPAIR", title: "Rewire the board", requirements: "Rewire the equipment board end to end.",
          criteria: ["The board is rewired."] })], { refused: "does not fund electrical repair" });
await step("enforced.over_cap", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr,
  terms({ type: "COMPONENT_REPLACEMENT", title: "Gold-plated controller", payment: 4n * GEN,
          requirements: "Replace the controller with an expensive one.", criteria: ["It is replaced."] })],
  { refused: "exceeds the constitution's limit" });
await step("enforced.unauthorised_provider", "FOUNDER", "create_work_order", [AID, KEYS.STRANGER.addr,
  terms({ type: "COMPONENT_REPLACEMENT", title: "Unvetted repair", requirements: "Replace the charge controller.",
          criteria: ["It is replaced."] })], { refused: "not authorised by this organisation" });
await step("enforced.stranger_commissions", "STRANGER", "create_work_order", [AID, KEYS.PROVIDER.addr,
  terms({ type: "COMPONENT_REPLACEMENT", title: "Uninvited", requirements: "Replace the charge controller.",
          criteria: ["It is replaced."] })], { refused: "only a steward" });

// 2. The flagship: the failed charge controller is replaced, and the evidence
//    (after photograph, display reading, technician report, inspector's
//    checklist) establishes it.
const flag = await workOrder("flagship", terms({
  type: "COMPONENT_REPLACEMENT", title: "Replace the failed charge controller",
  requirements: "Replace the failed solar charge controller, fix it to the equipment board, land the "
    + "panel and battery cables in its terminals, and return the bank to charging.",
  spec: "12/24 V PWM solar charge controller with LCD display.",
  criteria: ["A solar charge controller is fixed to the equipment board with its cables landed in its terminals.",
             "The controller's display shows the battery bank at a normal voltage for a 12 V bank."],
  required: [{ type: "OPERATIONAL_READING", min_count: 1 }] }));
await offered("flagship.before_evidence", flag, "PROVIDER", "assess", false);
await step("flagship.preflight_refused", "PROVIDER", "request_assessment", [flag],
           { refused: "1 after photo before assessment; 0 on file" });
await image("flagship.after", "PROVIDER", flag, "bank-overview", "AFTER",
            "The equipment board after the work: controller at left, batteries, inverter");
await image("flagship.display", "PROVIDER", flag, "controller-display", "METER_DISPLAY",
            "The replacement controller, screwed down, display reading the battery voltage");
await doc("flagship.report", "PROVIDER", flag, "TECHNICAL_REPORT", "Technician report",
          "Removed the failed charge controller. Fitted a 12/24 V PWM controller with LCD display, fixed "
          + "with two screws to the equipment board. Landed panel and battery cables in the controller "
          + "terminals. On completion the display read 12.5 V for the battery bank.");
const flagChecklist = await doc("flagship.checklist", "INSPECTOR", flag, "INSPECTION_CHECKLIST", "Inspection checklist",
          "Controller fixed to board: yes. Cables landed in terminals: yes. Display lit and reading battery "
          + "voltage: yes, 12.5 V. No loose conductors at the controller: yes.");
await step("walls.provider_inspection_report", "PROVIDER", "submit_document",
           [flag, JSON.stringify({ doc_type: "INSPECTION_REPORT", title: "My own inspection" }), "Fine."],
           { refused: "only the asset's accepted inspector" });
await offered("flagship.ready", flag, "PROVIDER", "assess", true);
const flagDecision = await decide("flagship.assess", "request_assessment", flag);
assert(flagDecision.outcome === "ACCEPTED", `flagship: ${flagDecision.outcome}`);
// Negative controls: on a clean, consistent file neither flag is raised.
assert(flagDecision.conflicts_detected === false, "a conflict was recorded on the clean flagship file");
assert(flagDecision.requirements.find((r) => r.id === "S1")?.status === "SATISFIED",
       "the flagship's photographs were not found to show the enrolled asset");
// With an inspector on the asset, every principle and criterion met cites
// the inspector's observation (the S8 floor), read back from the record.
for (const r of flagDecision.requirements.filter((x) => /^[PC]/.test(x.id) && x.status === "SATISFIED")) {
  const cited = flagDecision.notes.basis[r.id] ?? [];
  assert(cited.some((e) => e === flagChecklist), `${r.id} was accepted without the inspector's observation`);
}
await offered("flagship.steward_may_appeal", flag, "STEWARD", "appeal", true);
await offered("flagship.provider_may_not_appeal", flag, "PROVIDER", "appeal", false);
await offered("flagship.not_final_yet", flag, "STRANGER", "finalize", false);
assert(flagDecision.constitution_version === 1 && flagDecision.work_order_version === 1,
       "the decision does not cite the exact rules and terms");
const flagSnap = await readJson("get_snapshot", [flagDecision.snapshot_id]);
assert(flagSnap.evidence_count === 4, `the snapshot should hold four items, holds ${flagSnap.evidence_count}`);
assert(!flagDecision.requirements.some((r) => r.id === "P2"), "a battery-service principle was put to a replacement");
await step("walls.finalize_early", "STRANGER", "finalize", [flag], { refused: "appeal window is still open" });
await step("walls.provider_appeals_acceptance", "PROVIDER", "open_appeal", [flag, "More, please."],
           { refused: "only a steward appeals an acceptance" });
await step("walls.settle_early", "STRANGER", "settle", [flag], { refused: "only a finalized acceptance" });

// 3. The rejection: a battery service leaves temporary clip leads on the
//    terminals, which the constitution forbids for this kind of work.
const clip = await workOrder("clipleads", terms({
  type: "BATTERY_SERVICE", title: "Service the battery bank connections",
  requirements: "Clean the battery terminals and make every battery connection permanent and secure.",
  criteria: ["Every battery connection is permanent and secure."] }));
await image("clipleads.after", "PROVIDER", clip, "battery-terminals", "AFTER",
            "The battery bank after servicing");
const clipDecision = await decide("clipleads.assess", "request_assessment", clip);
assert(clipDecision.outcome !== "ACCEPTED", `clip leads on the terminals were accepted`);
if (clipDecision.outcome === "REJECTED") {
  assert(clipDecision.evidence_sufficient === true, "a rejection was recorded on evidence found insufficient");
  assert(clipDecision.failed.includes("P2"), "the rejection does not rest on the clip-lead principle");
  assert(JSON.stringify(clipDecision.bound.requirements) === JSON.stringify(clipDecision.failed),
         "the record does not say which failures every validator reproduced");
} else {
  // The inspector floor: a SATISFIED the provider's photograph alone cannot
  // carry is recorded as not established, so doubt, never payment.
  const floored = Object.entries(clipDecision.notes.raw).filter(([id, raw]) => /^[PC]/.test(id) && raw === "SATISFIED");
  for (const [id] of floored) {
    assert(clipDecision.requirements.find((r) => r.id === id)?.status === "NOT_ESTABLISHED",
           `${id} was read as met on the provider's photograph alone and kept`);
  }
  assert(clipDecision.bound.requirements.length === 0, "a doubtful result claims bound requirements");
  run.floored = floored.map(([id]) => id);
  save();
  say(`clipleads: the panel read ${floored.map(([id]) => id).join(", ") || "nothing"} as met on the provider's photograph alone; the inspector floor recorded doubt`);
}
say(`clipleads: ${clipDecision.outcome}, failed ${JSON.stringify(clipDecision.failed)}`);

// 3b. Mislabelled equipment (S1 and label guardrail, positive control): the
//     back of a solar panel, filed as the new charge controller.
const wrong = await workOrder("mislabel", terms({
  type: "COMPONENT_REPLACEMENT", title: "Replace the charge controller (mislabelled file)", payment: GEN,
  requirements: "Replace the failed solar charge controller and fix it to the equipment board.",
  criteria: ["A solar charge controller is fixed to the equipment board with its cables landed in its terminals."] }));
await image("mislabel.after", "PROVIDER", wrong, "panel-backside", "AFTER",
            "The new charge controller fixed to the equipment board");
await step("walls.same_bytes_twice", "PROVIDER", "submit_image",
           [wrong, JSON.stringify({ view: "BEFORE", description: "Before" }), IMG("panel-backside")],
           { refused: "these exact bytes are already on file" });
const wrongDecision = await decide("mislabel.assess", "request_assessment", wrong);
assert(wrongDecision.outcome !== "ACCEPTED", "a photograph of a solar panel was accepted as a charge controller");
const wrongS1 = wrongDecision.requirements.find((r) => r.id === "S1")?.status;
const wrongC1 = wrongDecision.requirements.find((r) => r.id === "C1")?.status;
assert(wrongC1 !== "SATISFIED", "the criterion was met on a photograph of different equipment");
run.mislabel = { raw_c1: wrongDecision.notes.raw.C1, shows: wrongDecision.notes.observations.map((o) => o.shows) };
save();
say(`mislabel: ${wrongDecision.outcome}, S1 ${wrongS1}, C1 ${wrongC1} (the panel's own rating ${wrongDecision.notes.raw.C1}), conflicts ${wrongDecision.conflicts_detected}`);
say(`mislabel: the panel saw ${JSON.stringify(run.mislabel.shows)}`);

// 3c. A contradiction (conflict flag, positive control): the provider's report
//     states a reading the photographed display does not show.
const cont = await workOrder("conflict", terms({
  type: "COMPONENT_REPLACEMENT", title: "Replace the charge controller (contradictory report)", payment: GEN,
  requirements: "Replace the failed solar charge controller and show the battery reading on its display.",
  criteria: ["The controller's display shows the battery bank at a normal voltage for a 12 V bank."],
  required: [{ type: "OPERATIONAL_READING", min_count: 1 }] }));
await image("conflict.display", "PROVIDER", cont, "controller-display", "AFTER",
            "The replacement controller and its display after the work");
await doc("conflict.report", "PROVIDER", cont, "METER_READING", "Reading taken on site",
          "After replacement the controller display read 14.6 V for the battery bank, in float.");
const contDecision = await decide("conflict.assess", "request_assessment", cont);
assert(contDecision.outcome !== "ACCEPTED", "a report contradicting the photographed display was accepted");
assert(contDecision.conflicts_detected === true, "the contradiction between report and display was not flagged");
say(`conflict: ${contDecision.outcome}, note ${JSON.stringify(contDecision.notes.conflict_note)}`);

// 4. Undetermined, then accepted on appeal: the first file cannot show the
//    reading; the provider appeals with the close-up of the display.
const rest = await workOrder("restore", terms({
  type: "SYSTEM_RESTORATION", title: "Return the battery bank to charging",
  requirements: "Restore charging to the battery bank and show the charge controller reporting a normal reading.",
  criteria: ["The charge controller's display shows the battery bank at a normal voltage for a 12 V bank."] }));
await image("restore.after", "PROVIDER", rest, "bank-overview", "AFTER", "The equipment board after the work");
await doc("restore.reading", "PROVIDER", rest, "METER_READING", "Reading taken on site",
          "Battery voltage at the controller after restoration: 12.5 V.");
const restFirst = await decide("restore.assess", "request_assessment", rest);
assert(restFirst.outcome !== "ACCEPTED", "a reading on paper alone was accepted");
await offered("restore.provider_may_appeal", rest, "PROVIDER", "appeal", restFirst.outcome !== "ACCEPTED");
if (restFirst.outcome === "UNDETERMINED") {
  await step("restore.appeal", "PROVIDER", "open_appeal",
             [rest, "The reading was taken on site; the attached photograph shows the controller's display."]);
  await image("restore.display", "PROVIDER", rest, "controller-display", "METER_DISPLAY",
              "The controller's display after restoration");
  const restSecond = await decide("restore.readjudicate", "readjudicate", rest);
  assert(restSecond.appeal_of === restFirst.decision_id, "the readjudication is not linked to the decision it reviews");
  const original = await readJson("get_decision", [restFirst.decision_id]);
  assert(original.lifecycle === "SUPERSEDED" && original.outcome === restFirst.outcome,
         "the original decision was overwritten");
  say(`restore: ${restFirst.outcome} -> ${restSecond.outcome} on appeal`);
  if (restSecond.outcome === "ACCEPTED") {
    await step("restore.finalize", "STRANGER", "finalize", [rest]);
    await step("restore.settle", "STRANGER", "settle", [rest], { transfer: true });
  }
}

// 4b. A steward appeals an acceptance with photographs of their own (S42):
//     whatever the panel finds, no requirement fails on the payer's
//     photographs alone. Asserted on the recorded basis.
const sa = await workOrder("stewardappeal", terms({
  type: "COMPONENT_REPLACEMENT", title: "Replace the charge controller (contested)", payment: GEN,
  requirements: "Replace the failed solar charge controller, fix it to the equipment board and land its cables.",
  criteria: ["A solar charge controller is fixed to the equipment board with its cables landed in its terminals."] }));
await image("stewardappeal.after", "PROVIDER", sa, "controller-display", "AFTER",
            "The replacement controller, screwed down, cables landed");
const saChecklist = await doc("stewardappeal.checklist", "INSPECTOR", sa, "INSPECTION_CHECKLIST", "Inspection checklist",
          "Controller fixed to board: yes. Cables landed in its terminals: yes. Display lit: yes.");
const saFirst = await decide("stewardappeal.assess", "request_assessment", sa);
say(`stewardappeal: first ${saFirst.outcome}`);
if (saFirst.outcome === "ACCEPTED") {
  await offered("stewardappeal.steward_may_appeal", sa, "STEWARD", "appeal", true);
  await step("stewardappeal.appeal", "STEWARD", "open_appeal",
             [sa, "The battery terminals still carry temporary clip leads."]);
  const sp = await image("stewardappeal.steward_photo", "STEWARD", sa, "battery-terminals", "SITE",
                         "The battery terminals today");
  const saSecond = await decide("stewardappeal.readjudicate", "readjudicate", sa, "STEWARD");
  const roleOf = Object.fromEntries((await readJson("get_snapshot", [saSecond.snapshot_id])).evidence.map((e) => [e.evidence_id, e.role]));
  for (const id of saSecond.failed) {
    const cited = saSecond.notes.basis[id] ?? [];
    assert(cited.some((e) => roleOf[e] && roleOf[e] !== "STEWARD"),
           `${id} failed on the steward's own photographs alone`);
  }
  say(`stewardappeal: ${saFirst.outcome} -> ${saSecond.outcome} on the steward's appeal; failed ${JSON.stringify(saSecond.failed)}`);
  assert(sp && saChecklist, "the contested file is incomplete");
}

// 5. Finality: the flagship settles once its window has passed, the asset
//    returns to monitoring, and the next cycle's work order can be created.
await waitUntil(flagDecision.appeal_window_ends, "the flagship's appeal window");
await offered("flagship.final_now", flag, "STRANGER", "finalize", true);
await step("flagship.finalize", "STRANGER", "finalize", [flag]);
await offered("flagship.settle_offered", flag, "STRANGER", "settle", true);
const settledEarlier = !!run.steps["flagship.settle"];
const before = await balance("PROVIDER");
const orgBefore = await readJson("get_organization", [OID]);
await step("flagship.settle", "STRANGER", "settle", [flag], { transfer: true });
const orgAfter = await readJson("get_organization", [OID]);
if (!settledEarlier) {
  // Measured around the settlement itself; a resumed run past it has no "before".
  assert(BigInt(orgBefore.escrow_wei) - BigInt(orgAfter.escrow_wei) === 2n * GEN, "the treasury did not pay exactly 2 GEN");
  assert((await balance("PROVIDER")) > before, "the provider's wallet did not receive the payment");
}
assert((await readJson("get_work_order", [flag])).settlement?.to === KEYS.PROVIDER.addr, "no settlement recorded");
await waitUntil(clipDecision.appeal_window_ends, "the rejection's appeal window");
await step("clipleads.finalize", "STRANGER", "finalize", [clip]);
assert((await readJson("get_work_order", [clip])).state === "CLOSED_UNPAID", "the rejection did not close unpaid");
asset = await readJson("get_asset", [AID]);
say(`asset: ${asset.status}, last serviced ${asset.last_serviced_at}, next due ${asset.next_service_due}`);
assert(asset.last_serviced_at, "the asset records no service");
const next = await step("cycle.next", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr, terms({
  type: "COMPONENT_REPLACEMENT", title: "Six-month check of the replacement controller", payment: GEN,
  requirements: "Inspect the replacement controller six months on and confirm it still charges the bank.",
  criteria: ["The controller's display shows the battery bank at a normal voltage for a 12 V bank."] })]);
assert(jsonFrom(next.text)?.work_order_id, "the next cycle's work order was not created");

say(`stats ${JSON.stringify(await readJson("get_stats", []))}`);
const missed = run.no_consensus ?? [];
const rotated = Object.entries(run.steps).filter(([, v]) => (v.nodes ?? []).some((n) => n.rotation > 0)).map(([k]) => k);
say(missed.length ? `${missed.length} round(s) reached no majority and were asked again` : "no round had to be asked again");
say(rotated.length ? `rounds that needed a leader rotation: ${rotated.join(", ")}` : "no round needed a leader rotation");
say(`the app's own rules agreed with the chain at ${Object.keys(run.app ?? {}).length} checks`);
say("every proof passed");
