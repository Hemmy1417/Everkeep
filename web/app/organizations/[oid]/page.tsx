"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Button, Card, Empty, Fact, Field, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { Info, Stat, Tabs } from "@/components/tabs";
import { acting, isSteward, orgActs } from "@/lib/acts";
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
        <div className="page pb-12 pt-12">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <Status dark>{orgState(o.state)}</Status>
                {isSteward(acting(o), w.address) ? <Tag dark>You are a steward</Tag>
                  : isSteward(o.stewards, w.address) ? <Tag dark>Named a steward; not yet accepted</Tag> : null}
              </div>
              <h1 className="t-heading-lg mt-5 max-w-[24ch]">{o.name}</h1>
              <p className="t-body mt-3 line-clamp-2 max-w-[60ch] text-haze">{o.mission}</p>
            </div>
            {acts?.createWorkOrder ? <Link href={`/organizations/${oid}/work-orders/new`} className="t-label rounded-[8px] bg-paper px-4 py-2.5 text-ink">Commission work</Link> : null}
          </div>
          <dl className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat dark label="Treasury" value={gen(o.escrow_wei)} info="Everything the contract holds for this organisation. There is no owner and no withdrawal." />
            <Stat dark label="Committed" value={gen(o.committed_wei)} info="Set aside for open work orders. It is paid only after a finalized acceptance." />
            <Stat dark label="Free to commit" value={gen(o.spendable_wei)} info="What new work can still draw on, above the reserve the constitution keeps." />
            <Stat dark label="Paid out" value={gen(o.paid_wei)} info="Settled to providers for accepted work." />
          </dl>
        </div>
      </section>

      <section className="band-light py-12">
        <div className="page">
          <Tabs items={[
            { id: "infrastructure", label: "Infrastructure", content: <Assets o={o} c={c.data ?? null} canEnrol={!!acts?.registerAsset} /> },
            { id: "rules", label: "Rules", content: c.data && config.data ? <Rules oid={oid} c={c.data} rule={config.data.decision_rule} /> : <Loading what="the constitution" /> },
            { id: "governance", label: "Governance", content: acts && c.data ? <Governance o={o} c={c.data} acts={acts} now={now} onChange={reload} /> : <Loading what="the constitution" /> },
            { id: "activity", label: "Activity", content: <Record oid={oid} /> },
          ]} />
        </div>
      </section>
    </>
  );
}

function Rules({ oid, c, rule }: { oid: string; c: Constitution; rule: string[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <dl className="grid content-start gap-x-8 gap-y-6 sm:grid-cols-2">
        <Fact label="Maintains">{c.supported_infrastructure_types.map(infraType).join(", ")}</Fact>
        <Fact label="Funds">{c.eligibility_rules.approved_maintenance_types.map(maintenanceType).join(", ")}</Fact>
        <Fact label="Largest payment">{gen(c.funding_rules.max_payment_wei)}, emergencies {gen(c.emergency_rules.emergency_max_payment_wei)}</Fact>
        <Fact label="Reserve">{gen(c.funding_rules.reserve_floor_wei)}</Fact>
        <Fact label="Appeals">{c.appeal_rules.max_appeals_per_work_order} per work order, within {duration(c.appeal_rules.appeal_window_seconds)}</Fact>
        <Fact label="Providers">Authorised by the stewards</Fact>
      </dl>
      <Card tone="tissue" className="!p-6">
        <p className="t-label text-graphite">How work is judged
          <Info>Validators examine the photographs and documents and rate every requirement. Code turns the ratings into the outcome. Only a photograph or the independent inspector can establish a finding.</Info>
        </p>
        <ol className="mt-4">
          {rule.map((r) => {
            const [when, then] = r.split(" -> ");
            return (
              <li key={r} className="grid grid-cols-[1fr_auto] gap-4 border-t border-lichen py-2.5">
                <span className="t-small">{(when ?? "").replace(/_/g, " ").toLowerCase().replace(/^./, (x) => x.toUpperCase())}</span>
                <span className="t-label">{(then ?? "").toLowerCase()}</span>
              </li>
            );
          })}
        </ol>
        <Link href={`/organizations/${oid}/constitution`} className="t-label mt-4 inline-block underline underline-offset-4">Full constitution</Link>
      </Card>
    </div>
  );
}

function Assets({ o, c, canEnrol }: { o: Organization; c: Constitution | null; canEnrol: boolean }) {
  const assets = useChain(`assets.${o.organization_id}`, (f) => listAssets(o.organization_id, 0, 50, f));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "", name: "", description: "", location: "", operator: "", profile: "",
                               installed: "", interval: "180", inspector: "" });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <div className="flex flex-col gap-4">
      {assets.loading ? <Loading what="the registry" /> : null}
      {assets.data?.total === 0 ? <Empty>Nothing enrolled yet.</Empty> : null}
      {assets.data?.assets.length ? (
        <ul className="border-t border-lichen">
          {assets.data.assets.map((a) => (
            <li key={a.asset_id} className="grid items-center gap-3 border-b border-lichen py-4 md:grid-cols-[2fr_1fr_1fr_1.3fr_auto]">
              <div><p className="t-sub">{a.name}</p><p className="t-small text-graphite">{infraType(a.asset_type)}</p></div>
              <div><Status>{assetStatus(a.status)}</Status></div>
              <span className="t-small text-graphite">{a.service_log.length} service record{a.service_log.length === 1 ? "" : "s"}</span>
              <span className="t-small text-graphite">{a.next_service_due ? `Next due ${moment(a.next_service_due)}` : "No schedule"}</span>
              <Arrow href={`/assets/${a.asset_id}`} label={`Open ${a.name}`} />
            </li>
          ))}
        </ul>
      ) : null}
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <Tag>Motions</Tag>
        {m && m.state === "PENDING" ? (
          <div className="mt-5">
            <p className="t-heading">{motionKind(m.kind)} pending{m.kind === "AMENDMENT" ? `: version ${m.version}` : ""}.</p>
            {m.reason ? <p className="t-body mt-3">&ldquo;{m.reason}&rdquo;</p> : null}
            <p className="t-small mt-3 text-graphite">
              Window closes {relative(m.window_ends, now)}.<Info>Any steward may withdraw it until {moment(m.window_ends)}. After that, anyone may enact it.</Info>
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
          <p className="t-body mt-5 text-graphite">No motion pending.<Info>Amendments and dissolution pass only by a motion that waits {duration(c.governance.motion_window_seconds)} for any steward&apos;s objection.</Info></p>
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
          {o.state === "ACTIVE" ? "Taking new work."
            : o.state === "PAUSED" ? "Paused. Work in flight continues."
            : o.state === "DISSOLVING" ? "Dissolving. The treasury goes to the beneficiary once open work ends."
            : `Dissolved ${moment(o.dissolved_at)}. ${gen(o.returned_wei)} was refunded to the beneficiary.`}
        </p>
        <div className="mt-6 grid gap-5">
          {acts.acceptSteward ? (
            <Act label="Accept the steward role" method="accept_steward_role" args={[o.organization_id]} onAnswer={onChange} />
          ) : null}
          {acts.dissolveAbandoned ? (
            <div className="flex flex-col gap-2">
              <p className="t-small text-graphite">No steward has acted since {moment(o.last_steward_act)}.
                <Info>After {o.abandoned_after_days} days without a steward acting, anyone may start the dissolution, so the treasury reaches the beneficiary instead of being stranded.</Info></p>
              <Act label="Dissolve as abandoned" method="dissolve_abandoned" variant="secondary" args={[o.organization_id]} onAnswer={onChange} />
            </div>
          ) : null}
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
  const [all, setAll] = useState(false);
  const list = events.data?.events ?? [];
  return (
    <div>
      {events.loading ? <Loading what="the record" /> : null}
      <ol className="border-t border-lichen">
        {(all ? list : list.slice(0, 8)).map((e) => (
          <li key={e.n} className="grid gap-1 border-b border-lichen py-3 md:grid-cols-[1fr_240px]">
            <span className="t-body">{eventKind(e.kind)}</span>
            <span className="t-small text-graphite md:text-right">{moment(e.at)}</span>
          </li>
        ))}
      </ol>
      {list.length > 8 && !all ? <div className="mt-5"><Button variant="secondary" onClick={() => setAll(true)}>Show all {list.length}</Button></div> : null}
    </div>
  );
}
