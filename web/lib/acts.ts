/**
 * What each person may do next, derived from the states contracts/everkeep.py
 * writes. Every rule mirrors a guard in the contract, on the same fields, so
 * the app never offers an act the chain would refuse and never hides one it
 * would accept. tests/acts.test.ts runs these rules on shapes the contract
 * produces.
 */
import type { Asset, Constitution, Decision, Organization, WorkOrder } from "./types";

export const MAX_VERSIONS = 6;
export const STALE_APPEAL_MS = 3 * 86_400_000;
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function isSteward(stewards: string[], addr: string | null | undefined): boolean {
  return stewards.some((s) => same(s, addr));
}

export type Seat = "PROVIDER" | "INSPECTOR" | "STEWARD" | "";

/** Who this address files as, in the contract's order. */
export function seatOn(order: WorkOrder, asset: Asset, stewards: string[], addr: string | null | undefined): Seat {
  if (!addr) return "";
  if (same(addr, order.provider)) return "PROVIDER";
  if (asset.inspector && same(addr, asset.inspector) && asset.inspector_accepted_at && !isSteward(stewards, addr)) {
    return "INSPECTOR";
  }
  if (order.appeal && same(addr, order.appeal.opened_by)) return "STEWARD";
  return "";
}

export function currentTerms(order: WorkOrder) {
  const v = order.current_version || order.pending_version || 1;
  return order.versions[v - 1] ?? order.versions[0]!;
}

/* ── the organisation ── */

export interface OrgActs {
  fund: boolean;
  proposeAmendment: boolean;
  proposeDissolution: boolean;
  objectMotion: boolean;
  enactMotion: boolean;
  completeDissolution: boolean;
  pause: boolean;
  resume: boolean;
  authorizeProvider: boolean;
  revokeProvider: boolean;
  registerAsset: boolean;
  createWorkOrder: boolean;
}

export function orgActs(o: Organization, c: Constitution, addr: string | null | undefined, now: number): OrgActs {
  const steward = isSteward(o.stewards, addr);
  const m = o.motion && o.motion.state === "PENDING" ? o.motion : null;
  const active = o.state === "ACTIVE";
  return {
    fund: !!addr && o.state !== "DISSOLVING" && o.state !== "DISSOLVED",
    proposeAmendment: steward && active && !m,
    proposeDissolution: steward && (active || o.state === "PAUSED") && !m,
    objectMotion: steward && !!m && now <= t(m.window_ends),
    enactMotion: !!addr && !!m && now > t(m.window_ends)
      && (m.kind === "AMENDMENT" || active || o.state === "PAUSED"),
    completeDissolution: !!addr && o.state === "DISSOLVING" && o.open_work_orders === 0,
    pause: steward && active,
    resume: steward && o.state === "PAUSED",
    authorizeProvider: steward && active,
    revokeProvider: steward,
    registerAsset: steward && active,
    createWorkOrder: steward && active && o.open_work_orders < c.funding_rules.max_open_work_orders,
  };
}

export function assetActs(a: Asset, o: Organization, addr: string | null | undefined) {
  return {
    acceptInspector: !!a.inspector && same(addr, a.inspector) && !a.inspector_accepted_at,
    retire: isSteward(o.stewards, addr) && !a.retired_at && a.open_work_orders === 0,
  };
}

/* ── a work order ── */

export interface OrderActs {
  accept: boolean;
  proposeTerms: boolean;
  cancel: boolean;
  file: boolean;
  assess: boolean;
  appeal: boolean;
  readjudicate: boolean;
  finalize: boolean;
  settle: boolean;
  close: boolean;
  fileClosed: string;
}

export function fileClosed(w: WorkOrder, now: number): string {
  if (w.state === "ACTIVE") {
    return now > t(w.versions[w.current_version - 1]!.deadline) ? "The deadline has passed." : "";
  }
  if (w.state === "UNDER_APPEAL") {
    return w.appeal && now > t(w.appeal.evidence_ends) ? "The appeal's evidence period has ended." : "";
  }
  if (w.state === "PROPOSED") return "The provider has not accepted the terms yet.";
  return "Evidence is filed while the work is active or during an appeal.";
}

export function orderActs(w: WorkOrder, o: Organization, d: Decision | null, seat: Seat,
                          addr: string | null | undefined, now: number): OrderActs {
  const steward = isSteward(o.stewards, addr);
  const pending = w.pending_version ? w.versions[w.pending_version - 1] : null;
  const current = w.current_version ? w.versions[w.current_version - 1] : null;
  const open = w.state === "PROPOSED" || w.state === "ACTIVE";
  const delta = pending ? BigInt(pending.payment_wei) - BigInt(w.committed_wei) : 0n;
  const closedWhy = fileClosed(w, now);

  let close = false;
  if (w.state === "PROPOSED" && pending) close = now > t(pending.deadline);
  else if (w.state === "ACTIVE" && current) close = now > t(current.deadline);
  else if (w.state === "UNDER_APPEAL" && w.appeal) close = now > t(w.appeal.evidence_ends) + STALE_APPEAL_MS;

  return {
    accept: same(addr, w.provider) && open && !!pending && t(pending.deadline) > now
      && !(delta > 0n && o.state !== "ACTIVE"),
    proposeTerms: steward && o.state === "ACTIVE" && open && w.decisions.length === 0
      && w.versions.length < MAX_VERSIONS,
    cancel: steward && w.state === "PROPOSED",
    file: seat !== "" && closedWhy === "",
    assess: same(addr, w.provider) && w.state === "ACTIVE" && !!current && now <= t(current.deadline),
    appeal: w.state === "DECIDED" && !!d && d.appeals_left > 0 && now <= t(d.appeal_window_ends)
      && (d.outcome === "ACCEPTED" ? steward : same(addr, w.provider)),
    readjudicate: w.state === "UNDER_APPEAL" && !!w.appeal && !!addr
      && (same(addr, w.appeal.opened_by) || now > t(w.appeal.evidence_ends)),
    finalize: w.state === "DECIDED" && !!d && !(d.appeals_left > 0 && now <= t(d.appeal_window_ends)),
    settle: w.state === "PAYMENT_RELEASABLE",
    close,
    fileClosed: closedWhy,
  };
}

/** Where a work order stands, as one sentence. */
export function situation(w: WorkOrder, d: Decision | null, now: number): string {
  switch (w.state) {
    case "PROPOSED": return "Commissioned. Waiting for the provider to accept the terms.";
    case "ACTIVE": return "Accepted. The provider does the work, files the evidence and asks for an assessment.";
    case "DECIDED": {
      if (!d) return "Decided.";
      const word = d.outcome === "ACCEPTED" ? "Accepted" : d.outcome === "REJECTED" ? "Rejected" : "Undetermined";
      const how = d.kind === "READJUDICATION" ? " on appeal" : "";
      if (d.appeals_left > 0 && now <= t(d.appeal_window_ends)) {
        return `${word}${how}. ${d.outcome === "ACCEPTED" ? "A steward" : "The provider"} may appeal until the window closes; then anyone can finalize it.`;
      }
      return `${word}${how}. The decision can be finalized now.`;
    }
    case "UNDER_APPEAL": return w.appeal && now <= t(w.appeal.evidence_ends)
      ? "Under appeal. Additional evidence may be filed until the period ends."
      : "Under appeal. The validators can be asked to decide it again.";
    case "PAYMENT_RELEASABLE": return "Finalized as accepted. The payment is releasable and anyone can settle it.";
    case "SETTLED": return "Settled. The provider was paid, and the asset is back to monitoring.";
    case "CLOSED_UNPAID": return "Closed without payment. The commitment went back to the treasury.";
    case "CANCELLED": return "Cancelled before the provider accepted.";
    default: return "";
  }
}
