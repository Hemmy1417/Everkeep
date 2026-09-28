/**
 * What each person may do next, derived from the states contracts/everkeep.py
 * writes. Every rule mirrors a guard in the contract, on the same fields, so
 * the app never offers an act the chain would refuse and never hides one it
 * would accept. tests/acts.test.ts runs these rules on shapes the contract
 * produces.
 */
import type { Asset, Constitution, Decision, Evidence, Organization, Terms, WorkOrder } from "./types";

export const MAX_VERSIONS = 6;
export const STALE_APPEAL_MS = 3 * 86_400_000;
const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function isSteward(stewards: string[], addr: string | null | undefined): boolean {
  return stewards.some((s) => same(s, addr));
}

/** The stewards who act: named, and having accepted the role (contract `_stewards`). */
export function acting(o: Organization): string[] {
  return o.accepted_stewards ?? o.stewards;
}

const DAY_MS = 86_400_000;
const INSPECTOR_DOCUMENTS = ["INSPECTION_REPORT", "INSPECTION_CHECKLIST"];

/** Whether one evidence item meets one evidence rule (contract `_meets`). */
export function meets(item: Evidence, rtype: string): boolean {
  const { kind, view = "", doc_type: doc = "" } = item;
  if (rtype === "BEFORE_PHOTO") return kind === "IMAGE" && view === "BEFORE";
  if (rtype === "AFTER_PHOTO") return kind === "IMAGE" && view === "AFTER";
  if (rtype === "NAMEPLATE_PHOTO") return kind === "IMAGE" && view === "NAMEPLATE";
  if (rtype === "OPERATIONAL_READING") return (kind === "IMAGE" && view === "METER_DISPLAY") || (kind === "DOCUMENT" && doc === "METER_READING");
  if (INSPECTOR_DOCUMENTS.includes(rtype)) return kind === "DOCUMENT" && doc === rtype && item.role === "INSPECTOR";
  return kind === "DOCUMENT" && doc === rtype;
}

/** The first evidence rule the file does not meet, in words, or "" (contract `_preflight_gap`). */
export function preflightGap(c: Constitution, terms: Terms, items: Evidence[]): string {
  const mtype = terms.maintenance_type;
  const rules = c.evidence_requirements.filter((r) => r.maintenance_type === "ALL" || r.maintenance_type === mtype)
    .map((r) => ({ type: r.type, min_count: r.min_count }));
  rules.push(...terms.required_evidence);
  if (c.eligibility_rules.inspection_report_required_for.includes(mtype)) rules.push({ type: "INSPECTION_REPORT", min_count: 1 });
  for (const r of rules) {
    const have = items.filter((it) => meets(it, r.type)).length;
    if (have < r.min_count) {
      const what = r.type.toLowerCase().replace(/_/g, " ");
      return `The rules require ${r.min_count} ${what}${r.min_count === 1 ? "" : "s"} before assessment; ${have} on file.`;
    }
  }
  if (!items.some((it) => it.kind === "IMAGE")) return "At least one photograph must be on file before assessment.";
  return "";
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
  acceptSteward: boolean;
  dissolveAbandoned: boolean;
  authorizeProvider: boolean;
  revokeProvider: boolean;
  registerAsset: boolean;
  createWorkOrder: boolean;
}

export function orgActs(o: Organization, c: Constitution, addr: string | null | undefined, now: number): OrgActs {
  const steward = isSteward(acting(o), addr);
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
    acceptSteward: !!addr && isSteward(o.stewards, addr) && !steward,
    dissolveAbandoned: !!addr && (active || o.state === "PAUSED")
      && now > t(o.last_steward_act ?? o.created_at) + (o.abandoned_after_days ?? 365) * DAY_MS,
    authorizeProvider: steward && active,
    revokeProvider: steward,
    registerAsset: steward && active,
    createWorkOrder: steward && active && o.open_work_orders < c.funding_rules.max_open_work_orders,
  };
}

export function assetActs(a: Asset, o: Organization, addr: string | null | undefined) {
  return {
    acceptInspector: !!a.inspector && same(addr, a.inspector) && !a.inspector_accepted_at,
    retire: isSteward(acting(o), addr) && !a.retired_at && a.open_work_orders === 0,
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
                          addr: string | null | undefined, now: number, gap = ""): OrderActs {
  const steward = isSteward(acting(o), addr);
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
    assess: same(addr, w.provider) && w.state === "ACTIVE" && !!current && now <= t(current.deadline) && gap === "",
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
