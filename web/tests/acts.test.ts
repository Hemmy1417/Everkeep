/**
 * The app's action rules on shapes contracts/everkeep.py writes: every
 * fixture below copies a record the contract produces (_record for a
 * decision, open_appeal for an appeal, the organisation view).
 */
import { describe, expect, it } from "vitest";

import { assetActs, orderActs, orgActs, seatOn, situation } from "@/lib/acts";
import type { Asset, Constitution, Decision, Organization, WorkOrder } from "@/lib/types";

const STEWARD = "0xa040709b6A2AEF280703B116427e0f7aDcFf17Eb";
const PROVIDER = "0xce087D0000000000000000000000000000000001";
const INSPECTOR = "0x52Df2f0000000000000000000000000000000002";
const STRANGER = "0xa80d450000000000000000000000000000000003";
const T0 = Date.parse("2026-09-27T12:00:00Z");
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

const terms = (deadline = T0 + 14 * 86_400_000, version = 1, pay = "2000000000000000000") => ({
  version, title: "Replace the controller", maintenance_type: "COMPONENT_REPLACEMENT", description: "",
  requirements: "Replace the failed controller.", specification: "", acceptance_criteria: [{ id: "C1", text: "It is fixed." }],
  required_evidence: [], budget_wei: pay, payment_wei: pay, deadline: iso(deadline),
});

const org: Organization = {
  organization_id: "org-00001", founder: STEWARD, state: "ACTIVE", constitution_version: 1, constitution_count: 1,
  motion: null, motions: [], created_at: iso(T0), escrow_wei: "0", funded_wei: "0", committed_wei: "0",
  releasable_wei: "0", paid_wei: "0", returned_wei: "0", dissolved_at: null, name: "Fund", mission: "m",
  stewards: [STEWARD], available_wei: "0", spendable_wei: "0", open_work_orders: 1, asset_count: 1,
  work_order_count: 1, provider_count: 1, pending_decisions: 0, open_appeals: 0, now: iso(T0),
};
const asset = { asset_id: "as-00001", inspector: INSPECTOR, inspector_accepted_at: iso(T0), retired_at: null,
                open_work_orders: 1 } as Asset;
const constitution = { funding_rules: { max_open_work_orders: 2 } } as Constitution;

function order(over: Partial<WorkOrder> = {}): WorkOrder {
  return {
    work_order_id: "wo-00001", organization_id: "org-00001", asset_id: "as-00001", provider: PROVIDER,
    provider_authorized_at: iso(T0), created_by: STEWARD, constitution_version: 1, emergency: false, state: "ACTIVE",
    committed_wei: "2000000000000000000", versions: [terms()], current_version: 1, pending_version: null,
    decisions: [], current_decision_id: null, appeals_used: 0, appeal: null, created_at: iso(T0), accepted_at: iso(T0),
    settlement: null, closed_at: null, close_reason: null, evidence: {}, now: iso(T0), ...over,
  };
}

/** _record: an ASSESSMENT with one appeal left and a ten-minute window. */
const decided = (outcome: Decision["outcome"], over: Partial<Decision> = {}): Decision => ({
  decision_id: "dec-000001", snapshot_id: "snap-000001", kind: "ASSESSMENT", organization_id: "org-00001",
  asset_id: "as-00001", work_order_id: "wo-00001", work_order_version: 1, constitution_version: 1, provider: PROVIDER,
  payment_wei: "2000000000000000000", decided_at: iso(T0), requested_by: PROVIDER, outcome, requirements: [],
  failed: [], not_established: [], evidence_sufficient: true, conflicts_detected: false, needs_appeal: outcome !== "ACCEPTED",
  appeal_of: null, appeal: null, lifecycle: "APPEALABLE", appeal_window_ends: iso(T0 + 10 * MIN), appeals_left: 1,
  finalized_at: null, superseded_by: null,
  notes: { reasoning: "", conflict_note: "", raw: {}, basis: {}, requirement_notes: {}, observations: [] }, ...over,
});

const acts = (w: WorkOrder, d: Decision | null, who: string, now = T0, o = org) =>
  orderActs(w, o, d, seatOn(w, asset, o.stewards, who), who, now);

describe("seats follow the contract's filing order", () => {
  it("provider, then the accepted independent inspector, then the appellant steward", () => {
    expect(seatOn(order(), asset, [STEWARD], PROVIDER)).toBe("PROVIDER");
    expect(seatOn(order(), asset, [STEWARD], INSPECTOR)).toBe("INSPECTOR");
    expect(seatOn(order(), { ...asset, inspector_accepted_at: null }, [STEWARD], INSPECTOR)).toBe("");
    expect(seatOn(order(), asset, [STEWARD, INSPECTOR], INSPECTOR)).toBe("");
    expect(seatOn(order(), asset, [STEWARD], STEWARD)).toBe("");
    const appeal = { decision_id: "dec-000001", by: "STEWARD" as const, opened_by: STEWARD, reason: "r",
                     opened_at: iso(T0), mark: 2, evidence_ends: iso(T0 + 10 * MIN) };
    expect(seatOn(order({ state: "UNDER_APPEAL", appeal }), asset, [STEWARD], STEWARD.toLowerCase())).toBe("STEWARD");
    expect(seatOn(order({ state: "UNDER_APPEAL", appeal }), asset, [STEWARD], STRANGER)).toBe("");
  });
});

describe("terms", () => {
  it("the provider accepts a live pending version; not a larger one while paused", () => {
    const w = order({ state: "PROPOSED", current_version: 0, pending_version: 1, accepted_at: null });
    expect(acts(w, null, PROVIDER).accept).toBe(true);
    expect(acts(w, null, STEWARD).accept).toBe(false);
    expect(acts(w, null, PROVIDER, T0 + 15 * 86_400_000).accept).toBe(false);
    const bigger = order({ versions: [terms(), terms(undefined, 2, "3000000000000000000")], pending_version: 2 });
    expect(acts(bigger, null, PROVIDER).accept).toBe(true);
    expect(acts(bigger, null, PROVIDER, T0, { ...org, state: "PAUSED" }).accept).toBe(false);
  });

  it("terms freeze once a decision exists", () => {
    expect(acts(order(), null, STEWARD).proposeTerms).toBe(true);
    expect(acts(order({ decisions: ["dec-000001"] }), null, STEWARD).proposeTerms).toBe(false);
    expect(acts(order(), null, STEWARD, T0, { ...org, state: "PAUSED" }).proposeTerms).toBe(false);
  });
});

describe("assessment is asked once", () => {
  it("only by the provider, only while active and before the deadline", () => {
    expect(acts(order(), null, PROVIDER).assess).toBe(true);
    expect(acts(order(), null, STEWARD).assess).toBe(false);
    expect(acts(order(), null, PROVIDER, T0 + 15 * 86_400_000).assess).toBe(false);
    expect(acts(order({ state: "DECIDED", decisions: ["dec-000001"] }), decided("UNDETERMINED"), PROVIDER).assess).toBe(false);
  });
});

describe("appeals", () => {
  it("a steward appeals an acceptance; the provider a rejection or doubt; inside the window", () => {
    const w = order({ state: "DECIDED" });
    expect(acts(w, decided("ACCEPTED"), STEWARD).appeal).toBe(true);
    expect(acts(w, decided("ACCEPTED"), PROVIDER).appeal).toBe(false);
    expect(acts(w, decided("UNDETERMINED"), PROVIDER).appeal).toBe(true);
    expect(acts(w, decided("REJECTED"), STEWARD).appeal).toBe(false);
    expect(acts(w, decided("REJECTED"), PROVIDER, T0 + 11 * MIN).appeal).toBe(false);
    expect(acts(w, decided("REJECTED", { appeals_left: 0 }), PROVIDER).appeal).toBe(false);
  });

  it("the appellant readjudicates at once; anyone after the evidence period", () => {
    const appeal = { decision_id: "dec-000001", by: "PROVIDER" as const, opened_by: PROVIDER, reason: "r",
                     opened_at: iso(T0), mark: 2, evidence_ends: iso(T0 + 10 * MIN) };
    const w = order({ state: "UNDER_APPEAL", appeal });
    expect(acts(w, null, PROVIDER).readjudicate).toBe(true);
    expect(acts(w, null, STRANGER).readjudicate).toBe(false);
    expect(acts(w, null, STRANGER, T0 + 11 * MIN).readjudicate).toBe(true);
    expect(acts(w, null, STRANGER, T0 + 11 * MIN).close).toBe(false);
    expect(acts(w, null, STRANGER, T0 + 10 * MIN + 3 * 86_400_000 + 1).close).toBe(true);
  });
});

describe("finality and settlement", () => {
  it("finalize only after the window, at once when no appeal is left", () => {
    const w = order({ state: "DECIDED" });
    expect(acts(w, decided("ACCEPTED"), STRANGER).finalize).toBe(false);
    expect(acts(w, decided("ACCEPTED"), STRANGER, T0 + 10 * MIN + 1).finalize).toBe(true);
    expect(acts(w, decided("ACCEPTED", { appeals_left: 0 }), STRANGER).finalize).toBe(true);
    expect(situation(w, decided("ACCEPTED", { kind: "READJUDICATION", appeals_left: 0 }), T0)).toMatch(/on appeal.*finalized now/i);
  });

  it("settle only a releasable payment; close only undecided work past its deadline", () => {
    expect(acts(order({ state: "PAYMENT_RELEASABLE" }), null, STRANGER).settle).toBe(true);
    expect(acts(order({ state: "DECIDED" }), decided("ACCEPTED"), STRANGER).settle).toBe(false);
    expect(acts(order(), null, STRANGER).close).toBe(false);
    expect(acts(order(), null, STRANGER, T0 + 15 * 86_400_000).close).toBe(true);
    expect(acts(order({ state: "DECIDED" }), decided("REJECTED"), STRANGER, T0 + 15 * 86_400_000).close).toBe(false);
  });
});

describe("the organisation", () => {
  const pending = (kind: "AMENDMENT" | "DISSOLUTION") => ({ ...org, motion: { kind, state: "PENDING" as const,
    proposed_by: STEWARD, proposed_at: iso(T0), window_ends: iso(T0 + 10 * MIN), objected_by: null, objection: "",
    decided_at: null } });

  it("motions: stewards object inside the window, anyone enacts after it", () => {
    const o = pending("AMENDMENT");
    expect(orgActs(o, constitution, STEWARD, T0).objectMotion).toBe(true);
    expect(orgActs(o, constitution, STRANGER, T0).objectMotion).toBe(false);
    expect(orgActs(o, constitution, STRANGER, T0).enactMotion).toBe(false);
    expect(orgActs(o, constitution, STRANGER, T0 + 11 * MIN).enactMotion).toBe(true);
    expect(orgActs(o, constitution, STEWARD, T0).proposeDissolution).toBe(false);
  });

  it("dissolution completes only with no open work, and a dissolving treasury takes no funds", () => {
    const d = { ...org, state: "DISSOLVING" as const };
    expect(orgActs(d, constitution, STRANGER, T0).completeDissolution).toBe(false);
    expect(orgActs({ ...d, open_work_orders: 0 }, constitution, STRANGER, T0).completeDissolution).toBe(true);
    expect(orgActs(d, constitution, STRANGER, T0).fund).toBe(false);
    expect(orgActs(d, constitution, STEWARD, T0).createWorkOrder).toBe(false);
  });

  it("new work respects the cap; assets retire only when idle", () => {
    expect(orgActs(org, constitution, STEWARD, T0).createWorkOrder).toBe(true);
    expect(orgActs({ ...org, open_work_orders: 2 }, constitution, STEWARD, T0).createWorkOrder).toBe(false);
    expect(assetActs(asset, org, STEWARD).retire).toBe(false);
    expect(assetActs({ ...asset, open_work_orders: 0 }, org, STEWARD).retire).toBe(true);
    expect(assetActs({ ...asset, inspector_accepted_at: null }, org, INSPECTOR).acceptInspector).toBe(true);
  });
});
