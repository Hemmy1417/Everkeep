"use client";

/**
 * Work order terms. The maintenance choices are the constitution's, not the
 * contract's whole list: the form offers only what the rulebook in force
 * funds, and caps the payment at its limit.
 */
import { Field } from "./bits";
import { gen, maintenanceType, parseGen } from "@/lib/present";
import type { Config, Constitution } from "@/lib/types";

export interface TermsDraft {
  title: string;
  maintenance: string;
  description: string;
  requirements: string;
  criteria: string[];
  images: string;
  meter: boolean;
  payment: string;
  deadline: string; // yyyy-mm-ddThh:mm, read as UTC
}

export function blankTerms(c: Constitution): TermsDraft {
  const soon = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 16);
  return {
    title: "", maintenance: c.approved_maintenance_types[0] ?? "", description: "", requirements: "",
    criteria: [""], images: String(c.evidence_rules.min_images), meter: false, payment: "1", deadline: soon,
  };
}

export function termsJson(d: TermsDraft, c: Constitution): string {
  const wei = parseGen(d.payment);
  if (!d.title.trim()) return "Give the work order a title.";
  if (d.requirements.trim().length < 20) return "The requirements need at least twenty characters.";
  if (!d.criteria.some((x) => x.trim())) return "Write at least one acceptance criterion.";
  if (wei === null) return "The payment must be an amount of GEN.";
  if (wei > BigInt(c.funding_rules.max_payment_wei)) {
    return `The constitution caps one work order at ${gen(c.funding_rules.max_payment_wei)}.`;
  }
  const required = [{ type: "IMAGE", min_count: Number(d.images) || 1 }];
  if (d.meter) required.push({ type: "METER_READING", min_count: 1 });
  return JSON.stringify({
    maintenance_type: d.maintenance,
    title: d.title.trim(),
    description: d.description.trim(),
    requirements: d.requirements.trim(),
    acceptance_criteria: d.criteria.map((x) => x.trim()).filter(Boolean).map((text) => ({ text })),
    required_evidence: required,
    payment_wei: wei.toString(),
    deadline: `${d.deadline}:00Z`,
  });
}

export function TermsForm({ config, constitution, draft, onChange }:
    { config: Config; constitution: Constitution; draft: TermsDraft; onChange: (d: TermsDraft) => void }) {
  const set = (patch: Partial<TermsDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Title"><input value={draft.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Maintenance">
          <select value={draft.maintenance} onChange={(e) => set({ maintenance: e.target.value })}>
            {constitution.approved_maintenance_types.map((m) => <option key={m} value={m}>{maintenanceType(m)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="What has to be done"><textarea value={draft.requirements} maxLength={2000} onChange={(e) => set({ requirements: e.target.value })} /></Field>
      <Field label="Background, optional"><textarea value={draft.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></Field>
      {draft.criteria.map((x, i) => (
        <Field key={i} label={`Acceptance criterion ${i + 1}`}
               hint={i === 0 ? "Something a photograph can show, such as a named model identified by its rating plate." : undefined}>
          <div className="flex gap-2">
            <textarea value={x} maxLength={300}
                      onChange={(e) => set({ criteria: draft.criteria.map((y, j) => (j === i ? e.target.value : y)) })} />
            {draft.criteria.length > 1 ? (
              <button type="button" className="t-label px-2 text-graphite"
                      onClick={() => set({ criteria: draft.criteria.filter((_, j) => j !== i) })}>Remove</button>
            ) : null}
          </div>
        </Field>
      ))}
      {draft.criteria.length < config.max_criteria ? (
        <button type="button" className="t-label self-start text-graphite underline underline-offset-4"
                onClick={() => set({ criteria: [...draft.criteria, ""] })}>Add a criterion</button>
      ) : null}
      <div className="grid gap-6 md:grid-cols-4">
        <Field label="Payment, GEN" hint={`At most ${gen(constitution.funding_rules.max_payment_wei)}.`}>
          <input inputMode="decimal" value={draft.payment} onChange={(e) => set({ payment: e.target.value })} />
        </Field>
        <Field label="Deadline, UTC"><input type="datetime-local" value={draft.deadline} onChange={(e) => set({ deadline: e.target.value })} /></Field>
        <Field label="Photographs required">
          <input type="number" min={1} max={config.max_named.IMAGE} value={draft.images} onChange={(e) => set({ images: e.target.value })} />
        </Field>
        <Field label="Meter reading">
          <select value={draft.meter ? "yes" : "no"} onChange={(e) => set({ meter: e.target.value === "yes" })}>
            <option value="no">Not required</option>
            <option value="yes">One required</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
