/**
 * The maintenance cycle and a work order's place in it, drawn only from
 * states the contract has written. A step is marked done only when the
 * record shows it; nothing here reports validator activity the network does
 * not expose.
 */
import type { Decision, WorkOrder } from "@/lib/types";

const STEPS = [
  { key: "commissioned", label: "Commissioned" },
  { key: "accepted", label: "Terms accepted" },
  { key: "evidence", label: "Evidence filed" },
  { key: "decision", label: "GenLayer decision" },
  { key: "appeal", label: "Appeal window" },
  { key: "final", label: "Finalized" },
  { key: "settled", label: "Settled or closed" },
] as const;

export function orderProgress(w: WorkOrder, d: Decision | null, now: number): Record<string, "done" | "now" | "later" | "skipped"> {
  const has = (k: string) => {
    switch (k) {
      case "commissioned": return true;
      case "accepted": return !!w.accepted_at;
      case "evidence": return Object.values(w.evidence).some((v) => v.length > 0) || w.decisions.length > 0;
      case "decision": return w.decisions.length > 0;
      case "appeal": return !!d && (d.lifecycle === "FINALIZED" || d.lifecycle === "SUPERSEDED"
        || d.appeals_left === 0 || now > Date.parse(d.appeal_window_ends));
      case "final": return ["PAYMENT_RELEASABLE", "SETTLED", "CLOSED_UNPAID"].includes(w.state) && !!d && d.lifecycle === "FINALIZED";
      case "settled": return ["SETTLED", "CLOSED_UNPAID", "CANCELLED"].includes(w.state);
      default: return false;
    }
  };
  const out: Record<string, "done" | "now" | "later" | "skipped"> = {};
  let current = false;
  for (const s of STEPS) {
    if (w.state === "CANCELLED" && s.key !== "commissioned" && s.key !== "settled") { out[s.key] = "skipped"; continue; }
    if (has(s.key)) out[s.key] = "done";
    else if (!current) { out[s.key] = "now"; current = true; }
    else out[s.key] = "later";
  }
  return out;
}

export function OrderProgress({ w, d, now, dark = false }: { w: WorkOrder; d: Decision | null; now: number; dark?: boolean }) {
  const p = orderProgress(w, d, now);
  return (
    <ol className="grid gap-3 sm:grid-cols-7">
      {STEPS.map((s) => (
        <li key={s.key} className={`flex items-center gap-2 border-t pt-3 sm:flex-col sm:items-start ${dark ? "border-graphite" : "border-lichen"}`}>
          <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${
            p[s.key] === "done" ? (dark ? "bg-paper" : "bg-ink") : p[s.key] === "now" ? "bg-lime" : dark ? "bg-graphite" : "bg-lichen"}`} />
          <span className={`t-label ${p[s.key] === "later" || p[s.key] === "skipped" ? (dark ? "text-graphite" : "text-lichen") : dark ? "text-paper" : "text-ink"}`}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The organisation's cycle, as the brief draws it. Static: it explains, it reports nothing. */
export function Cycle({ dark = false }: { dark?: boolean }) {
  const steps = ["Asset enrolled", "Service due", "Work order", "Work performed", "Evidence", "Preflight in code",
                 "GenLayer decision", "Appeal", "Finalization", "Payment or none", "Back to monitoring"];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`t-label rounded-full border px-3 py-1 ${dark ? "border-graphite text-lichen" : "border-lichen text-graphite"}`}>{s}</span>
          {i < steps.length - 1 ? <span aria-hidden className={dark ? "text-graphite" : "text-lichen"}>→</span> : null}
        </li>
      ))}
      <li className={`t-label ${dark ? "text-haze" : "text-graphite"}`}>and again</li>
    </ol>
  );
}
