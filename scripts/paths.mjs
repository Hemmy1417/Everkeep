/**
 * The writes the main proof run does not reach: governance and the money
 * paths around a work order.
 *
 * scripts/proofs.mjs proves the adjudication. This proves, live and in one
 * organisation, the constitution's own lifecycle and the exits every hold
 * has:
 *
 *   fund_treasury            anyone adds to the treasury
 *   propose_amendment        a steward proposes v2 under v1's window
 *   object_amendment         another steward withdraws it inside the window
 *   propose_amendment        v3, left unopposed
 *   ratify_amendment         a stranger ratifies it once the window passed
 *   pause / resume           a steward pauses new commitments and resumes
 *   accept_inspector_role    the independent inspector takes the appointment
 *   propose_version          a steward revises signed terms
 *   accept_work_order        the provider signs the revision
 *   cancel_work_order        a steward withdraws an unsigned order
 *   close_work_order         an order nobody accepted closes past its deadline
 *
 * and the walls around them: a stranger cannot propose or object, a steward
 * named only by the withdrawn v2 never governed, an order created under v1
 * still reads v1 after v3 takes effect, and an appeal cannot lapse early.
 * lapse_appeal itself needs three days and is covered by the direct suite.
 *
 *   node scripts/paths.mjs 0x…
 */
import { createAccount, createClient } from "genlayer-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { EXPLORER, GEN, chain, leaderOf, loadKeys, plainFees, resultText, sleep, waitFinal } from "./lib.mjs";

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

const jsonFrom = (text) => {
  const i = text.indexOf("{");
  return i >= 0 ? JSON.parse(text.slice(i)) : null;
};

async function view(fn, args) {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(await reader.readContract({ address: ADDRESS, functionName: fn, args }));
    } catch (e) {
      if (i >= 5) throw e;
      await sleep(4000 * (i + 1));
    }
  }
}

async function step(name, role, fn, args, { value = 0n, refused = null } = {}) {
  if (run.steps[name]) {
    say(`${name}: done earlier (${run.steps[name].hash})`);
    return run.steps[name];
  }
  run.pending ??= {};
  let hash = run.pending[name];
  if (!hash) {
    for (let attempt = 0; ; attempt++) {
      try {
        const client = clientFor(role);
        hash = await client.writeContract({ address: ADDRESS, functionName: fn, args, value,
                                            fees: await plainFees(client) });
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
  const t = await waitFinal(hash, { label: name, tries: 150 });
  delete run.pending[name];
  const leader = leaderOf(t);
  const ok = leader?.execution_result === "SUCCESS";
  const text = resultText(leader);
  say(`${name}: ${t.status} leader=${leader?.execution_result} in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (refused) {
    assert(!ok, `${name} should have been refused`);
    assert(text.includes(refused), `${name} refusal should say "${refused}", said "${text.slice(0, 200)}"`);
  } else {
    assert(ok, `${name} failed: ${text.slice(0, 300)}`);
  }
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

function constitution(stewards, over = {}) {
  return JSON.stringify({
    organization_name: "Demonstration microgrid trust",
    mission: "Keep the demonstration's microgrid producing by funding maintenance that meets the "
      + "rules written here. A demonstration of how the record works, not anyone's organisation.",
    supported_infrastructure_types: ["MICROGRID", "COMMUNITY_SOLAR"],
    approved_maintenance_types: ["INSPECTION", "CORRECTIVE_MAINTENANCE", "INVERTER_REPAIR"],
    principles: [
      { text: "Equipment installed under a work order is mounted on a wall or a rack, never left loose." },
      { text: "Every inverter installed under a work order is identifiable from its own rating plate." },
    ],
    evidence_rules: { min_images: 1, inspection_report_required: false },
    funding_rules: { max_payment_wei: (3n * GEN).toString(), max_open_work_orders: 6 },
    windows: { appeal_window_seconds: 600, amendment_window_seconds: 600 },
    stewards,
    ...over,
  });
}

function terms({ title, payment = 1n * GEN, minutes = 14 * 24 * 60, type = "INVERTER_REPAIR" }) {
  return JSON.stringify({
    maintenance_type: type, title,
    description: "Demonstration work order for the governance and money paths.",
    requirements: "The failed inverter is replaced, mounted on the wall, and identifiable from its plate.",
    acceptance_criteria: [{ text: "The replacement inverter is installed on the wall and identifiable "
                                  + "from its rating plate." }],
    required_evidence: [{ type: "IMAGE", min_count: 1 }],
    payment_wei: payment.toString(),
    deadline: new Date(Date.now() + minutes * 60000).toISOString().replace(/\.\d+Z$/, "Z"),
  });
}

say(`paths on ${ADDRESS}`);

// The organisation, funded at creation by the founder and again by a stranger.
const created = await step("org.create", "FOUNDER", "create_organization",
                           [constitution([KEYS.FOUNDER.addr, KEYS.STEWARD.addr])], { value: 4n * GEN });
const OID = jsonFrom(created.text)?.organization_id;
assert(OID, "no organisation id");
await step("fund.stranger", "STRANGER", "fund_treasury", [OID], { value: 1n * GEN });
let org = await view("get_organization", [OID]);
assert(org.escrow_wei === (5n * GEN).toString(), `escrow after funding: ${org.escrow_wei}`);
assert(org.funded_wei === (5n * GEN).toString(), `funded after funding: ${org.funded_wei}`);

// Governance: v2 is proposed by a steward and withdrawn by another steward's
// objection; v3 is proposed and ratified by anyone once the window passes.
await step("amend.stranger_proposes", "STRANGER", "propose_amendment",
           [OID, constitution([KEYS.STRANGER.addr])], { refused: "only a steward" });
const v2 = await step("amend.propose_v2", "FOUNDER", "propose_amendment",
                      [OID, constitution([KEYS.FOUNDER.addr, KEYS.STRANGER.addr])]);
assert(jsonFrom(v2.text).version === 2, "the first amendment is not v2");
await step("amend.stranger_objects", "STRANGER", "object_amendment", [OID, "I object."],
           { refused: "only a steward" });
await step("amend.ratify_early", "STRANGER", "ratify_amendment", [OID],
           { refused: "the amendment window is still open" });
await step("amend.object_v2", "STEWARD", "object_amendment",
           [OID, "The proposal drops the treasurer from the stewards."]);
org = await view("get_organization", [OID]);
assert(org.constitution_version === 1 && org.amendment.state === "WITHDRAWN",
       `after the objection: ${JSON.stringify(org.amendment)}`);
// the steward v2 would have named never governed
await step("amend.never_a_steward", "STRANGER", "pause_organization", [OID, "test"],
           { refused: "only a steward" });

const v3 = await step("amend.propose_v3", "STEWARD", "propose_amendment",
                      [OID, constitution([KEYS.FOUNDER.addr, KEYS.STEWARD.addr],
                                         { approved_maintenance_types: ["INSPECTION", "INVERTER_REPAIR"],
                                           funding_rules: { max_payment_wei: (2n * GEN).toString(),
                                                            max_open_work_orders: 6 } })]);
assert(jsonFrom(v3.text).version === 3, "the second amendment is not v3");
const v3Ends = jsonFrom(v3.text).window_ends;

// Meanwhile, an order created under v1, with terms v1 allows and v3 will not.
const asset = JSON.stringify({ infrastructure_type: "MICROGRID", name: "Village microgrid (demonstration)",
                               location: "Demonstration site", technical_profile: "Hybrid inverter and battery bank.",
                               inspector: KEYS.INSPECTOR.addr });
const registered = await step("asset.register", "STEWARD", "register_asset", [OID, asset]);
const AID = jsonFrom(registered.text)?.asset_id;
assert(AID, "no asset id");
await step("inspector.stranger_accepts", "STRANGER", "accept_inspector_role", [AID],
           { refused: "only the inspector named" });
await step("inspector.accept", "INSPECTOR", "accept_inspector_role", [AID]);

const v1Order = await step("order.under_v1", "FOUNDER", "create_work_order",
                           [AID, KEYS.PROVIDER.addr, terms({ title: "Corrective maintenance under v1",
                                                             type: "CORRECTIVE_MAINTENANCE",
                                                             payment: 3n * GEN })]);
const WID = jsonFrom(v1Order.text).work_order_id;
await step("order.sign_v1", "PROVIDER", "accept_work_order", [WID, 1]);
org = await view("get_organization", [OID]);
assert(org.committed_wei === (3n * GEN).toString(), `committed after signing: ${org.committed_wei}`);

// Revised terms: the commitment follows the signed version.
await step("version.propose", "FOUNDER", "propose_version",
           [WID, terms({ title: "Corrective maintenance under v1, revised", type: "CORRECTIVE_MAINTENANCE",
                         payment: 2n * GEN })]);
org = await view("get_organization", [OID]);
assert(org.committed_wei === (3n * GEN).toString(), "a proposed revision moved the commitment");
await step("version.sign", "PROVIDER", "accept_work_order", [WID, 2]);
org = await view("get_organization", [OID]);
assert(org.committed_wei === (2n * GEN).toString(), `committed after the revision: ${org.committed_wei}`);
let wo = await view("get_work_order", [WID]);
assert(wo.current_version === 2 && wo.constitution_version === 1, "the revision did not sign as v2 under v1");

// Pause: no new commitments, but the signed order continues.
await step("pause", "STEWARD", "pause_organization", [OID, "Treasury audit"]);
await step("pause.no_orders", "FOUNDER", "create_work_order",
           [AID, KEYS.PROVIDER.addr, terms({ title: "Blocked by the pause" })],
           { refused: "paused organisation creates no work orders" });
await step("pause.no_amendments", "FOUNDER", "propose_amendment",
           [OID, constitution([KEYS.FOUNDER.addr])], { refused: "paused organisation takes no amendments" });
await step("pause.provider_still_files", "PROVIDER", "submit_declaration",
           [WID, "Work continues during the pause."]);
await step("resume", "FOUNDER", "resume_organization", [OID]);

// An order withdrawn before the provider signs, and one that closes unaccepted.
const unsigned = await step("cancel.create", "FOUNDER", "create_work_order",
                            [AID, KEYS.PROVIDER.addr, terms({ title: "Withdrawn before signing" })]);
const CANCEL_WID = jsonFrom(unsigned.text).work_order_id;
await step("cancel.stranger", "STRANGER", "cancel_work_order", [CANCEL_WID, "x"], { refused: "only a steward" });
await step("cancel", "STEWARD", "cancel_work_order", [CANCEL_WID, "Provider unavailable"]);
const shortLived = await step("close.create", "FOUNDER", "create_work_order",
                              [AID, KEYS.PROVIDER.addr, terms({ title: "Closes unaccepted", minutes: 12 })]);
const CLOSE_WID = jsonFrom(shortLived.text).work_order_id;
await step("close.sign", "PROVIDER", "accept_work_order", [CLOSE_WID, 1]);
await step("close.early", "STRANGER", "close_work_order", [CLOSE_WID], { refused: "the deadline has not passed" });
org = await view("get_organization", [OID]);
assert(org.committed_wei === (3n * GEN).toString(), `committed with two orders open: ${org.committed_wei}`);
assert(org.open_work_orders === 2, `open orders: ${org.open_work_orders}`);

// v3 takes effect: a stranger ratifies it. The v1 order still reads v1; a new
// order is judged by v3's enforced half.
await waitUntil(v3Ends, "the amendment window");
await step("amend.ratify_v3", "STRANGER", "ratify_amendment", [OID]);
org = await view("get_organization", [OID]);
assert(org.constitution_version === 3, `constitution in force: ${org.constitution_version}`);
wo = await view("get_work_order", [WID]);
assert(wo.constitution_version === 1, "the v1 order was rebound to v3");
await step("v3.corrective_refused", "FOUNDER", "create_work_order",
           [AID, KEYS.PROVIDER.addr, terms({ title: "Corrective under v3", type: "CORRECTIVE_MAINTENANCE" })],
           { refused: "does not fund corrective maintenance" });
await step("v3.cap_refused", "FOUNDER", "create_work_order",
           [AID, KEYS.PROVIDER.addr, terms({ title: "Over v3's cap", payment: 3n * GEN })],
           { refused: "exceeds the constitution's limit" });
await step("v1.revision_still_v1", "FOUNDER", "propose_version",
           [WID, terms({ title: "Corrective maintenance under v1, revised again",
                         type: "CORRECTIVE_MAINTENANCE", payment: 3n * GEN })]);

// The unaccepted order closes past its deadline and its commitment returns.
wo = await view("get_work_order", [CLOSE_WID]);
await waitUntil(wo.versions[0].deadline, "the short-lived order's deadline");
const closed = await step("close", "STRANGER", "close_work_order", [CLOSE_WID]);
assert(jsonFrom(closed.text).released_wei === (1n * GEN).toString(), "the close released the wrong amount");
org = await view("get_organization", [OID]);
assert(org.committed_wei === (2n * GEN).toString(), `committed after the close: ${org.committed_wei}`);
assert(org.open_work_orders === 1, `open orders after the close: ${org.open_work_orders}`);
assert(org.escrow_wei === (5n * GEN).toString(), "the treasury changed without a payment");

say("every path passed");
