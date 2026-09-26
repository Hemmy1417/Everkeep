"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import {
  Arrow, Band, Button, Card, Counter, Empty, Fact, Field, Hairline, Loading, ReadFailure, Status, Tag,
} from "@/components/bits";
import { ConstitutionForm, constitutionJson, draftFrom, type ConstitutionDraft } from "@/components/ConstitutionForm";
import { blankTerms, TermsForm, termsJson, type TermsDraft } from "@/components/TermsForm";
import { isSteward, orgActs } from "@/lib/acts";
import {
  amendmentState, duration, eventKind, gen, infraType, maintenanceType, moment, orderState, orgState,
  parseGen, plural, relative,
} from "@/lib/present";
import {
  getConfig, getConstitution, getEvents, getOrganization, invalidateReads, listAssets, listWorkOrders,
} from "@/lib/read";
import type { Constitution, Organization } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

export default function OrganizationPage() {
  const { oid } = useParams<{ oid: string }>();
  const w = useWallet();
  const clock = useNow();
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const version = org.data?.constitution_version;
  const constitution = useChain(version ? `c.${oid}.${version}` : null, (f) => getConstitution(oid, version!, f));

  if (org.loading) return <Band dark><Loading what="the organisation" dark /></Band>;
  if (org.error) return <Band><ReadFailure what="the organisation" detail={String((org.error as Error).message)} /></Band>;
  if (!org.data) return <Band><Empty>There is no such organisation on this deployment.</Empty></Band>;
  const o = org.data;
  const c = constitution.data;
  const now = Math.max(Date.parse(o.now) || 0, clock);
  const acts = c ? orgActs(o, c, w.address, now) : null;
  const steward = isSteward(o.stewards, w.address);
  const reload = () => { invalidateReads(); org.reload(); constitution.reload(); };

  return (
    <>
      <section className="band-dark">
        <div className="page pb-16 pt-14 md:pb-24 md:pt-20">
          <div className="flex flex-wrap gap-5">
            <Tag dark>{orgState(o.state)}</Tag>
            <Tag dark>Constitution {o.constitution_version}</Tag>
            {steward ? <Tag dark>You are a steward</Tag> : null}
          </div>
          <h1 className="t-display mt-6 max-w-[18ch]">{o.name}</h1>
          <p className="t-body-lg mt-8 max-w-[62ch] text-haze">{o.mission}</p>
          <dl className="mt-14 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-4">
            <Fact dark label="Held">{gen(o.escrow_wei)}</Fact>
            <Fact dark label="Committed to open orders">{gen(o.committed_wei)}</Fact>
            <Fact dark label="Uncommitted">{gen(o.available_wei)}</Fact>
            <Fact dark label="Paid out">{gen(o.paid_wei)}</Fact>
          </dl>
          {o.state === "PAUSED" ? (
            <p className="t-small mt-8 text-lichen">
              Paused {relative(o.paused_at, now)}. No new assets, work orders or amendments;
              everything already in flight continues.
            </p>
          ) : null}
        </div>
      </section>

      <Band>
        <Counter n={1} of={4} />
        <h2 className="t-heading-lg mt-8">The constitution in force.</h2>
        {!c ? <div className="mt-8"><Loading what="the constitution" /></div> : (
          <ConstitutionView c={c} viewer={w.address} />
        )}
        {c && acts ? <Amendments o={o} c={c} acts={acts} onChange={reload} /> : null}
      </Band>

      <Band className="border-t border-lichen">
        <Counter n={2} of={4} />
        <h2 className="t-heading-lg mt-8">Treasury.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card><Fund oid={o.organization_id} onDone={reload} /></Card>
          {acts && (acts.pause || acts.resume) ? (
            <Card tone="tissue"><PauseResume o={o} pause={acts.pause} onDone={reload} /></Card>
          ) : (
            <Card tone="tissue">
              <p className="t-sub">Nothing leaves except a payment.</p>
              <p className="t-small mt-3 text-graphite">
                There is no withdrawal and no owner. A work order commits its payment when it is
                created; only a finalized acceptance pays it out, and a closed or withdrawn order
                returns it.
              </p>
            </Card>
          )}
        </div>
      </Band>

      {c ? <Assets o={o} c={c} canRegister={!!acts?.registerAsset} /> : null}
      {c ? <Orders o={o} c={c} canCreate={!!acts?.createWorkOrder} /> : null}
      <Record oid={o.organization_id} />
    </>
  );
}

function ConstitutionView({ c, viewer }: { c: Constitution; viewer: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <Tag>Enforced in code</Tag>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <Fact label="Supports">{c.supported_infrastructure_types.map(infraType).join(", ")}</Fact>
          <Fact label="Pays for">{c.approved_maintenance_types.map(maintenanceType).join(", ")}</Fact>
          <Fact label="Largest payment">{gen(c.funding_rules.max_payment_wei)}</Fact>
          <Fact label="Open orders at once">{c.funding_rules.max_open_work_orders}</Fact>
          <Fact label="Evidence before a panel">
            {plural(c.evidence_rules.min_images, "photograph")}
            {c.evidence_rules.inspection_report_required ? ", and the inspector's report" : ""}
          </Fact>
          <Fact label="Windows">
            Appeal {duration(c.windows.appeal_window_seconds)}, amendment {duration(c.windows.amendment_window_seconds)}
          </Fact>
          <Fact label="Stewards">
            {plural(c.stewards.length, "steward")}
            {isSteward(c.stewards, viewer) ? ", you among them" : ""}
          </Fact>
          <Fact label="In force since">{moment(c.effective_at)}</Fact>
        </dl>
        <Hairline className="mt-8" />
        <button type="button" onClick={() => setShow((v) => !v)} className="t-label mt-4 text-graphite underline underline-offset-4">
          {show ? "Hide the stewards' wallets" : "Show the stewards' wallets"}
        </button>
        {show ? (
          <ul className="mt-3 flex flex-col gap-1">
            {c.stewards.map((s) => <li key={s} className="t-mono break-all text-graphite">{s}</li>)}
          </ul>
        ) : null}
      </Card>
      <Card tone="tissue">
        <Tag>Judged by a panel</Tag>
        <ol className="mt-6 flex flex-col">
          {c.principles.map((p, i) => (
            <li key={p.id} className="grid grid-cols-[auto_1fr] gap-5 border-t border-lichen py-5 first:border-t-0">
              <span className="t-label pt-1.5 text-graphite">{String(i + 1).padStart(2, "0")}</span>
              <span className="t-body-lg">{p.text}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Amendments({ o, c, acts, onChange }:
    { o: Organization; c: Constitution; acts: NonNullable<ReturnType<typeof orgActs>>; onChange: () => void }) {
  const config = useChain("config", () => getConfig());
  const a = o.amendment;
  const pending = useChain(a && a.state === "PROPOSED" ? `c.${o.organization_id}.${a.version}` : null,
                           (f) => getConstitution(o.organization_id, a!.version, f));
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<ConstitutionDraft>(() => draftFrom(c, ""));
  const [objection, setObjection] = useState("");
  const now = useNow();

  return (
    <div className="mt-6 flex flex-col gap-6">
      {a ? (
        <Card tone={a.state === "PROPOSED" ? "paper" : "tissue"}>
          <div className="flex flex-wrap items-center gap-4">
            <Status>{amendmentState(a.state)}</Status>
            <span className="t-label text-graphite">Version {a.version}</span>
          </div>
          {a.state === "PROPOSED" ? (
            <>
              <p className="t-heading mt-5">An amendment is waiting out its window.</p>
              <p className="t-body mt-3 text-graphite">
                The window closes {moment(a.window_ends)}, {relative(a.window_ends, now)}. Any
                steward can withdraw it until then; after that anyone can bring it into force.
                Work orders already created keep the constitution they were created under.
              </p>
              {pending.data ? (
                <details className="mt-6">
                  <summary className="t-label cursor-pointer text-graphite">Read the proposed principles</summary>
                  <ol className="mt-4 flex flex-col gap-3">
                    {pending.data.principles.map((p, i) => (
                      <li key={p.id} className="t-body"><span className="t-label mr-3 text-graphite">{String(i + 1).padStart(2, "0")}</span>{p.text}</li>
                    ))}
                  </ol>
                  <p className="t-small mt-4 text-graphite">
                    Largest payment {gen(pending.data.funding_rules.max_payment_wei)}, {plural(pending.data.stewards.length, "steward")},
                    pays for {pending.data.approved_maintenance_types.map(maintenanceType).join(", ").toLowerCase()}.
                  </p>
                </details>
              ) : null}
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {acts.objectAmendment ? (
                  <Act label="Withdraw it" method="object_amendment" variant="secondary"
                       prepare={() => (objection.trim() ? [o.organization_id, objection.trim()] : "Say why you object.")}
                       onAnswer={onChange}>
                    <Field label="Your objection"><textarea value={objection} onChange={(e) => setObjection(e.target.value)} maxLength={2000} /></Field>
                  </Act>
                ) : null}
                {acts.ratifyAmendment ? (
                  <Act label="Bring it into force" method="ratify_amendment" args={[o.organization_id]} onAnswer={onChange} />
                ) : null}
              </div>
            </>
          ) : a.state === "WITHDRAWN" ? (
            <p className="t-body mt-4 text-graphite">
              Version {a.version} was withdrawn by a steward&apos;s objection {moment(a.decided_at)}: &ldquo;{a.objection}&rdquo;
            </p>
          ) : (
            <p className="t-body mt-4 text-graphite">Version {a.version} came into force {moment(a.decided_at)}.</p>
          )}
        </Card>
      ) : null}
      {acts.proposeAmendment && config.data ? (
        drafting ? (
          <Card>
            <p className="t-sub mb-8">A new constitution, starting from the one in force.</p>
            <ConstitutionForm config={config.data} draft={draft} onChange={setDraft} />
            <div className="mt-10 flex flex-wrap gap-3">
              <Act label="Propose this amendment" method="propose_amendment"
                   prepare={() => {
                     const json = constitutionJson(draft);
                     return json.startsWith("{") ? [o.organization_id, json] : json;
                   }}
                   onAnswer={() => { setDrafting(false); onChange(); }} />
              <Button variant="secondary" onClick={() => setDrafting(false)}>Put it away</Button>
            </div>
          </Card>
        ) : (
          <div><Button variant="secondary" onClick={() => setDrafting(true)}>Propose an amendment</Button></div>
        )
      ) : null}
    </div>
  );
}

function Fund({ oid, onDone }: { oid: string; onDone: () => void }) {
  const [amount, setAmount] = useState("1");
  const value = parseGen(amount) ?? 0n;
  return (
    <Act label="Fund the treasury" method="fund_treasury" args={[oid]} value={value}
         prepare={() => (value > 0n ? [oid] : "Send some GEN.")} onAnswer={onDone}>
      <p className="t-sub">Anyone may add to it.</p>
      <Field label="Amount, GEN"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
    </Act>
  );
}

function PauseResume({ o, pause, onDone }: { o: Organization; pause: boolean; onDone: () => void }) {
  const [reason, setReason] = useState("");
  return pause ? (
    <Act label="Pause new commitments" method="pause_organization" variant="secondary"
         prepare={() => [o.organization_id, reason.trim()]} onAnswer={onDone}>
      <p className="t-sub">Stop new work while you look.</p>
      <p className="t-small text-graphite">Signed orders continue: a pause cannot starve a provider who has done the work.</p>
      <Field label="Reason, optional"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
    </Act>
  ) : (
    <Act label="Resume" method="resume_organization" args={[o.organization_id]} onAnswer={onDone}>
      <p className="t-sub">Paused.</p>
    </Act>
  );
}

function Assets({ o, c, canRegister }: { o: Organization; c: Constitution; canRegister: boolean }) {
  const w = useWallet();
  const assets = useChain(`assets.${o.organization_id}`, (f) => listAssets(o.organization_id, 0, 50, f));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: c.supported_infrastructure_types[0] ?? "", name: "", location: "", profile: "", inspector: "" });
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p });

  return (
    <Band className="border-t border-lichen">
      <Counter n={3} of={4} />
      <h2 className="t-heading-lg mt-8">Assets.</h2>
      <div className="mt-10 flex flex-col gap-4">
        {assets.loading ? <Loading what="the assets" /> : null}
        {assets.data?.total === 0 ? <Empty>No infrastructure registered yet.</Empty> : null}
        {assets.data?.assets.map((a) => (
          <Card key={a.asset_id} className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap gap-4">
                <Tag>{infraType(a.infrastructure_type)}</Tag>
                <Tag>{a.status === "UNDER_MAINTENANCE" ? "Under maintenance" : "Monitoring"}</Tag>
              </div>
              <p className="t-heading mt-3">{a.name}</p>
              {a.location ? <p className="t-body mt-2 text-graphite">{a.location}</p> : null}
              {a.technical_profile ? <p className="t-small mt-2 max-w-[70ch] text-graphite">{a.technical_profile}</p> : null}
              <p className="t-label mt-4 text-graphite">
                {a.inspector
                  ? a.inspector_accepted_at ? "Independent inspector appointed" : "Inspector named, not yet accepted"
                  : "No independent inspector"} · {plural(a.work_orders.length, "work order")}
              </p>
            </div>
            {a.inspector && !a.inspector_accepted_at && w.address.toLowerCase() === a.inspector.toLowerCase() ? (
              <Act label="Accept the inspector role" method="accept_inspector_role" args={[a.asset_id]}
                   onAnswer={() => { invalidateReads(); assets.reload(); }} />
            ) : null}
          </Card>
        ))}
        {canRegister ? (open ? (
          <Card tone="tissue">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Kind">
                <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                  {c.supported_infrastructure_types.map((t) => <option key={t} value={t}>{infraType(t)}</option>)}
                </select>
              </Field>
              <Field label="Name"><input value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="Where"><input value={form.location} maxLength={200} onChange={(e) => set({ location: e.target.value })} /></Field>
              <Field label="Independent inspector's wallet, optional" hint="Not a steward. They must accept before their report counts.">
                <input className="font-mono" value={form.inspector} placeholder="0x…" onChange={(e) => set({ inspector: e.target.value })} />
              </Field>
            </div>
            <div className="mt-6"><Field label="Technical profile"><textarea value={form.profile} maxLength={2000} onChange={(e) => set({ profile: e.target.value })} /></Field></div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Act label="Register the asset" method="register_asset"
                   prepare={() => form.name.trim() ? [o.organization_id, JSON.stringify({
                     infrastructure_type: form.type, name: form.name.trim(), location: form.location.trim(),
                     technical_profile: form.profile.trim(), inspector: form.inspector.trim() })] : "Name the asset."}
                   onAnswer={() => { setOpen(false); invalidateReads(); assets.reload(); }} />
              <Button variant="secondary" onClick={() => setOpen(false)}>Put it away</Button>
            </div>
          </Card>
        ) : <div><Button variant="secondary" onClick={() => setOpen(true)}>Register an asset</Button></div>) : null}
      </div>
    </Band>
  );
}

function Orders({ o, c, canCreate }: { o: Organization; c: Constitution; canCreate: boolean }) {
  const config = useChain("config", () => getConfig());
  const orders = useChain(`orders.${o.organization_id}`, (f) => listWorkOrders(o.organization_id, 0, 50, f));
  const assets = useChain(`assets.${o.organization_id}`, (f) => listAssets(o.organization_id, 0, 50, f));
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState("");
  const [provider, setProvider] = useState("");
  const [draft, setDraft] = useState<TermsDraft>(() => blankTerms(c));
  const firstAsset = assets.data?.assets[0]?.asset_id ?? "";

  return (
    <Band className="border-t border-lichen">
      <Counter n={4} of={4} />
      <h2 className="t-heading-lg mt-8">Work orders.</h2>
      <div className="mt-10 flex flex-col">
        {orders.loading ? <Loading what="the work orders" /> : null}
        {orders.data?.total === 0 ? <Empty>No work commissioned yet.</Empty> : null}
        {orders.data?.work_orders.map((x) => (
          <div key={x.work_order_id} className="grid grid-cols-[1fr_auto] items-center gap-6 border-t border-lichen py-6">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-4">
                <Status>{orderState(x.state)}</Status>
                <span className="t-label self-center text-graphite">{maintenanceType(x.maintenance_type)} · {gen(x.payment_wei)}</span>
              </div>
              <p className="t-sub mt-3">{x.title}</p>
            </div>
            <Arrow href={`/work-orders/${x.work_order_id}`} label={`Open ${x.title}`} />
          </div>
        ))}
      </div>
      {canCreate && config.data ? (open ? (
        <Card tone="tissue" className="mt-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Asset">
              <select value={asset || firstAsset} onChange={(e) => setAsset(e.target.value)}>
                {assets.data?.assets.map((a) => <option key={a.asset_id} value={a.asset_id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Provider's wallet" hint="Not a steward and not the asset's inspector. They sign before anything is filed.">
              <input className="font-mono" value={provider} placeholder="0x…" onChange={(e) => setProvider(e.target.value)} />
            </Field>
          </div>
          <div className="mt-8"><TermsForm config={config.data} constitution={c} draft={draft} onChange={setDraft} /></div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Act label="Commission the work" method="create_work_order"
                 prepare={() => {
                   const a = asset || firstAsset;
                   if (!a) return "Register an asset first.";
                   if (!/^0x[0-9a-fA-F]{40}$/.test(provider.trim())) return "The provider must be a wallet address.";
                   const json = termsJson(draft, c);
                   return json.startsWith("{") ? [a, provider.trim(), json] : json;
                 }}
                 onAnswer={() => { setOpen(false); invalidateReads(); orders.reload(); }} />
            <Button variant="secondary" onClick={() => setOpen(false)}>Put it away</Button>
          </div>
        </Card>
      ) : (
        <div className="mt-8">
          <Button variant="secondary" disabled={!firstAsset} onClick={() => setOpen(true)}>Commission work</Button>
          {!firstAsset ? <p className="t-small mt-2 text-graphite">Register an asset first.</p> : null}
        </div>
      )) : null}
    </Band>
  );
}

function Record({ oid }: { oid: string }) {
  const events = useChain(`events.${oid}`, (f) => getEvents(oid, 0, 30, f));
  return (
    <Band dark>
      <Tag dark>The record</Tag>
      <h2 className="t-heading mt-6">Everything that happened here, newest first.</h2>
      <ol className="mt-10">
        {events.loading ? <Loading what="the record" dark /> : null}
        {events.data?.events.map((e) => (
          <li key={e.n} className="grid gap-2 border-t border-graphite py-4 md:grid-cols-[220px_1fr]">
            <span className="t-label text-haze">{moment(e.at)}</span>
            <span className="t-body">{eventKind(e.kind)}</span>
          </li>
        ))}
      </ol>
    </Band>
  );
}
