/**
 * The organisational paths, live: governance motions, the provider registry,
 * pause, revisions, cancellation, closing and dissolution. scripts/proofs.mjs
 * proves the maintenance cycle; this proves the organisation around it.
 *
 *   node scripts/paths.mjs 0x…
 *
 * What it asserts, in one organisation founded here:
 *   - a stranger cannot propose, object or pause; a steward's amendment is
 *     withdrawn by another steward inside its window; a second one is enacted
 *     by a stranger after its window
 *   - a work order created under v1 keeps v1 after v2 takes effect
 *   - a revoked provider cannot be assigned new work, while work already
 *     assigned continues
 *   - a pause refuses new commitments and lets work in flight continue
 *   - a revision moves the commitment only when the provider accepts it
 *   - unaccepted work is cancelled; accepted work that is never assessed
 *     closes after its deadline; each returns its commitment
 *   - dissolution: proposed, enacted after its window, refused while work is
 *     open, completed once it is not, and the treasury refunded in full to the
 *     beneficiary the constitution names, who claims it
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { EXPLORER, GEN, chain, leaderOf, loadKeys, plainFees, resultText, rpc, sleep, transferFees,
         waitFinal } from "./lib.mjs";

const ADDRESS = process.argv[2];
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS ?? "")) throw new Error("usage: node scripts/paths.mjs 0x…");
const OUT = fileURLToPath(new URL(`../.data/paths-${ADDRESS}.json`, import.meta.url));
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
const jsonFrom = (t) => { const i = t.indexOf("{"); return i >= 0 ? JSON.parse(t.slice(i)) : null; };

async function view(fn, args) {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(await reader.readContract({ address: ADDRESS, functionName: fn, args }));
    } catch (e) {
      if (i >= 5) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}

async function step(name, role, fn, args, { value = 0n, refused = null, transfer = false } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier`);
    return run.steps[name];
  }
  run.pending ??= {};
  let hash = run.pending[name];
  if (!hash) {
    for (let attempt = 0; ; attempt++) {
      try {
        const client = clientFor(role);
        const fees = transfer ? await transferFees(client, { address: ADDRESS, functionName: fn, args, value })
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
  const t = await waitFinal(hash, { label: name, tries: 150 });
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  if (refused) {
    assert(!ok && text.includes(refused), `${name} should be refused with "${refused}", got ${ok ? "success" : text.slice(0, 160)}`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 300)}`);
  }
  say(`${name}: ${ok ? "ok" : "refused as expected"}`);
  run.steps[name] = { name, role, fn, hash, ok, text: text.slice(0, 600), explorer: `${EXPLORER}/tx/${hash}` };
  save();
  return run.steps[name];
}

async function waitUntil(iso, label) {
  const target = Date.parse(iso) + 5000;
  while (Date.now() < target) {
    say(`waiting for ${label} (${Math.ceil((target - Date.now()) / 1000)} s)`);
    await sleep(Math.min(60000, target - Date.now()));
  }
}

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

function constitution(stewards, over = {}) {
  return JSON.stringify({
    organization_name: "Riverside Microgrid Trust (demonstration)",
    mission: "Maintain the riverside microgrid by funding verified maintenance under transparent rules. "
      + "A demonstration of how the record works, not anyone's organisation.",
    supported_infrastructure_types: ["MICROGRID", "COMMUNITY_SOLAR"],
    eligibility_rules: { approved_maintenance_types: ["INSPECTION", "COMPONENT_REPLACEMENT"],
                         inspection_report_required_for: [] },
    maintenance_principles: [{ text: "Equipment installed or replaced is fixed in place with its cabling landed.",
                               applies_to: [] }],
    evidence_requirements: [{ maintenance_type: "ALL", type: "AFTER_PHOTO", min_count: 1 }],
    funding_rules: { max_payment_wei: (2n * GEN).toString(), max_open_work_orders: 6, reserve_floor_wei: "0" },
    emergency_rules: { emergency_max_payment_wei: (2n * GEN).toString(), emergency_appeal_window_seconds: 600 },
    appeal_rules: { appeal_window_seconds: 600, evidence_period_seconds: 600, max_appeals_per_work_order: 1 },
    governance: { stewards, motion_window_seconds: 600, dissolution_beneficiary: KEYS.BENEFICIARY.addr },
    ...over,
  });
}

function terms({ title, payment = GEN, minutes = 14 * 24 * 60, type = "COMPONENT_REPLACEMENT" }) {
  return JSON.stringify({
    maintenance_type: type, title, description: "Demonstration work order for the organisational paths.",
    requirements: "Replace the failed component and fix it in place with its cabling landed.",
    acceptance_criteria: [{ text: "The replacement is fixed in place with its cabling landed." }],
    required_evidence: [], budget_wei: payment.toString(), payment_wei: payment.toString(),
    deadline: iso(Date.now() + minutes * 60000),
  });
}

say(`paths on ${ADDRESS}`);
const STEWARDS = [KEYS.FOUNDER.addr, KEYS.STEWARD.addr];
const OID = jsonFrom((await step("org.found", "FOUNDER", "create_organization", [constitution(STEWARDS)],
                                { value: 5n * GEN })).text).organization_id;
await step("fund.stranger", "STRANGER", "fund_treasury", [OID], { value: GEN });
let o = await view("get_organization", [OID]);
assert(o.escrow_wei === (6n * GEN).toString(), `treasury: ${o.escrow_wei}`);

// Governance motions.
await step("motion.stranger", "STRANGER", "propose_amendment", [OID, constitution([KEYS.STRANGER.addr])],
           { refused: "only a steward" });
await step("motion.v2", "FOUNDER", "propose_amendment", [OID, constitution([...STEWARDS, KEYS.STRANGER.addr])]);
await step("motion.stranger_objects", "STRANGER", "object_motion", [OID, "no"], { refused: "only a steward" });
await step("motion.enact_early", "STRANGER", "enact_motion", [OID], { refused: "window is still open" });
await step("motion.object_v2", "STEWARD", "object_motion", [OID, "It adds a steward nobody vetted."]);
o = await view("get_organization", [OID]);
assert(o.constitution_version === 1 && o.motion.state === "WITHDRAWN", "the objection did not withdraw v2");
await step("motion.never_governed", "STRANGER", "pause_organization", [OID, "x"], { refused: "only a steward" });

// The registry, and work created under v1.
await step("provider.a", "FOUNDER", "authorize_provider", [OID, KEYS.PROVIDER.addr,
  JSON.stringify({ name: "Riverbank Electrical (demonstration)", maintenance_types: ["COMPONENT_REPLACEMENT"] })]);
await step("provider.b", "FOUNDER", "authorize_provider", [OID, KEYS.INSPECTOR.addr,
  JSON.stringify({ name: "Second provider (demonstration)", maintenance_types: ["INSPECTION"] })]);
const AID = jsonFrom((await step("asset.enrol", "STEWARD", "register_asset", [OID, JSON.stringify({
  asset_type: "MICROGRID", name: "Riverside microgrid (demonstration)", location_reference: "Riverside",
  technical_profile: "Hybrid inverter and battery bank.", maintenance_interval_days: 90 })])).text).asset_id;
const W1 = jsonFrom((await step("order.v1", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr,
  terms({ title: "Replace the failed breaker" })])).text).work_order_id;
await step("order.v1.accept", "PROVIDER", "accept_work_order", [W1, 1]);

const v3 = await step("motion.v3", "STEWARD", "propose_amendment", [OID, constitution(STEWARDS, {
  eligibility_rules: { approved_maintenance_types: ["INSPECTION"], inspection_report_required_for: [] } })]);
const v3Ends = jsonFrom(v3.text).window_ends;

// Revocation stops new assignments; assigned work continues.
await step("provider.revoke_b", "FOUNDER", "revoke_provider", [OID, KEYS.INSPECTOR.addr]);
await step("provider.revoked_assign", "FOUNDER", "create_work_order", [AID, KEYS.INSPECTOR.addr,
  terms({ title: "Inspection", type: "INSPECTION" })], { refused: "not authorised by this organisation" });

// Revision: the commitment follows acceptance.
await step("order.v1.revise", "FOUNDER", "propose_version", [W1, terms({ title: "Replace the failed breaker (revised)", payment: 2n * GEN, minutes: 40 })]);
o = await view("get_organization", [OID]);
assert(o.committed_wei === GEN.toString(), "a proposed revision moved the commitment");
await step("order.v1.accept_revision", "PROVIDER", "accept_work_order", [W1, 2]);
o = await view("get_organization", [OID]);
assert(o.committed_wei === (2n * GEN).toString(), `committed after the revision: ${o.committed_wei}`);

// Pause.
await step("pause", "STEWARD", "pause_organization", [OID, "Treasury audit"]);
await step("pause.no_new_work", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr, terms({ title: "Blocked" })],
           { refused: "paused organisation cannot commission" });
await step("pause.work_continues", "PROVIDER", "submit_declaration", [W1, "Work continues during the pause."]);
await step("resume", "FOUNDER", "resume_organization", [OID]);

// Cancel and close.
const W2 = jsonFrom((await step("order.cancel.create", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr,
  terms({ title: "Withdrawn before acceptance" })])).text).work_order_id;
await step("order.cancel", "STEWARD", "cancel_work_order", [W2, "Provider unavailable"]);
const W3 = jsonFrom((await step("order.close.create", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr,
  terms({ title: "Accepted, never assessed", minutes: 14 })])).text).work_order_id;
await step("order.close.accept", "PROVIDER", "accept_work_order", [W3, 1]);
await step("order.close.early", "STRANGER", "close_work_order", [W3], { refused: "deadline has not passed" });

// v3 in force: the v1 order keeps v1; new work of the old kind is refused.
await waitUntil(v3Ends, "the amendment window");
await step("motion.enact_v3", "STRANGER", "enact_motion", [OID]);
o = await view("get_organization", [OID]);
assert(o.constitution_version === 3, `constitution in force: ${o.constitution_version}`);
assert((await view("get_work_order", [W1])).constitution_version === 1, "the v1 order was rebound");
await step("v3.refuses_old_kind", "FOUNDER", "create_work_order", [AID, KEYS.PROVIDER.addr, terms({ title: "Old kind" })],
           { refused: "does not fund component replacement" });

const w3 = await view("get_work_order", [W3]);
await waitUntil(w3.versions[0].deadline, "the unassessed order's deadline");
await step("order.close", "STRANGER", "close_work_order", [W3]);
await step("order.close.v1", "STRANGER", "close_work_order", [W1], { refused: "deadline has not passed" });

// Dissolution.
const diss = await step("dissolve.propose", "FOUNDER", "propose_dissolution", [OID, "The microgrid passes to the county."]);
await waitUntil(jsonFrom(diss.text).window_ends, "the dissolution window");
await step("dissolve.enact", "STRANGER", "enact_motion", [OID]);
const nofunds = await step("dissolve.no_new_funds", "STRANGER", "fund_treasury", [OID], { value: GEN });
assert(jsonFrom(nofunds.text)?.refused && nofunds.text.includes("dissolving"), "a dissolving treasury took funds");
await step("dissolve.blocked", "STRANGER", "complete_dissolution", [OID], { refused: "work orders are still open" });
const w1 = await view("get_work_order", [W1]);
await waitUntil(w1.versions[1].deadline, "the remaining order's deadline");
await step("dissolve.close_last", "STRANGER", "close_work_order", [W1]);
const done = await step("dissolve.complete", "STRANGER", "complete_dissolution", [OID]);
assert(jsonFrom(done.text).returned_wei === (6n * GEN).toString(), `returned ${jsonFrom(done.text).returned_wei}`);
await step("dissolve.claim", "BENEFICIARY", "claim_refund", [], { transfer: true });
say("every path passed");
