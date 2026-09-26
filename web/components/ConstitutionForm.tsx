"use client";

/**
 * A whole constitution, as a form. Used to found an organisation and to
 * propose an amendment (prefilled with the one in force). Every limit and
 * every list of choices comes from the contract's get_config, so the form
 * cannot offer something the contract would refuse on shape. Whether the
 * contract accepts the content is its call, in its own words.
 */
import { useState } from "react";

import { Field } from "./bits";
import { duration, infraType, maintenanceType, parseGen } from "@/lib/present";
import type { Config, Constitution } from "@/lib/types";

export interface ConstitutionDraft {
  name: string;
  mission: string;
  infra: string[];
  maint: string[];
  principles: string[];
  minImages: string;
  inspection: boolean;
  maxPayment: string;
  maxOpen: string;
  appealSeconds: number;
  amendSeconds: number;
  stewards: string[];
}

const GEN = 10n ** 18n;
const genText = (wei: string) => {
  const v = BigInt(wei);
  const whole = v / GEN;
  const frac = (v % GEN).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
};

export function draftFrom(c: Constitution | null, founder: string): ConstitutionDraft {
  if (!c) {
    return {
      name: "", mission: "", infra: ["COMMUNITY_SOLAR"], maint: ["INSPECTION", "CORRECTIVE_MAINTENANCE"],
      principles: [""], minImages: "1", inspection: false, maxPayment: "3", maxOpen: "5",
      appealSeconds: 3600, amendSeconds: 86400, stewards: founder ? [founder] : [""],
    };
  }
  return {
    name: c.organization_name, mission: c.mission,
    infra: [...c.supported_infrastructure_types], maint: [...c.approved_maintenance_types],
    principles: c.principles.map((p) => p.text),
    minImages: String(c.evidence_rules.min_images), inspection: c.evidence_rules.inspection_report_required,
    maxPayment: genText(c.funding_rules.max_payment_wei), maxOpen: String(c.funding_rules.max_open_work_orders),
    appealSeconds: c.windows.appeal_window_seconds, amendSeconds: c.windows.amendment_window_seconds,
    stewards: [...c.stewards],
  };
}

/** The JSON the contract reads, or a sentence saying what is missing. */
export function constitutionJson(d: ConstitutionDraft): string {
  const wei = parseGen(d.maxPayment);
  if (!d.name.trim()) return "Name the organisation.";
  if (d.mission.trim().length < 20) return "The mission needs at least twenty characters.";
  if (!d.principles.some((p) => p.trim())) return "Write at least one maintenance principle.";
  if (wei === null) return "The largest payment must be an amount of GEN.";
  if (!d.stewards.some((s) => s.trim())) return "Name at least one steward.";
  return JSON.stringify({
    organization_name: d.name.trim(),
    mission: d.mission.trim(),
    supported_infrastructure_types: d.infra,
    approved_maintenance_types: d.maint,
    principles: d.principles.map((p) => p.trim()).filter(Boolean).map((text) => ({ text })),
    evidence_rules: { min_images: Number(d.minImages) || 1, inspection_report_required: d.inspection },
    funding_rules: { max_payment_wei: wei.toString(), max_open_work_orders: Number(d.maxOpen) || 1 },
    windows: { appeal_window_seconds: d.appealSeconds, amendment_window_seconds: d.amendSeconds },
    stewards: d.stewards.map((s) => s.trim()).filter(Boolean),
  });
}

const WINDOWS = [600, 3600, 6 * 3600, 86400, 3 * 86400, 7 * 86400, 14 * 86400, 30 * 86400];

function Checks({ all, chosen, name, onChange }:
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

export function ConstitutionForm({ config, draft, onChange }:
    { config: Config; draft: ConstitutionDraft; onChange: (d: ConstitutionDraft) => void }) {
  const set = (patch: Partial<ConstitutionDraft>) => onChange({ ...draft, ...patch });
  const [, force] = useState(0);
  const within = (lo: number, hi: number) => WINDOWS.filter((s) => s >= lo && s <= hi);

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Organisation name"><input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} /></Field>
        <Field label="Mission"><textarea value={draft.mission} onChange={(e) => set({ mission: e.target.value })} maxLength={2000} /></Field>
      </div>

      <div className="flex flex-col gap-6">
        <p className="t-sub">The enforced half</p>
        <Field label="Infrastructure it supports">
          <Checks all={config.infrastructure_types} chosen={draft.infra} name={infraType} onChange={(infra) => set({ infra })} />
        </Field>
        <Field label="Maintenance it pays for">
          <Checks all={config.maintenance_types} chosen={draft.maint} name={maintenanceType} onChange={(maint) => set({ maint })} />
        </Field>
        <div className="grid gap-6 md:grid-cols-4">
          <Field label="Largest payment, GEN"><input inputMode="decimal" value={draft.maxPayment} onChange={(e) => set({ maxPayment: e.target.value })} /></Field>
          <Field label="Open orders at once">
            <input type="number" min={1} max={config.max_open_work_orders_cap} value={draft.maxOpen} onChange={(e) => set({ maxOpen: e.target.value })} />
          </Field>
          <Field label="Photographs required">
            <input type="number" min={1} max={config.max_named.IMAGE} value={draft.minImages} onChange={(e) => set({ minImages: e.target.value })} />
          </Field>
          <Field label="Inspector's report">
            <select value={draft.inspection ? "yes" : "no"} onChange={(e) => set({ inspection: e.target.value === "yes" })}>
              <option value="no">Not required</option>
              <option value="yes">Required</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Appeal window">
            <select value={draft.appealSeconds} onChange={(e) => set({ appealSeconds: Number(e.target.value) })}>
              {within(config.window_seconds[0], config.window_seconds[1]).map((s) => <option key={s} value={s}>{duration(s)}</option>)}
            </select>
          </Field>
          <Field label="Amendment window">
            <select value={draft.amendSeconds} onChange={(e) => set({ amendSeconds: Number(e.target.value) })}>
              {within(config.amendment_window_seconds[0], config.amendment_window_seconds[1]).map((s) => <option key={s} value={s}>{duration(s)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Stewards' wallets" hint="Every steward governs under this constitution. The founder must be one of them.">
          <div className="flex flex-col gap-2">
            {draft.stewards.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="font-mono" value={s} placeholder="0x…" spellCheck={false}
                       onChange={(e) => set({ stewards: draft.stewards.map((x, j) => (j === i ? e.target.value : x)) })} />
                {draft.stewards.length > 1 ? (
                  <button type="button" className="t-label px-2 text-graphite"
                          onClick={() => set({ stewards: draft.stewards.filter((_, j) => j !== i) })}>Remove</button>
                ) : null}
              </div>
            ))}
            {draft.stewards.length < config.max_stewards ? (
              <button type="button" className="t-label self-start text-graphite underline underline-offset-4"
                      onClick={() => set({ stewards: [...draft.stewards, ""] })}>Add a steward</button>
            ) : null}
          </div>
        </Field>
      </div>

      <div className="flex flex-col gap-6">
        <p className="t-sub">The judged half</p>
        <p className="t-small -mt-3 max-w-[70ch] text-graphite">
          Each principle is put to the panel on its own and rated against photographs and the
          inspector&apos;s report. Ask what a photograph can show: a principle the evidence cannot
          settle will never pay.
        </p>
        {draft.principles.map((p, i) => (
          <Field key={i} label={`Principle ${i + 1}`}>
            <div className="flex gap-2">
              <textarea value={p} maxLength={300}
                        onChange={(e) => set({ principles: draft.principles.map((x, j) => (j === i ? e.target.value : x)) })} />
              {draft.principles.length > 1 ? (
                <button type="button" className="t-label px-2 text-graphite"
                        onClick={() => { set({ principles: draft.principles.filter((_, j) => j !== i) }); force((n) => n + 1); }}>Remove</button>
              ) : null}
            </div>
          </Field>
        ))}
        {draft.principles.length < config.max_principles ? (
          <button type="button" className="t-label self-start text-graphite underline underline-offset-4"
                  onClick={() => set({ principles: [...draft.principles, ""] })}>Add a principle</button>
        ) : null}
      </div>
    </div>
  );
}
