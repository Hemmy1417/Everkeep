"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Band, Button, Card, Fact, Loading, Status } from "@/components/bits";
import { Info, Tabs } from "@/components/tabs";
import { ConstitutionForm, constitutionJson, draftFrom, type Draft } from "@/components/ConstitutionForm";
import { orgActs } from "@/lib/acts";
import { duration, gen, infraType, maintenanceType, moment, requirementType, shortAddress } from "@/lib/present";
import { getConfig, getConstitution, getOrganization, invalidateReads } from "@/lib/read";
import type { Constitution } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

function Body({ c }: { c: Constitution }) {
  return (
    <Tabs items={[
      { id: "rules", label: "Rules", content: (
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Maintains">{c.supported_infrastructure_types.map(infraType).join(", ")}</Fact>
          <Fact label="Funds">{c.eligibility_rules.approved_maintenance_types.map(maintenanceType).join(", ")}</Fact>
          <Fact label="Payments">Up to {gen(c.funding_rules.max_payment_wei)}, emergencies {gen(c.emergency_rules.emergency_max_payment_wei)}</Fact>
          <Fact label="Reserve">{gen(c.funding_rules.reserve_floor_wei)}</Fact>
          <Fact label="Open work at once">{c.funding_rules.max_open_work_orders}</Fact>
          <Fact label="Appeals">{c.appeal_rules.max_appeals_per_work_order} per order, within {duration(c.appeal_rules.appeal_window_seconds)}</Fact>
        </dl>
      ) },
      { id: "principles", label: "Principles", count: c.maintenance_principles.length, content: (
        <ol className="border-t border-lichen">
          {c.maintenance_principles.map((p, i) => (
            <li key={p.id} className="grid gap-2 border-b border-lichen py-4 md:grid-cols-[48px_1fr_220px]">
              <span className="t-label text-graphite">{i + 1}</span>
              <span className="t-body">{p.text}</span>
              <span className="t-small text-graphite md:text-right">{p.applies_to.length ? p.applies_to.map(maintenanceType).join(", ") : "Every kind of work"}</span>
            </li>
          ))}
        </ol>
      ) },
      { id: "evidence", label: "Evidence required", content: (
        <div>
          <ul className="border-t border-lichen">
            {c.evidence_requirements.map((r, i) => (
              <li key={i} className="t-body border-b border-lichen py-3">{r.min_count} {requirementType(r.type, r.min_count)} for {r.maintenance_type === "ALL" ? "every kind of work" : maintenanceType(r.maintenance_type).toLowerCase()}</li>
            ))}
          </ul>
          <p className="t-small mt-4 text-graphite">An inspector&apos;s report is required for {c.eligibility_rules.inspection_report_required_for.map(maintenanceType).join(", ").toLowerCase() || "nothing"}.</p>
        </div>
      ) },
      { id: "governance", label: "Governance", content: (
        <div>
          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <Fact label="Stewards">{c.governance.stewards.length}</Fact>
            <Fact label="Motions wait">{duration(c.governance.motion_window_seconds)}</Fact>
            <Fact label="Appeal evidence period">{duration(c.appeal_rules.evidence_period_seconds)}</Fact>
            <Fact label="Emergency appeal window">{duration(c.emergency_rules.emergency_appeal_window_seconds)}</Fact>
          </dl>
          <details className="mt-6">
            <summary className="t-label cursor-pointer text-graphite">Wallets</summary>
            <ul className="mt-3 flex flex-col gap-1">
              {c.governance.stewards.map((s) => <li key={s} className="t-mono break-all text-graphite">Steward {s}</li>)}
              <li className="t-mono break-all text-graphite">Beneficiary {c.governance.dissolution_beneficiary}</li>
            </ul>
          </details>
        </div>
      ) },
    ]} />
  );
}

export default function ConstitutionPage() {
  const { oid } = useParams<{ oid: string }>();
  const w = useWallet();
  const clock = useNow();
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const config = useChain("config", () => getConfig());
  const count = org.data?.constitution_count ?? 0;
  const inForce = org.data?.constitution_version ?? 0;
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? inForce;
  const c = useChain(shown ? `c.${oid}.${shown}` : null, (f) => getConstitution(oid, shown, f));
  const current = useChain(inForce ? `c.${oid}.${inForce}` : null, (f) => getConstitution(oid, inForce, f));
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  if (!org.data) return <Band dark><Loading what="the constitution" dark /></Band>;
  const acts = current.data ? orgActs(org.data, current.data, w.address, Math.max(Date.parse(org.data.now), clock)) : null;

  return (
    <>
      <section className="band-dark">
        <div className="page pb-12 pt-12">
          <p className="t-label text-haze">Constitution
            <Info dark>Immutable once in force. Each work order is bound to the version in force when it was created, so a later amendment never changes an earlier decision.</Info>
          </p>
          <h1 className="t-heading-lg mt-5 max-w-[24ch]">{c.data?.organization_name ?? "Constitution"}</h1>
          <div className="mt-8 flex flex-wrap gap-2">
            {Array.from({ length: count }, (_, i) => i + 1).map((v) => (
              <button key={v} type="button" onClick={() => setPicked(v)} aria-pressed={v === shown}
                      className={`t-label rounded-[12px] border px-3 py-1.5 ${v === shown ? "border-lime bg-lime text-ink" : "border-graphite text-lichen"}`}>
                Version {v}{v === inForce ? " · in force" : ""}
              </button>
            ))}
          </div>
        </div>
      </section>
      <Band>
        {c.data ? (
          <>
            <div className="mb-8 flex flex-wrap items-center gap-4">
              <Status>{c.data.effective_at ? (c.data.version === inForce ? "In force" : "Historical") : "Proposed, not in force"}</Status>
              <span className="t-small text-graphite">
                {c.data.effective_at ? `In force from ${moment(c.data.effective_at)}` : `Proposed ${moment(c.data.proposed_at)}`}
                <Info>Proposed by {shortAddress(c.data.proposed_by)}, {moment(c.data.proposed_at)}. Mission: {c.data.mission}</Info>
              </span>
            </div>
            <Body c={c.data} />
          </>
        ) : <Loading what="the constitution" />}
      </Band>
      {acts?.proposeAmendment && config.data && current.data ? (
        <Band className="border-t border-lichen">
          {drafting ? (
            <Card>
              <p className="t-sub mb-8">The next constitution, starting from the one in force.</p>
              <ConstitutionForm config={config.data} draft={draft ?? draftFrom(current.data, "")} onChange={setDraft} />
              <div className="mt-10 flex flex-wrap gap-3">
                <Act label="Propose this amendment" method="propose_amendment"
                     prepare={() => {
                       const json = constitutionJson(draft ?? draftFrom(current.data!, ""));
                       return json.startsWith("{") ? [oid, json] : json;
                     }}
                     onAnswer={() => { setDrafting(false); invalidateReads(); org.reload(); }} />
                <Button variant="secondary" onClick={() => setDrafting(false)}>Put it away</Button>
              </div>
            </Card>
          ) : <Button variant="secondary" onClick={() => setDrafting(true)}>Propose an amendment</Button>}
        </Band>
      ) : null}
    </>
  );
}
