"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Button, Card, Counter, Empty, Fact, Field, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { isSteward, orgActs } from "@/lib/acts";
import {
  assetStatus, duration, eventKind, gen, infraType, maintenanceType, moment, motionKind, motionState, orgState,
  relative,
} from "@/lib/present";
import { getConfig, getConstitution, getEvents, getOrganization, invalidateReads, listAssets } from "@/lib/read";
import type { Constitution, Organization } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

export default function OrganizationPage() {
  const { oid } = useParams<{ oid: string }>();
  const w = useWallet();
  const clock = useNow();
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const v = org.data?.constitution_version;
  const c = useChain(v ? `c.${oid}.${v}` : null, (f) => getConstitution(oid, v!, f));
  const config = useChain("config", () => getConfig());

  if (org.loading) return <Band dark><Loading what="the organisation" dark /></Band>;
  if (org.error) return <Band><ReadFailure what="the organisation" detail={String((org.error as Error).message)} /></Band>;
  if (!org.data) return <Band><Empty>There is no such organisation on this deployment.</Empty></Band>;
  const o = org.data;
  const now = Math.max(Date.parse(o.now) || 0, clock);
  const acts = c.data ? orgActs(o, c.data, w.address, now) : null;
  const reload = () => { invalidateReads(); org.reload(); c.reload(); };

  return (
    <>
      <section className="band-dark">
        <div className="page pb-16 pt-12 md:pb-20">
          <div className="flex flex-wrap items-center gap-5">
            <Status dark>{orgState(o.state)}</Status>
            <span className="t-label text-haze">Constitution {o.constitution_version} · founded {moment(o.created_at)}</span>
            {isSteward(o.stewards, w.address) ? <Tag dark>You are a steward</Tag> : null}
          </div>
          <h1 className="t-display mt-6 max-w-[20ch]">{o.name}</h1>
          <p className="t-body-lg mt-8 max-w-[64ch] text-haze">{o.mission}</p>
          <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-4">
            <Fact dark label="Treasury">{gen(o.escrow_wei)}</Fact>
            <Fact dark label="Committed">{gen(o.committed_wei)}</Fact>
            <Fact dark label="Free to commit">{gen(o.spendable_wei)}</Fact>
            <Fact dark label="Paid for maintenance">{gen(o.paid_wei)}</Fact>
          </dl>
        </div>
      </section>

      <Band>
        <Counter n={1} of={4} />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 className="t-heading-lg">Infrastructure.</h2>
          {acts?.createWorkOrder ? <Link href={`/organizations/${oid}/work-orders/new`} className="t-label rounded-[8px] bg-ink px-4 py-2.5 text-paper">Commission work</Link> : null}
        </div>
        <Assets o={o} c={c.data ?? null} canEnrol={!!acts?.registerAsset} />
      </Band>

      {c.data && config.data ? (
        <Band className="border-t border-lichen">
          <Counter n={2} of={4} />
          <h2 className="t-heading-lg mt-6">Maintenance rules and how decisions are made.</h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Card>
              <Tag>Enforced in code</Tag>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <Fact label="Maintains">{c.data.supported_infrastructure_types.map(infraType).join(", ")}</Fact>
                <Fact label="Funds">{c.data.eligibility_rules.approved_maintenance_types.map(maintenanceType).join(", ")}</Fact>
                <Fact label="Largest payment">{gen(c.data.funding_rules.max_payment_wei)}, emergencies {gen(c.data.emergency_rules.emergency_max_payment_wei)}</Fact>
                <Fact label="Reserve">{gen(c.data.funding_rules.reserve_floor_wei)} never committed</Fact>
                <Fact label="Appeals">{c.data.appeal_rules.max_appeals_per_work_order} per work order, within {duration(c.data.appeal_rules.appeal_window_seconds)}</Fact>
                <Fact label="Providers">Only those the stewards authorise, for the work named</Fact>
              </dl>
              <Link href={`/organizations/${oid}/constitution`} className="t-label mt-6 inline-block underline underline-offset-4">The whole constitution and its history</Link>
            </Card>
            <Card tone="tissue">
              <Tag>Judged on GenLayer</Tag>
              <p className="t-body mt-5">
                Validators each examine the photographs and read the documents, then rate every principle in
                scope, every acceptance criterion and three consistency checks. Code grounds each rating and
                derives the outcome:
              </p>
              <ol className="mt-5">
                {config.data.decision_rule.map((r) => {
                  const [when, then] = r.split(" -> ");
                  return (
                    <li key={r} className="grid grid-cols-[1fr_auto] gap-4 border-t border-lichen py-3">
                      <span className="t-small">{(when ?? "").replace(/_/g, " ").toLowerCase().replace(/^./, (x) => x.toUpperCase())}</span>
                      <span className="t-label">{(then ?? "").toLowerCase()}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="t-small mt-4 text-graphite">A finding stands only on a photograph or the independent inspector&apos;s observation. Paperwork can neither prove nor disprove the work.</p>
            </Card>
          </div>
        </Band>
      ) : null}

      <Band className="border-t border-lichen">
        <Counter n={3} of={4} />
        <h2 className="t-heading-lg mt-6">Governance.</h2>
        {acts && c.data ? <Governance o={o} c={c.data} acts={acts} now={now} onChange={reload} /> : <Loading what="the constitution" />}
      </Band>

      <Record oid={oid} />
    </>
  );
}

function Assets({ o, c, canEnrol }: { o: Organization; c: Constitution | null; canEnrol: boolean }) {
  const assets = useChain(`assets.${o.organization_id}`, (f) => listAssets(o.organization_id, 0, 50, f));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "", name: "", description: "", location: "", operator: "", profile: "",
                               installed: "", interval: "180", inspector: "" });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <div className="mt-8 flex flex-col gap-4">
      {assets.loading ? <Loading what="the registry" /> : null}
      {assets.data?.total === 0 ? <Empty>Nothing enrolled yet.</Empty> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {assets.data?.assets.map((a) => (
          <Card key={a.asset_id} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3"><Tag>{infraType(a.asset_type)}</Tag><Status>{assetStatus(a.status)}</Status></div>
            <p className="t-heading">{a.name}</p>
            {a.location_reference ? <p className="t-body text-graphite">{a.location_reference}</p> : null}
            <p className="t-small text-graphite">
              {a.service_log.length} service record{a.service_log.length === 1 ? "" : "s"}
              {a.next_service_due ? `; next service due ${moment(a.next_service_due)}` : ""}.
            </p>
            <div className="mt-auto"><Arrow href={`/assets/${a.asset_id}`} label={`Open ${a.name}`} /></div>
          </Card>
        ))}
      </div>
      {canEnrol && c ? (open ? (
        <Card tone="tissue">
          <p className="t-sub">Enrol infrastructure.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Kind">
              <select value={f.type || c.supported_infrastructure_types[0]} onChange={(e) => set({ type: e.target.value })}>
                {c.supported_infrastructure_types.map((t) => <option key={t} value={t}>{infraType(t)}</option>)}
              </select>
            </Field>
            <Field label="Name"><input value={f.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Location reference"><input value={f.location} maxLength={200} onChange={(e) => set({ location: e.target.value })} /></Field>
            <Field label="Operator"><input value={f.operator} maxLength={120} onChange={(e) => set({ operator: e.target.value })} /></Field>
            <Field label="Installed on"><input type="date" value={f.installed} onChange={(e) => set({ installed: e.target.value })} /></Field>
            <Field label="Service every, days" hint="0 for no scheduled service."><input type="number" min={0} max={3650} value={f.interval} onChange={(e) => set({ interval: e.target.value })} /></Field>
            <Field label="Independent inspector's wallet, optional" hint="Not a steward. They accept the role before their observations count.">
              <input className="font-mono" value={f.inspector} placeholder="0x…" onChange={(e) => set({ inspector: e.target.value })} />
            </Field>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field label="Description"><textarea value={f.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></Field>
            <Field label="Technical profile"><textarea value={f.profile} maxLength={2000} onChange={(e) => set({ profile: e.target.value })} /></Field>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Act label="Enrol the asset" method="register_asset"
                 prepare={() => (f.name.trim() ? [o.organization_id, JSON.stringify({
                   asset_type: f.type || c.supported_infrastructure_types[0], name: f.name.trim(), description: f.description.trim(),
                   location_reference: f.location.trim(), operator: f.operator.trim(), technical_profile: f.profile.trim(),
                   installation_date: f.installed, maintenance_interval_days: Number(f.interval) || 0, inspector: f.inspector.trim() })]
                   : "Name the asset.")}
                 onAnswer={() => { setOpen(false); invalidateReads(); assets.reload(); }} />
            <Button variant="secondary" onClick={() => setOpen(false)}>Put it away</Button>
          </div>
        </Card>
      ) : <div><Button variant="secondary" onClick={() => setOpen(true)}>Enrol infrastructure</Button></div>) : null}
    </div>
  );
}

function Governance({ o, c, acts, now, onChange }:
    { o: Organization; c: Constitution; acts: NonNullable<ReturnType<typeof orgActs>>; now: number; onChange: () => void }) {
  const [objection, setObjection] = useState("");
  const [reason, setReason] = useState("");
  const [pauseWhy, setPauseWhy] = useState("");
  const m = o.motion;
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <Card>
        <Tag>Motions</Tag>
        {m && m.state === "PENDING" ? (
          <div className="mt-5">
            <p className="t-heading">{motionKind(m.kind)} pending{m.kind === "AMENDMENT" ? `: version ${m.version}` : ""}.</p>
            {m.reason ? <p className="t-body mt-3">&ldquo;{m.reason}&rdquo;</p> : null}
            <p className="t-small mt-3 text-graphite">
              Its window closes {moment(m.window_ends)}, {relative(m.window_ends, now)}. Any steward may withdraw it until
              then; afterwards anyone may enact it.
            </p>
            <div className="mt-6 grid gap-5">
              {acts.objectMotion ? (
                <Act label="Withdraw it" method="object_motion" variant="secondary"
                     prepare={() => (objection.trim() ? [o.organization_id, objection.trim()] : "Say why you object.")} onAnswer={onChange}>
                  <Field label="Objection"><textarea value={objection} onChange={(e) => setObjection(e.target.value)} /></Field>
                </Act>
              ) : null}
              {acts.enactMotion ? <Act label="Enact it" method="enact_motion" args={[o.organization_id]} onAnswer={onChange} /> : null}
            </div>
          </div>
        ) : (
          <p className="t-body mt-5 text-graphite">No motion is pending. The constitution changes, and the organisation dissolves, only by a motion that waits {duration(c.governance.motion_window_seconds)} for any steward&apos;s objection.</p>
        )}
        {o.motions.length ? (
          <ol className="mt-6 border-t border-lichen pt-4">
            {[...o.motions].reverse().slice(0, 5).map((x, i) => (
              <li key={i} className="t-small py-1 text-graphite">{motionKind(x.kind)}{x.version ? ` v${x.version}` : ""}: {motionState(x.state).toLowerCase()} {moment(x.decided_at)}</li>
            ))}
          </ol>
        ) : null}
        {acts.proposeAmendment ? <Link href={`/organizations/${o.organization_id}/constitution`} className="t-label mt-6 inline-block underline underline-offset-4">Propose an amendment</Link> : null}
      </Card>
      <Card tone="tissue">
        <Tag>Operation</Tag>
        <p className="t-body mt-5">
          {o.state === "ACTIVE" ? "Active: taking new infrastructure, providers and work."
            : o.state === "PAUSED" ? "Paused: no new commitments; work in flight continues."
            : o.state === "DISSOLVING" ? "Dissolving: no new commitments. Once every open work order ends, the treasury is refunded in full to the named beneficiary."
            : `Dissolved ${moment(o.dissolved_at)}. ${gen(o.returned_wei)} was refunded to the beneficiary.`}
        </p>
        <div className="mt-6 grid gap-5">
          {acts.pause ? (
            <Act label="Pause new commitments" method="pause_organization" variant="secondary"
                 prepare={() => [o.organization_id, pauseWhy.trim()]} onAnswer={onChange}>
              <Field label="Reason, optional"><input value={pauseWhy} onChange={(e) => setPauseWhy(e.target.value)} /></Field>
            </Act>
          ) : null}
          {acts.resume ? <Act label="Resume" method="resume_organization" args={[o.organization_id]} onAnswer={onChange} /> : null}
          {acts.completeDissolution ? <Act label="Complete the dissolution" method="complete_dissolution" args={[o.organization_id]} onAnswer={onChange} /> : null}
          {acts.proposeDissolution ? (
            <details>
              <summary className="t-label cursor-pointer text-graphite">Propose dissolution</summary>
              <div className="mt-4">
                <Act label="Propose dissolution" method="propose_dissolution" variant="secondary"
                     prepare={() => (reason.trim() ? [o.organization_id, reason.trim()] : "State the reason.")} onAnswer={onChange}>
                  <Field label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                </Act>
              </div>
            </details>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Record({ oid }: { oid: string }) {
  const events = useChain(`events.${oid}`, (f) => getEvents(oid, 0, 40, f));
  return (
    <Band dark>
      <Counter n={4} of={4} dark />
      <h2 className="t-heading-lg mt-6">Activity.</h2>
      <ol className="mt-10">
        {events.loading ? <Loading what="the record" dark /> : null}
        {events.data?.events.map((e) => (
          <li key={e.n} className="grid gap-2 border-t border-graphite py-4 md:grid-cols-[240px_1fr]">
            <span className="t-label text-haze">{moment(e.at)}</span>
            <span className="t-body">{eventKind(e.kind)}</span>
          </li>
        ))}
      </ol>
    </Band>
  );
}
