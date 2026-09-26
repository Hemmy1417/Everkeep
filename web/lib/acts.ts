/**
 * What each person may do next, derived from the states the contract writes.
 *
 * Every rule here mirrors a guard in contracts/everkeep.py, in the same order
 * and on the same fields, so the app never offers an act the chain would
 * refuse and never hides one it would accept. The tests in tests/acts.test.ts
 * run these rules on shapes the contract produces, and the live check in
 * scripts/check-acts.mjs runs them against the deployment of record.
 */
import type { Asset, Constitution, Organization, WorkOrder } from "./types";

export const SETTLED = ["FINALIZED", "CLOSED", "CANCELLED"] as const;
export const TERMS_LOCKED = ["ACCEPTED", "APPEALED", "FINALIZED", "CLOSED", "CANCELLED"] as const;
export const OPEN = ["PROPOSED", "AWAITING_EVIDENCE", "ACCEPTED", "REJECTED", "UNDETERMINED", "APPEALED"] as const;
export const APPEAL_LAPSE_MS = 3 * 86_400_000;
export const MAX_ASSESSMENTS = 5;
export const MAX_VERSIONS = 6;

const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const has = <T extends string>(list: readonly T[], v: string): boolean => (list as readonly string[]).includes(v);

export type Seat = "PROVIDER" | "INSPECTOR" | "STEWARD" | "";

export function isSteward(stewards: string[], addr: string | null | undefined): boolean {
  return stewards.some((s) => same(s, addr));
}

/** The role this address files as: the contract checks provider, then the accepted inspector, then steward. */
export function seatOn(order: WorkOrder, asset: Asset, stewards: string[], addr: string | null | undefined): Seat {
  if (!addr) return "";
  if (same(addr, order.provider)) return "PROVIDER";
  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at) return "INSPECTOR";
  if (isSteward(stewards, addr)) return "STEWARD";
  return "";
}

export function currentTerms(order: WorkOrder) {
  const v = order.current_version || order.pending_version || 1;
  return order.versions[v - 1] ?? order.versions[0]!;
}

/* ── work order ── */

export interface OrderActs {
  sign: boolean;
  proposeTerms: boolean;
  cancel: boolean;
  file: boolean;
  assess: boolean;
  appeal: boolean;
  decideAppeal: boolean;
  lapseAppeal: boolean;
  finalize: boolean;
  close: boolean;
  /** Why filing is closed, when a party would otherwise file. */
  fileClosed: string;
}

export function canFile(order: WorkOrder, nowMs: number): string {
  if (has(SETTLED, order.state)) return "The work order is settled.";
  if ((order.current_version || 0) < 1) return "The provider has not signed the terms yet.";
  if (order.state === "ACCEPTED") return "An acceptance stands. Evidence is filed again only if someone appeals.";
  if (order.state === "APPEALED") {
    if (order.appeal && nowMs > t(order.appeal.evidence_ends)) return "The appeal's evidence period has ended.";
    return "";
  }
  if (nowMs > t(order.versions[order.current_version - 1]!.deadline)) {
    return "The deadline has passed.";
  }
  return "";
}

export function orderActs(order: WorkOrder, org: Organization, seat: Seat, isStewardHere: boolean,
                          nowMs: number): OrderActs {
  const s = order.state;
  const standing = order.standing;
  const pending = order.pending_version;
  const pendingTerms = pending ? order.versions[pending - 1] : undefined;
  const current = order.current_version ? order.versions[order.current_version - 1] : undefined;

  const sign = seat === "PROVIDER" && !has(TERMS_LOCKED, s) && !!pendingTerms
    && t(pendingTerms.deadline) > nowMs;

  const proposeTerms = isStewardHere && org.state === "ACTIVE" && !has(TERMS_LOCKED, s)
    && order.versions.length < MAX_VERSIONS;

  const cancel = isStewardHere && s === "PROPOSED";

  const fileClosed = canFile(order, nowMs);
  const file = seat !== "" && fileClosed === "";

  const assess = seat === "PROVIDER" && !has(SETTLED, s) && s !== "ACCEPTED" && s !== "APPEALED"
    && !(standing && (standing.appealed || standing.kind !== "ASSESSMENT"))
    && !!current && nowMs <= t(current.deadline)
    && order.version_assessments < MAX_ASSESSMENTS;

  const appeal = !!standing && standing.appealable && !standing.appealed
    && (s === "ACCEPTED" || s === "REJECTED")
    && nowMs <= t(standing.window_ends)
    && seat === (standing.decision === "ACCEPTED" ? "STEWARD" : "PROVIDER");

  const decideAppeal = s === "APPEALED" && !!order.appeal && nowMs > t(order.appeal.evidence_ends);
  const lapseAppeal = s === "APPEALED" && !!order.appeal
    && nowMs > t(order.appeal.evidence_ends) + APPEAL_LAPSE_MS;

  const finalize = s === "ACCEPTED" && !!standing
    && !(standing.appealable && nowMs <= t(standing.window_ends));

  let close = !has(SETTLED, s) && s !== "ACCEPTED" && s !== "APPEALED";
  if (close && pendingTerms && t(pendingTerms.deadline) > nowMs) close = false;
  if (close && current) {
    if (nowMs <= t(current.deadline)) close = false;
    if (standing && standing.appealable && standing.window_ends && nowMs <= t(standing.window_ends)) close = false;
  }

  return { sign, proposeTerms, cancel, file, assess, appeal, decideAppeal, lapseAppeal, finalize, close,
           fileClosed };
}

/** Where an order stands, as one sentence for a reader. */
export function orderSituation(order: WorkOrder, nowMs: number): string {
  const standing = order.standing;
  switch (order.state) {
    case "PROPOSED":
      return "Waiting for the provider to sign the terms.";
    case "AWAITING_EVIDENCE":
      return "Signed. The provider files evidence and asks for an assessment.";
    case "ACCEPTED":
      if (standing && standing.appealable && nowMs <= t(standing.window_ends)) {
        return "Accepted. A steward may still appeal until the window closes; then anyone can settle it.";
      }
      return standing?.kind === "APPEAL"
        ? "Accepted on appeal. Final, and ready to settle."
        : "Accepted, and the appeal window has closed. Ready to settle.";
    case "REJECTED":
      if (standing?.kind === "APPEAL") return "Rejected on appeal. Final for these terms.";
      if (standing && standing.appealable && nowMs <= t(standing.window_ends)) {
        return "Rejected. The provider may appeal until the window closes, or file new evidence.";
      }
      return "Rejected. The provider may file new evidence and ask again before the deadline.";
    case "UNDETERMINED":
      if (standing?.kind === "APPEAL_LAPSED") return "The appeal lapsed undecided. Nothing pays on these terms.";
      if (standing?.kind === "APPEAL") return "Undetermined on appeal. Final for these terms.";
      return "Undetermined. The evidence did not settle it; new evidence can be filed before the deadline.";
    case "APPEALED":
      return order.appeal && nowMs <= t(order.appeal.evidence_ends)
        ? "Under appeal. Every party may add evidence until the period ends."
        : "Under appeal. The evidence period is over; anyone can ask a fresh panel to decide.";
    case "FINALIZED":
      return "Paid. The provider's claim was credited.";
    case "CLOSED":
      return "Closed with nothing accepted. The commitment went back to the treasury.";
    case "CANCELLED":
      return "Withdrawn before the provider signed.";
    default:
      return "";
  }
}

/* ── organisation ── */

export interface OrgActs {
  fund: boolean;
  proposeAmendment: boolean;
  objectAmendment: boolean;
  ratifyAmendment: boolean;
  pause: boolean;
  resume: boolean;
  registerAsset: boolean;
  createWorkOrder: boolean;
}

export function orgActs(org: Organization, constitution: Constitution, addr: string | null | undefined,
                        nowMs: number): OrgActs {
  const steward = isSteward(org.stewards, addr);
  const a = org.amendment;
  const pending = !!a && a.state === "PROPOSED";
  return {
    fund: !!addr,
    proposeAmendment: steward && org.state === "ACTIVE" && !pending,
    objectAmendment: steward && pending && nowMs <= t(a!.window_ends),
    ratifyAmendment: !!addr && pending && nowMs > t(a!.window_ends),
    pause: steward && org.state === "ACTIVE",
    resume: steward && org.state === "PAUSED",
    registerAsset: steward && org.state === "ACTIVE",
    createWorkOrder: steward && org.state === "ACTIVE"
      && org.open_work_orders < constitution.funding_rules.max_open_work_orders,
  };
}
