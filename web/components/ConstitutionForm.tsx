"use client";

/**
 * A whole constitution as a form: used to found an organisation and to
 * propose an amendment (prefilled with the one in force). Every list of
 * choices comes from the contract's get_config; whether the contract accepts
 * the content is its call, in its own words.
 */
import { Field } from "./bits";
import { duration, gen, infraType, maintenanceType, parseGen, requirementType } from "@/lib/present";
import type { Config, Constitution } from "@/lib/types";

export interface Draft {
  name: string;
  mission: string;
  infra: string[];
  maint: string[];
  inspected: string[];
  principles: Array<{ text: string; applies_to: string[] }>;
  evidence: Array<{ maintenance_type: string; type: string; min_count: string }>;
  maxPay: string;
  maxOpen: string;
  reserve: string;
  emergencyPay: string;
  emergencyWindow: number;
  appealWindow: number;
  evidencePeriod: number;
  maxAppeals: string;
  stewards: string[];
  motionWindow: number;
  beneficiary: string;
}

const W = 10n ** 18n;
const genText = (wei: string) => {
  const v = BigInt(wei);
  const f = (v % W).toString().padStart(18, "0").replace(/0+$/, "");
  return f ? `${v / W}.${f}` : `${v / W}`;
};

export function draftFrom(c: Constitution | null, me: string): Draft {
  if (!c) {
    return {
      name: "", mission: "", infra: ["COMMUNITY_SOLAR"], maint: ["INSPECTION", "COMPONENT_REPLACEMENT", "SYSTEM_RESTORATION"],
      inspected: [], principles: [{ text: "", applies_to: [] }],
      evidence: [{ maintenance_type: "ALL", type: "AFTER_PHOTO", min_count: "1" }],
      maxPay: "3", maxOpen: "5", reserve: "1", emergencyPay: "4", emergencyWindow: 3600, appealWindow: 86400,
      evidencePeriod: 86400, maxAppeals: "1", stewards: me ? [me] : [""], motionWindow: 3 * 86400, beneficiary: "",
    };
  }
  return {
    name: c.organization_name, mission: c.mission, infra: [...c.supported_infrastructure_types],
    maint: [...c.eligibility_rules.approved_maintenance_types], inspected: [...c.eligibility_rules.inspection_report_required_for],
    principles: c.maintenance_principles.map((p) => ({ text: p.text, applies_to: [...p.applies_to] })),
    evidence: c.evidence_requirements.map((r) => ({ ...r, min_count: String(r.min_count) })),
    maxPay: genText(c.funding_rules.max_payment_wei), maxOpen: String(c.funding_rules.max_open_work_orders),
    reserve: genText(c.funding_rules.reserve_floor_wei), emergencyPay: genText(c.emergency_rules.emergency_max_payment_wei),
    emergencyWindow: c.emergency_rules.emergency_appeal_window_seconds, appealWindow: c.appeal_rules.appeal_window_seconds,
    evidencePeriod: c.appeal_rules.evidence_period_seconds, maxAppeals: String(c.appeal_rules.max_appeals_per_work_order),
    stewards: [...c.governance.stewards], motionWindow: c.governance.motion_window_seconds,
    beneficiary: c.governance.dissolution_beneficiary,
  };
}

/** The JSON the contract reads, or a sentence saying what is missing. */
export function constitutionJson(d: Draft): string {
  const pay = parseGen(d.maxPay), reserve = parseGen(d.reserve), emergency = parseGen(d.emergencyPay);
  if (!d.name.trim()) return "Name the organisation.";
  if (d.mission.trim().length < 20) return "The mission needs at least twenty characters.";
  if (!d.principles.some((p) => p.text.trim())) return "Write at least one maintenance principle.";
  if (pay === null || reserve === null || emergency === null) return "Amounts must be in GEN.";
  if (!d.stewards.some((s) => s.trim())) return "Name at least one steward.";
  if (!/^0x[0-9a-fA-F]{40}$/.test(d.beneficiary.trim())) return "Name the wallet a dissolved treasury would go to.";
  return JSON.stringify({
    organization_name: d.name.trim(), mission: d.mission.trim(),
    supported_infrastructure_types: d.infra,
    eligibility_rules: { approved_maintenance_types: d.maint, inspection_report_required_for: d.inspected },
    maintenance_principles: d.principles.filter((p) => p.text.trim()).map((p) => ({ text: p.text.trim(), applies_to: p.applies_to })),
    evidence_requirements: d.evidence.map((r) => ({ maintenance_type: r.maintenance_type, type: r.type, min_count: Number(r.min_count) || 1 })),
    funding_rules: { max_payment_wei: pay.toString(), max_open_work_orders: Number(d.maxOpen) || 1, reserve_floor_wei: reserve.toString() },
    emergency_rules: { emergency_max_payment_wei: emergency.toString(), emergency_appeal_window_seconds: d.emergencyWindow },
    appeal_rules: { appeal_window_seconds: d.appealWindow, evidence_period_seconds: d.evidencePeriod,
                    max_appeals_per_work_order: Number(d.maxAppeals) || 0 },
    governance: { stewards: d.stewards.map((s) => s.trim()).filter(Boolean), motion_window_seconds: d.motionWindow,
                  dissolution_beneficiary: d.beneficiary.trim() },
  });
}

const WINDOWS = [600, 3600, 6 * 3600, 86400, 3 * 86400, 7 * 86400, 14 * 86400, 30 * 86400];

function Chips({ all, chosen, name, onChange }:
    { all: string[]; chosen: string[]; name: (s: string) => string; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((v) => {
        const on = chosen.includes(v);
        return (
          <button key={v} type="button" aria-pressed={on}
                  onClick={() => onChange(on ? chosen.filter((x) => x !== v) : [...chosen, v])}
                  className={`t-label rounded-full border px-3 py-1.5 ${on ? "border-ink bg-ink text-paper" : "border-lichen text-graphite"}`}>
            {name(v)}
          </button>
        );
      })}
    </div>
  );
}

function Window({ label, value, onChange, range }:
    { label: string; value: number; onChange: (n: number) => void; range: [number, number] }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {WINDOWS.filter((s) => s >= range[0] && s <= range[1]).map((s) => <option key={s} value={s}>{duration(s)}</option>)}
      </select>
    </Field>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-lichen pt-8 first:border-t-0 first:pt-0">
      <div>
        <p className="t-sub">{title}</p>
        {note ? <p className="t-small mt-2 max-w-[70ch] text-graphite">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ConstitutionForm({ config, draft, onChange }: { config: Config; draft: Draft; onChange: (d: Draft) => void }) {
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p });
  const range = config.limits.window_seconds;
  return (
    <div className="flex flex-col gap-10">
      <Section title="Mission">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Organisation name"><input value={draft.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Mission"><textarea value={draft.mission} maxLength={2000} onChange={(e) => set({ mission: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="What it maintains" note="Enforced in code: assets of other kinds are refused, and so is work of other kinds.">
        <Field label="Infrastructure it supports"><Chips all={config.infrastructure_types} chosen={draft.infra} name={infraType} onChange={(infra) => set({ infra })} /></Field>
        <Field label="Maintenance it funds"><Chips all={config.maintenance_types} chosen={draft.maint} name={maintenanceType} onChange={(maint) => set({ maint })} /></Field>
        <Field label="Work that needs the independent inspector's report"><Chips all={draft.maint} chosen={draft.inspected} name={maintenanceType} onChange={(inspected) => set({ inspected })} /></Field>
      </Section>

      <Section title="Maintenance principles"
               note="The judged half. Each principle is put to validators on its own, only for the kinds of work it applies to. Ask what a photograph or an inspector can show.">
        {draft.principles.map((p, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[16px] border border-lichen p-5">
            <Field label={`Principle ${i + 1}`}>
              <textarea value={p.text} maxLength={300}
                        onChange={(e) => set({ principles: draft.principles.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            </Field>
            <Field label="Applies to" hint="None chosen means every kind of work.">
              <Chips all={draft.maint} chosen={p.applies_to} name={maintenanceType}
                     onChange={(applies_to) => set({ principles: draft.principles.map((x, j) => (j === i ? { ...x, applies_to } : x)) })} />
            </Field>
            {draft.principles.length > 1 ? (
              <button type="button" className="t-label self-start text-graphite underline underline-offset-4"
                      onClick={() => set({ principles: draft.principles.filter((_, j) => j !== i) })}>Remove</button>
            ) : null}
          </div>
        ))}
        {draft.principles.length < config.limits.max_principles ? (
          <button type="button" className="t-label self-start text-graphite underline underline-offset-4"
                  onClick={() => set({ principles: [...draft.principles, { text: "", applies_to: [] }] })}>Add a principle</button>
        ) : null}
      </Section>

      <Section title="Evidence before any assessment" note="Checked in code before an assessment is allowed.">
        {draft.evidence.map((r, i) => (
          <div key={i} className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto] md:items-end">
            <Field label="For">
              <select value={r.maintenance_type} onChange={(e) => set({ evidence: draft.evidence.map((x, j) => (j === i ? { ...x, maintenance_type: e.target.value } : x)) })}>
                <option value="ALL">Every kind of work</option>
                {draft.maint.map((m) => <option key={m} value={m}>{maintenanceType(m)}</option>)}
              </select>
            </Field>
            <Field label="Require">
              <select value={r.type} onChange={(e) => set({ evidence: draft.evidence.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>
                {config.requirement_types.map((t) => <option key={t} value={t}>{requirementType(t)}</option>)}
              </select>
            </Field>
            <Field label="At least">
              <input type="number" min={1} max={4} value={r.min_count}
                     onChange={(e) => set({ evidence: draft.evidence.map((x, j) => (j === i ? { ...x, min_count: e.target.value } : x)) })} />
            </Field>
            <button type="button" className="t-label pb-3 text-graphite underline underline-offset-4"
                    onClick={() => set({ evidence: draft.evidence.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="t-label self-start text-graphite underline underline-offset-4"
                onClick={() => set({ evidence: [...draft.evidence, { maintenance_type: "ALL", type: "AFTER_PHOTO", min_count: "1" }] })}>Add a rule</button>
      </Section>

      <Section title="Funding" note={`The largest ordinary payment, the emergency limit, and a reserve the treasury never commits. The contract's floor is ${gen(config.limits.min_payment_wei)} per work order.`}>
        <div className="grid gap-6 md:grid-cols-3">
          <Field label="Largest payment, GEN"><input inputMode="decimal" value={draft.maxPay} onChange={(e) => set({ maxPay: e.target.value })} /></Field>
          <Field label="Open work orders at once"><input type="number" min={1} max={50} value={draft.maxOpen} onChange={(e) => set({ maxOpen: e.target.value })} /></Field>
          <Field label="Reserve kept uncommitted, GEN"><input inputMode="decimal" value={draft.reserve} onChange={(e) => set({ reserve: e.target.value })} /></Field>
          <Field label="Largest emergency payment, GEN"><input inputMode="decimal" value={draft.emergencyPay} onChange={(e) => set({ emergencyPay: e.target.value })} /></Field>
          <Window label="Emergency appeal window" value={draft.emergencyWindow} onChange={(n) => set({ emergencyWindow: n })} range={range} />
        </div>
      </Section>

      <Section title="Appeals">
        <div className="grid gap-6 md:grid-cols-3">
          <Window label="Appeal window" value={draft.appealWindow} onChange={(n) => set({ appealWindow: n })} range={range} />
          <Window label="Evidence period on appeal" value={draft.evidencePeriod} onChange={(n) => set({ evidencePeriod: n })} range={range} />
          <Field label="Appeals per work order">
            <select value={draft.maxAppeals} onChange={(e) => set({ maxAppeals: e.target.value })}>
              {["0", "1", "2", "3"].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Governance" note="Stewards act only under the constitution in force. The constitution changes, and the organisation dissolves, only by a motion that waits out its window; any one steward can withdraw it.">
        <Field label="Stewards' wallets" hint="The founder must be one of them.">
          <div className="flex flex-col gap-2">
            {draft.stewards.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="font-mono" value={s} placeholder="0x…" spellCheck={false}
                       onChange={(e) => set({ stewards: draft.stewards.map((x, j) => (j === i ? e.target.value : x)) })} />
                {draft.stewards.length > 1 ? (
                  <button type="button" className="t-label px-2 text-graphite" onClick={() => set({ stewards: draft.stewards.filter((_, j) => j !== i) })}>Remove</button>
                ) : null}
              </div>
            ))}
            {draft.stewards.length < config.limits.max_stewards ? (
              <button type="button" className="t-label self-start text-graphite underline underline-offset-4" onClick={() => set({ stewards: [...draft.stewards, ""] })}>Add a steward</button>
            ) : null}
          </div>
        </Field>
        <div className="grid gap-6 md:grid-cols-2">
          <Window label="Motion window" value={draft.motionWindow} onChange={(n) => set({ motionWindow: n })} range={range} />
          <Field label="On dissolution, the treasury goes to" hint="A successor fund's wallet, for example.">
            <input className="font-mono" value={draft.beneficiary} placeholder="0x…" spellCheck={false} onChange={(e) => set({ beneficiary: e.target.value })} />
          </Field>
        </div>
      </Section>
    </div>
  );
}
