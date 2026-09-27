/**
 * Every word a person reads passes through here. The contract speaks in
 * SCREAMING_SNAKE because that is what a state machine should look like on
 * chain; a page should not. Identifiers, addresses, digests and raw enum
 * names never appear in reading flow; they belong on the verification pages,
 * where a reader has asked to see exactly what was recorded.
 */

export function humanize(value: string): string {
  const t = String(value ?? "").trim();
  if (!t) return "";
  const spaced = t.replace(/[_-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function label(map: Record<string, string>, key: string | null | undefined): string {
  const k = String(key ?? "").trim();
  if (!k) return "";
  return map[k] ?? humanize(k);
}

const ORDER_STATE: Record<string, string> = {
  PROPOSED: "Awaiting the provider", ACTIVE: "Work in progress", DECIDED: "Decided",
  UNDER_APPEAL: "Under appeal", PAYMENT_RELEASABLE: "Payment releasable", SETTLED: "Settled",
  CLOSED_UNPAID: "Closed unpaid", CANCELLED: "Cancelled",
};
export const orderState = (s: string) => label(ORDER_STATE, s);

export const orgState = (s: string) =>
  label({ ACTIVE: "Active", PAUSED: "Paused", DISSOLVING: "Dissolving", DISSOLVED: "Dissolved" }, s);

export const assetStatus = (s: string) => label({
  MONITORING: "Monitoring", SERVICE_DUE: "Service due", UNDER_MAINTENANCE: "Under maintenance", RETIRED: "Retired",
}, s);

export const outcome = (s: string) => label({ ACCEPTED: "Accepted", REJECTED: "Rejected", UNDETERMINED: "Undetermined" }, s);
export const outcomeHeadline = (s: string) => label({
  ACCEPTED: "Maintenance accepted", REJECTED: "Maintenance rejected", UNDETERMINED: "Undetermined",
}, s);

export const requirementStatus = (s: string) => label({
  SATISFIED: "Satisfied", NOT_SATISFIED: "Not satisfied", NOT_ESTABLISHED: "Not established", NOT_APPLICABLE: "Does not apply",
}, s);

export const lifecycle = (s: string) => label({
  APPEALABLE: "Open to appeal", APPEALED: "Under appeal", SUPERSEDED: "Superseded on appeal", FINALIZED: "Final",
}, s);

export const source = (s: string) => label({ CONSTITUTION: "Constitution", WORK_ORDER: "Work order", SYSTEM: "Always asked" }, s);

export const motionKind = (s: string) => label({ AMENDMENT: "Amendment", DISSOLUTION: "Dissolution" }, s);
export const motionState = (s: string) => label({ PENDING: "Pending", ENACTED: "Enacted", WITHDRAWN: "Withdrawn" }, s);

export const role = (s: string) => label({ STEWARD: "Steward", PROVIDER: "Provider", INSPECTOR: "Inspector" }, s);

const INFRA: Record<string, string> = {
  COMMUNITY_SOLAR: "Community solar", BATTERY_STORAGE: "Battery storage", WATER_SYSTEM: "Water system",
  EV_CHARGING: "Vehicle charging", TELECOM_SITE: "Telecom site", MICROGRID: "Microgrid",
  PUBLIC_LIGHTING: "Public lighting", AGRICULTURAL_POWER: "Agricultural power", COMMUNITY_FACILITY: "Community facility",
};
export const infraType = (s: string) => label(INFRA, s);

const MAINT: Record<string, string> = {
  INSPECTION: "Inspection", PREVENTIVE_MAINTENANCE: "Preventive maintenance",
  CORRECTIVE_MAINTENANCE: "Corrective maintenance", COMPONENT_REPLACEMENT: "Component replacement",
  ELECTRICAL_REPAIR: "Electrical repair", BATTERY_SERVICE: "Battery service", INVERTER_REPAIR: "Inverter repair",
  SYSTEM_RESTORATION: "System restoration", EMERGENCY_REPAIR: "Emergency repair", FINAL_VERIFICATION: "Final verification",
};
export const maintenanceType = (s: string) => label(MAINT, s);

const VIEW: Record<string, string> = {
  BEFORE: "Before photograph", AFTER: "After photograph", NAMEPLATE: "Nameplate", METER_DISPLAY: "Meter display",
  SITE: "Site photograph", DOCUMENT_SCAN: "Document scan",
};
export const imageView = (s: string) => label(VIEW, s);

const DOC: Record<string, string> = {
  TECHNICAL_REPORT: "Technician report", INSPECTION_REPORT: "Inspection report", INSPECTION_CHECKLIST: "Inspection checklist",
  METER_READING: "Meter reading", MAINTENANCE_LOG: "Maintenance log", WORK_ORDER_DOCUMENT: "Work order document",
  EQUIPMENT_DOCUMENT: "Equipment document", INVOICE: "Invoice",
};
export const docType = (s: string) => label(DOC, s);

const REQ: Record<string, [string, string]> = {
  BEFORE_PHOTO: ["before photograph", "before photographs"], AFTER_PHOTO: ["after photograph", "after photographs"],
  NAMEPLATE_PHOTO: ["nameplate photograph", "nameplate photographs"],
  OPERATIONAL_READING: ["operational reading", "operational readings"],
  TECHNICAL_REPORT: ["technician report", "technician reports"],
  INSPECTION_CHECKLIST: ["inspector's checklist", "inspector's checklists"],
  INSPECTION_REPORT: ["inspector's report", "inspector's reports"],
  EQUIPMENT_DOCUMENT: ["equipment document", "equipment documents"],
};
export function requirementType(type: string, n = 1): string {
  const pair = REQ[type];
  return pair ? pair[n === 1 ? 0 : 1] : humanize(type).toLowerCase();
}
export const requirement = (r: { type: string; min_count: number }) => `${r.min_count} ${requirementType(r.type, r.min_count)}`;

export function evidenceKind(e: { kind: string; view?: string; doc_type?: string; reference_type?: string }): string {
  if (e.kind === "IMAGE") return imageView(e.view ?? "");
  if (e.kind === "DOCUMENT") return docType(e.doc_type ?? "");
  if (e.kind === "TEXT_DECLARATION") return "Declaration";
  if (e.kind === "REFERENCE") return e.reference_type === "VIDEO_REFERENCE" ? "Video reference" : "External source";
  return humanize(e.kind);
}

const EVENT: Record<string, string> = {
  ORGANIZATION_FOUNDED: "Organisation founded", CONSTITUTION_IN_FORCE: "Constitution in force",
  TREASURY_FUNDED: "Treasury funded", AMENDMENT_PROPOSED: "Amendment proposed",
  DISSOLUTION_PROPOSED: "Dissolution proposed", MOTION_WITHDRAWN: "Motion withdrawn",
  DISSOLUTION_ENACTED: "Dissolution enacted", DISSOLVED: "Dissolved", PAUSED: "Paused", RESUMED: "Resumed",
  PROVIDER_AUTHORIZED: "Provider authorised", PROVIDER_REVOKED: "Provider revoked",
  ASSET_ENROLLED: "Asset enrolled", INSPECTOR_ACCEPTED: "Inspector accepted", ASSET_RETIRED: "Asset retired",
  WORK_ORDER_CREATED: "Work order created", TERMS_ACCEPTED: "Terms accepted", TERMS_PROPOSED: "New terms proposed",
  WORK_ORDER_CANCELLED: "Work order cancelled", EVIDENCE_SUBMITTED: "Evidence submitted",
  DECISION_RECORDED: "Decision recorded", APPEAL_OPENED: "Appeal opened", PAYMENT_RELEASABLE: "Payment releasable",
  SETTLED: "Payment settled", WORK_ORDER_CLOSED: "Work order closed",
};
export const eventKind = (s: string) => label(EVENT, s);

const tail = (id: string) => String(id ?? "").split("-").pop()?.replace(/^0+/, "") || "";
export const numberOf = (id: string) => tail(id);
export const evidenceName = (eid: string) => `Evidence ${tail(eid)}`;
export const decisionName = (did: string) => `Decision ${tail(did)}`;
export const snapshotName = (sid: string) => `Snapshot ${tail(sid)}`;
export const orderName = (wid: string) => `Work order ${tail(wid)}`;

/** P2 reads "Principle 2", C1 "Criterion 1", S3 "Consistency check 3". */
export const ruleName = (id: string) =>
  id.startsWith("P") ? `Principle ${id.slice(1)}` : id.startsWith("C") ? `Criterion ${id.slice(1)}`
    : id.startsWith("S") ? `Consistency check ${id.slice(1)}` : id;

/** Validators cite items and rules by id; a page writes them out. Their words are kept. */
export function writeOut(text: string | null | undefined): string {
  const written = prose(text)
    .replace(/ev-0*(\d+)/gi, (_m, d: string) => `evidence ${parseInt(d, 10)}`)
    .replace(/\bP(\d{1,2})\b/g, (_m, d: string) => `principle ${d}`)
    .replace(/\bC(\d{1,2})\b/g, (_m, d: string) => `criterion ${d}`)
    .replace(/\bS(\d)\b/g, (_m, d: string) => `consistency check ${d}`);
  return written.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead: string, ch: string) => lead + ch.toUpperCase());
}

/**
 * Text a party wrote, shown as a quotation. It is trimmed and its control
 * characters are dropped, and nothing else: a caption is the filer's words,
 * and rewriting them would be editing the record.
 */
export function prose(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * The contract caps a per-line note at 200 characters, so a validator's sentence
 * can arrive cut off mid-word. A page that printed the fragment as though it
 * were the whole note would be misreporting the record, so a note at the cap
 * is marked as cut rather than tidied up or silently completed.
 */
export const LINE_NOTE_MAX = 200;

/** A validator note as recorded, marked when the contract's cap cut it off. */
export function validatorNote(text: string | null | undefined): string {
  const body = writeOut(text);
  return wasCut(text) ? `${body}… (the record keeps the first 200 characters)` : body;
}

export function wasCut(text: string | null | undefined): boolean {
  return String(text ?? "").length >= LINE_NOTE_MAX;
}

/**
 * The contract's own sentence from a refused write, tidied into one. The
 * wording is the contract's and is never replaced: a refusal a person reads
 * should be the reason the chain gave, not this app's paraphrase of it.
 */
export function refusal(text: string): string {
  const body = String(text ?? "")
    .replace(/\[EXPECTED\]|\[LLM_ERROR\]/g, "")
    .replace(/^[\s:]+/, "")
    .trim();
  if (!body) return "The contract refused this action.";
  const sentence = body[0]!.toUpperCase() + body.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

const GEN_WEI = 10n ** 18n;

/** GEN with up to four decimals, trailing zeros trimmed: "2 GEN", "0.05 GEN". */
export function gen(wei: string | bigint | number | null | undefined, unit = true): string {
  let v: bigint;
  try {
    v = BigInt(typeof wei === "number" ? Math.trunc(wei) : (wei ?? 0));
  } catch {
    return unit ? "0 GEN" : "0";
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const whole = v / GEN_WEI;
  const frac = ((v % GEN_WEI) * 10_000n) / GEN_WEI;
  let text = whole.toLocaleString("en-GB");
  if (frac > 0n) text += `.${frac.toString().padStart(4, "0").replace(/0+$/, "")}`;
  return `${neg ? "-" : ""}${text}${unit ? " GEN" : ""}`;
}

/** Parse a GEN amount a person typed ("2", "0.05") into wei; null if unreadable. */
export function parseGen(text: string): bigint | null {
  const t = String(text ?? "").trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(t) || t === "" || t === ".") return null;
  const [whole = "0", frac = ""] = t.split(".");
  if (frac.length > 18) return null;
  try {
    return BigInt(whole) * GEN_WEI + BigInt((frac + "0".repeat(18)).slice(0, 18));
  } catch {
    return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19 Sep 2026", in UTC like every time the contract records. */
export function day(iso: string | null | undefined): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "19 Sep 2026, 15:24 UTC". */
export function moment(iso: string | null | undefined): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day(iso)}, ${hh}:${mm} UTC`;
}

/** "10 minutes", "1 hour", "7 days". */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return plural(s, "second");
  if (s < 3600) return plural(Math.round(s / 60), "minute");
  if (s < 86400) return plural(Math.round(s / 3600), "hour");
  return plural(Math.round(s / 86400), "day");
}

/** "in 42 minutes" or "3 hours ago", relative to a clock the caller supplies. */
export function relative(iso: string | null | undefined, nowMs: number): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.round((d.getTime() - nowMs) / 1000);
  if (Math.abs(diff) < 45) return diff >= 0 ? "in a moment" : "just now";
  return diff > 0 ? `in ${duration(diff)}` : `${duration(-diff)} ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
}

/** A count of bytes: "384 kB". Used only where the size of a file is the point. */
export function bytes(n: number): string {
  const v = Number(n) || 0;
  if (v < 1000) return `${v} bytes`;
  return `${Math.round(v / 100) / 10} kB`;
}

/** 0xAbCd…1234, for verification sections only, never in reading flow. */
export function shortAddress(addr: string): string {
  const a = String(addr ?? "");
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** A digest, shortened the same way and for the same places. */
export function shortDigest(hex: string): string {
  const h = String(hex ?? "");
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h;
}

