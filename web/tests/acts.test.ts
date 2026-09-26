/**
 * The app's action rules against shapes the contract writes. Every fixture
 * here is a state contracts/everkeep.py produces (the standing dicts are
 * copied from _record_round and lapse_appeal), so a rule that passes here is
 * a rule about states that exist.
 */
import { describe, expect, it } from "vitest";

import { orderActs, orderSituation, orgActs, seatOn } from "@/lib/acts";
import type { Asset, Constitution, Organization, Standing, WorkOrder } from "@/lib/types";

const STEWARD = "0xa040709b6A2AEF280703B116427e0f7aDcFf17Eb";
const PROVIDER = "0xce087D0000000000000000000000000000000001";
const INSPECTOR = "0x52Df2f0000000000000000000000000000000002";
const STRANGER = "0xa80d450000000000000000000000000000000003";
const T0 = Date.parse("2026-09-26T12:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const MIN = 60_000;

const terms = (deadlineMs = T0 + 14 * 86_400_000, version = 1) => ({
  version, title: "Replace the inverter", maintenance_type: "INVERTER_REPAIR", description: "",
  requirements: "Replace the failed inverter.", acceptance_criteria: [{ id: "C1", text: "It is replaced." }],
  required_evidence: [{ type: "IMAGE", min_count: 1 }], payment_wei: "2000000000000000000",
  deadline: iso(deadlineMs),
});

function order(over: Partial<WorkOrder> = {}): WorkOrder {
  return {
    work_order_id: "wo-00001", organization_id: "org-00001", asset_id: "as-00001", provider: PROVIDER,
    created_by: STEWARD, constitution_version: 1, state: "AWAITING_EVIDENCE", committed_wei: "2000000000000000000",
    versions: [terms()], current_version: 1, pending_version: null, version_assessments: 0, rounds_count: 0,
    standing: null, appeal: null, created_at: iso(T0), provider_accepted_at: iso(T0), closed_at: null,
    close_reason: null, evidence: {}, now: iso(T0), ...over,
  };
}

/** _record_round, for an assessment decided at `at` with a ten-minute window. */
const assessed = (decision: Standing["decision"], at = T0): Standing => {
  const appealable = decision !== "UNDETERMINED";
  return { round: 1, decision, at: iso(at), kind: "ASSESSMENT", appealable, appealed: false,
           window_ends: appealable ? iso(at + 10 * MIN) : null, item_mark: 2 };
};

const org: Organization = {
  organization_id: "org-00001", founder: STEWARD, state: "ACTIVE", constitution_version: 1, constitution_count: 1,
  amendment: null, created_at: iso(T0), paused_at: null, escrow_wei: "0", funded_wei: "0", committed_wei: "0",
  paid_wei: "0", name: "Fund", mission: "m", stewards: [STEWARD], available_wei: "0", open_work_orders: 1,
  assets: 1, work_orders: 1, now: iso(T0),
};
const asset: Asset = {
  asset_id: "as-00001", organization_id: "org-00001", name: "Array", infrastructure_type: "COMMUNITY_SOLAR",
  location: "", technical_profile: "", inspector: INSPECTOR, inspector_accepted_at: iso(T0), registered_by: STEWARD,
  registered_at: iso(T0), constitution_version: 1, work_orders: ["wo-00001"], status: "UNDER_MAINTENANCE",
};
const constitution = { funding_rules: { max_payment_wei: "3", max_open_work_orders: 2 } } as Constitution;

const actsFor = (o: WorkOrder, who: string, now = T0) =>
  orderActs(o, org, seatOn(o, asset, org.stewards, who), org.stewards.includes(who), now);

describe("seats follow the contract's role order", () => {
  it("provider first, then the accepted inspector, then a steward", () => {
    expect(seatOn(order(), asset, [STEWARD], PROVIDER)).toBe("PROVIDER");
    expect(seatOn(order(), asset, [STEWARD], INSPECTOR)).toBe("INSPECTOR");
    expect(seatOn(order(), { ...asset, inspector_accepted_at: null }, [STEWARD], INSPECTOR)).toBe("");
    expect(seatOn(order(), asset, [STEWARD, INSPECTOR], INSPECTOR)).toBe("INSPECTOR");
    expect(seatOn(order(), asset, [STEWARD], STEWARD.toLowerCase())).toBe("STEWARD");
    expect(seatOn(order(), asset, [STEWARD], STRANGER)).toBe("");
  });
});

describe("signing and terms", () => {
  it("the provider signs a pending version whose deadline has not passed", () => {
    const o = order({ state: "PROPOSED", current_version: 0, pending_version: 1, provider_accepted_at: null });
    expect(actsFor(o, PROVIDER).sign).toBe(true);
    expect(actsFor(o, STEWARD).sign).toBe(false);
    expect(actsFor(o, PROVIDER, T0 + 15 * 86_400_000).sign).toBe(false);
    expect(actsFor(o, STEWARD).cancel).toBe(true);
    expect(actsFor(order(), STEWARD).cancel).toBe(false);
  });

  it("new terms are refused while paused and once terms are locked", () => {
    expect(actsFor(order(), STEWARD).proposeTerms).toBe(true);
    expect(orderActs(order(), { ...org, state: "PAUSED" }, "STEWARD", true, T0).proposeTerms).toBe(false);
    expect(actsFor(order({ state: "ACCEPTED", standing: assessed("ACCEPTED") }), STEWARD).proposeTerms).toBe(false);
  });
});

describe("filing and assessment", () => {
  it("nobody files against a standing acceptance or after the deadline", () => {
    expect(actsFor(order(), PROVIDER).file).toBe(true);
    expect(actsFor(order(), STRANGER).file).toBe(false);
    expect(actsFor(order({ state: "ACCEPTED", standing: assessed("ACCEPTED") }), STEWARD).file).toBe(false);
    expect(actsFor(order(), PROVIDER, T0 + 15 * 86_400_000).file).toBe(false);
  });

  it("a decided or lapsed appeal is final: no re-assessment on those terms", () => {
    expect(actsFor(order({ state: "REJECTED", standing: assessed("REJECTED") }), PROVIDER).assess).toBe(true);
    const decided: Standing = { ...assessed("REJECTED"), round: 2, kind: "APPEAL", appealable: false, window_ends: null };
    expect(actsFor(order({ state: "REJECTED", standing: decided }), PROVIDER).assess).toBe(false);
    const lapsed: Standing = { round: 1, decision: "UNDETERMINED", at: iso(T0), kind: "APPEAL_LAPSED",
                               appealable: false, appealed: true, window_ends: null, item_mark: 2 };
    expect(actsFor(order({ state: "UNDETERMINED", standing: lapsed }), PROVIDER).assess).toBe(false);
  });

  it("assessments stop at five per version", () => {
    expect(actsFor(order({ version_assessments: 5 }), PROVIDER).assess).toBe(false);
  });
});

describe("appeals, the case the ICARUS review taught", () => {
  it("a steward appeals an acceptance, the provider a rejection, inside the window", () => {
    const acc = order({ state: "ACCEPTED", standing: assessed("ACCEPTED") });
    expect(actsFor(acc, STEWARD).appeal).toBe(true);
    expect(actsFor(acc, PROVIDER).appeal).toBe(false);
    expect(actsFor(acc, INSPECTOR).appeal).toBe(false);
    expect(actsFor(acc, STEWARD, T0 + 11 * MIN).appeal).toBe(false);
    const rej = order({ state: "REJECTED", standing: assessed("REJECTED") });
    expect(actsFor(rej, PROVIDER).appeal).toBe(true);
    expect(actsFor(rej, STEWARD).appeal).toBe(false);
  });

  it("an open appeal offers no settlement; an upheld one settles at once", () => {
    const open = order({
      state: "APPEALED",
      standing: { ...assessed("ACCEPTED"), appealed: true },
      appeal: { against: "ACCEPTED", by: "STEWARD", opened_by: STEWARD, reason: "r", opened_at: iso(T0),
                evidence_ends: iso(T0 + 10 * MIN), reviewed_round: 1 },
    });
    expect(actsFor(open, STRANGER, T0 + 20 * MIN).finalize).toBe(false);
    expect(actsFor(open, STRANGER, T0 + 5 * MIN).decideAppeal).toBe(false);
    expect(actsFor(open, STRANGER, T0 + 11 * MIN).decideAppeal).toBe(true);
    expect(actsFor(open, STRANGER, T0 + 11 * MIN).lapseAppeal).toBe(false);
    expect(actsFor(open, STRANGER, T0 + 10 * MIN + 3 * 86_400_000 + 1).lapseAppeal).toBe(true);
    // decide_appeal writes a fresh, unappealable standing and clears the appeal
    const upheld = order({ state: "ACCEPTED", appeal: null,
                           standing: { round: 2, decision: "ACCEPTED", at: iso(T0 + 12 * MIN), kind: "APPEAL",
                                       appealable: false, appealed: false, window_ends: null, item_mark: 2 } });
    expect(actsFor(upheld, STRANGER, T0 + 12 * MIN).finalize).toBe(true);
    expect(actsFor(upheld, STEWARD, T0 + 12 * MIN).appeal).toBe(false);
    expect(orderSituation(upheld, T0 + 12 * MIN)).toMatch(/on appeal.*ready to settle/i);
  });

  it("an acceptance settles only after its window", () => {
    const acc = order({ state: "ACCEPTED", standing: assessed("ACCEPTED") });
    expect(actsFor(acc, STRANGER, T0 + 5 * MIN).finalize).toBe(false);
    expect(actsFor(acc, STRANGER, T0 + 10 * MIN + 1).finalize).toBe(true);
  });
});

describe("closing", () => {
  it("closes after the deadline and any standing window, never an acceptance", () => {
    const deadline = T0 + 5 * MIN;
    const rej = order({ versions: [terms(deadline)], state: "REJECTED", standing: assessed("REJECTED") });
    expect(actsFor(rej, STRANGER, deadline + 1).close).toBe(false);
    expect(actsFor(rej, STRANGER, T0 + 10 * MIN + 1).close).toBe(true);
    const acc = order({ versions: [terms(deadline)], state: "ACCEPTED", standing: assessed("ACCEPTED") });
    expect(actsFor(acc, STRANGER, T0 + 20 * MIN).close).toBe(false);
  });

  it("a pending version with a live deadline holds the close", () => {
    const o = order({ versions: [terms(T0 + MIN), terms(T0 + 60 * MIN, 2)], pending_version: 2 });
    expect(actsFor(o, STRANGER, T0 + 2 * MIN).close).toBe(false);
    expect(actsFor(o, STRANGER, T0 + 61 * MIN).close).toBe(true);
  });
});

describe("the organisation", () => {
  it("amendments: stewards object inside the window, anyone ratifies after it", () => {
    const pending: Organization = { ...org, amendment: { version: 2, state: "PROPOSED", proposed_by: STEWARD,
      proposed_at: iso(T0), window_ends: iso(T0 + 10 * MIN), objected_by: null, objection: "", decided_at: null } };
    expect(orgActs(pending, constitution, STEWARD, T0).objectAmendment).toBe(true);
    expect(orgActs(pending, constitution, STRANGER, T0).objectAmendment).toBe(false);
    expect(orgActs(pending, constitution, STRANGER, T0).ratifyAmendment).toBe(false);
    expect(orgActs(pending, constitution, STRANGER, T0 + 11 * MIN).ratifyAmendment).toBe(true);
    expect(orgActs(pending, constitution, STEWARD, T0).proposeAmendment).toBe(false);
  });

  it("a pause stops new commitments; the open-order cap is the constitution's", () => {
    expect(orgActs({ ...org, state: "PAUSED" }, constitution, STEWARD, T0).createWorkOrder).toBe(false);
    expect(orgActs({ ...org, state: "PAUSED" }, constitution, STEWARD, T0).resume).toBe(true);
    expect(orgActs({ ...org, open_work_orders: 2 }, constitution, STEWARD, T0).createWorkOrder).toBe(false);
    expect(orgActs(org, constitution, STEWARD, T0).createWorkOrder).toBe(true);
    expect(orgActs(org, constitution, STRANGER, T0).registerAsset).toBe(false);
  });
});
