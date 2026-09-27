"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Band, Button, Card, Fact, Loading, Status, Tag } from "@/components/bits";
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <Tag>Enforced in code</Tag>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <Fact label="Supported infrastructure">{c.supported_infrastructure_types.map(infraType).join(", ")}</Fact>
          <Fact label="Funded maintenance">{c.eligibility_rules.approved_maintenance_types.map(maintenanceType).join(", ")}</Fact>
          <Fact label="Inspector's report required for">{c.eligibility_rules.inspection_report_required_for.map(maintenanceType).join(", ") || "Nothing"}</Fact>
          <Fact label="Payments">Up to {gen(c.funding_rules.max_payment_wei)}; emergencies up to {gen(c.emergency_rules.emergency_max_payment_wei)}</Fact>
          <Fact label="Open work at once">{c.funding_rules.max_open_work_orders}</Fact>
          <Fact label="Reserve">{gen(c.funding_rules.reserve_floor_wei)}</Fact>
          <Fact label="Appeals">{c.appeal_rules.max_appeals_per_work_order} per order; window {duration(c.appeal_rules.appeal_window_seconds)} ({duration(c.emergency_rules.emergency_appeal_window_seconds)} in emergencies); evidence period {duration(c.appeal_rules.evidence_period_seconds)}</Fact>
          <Fact label="Governance">{c.governance.stewards.length} steward{c.governance.stewards.length === 1 ? "" : "s"}; motions wait {duration(c.governance.motion_window_seconds)}</Fact>
        </dl>
        <div className="mt-8 border-t border-lichen pt-5">
          <p className="t-label text-graphite">Evidence required before any assessment</p>
          <ul className="mt-3 flex flex-col gap-1">
            {c.evidence_requirements.map((r, i) => (
              <li key={i} className="t-small">{r.min_count} {requirementType(r.type, r.min_count)} for {r.maintenance_type === "ALL" ? "every kind of work" : maintenanceType(r.maintenance_type).toLowerCase()}</li>
            ))}
          </ul>
        </div>
        <details className="mt-6">
          <summary className="t-label cursor-pointer text-graphite">The stewards&apos; and beneficiary&apos;s wallets</summary>
          <ul className="mt-3 flex flex-col gap-1">
            {c.governance.stewards.map((s) => <li key={s} className="t-mono break-all text-graphite">Steward {s}</li>)}
            <li className="t-mono break-all text-graphite">Beneficiary {c.governance.dissolution_beneficiary}</li>
          </ul>
        </details>
      </Card>
      <Card tone="tissue">
        <Tag>Maintenance principles, judged on GenLayer</Tag>
        <ol className="mt-6">
          {c.maintenance_principles.map((p, i) => (
            <li key={p.id} className="border-t border-lichen py-5 first:border-t-0">
              <p className="t-label text-graphite">Principle {i + 1} · {p.applies_to.length ? p.applies_to.map(maintenanceType).join(", ") : "every kind of work"}</p>
              <p className="t-body-lg mt-2">{p.text}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
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
        <div className="page py-14 md:py-20">
          <Tag dark>Constitution</Tag>
          <h1 className="t-display mt-6 max-w-[20ch]">{c.data?.organization_name ?? "Constitution"}</h1>
          <p className="t-body-lg mt-6 max-w-[64ch] text-haze">
            Versioned and immutable once in force. Every work order is bound to the version in force when it
            was created, and every decision cites it: a later amendment never changes an earlier decision.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
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
                Proposed by {shortAddress(c.data.proposed_by)} {moment(c.data.proposed_at)}
                {c.data.effective_at ? `; in force from ${moment(c.data.effective_at)}` : ""}.
              </span>
            </div>
            <p className="t-body-lg mb-10 max-w-[70ch]">{c.data.mission}</p>
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
