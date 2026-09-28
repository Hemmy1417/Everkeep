"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Act } from "@/components/Act";
import { Band, Button, Card, Field, Loading, Tag } from "@/components/bits";
import { acting, isSteward } from "@/lib/acts";
import { gen, maintenanceType, parseGen, requirementType } from "@/lib/present";
import { getConfig, getConstitution, getOrganization, invalidateReads, listAssets, listProviders } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

const STEPS = ["Asset", "Maintenance", "Requirements", "Acceptance criteria", "Evidence", "Provider", "Budget",
               "Deadline", "Review", "Create"];

function Wizard() {
  const { oid } = useParams<{ oid: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const w = useWallet();
  const config = useChain("config", () => getConfig());
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const v = org.data?.constitution_version;
  const c = useChain(v ? `c.${oid}.${v}` : null, (f) => getConstitution(oid, v!, f));
  const assets = useChain(`assets.${oid}`, (f) => listAssets(oid, 0, 50, f));
  const providers = useChain(`providers.${oid}`, (f) => listProviders(oid, f));

  const [step, setStep] = useState(0);
  const now = useNow();
  const [d, setD] = useState(() => ({
    asset: search.get("asset") ?? "", type: "", title: "", description: "", requirements: "", specification: "",
    criteria: [""], evidence: [] as Array<{ type: string; min_count: string }>, provider: "", budget: "1",
    payment: "1", deadline: new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 16),
  }));
  const set = (p: Partial<typeof d>) => setD({ ...d, ...p });

  const liveAssets = (assets.data?.assets ?? []).filter((a) => !a.retired_at);
  const asset = liveAssets.find((a) => a.asset_id === d.asset) ?? liveAssets[0];
  const type = d.type || c.data?.eligibility_rules.approved_maintenance_types[0] || "";
  const eligible = (providers.data?.providers ?? []).filter((p) => !p.revoked_at && p.maintenance_types.includes(type));
  const provider = eligible.find((p) => p.address === d.provider) ?? eligible[0];

  const checks = (() => {
    if (!c.data || !org.data) return [];
    const pay = parseGen(d.payment), budget = parseGen(d.budget);
    const cap = BigInt(type === "EMERGENCY_REPAIR" ? c.data.emergency_rules.emergency_max_payment_wei : c.data.funding_rules.max_payment_wei);
    const needsInspector = c.data.eligibility_rules.inspection_report_required_for.includes(type);
    return [
      { ok: !!asset, text: asset ? `The asset is enrolled: ${asset.name}.` : "Choose an enrolled asset." },
      { ok: c.data.eligibility_rules.approved_maintenance_types.includes(type), text: `The constitution funds ${maintenanceType(type).toLowerCase()}.` },
      { ok: !!provider, text: provider ? `${provider.name} is authorised for this work.` : "No authorised provider does this work." },
      { ok: pay !== null && budget !== null && pay <= budget, text: "The payment is within the budget." },
      { ok: budget !== null && budget <= cap, text: `The budget is within the constitution's limit of ${gen(cap)}.` },
      { ok: pay !== null && pay <= BigInt(org.data.spendable_wei), text: `The treasury can commit it and keep its reserve (${gen(org.data.spendable_wei)} free).` },
      { ok: org.data.open_work_orders < c.data.funding_rules.max_open_work_orders, text: `Open work is under the limit of ${c.data.funding_rules.max_open_work_orders}.` },
      { ok: !needsInspector || !!asset?.inspector, text: needsInspector ? "This work needs an inspector's report, and the asset names an inspector." : "No inspector's report is required for this work." },
      { ok: d.requirements.trim().length >= 20 && d.criteria.some((x) => x.trim().length >= 12) && !!d.title.trim(), text: "Title, requirements and at least one criterion are written." },
      { ok: Date.parse(`${d.deadline}:00Z`) > now, text: "The deadline is in the future." },
    ];
  })();

  const json = JSON.stringify({
    maintenance_type: type, title: d.title.trim(), description: d.description.trim(), requirements: d.requirements.trim(),
    specification: d.specification.trim(), acceptance_criteria: d.criteria.filter((x) => x.trim()).map((text) => ({ text: text.trim() })),
    required_evidence: d.evidence.map((r) => ({ type: r.type, min_count: Number(r.min_count) || 1 })),
    budget_wei: (parseGen(d.budget) ?? 0n).toString(), payment_wei: (parseGen(d.payment) ?? 0n).toString(), deadline: `${d.deadline}:00Z`,
  });

  if (!org.data || !c.data || !config.data) return <Band><Loading what="the organisation's rules" /></Band>;
  if (!isSteward(acting(org.data), w.address)) {
    return <Band><p className="t-body text-graphite">Only a steward under the constitution in force commissions work. Connect a steward&apos;s wallet.</p></Band>;
  }

  const panes = [
    <Field key="a" label="Which enrolled asset">
      <select value={asset?.asset_id ?? ""} onChange={(e) => set({ asset: e.target.value })}>
        {liveAssets.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.name}</option>)}
      </select>
    </Field>,
    <div key="m" className="grid gap-5 md:grid-cols-2">
      <Field label="Kind of work" hint="Only what the constitution funds.">
        <select value={type} onChange={(e) => set({ type: e.target.value })}>
          {c.data.eligibility_rules.approved_maintenance_types.map((m) => <option key={m} value={m}>{maintenanceType(m)}</option>)}
        </select>
      </Field>
      <Field label="Title"><input value={d.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="What prompted it, optional"><textarea value={d.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></Field>
    </div>,
    <div key="r" className="grid gap-5">
      <Field label="What has to be done"><textarea value={d.requirements} maxLength={2000} onChange={(e) => set({ requirements: e.target.value })} /></Field>
      <Field label="Specification, optional" hint="For example the replacement equipment required."><textarea value={d.specification} maxLength={2000} onChange={(e) => set({ specification: e.target.value })} /></Field>
    </div>,
    <div key="c" className="grid gap-4">
      {d.criteria.map((x, i) => (
        <Field key={i} label={`Criterion ${i + 1}`} hint={i === 0 ? "A contractual question the evidence can answer, such as a display showing a normal reading." : undefined}>
          <textarea value={x} maxLength={300} onChange={(e) => set({ criteria: d.criteria.map((y, j) => (j === i ? e.target.value : y)) })} />
        </Field>
      ))}
      {d.criteria.length < config.data.limits.max_criteria ? (
        <button type="button" className="t-label self-start underline underline-offset-4" onClick={() => set({ criteria: [...d.criteria, ""] })}>Add a criterion</button>
      ) : null}
    </div>,
    <div key="e" className="grid gap-4">
      <p className="t-small text-graphite">
        The constitution already requires: {c.data.evidence_requirements.filter((r) => r.maintenance_type === "ALL" || r.maintenance_type === type)
          .map((r) => `${r.min_count} ${requirementType(r.type, r.min_count)}`).join(", ") || "nothing beyond a photograph"}. Add what this job needs.
      </p>
      {d.evidence.map((r, i) => (
        <div key={i} className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
          <Field label="Require">
            <select value={r.type} onChange={(e) => set({ evidence: d.evidence.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>
              {(config.data?.requirement_types ?? []).map((t) => <option key={t} value={t}>{requirementType(t)}</option>)}
            </select>
          </Field>
          <Field label="At least"><input type="number" min={1} max={4} value={r.min_count} onChange={(e) => set({ evidence: d.evidence.map((x, j) => (j === i ? { ...x, min_count: e.target.value } : x)) })} /></Field>
          <button type="button" className="t-label pb-3 underline underline-offset-4" onClick={() => set({ evidence: d.evidence.filter((_, j) => j !== i) })}>Remove</button>
        </div>
      ))}
      <button type="button" className="t-label self-start underline underline-offset-4" onClick={() => set({ evidence: [...d.evidence, { type: "BEFORE_PHOTO", min_count: "1" }] })}>Add a requirement</button>
    </div>,
    <Field key="p" label="Authorised provider" hint={eligible.length ? "Only providers authorised for this kind of work." : "No provider is authorised for this work; a steward can authorise one."}>
      <select value={provider?.address ?? ""} onChange={(e) => set({ provider: e.target.value })}>
        {eligible.map((p) => <option key={p.address} value={p.address}>{p.name}</option>)}
      </select>
    </Field>,
    <div key="b" className="grid gap-5 md:grid-cols-2">
      <Field label="Budget, GEN"><input inputMode="decimal" value={d.budget} onChange={(e) => set({ budget: e.target.value })} /></Field>
      <Field label="Payment on acceptance, GEN" hint="Committed from the treasury the moment the order is created."><input inputMode="decimal" value={d.payment} onChange={(e) => set({ payment: e.target.value })} /></Field>
    </div>,
    <Field key="d" label="Deadline, UTC" hint="Evidence is filed and an assessment asked for before this."><input type="datetime-local" value={d.deadline} onChange={(e) => set({ deadline: e.target.value })} /></Field>,
    <div key="v" className="flex flex-col gap-3">
      <p className="t-sub">Constitutional compatibility, checked here as the contract will check it.</p>
      <ul>
        {checks.map((x) => (
          <li key={x.text} className="grid grid-cols-[auto_1fr] items-baseline gap-4 border-t border-lichen py-3">
            <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${x.ok ? "bg-lime" : "bg-ink"}`} />
            <span className={`t-body ${x.ok ? "" : "underline decoration-lichen underline-offset-4"}`}>{x.text}</span>
          </li>
        ))}
      </ul>
      <p className="t-label mt-4 text-graphite">The exact terms the contract will receive</p>
      <pre className="t-mono max-h-[280px] overflow-auto rounded-[12px] bg-ink p-4 text-lichen">{JSON.stringify(JSON.parse(json), null, 2)}</pre>
    </div>,
    <div key="x">
      {checks.every((x) => x.ok) ? (
        <Act label="Create the work order" method="create_work_order" args={[asset?.asset_id, provider?.address, json]}
             working="The contract checks the terms against the constitution in force and commits the payment."
             onAnswer={(a) => { invalidateReads(); const wid = a ? String(a.work_order_id ?? "") : ""; if (wid) router.push(`/work-orders/${wid}`); }} />
      ) : <p className="t-body">Go back to the review: a check above is not met.</p>}
    </div>,
  ];

  return (
    <Band>
      <ol className="mb-10 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}
                    className={`t-label rounded-[12px] border px-3 py-1.5 ${i === step ? "border-lime bg-lime text-ink" : i < step ? "border-ink text-ink" : "border-lichen text-graphite"}`}>
              {String(i + 1).padStart(2, "0")} {s}
            </button>
          </li>
        ))}
      </ol>
      <Card>
        <Tag>{`${String(step + 1).padStart(2, "0")} / 10 · ${STEPS[step]}`}</Tag>
        <div className="mt-8">{panes[step]}</div>
        <div className="mt-10 flex flex-wrap gap-3 border-t border-lichen pt-6">
          {step > 0 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button> : null}
          {step < STEPS.length - 1 ? <Button onClick={() => setStep(step + 1)}>Next</Button> : null}
        </div>
      </Card>
    </Band>
  );
}

export default function NewWorkOrder() {
  return (
    <>
      <section className="band-dark">
        <div className="page py-14 md:py-20">
          <Tag dark>New work order</Tag>
          <h1 className="t-display mt-6 max-w-[18ch]">Commission maintenance under the rules in force.</h1>
        </div>
      </section>
      <Suspense fallback={<Band><Loading what="the wizard" /></Band>}><Wizard /></Suspense>
    </>
  );
}
