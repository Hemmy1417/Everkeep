"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Button, Card, Empty, Field, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { Info, Stat, Tabs } from "@/components/tabs";
import { EvidenceFile, FilePanel, RequiredEvidence } from "@/components/evidence";
import { OrderProgress } from "@/components/lifecycle";
import { currentTerms, orderActs, seatOn, situation } from "@/lib/acts";
import { gen, lifecycle, maintenanceType, day, moment, orderState, outcome, parseGen, relative, role } from "@/lib/present";
import {
  getAsset, getConfig, getConstitution, getDecision, getOrganization, getWorkOrder, invalidateReads,
} from "@/lib/read";
import type { Terms, WorkOrder } from "@/lib/types";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

export default function WorkOrderPage() {
  const { wid } = useParams<{ wid: string }>();
  const w = useWallet();
  const clock = useNow();
  const order = useChain(`order.${wid}`, (f) => getWorkOrder(wid, f));
  const o = order.data;
  const org = useChain(o ? `org.${o.organization_id}` : null, (f) => getOrganization(o!.organization_id, f));
  const asset = useChain(o ? `asset.${o.asset_id}` : null, (f) => getAsset(o!.asset_id, f));
  const bound = useChain(o ? `c.${o.organization_id}.${o.constitution_version}` : null,
                         (f) => getConstitution(o!.organization_id, o!.constitution_version, f));
  const did = o?.current_decision_id ?? null;
  const decision = useChain(did ? `decision.${did}` : null, (f) => getDecision(did!, f));
  const config = useChain("config", () => getConfig());

  if (order.loading) return <Band dark><Loading what="the work order" dark /></Band>;
  if (order.error) return <Band><ReadFailure what="the work order" detail={String((order.error as Error).message)} /></Band>;
  if (!o) return <Band><Empty>There is no such work order on this deployment.</Empty></Band>;

  const now = Math.max(Date.parse(o.now) || 0, clock);
  const t = currentTerms(o);
  const d = decision.data ?? null;
  const seat = org.data && asset.data ? seatOn(o, asset.data, org.data.stewards, w.address) : "";
  const acts = org.data ? orderActs(o, org.data, d, seat, w.address, now) : null;
  const items = o.evidence[String(o.current_version || 1)] ?? [];
  const reload = () => { invalidateReads(); order.reload(); org.reload(); asset.reload(); decision.reload(); };

  return (
    <>
      <section className="band-dark">
        <div className="page pb-10 pt-12">
          <div className="flex flex-wrap items-center gap-4">
            <Status dark>{orderState(o.state)}</Status>
            {o.emergency ? <Tag dark>Emergency repair</Tag> : null}
            {asset.data ? <Link href={`/assets/${o.asset_id}`} className="t-label text-haze underline underline-offset-4">{asset.data.name}</Link> : null}
            {seat ? <Tag dark>You are the {role(seat).toLowerCase()}{seat === "STEWARD" ? " who appealed" : ""}</Tag> : null}
          </div>
          <h1 className="t-heading-lg mt-5 max-w-[26ch]">{t.title}</h1>
          <p className="t-body mt-3 max-w-[62ch] text-haze">{situation(o, d, now)}</p>
          <dl className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat dark label="Payment" value={gen(t.payment_wei)} info={`Budget ${gen(t.budget_wei)}. Paid only after a finalized acceptance.`} />
            <Stat dark label="Deadline" value={day(t.deadline) || "None"} info={moment(t.deadline)} />
            <Stat dark label="Work" value={<span className="text-[1.25rem] md:text-[1.5rem]">{maintenanceType(t.maintenance_type)}</span>} />
            <Stat dark label="Terms" value={`v${o.current_version || o.pending_version}`} info={`Version ${o.current_version || o.pending_version} of the terms, under constitution ${o.constitution_version}. A later amendment never reaches this order.`} />
          </dl>
          <div className="mt-10"><OrderProgress w={o} d={d} now={now} dark /></div>
        </div>
      </section>

      <section className="band-light py-12">
        <div className="page grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <Tabs items={[
              { id: "requirements", label: "Requirements", content: (
                <div className="flex flex-col gap-8">
                  <div>
                    <p className="t-body-lg">{t.requirements}</p>
                    {t.specification ? <p className="t-small mt-3 text-graphite">Specification: {t.specification}</p> : null}
                  </div>
                  <List title="Acceptance criteria" rows={t.acceptance_criteria.map((x, i) => [`${i + 1}`, x.text])} />
                  {bound.data ? (
                    <List title="Principles that apply"
                          info={`Only the principles in scope for ${maintenanceType(t.maintenance_type).toLowerCase()} go to validators.`}
                          rows={bound.data.maintenance_principles.filter((p) => !p.applies_to.length || p.applies_to.includes(t.maintenance_type)).map((p) => [p.id.replace(/^\D+/, ""), p.text])} />
                  ) : <Loading what="the constitution" />}
                </div>
              ) },
              { id: "evidence", label: "Evidence", count: items.length, content: (
                <div className="flex flex-col gap-8">
                  {acts?.file ? (
                    <Card tone="tissue" className="!p-6">
                      <p className="t-sub mb-5">File evidence as the {role(seat).toLowerCase()}{o.state === "UNDER_APPEAL" ? ", for the appeal" : ""}.</p>
                      <FilePanel wid={o.work_order_id} seat={seat as never} views={config.data?.image_views ?? []} docs={config.data?.document_types ?? []} onFiled={reload} />
                    </Card>
                  ) : null}
                  <div>
                    <p className="t-label text-graphite">Required before assessment
                      <Info>Checked in code before validators are asked. Declarations and links are kept but never judged. A capture time or place is the submitter&apos;s claim.</Info>
                    </p>
                    <div className="mt-3">{bound.data ? <RequiredEvidence c={bound.data} t={t} items={items} /> : null}</div>
                  </div>
                  <EvidenceFile items={items} />
                </div>
              ) },
              { id: "decisions", label: "Decisions", count: o.decisions.length, content: <Decisions o={o} /> },
            ]} />
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {acts ? <Actions o={o} t={t} acts={acts} seat={seat} now={now}
                             decisionOutcome={d?.outcome} windowEnds={d?.appeal_window_ends} onChange={reload} /> : <Loading what="what you can do" />}
          </aside>
        </div>
      </section>
    </>
  );
}


function List({ title, rows, info }: { title: string; rows: [string, string][]; info?: string }) {
  return (
    <div>
      <p className="t-label text-graphite">{title}{info ? <Info>{info}</Info> : null}</p>
      <ol className="mt-3 border-t border-lichen">
        {rows.map(([k, v]) => (
          <li key={k} className="grid grid-cols-[48px_1fr] gap-3 border-b border-lichen py-3">
            <span className="t-label pt-0.5 text-graphite">{k}</span><span className="t-body">{v}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Actions({ o, t, acts, seat, now, decisionOutcome, windowEnds, onChange }: {
  o: WorkOrder; t: Terms; acts: ReturnType<typeof orderActs>; seat: string; now: number;
  decisionOutcome?: string; windowEnds?: string; onChange: () => void;
}) {
  const w = useWallet();
  const [reason, setReason] = useState("");
  const [revise, setRevise] = useState(false);
  const [rv, setRv] = useState({ payment: "", deadline: "", requirements: t.requirements });
  const pending = o.pending_version ? o.versions[o.pending_version - 1] : null;
  const any = Object.entries(acts).some(([k, v]) => k !== "fileClosed" && v === true);

  const shell = (body: React.ReactNode) => (
    <div className="rounded-[20px] border border-lichen bg-paper p-6">
      <p className="t-label text-graphite">Actions</p>
      <div className="mt-5 flex flex-col gap-6">{body}</div>
    </div>
  );
  if (!w.address) return shell(<p className="t-body text-graphite">Connect a wallet to act.<Info>Anyone may finalize, settle or close work once its time comes.</Info></p>);
  if (!any) {
    return shell(
      <>
        <p className="t-body text-graphite">Nothing for this wallet right now.</p>
        {windowEnds && o.state === "DECIDED" ? <p className="t-small text-graphite">Appeal window closes {relative(windowEnds, now)}.</p> : null}
        {o.appeal ? <p className="t-small text-graphite">Appeal evidence closes {relative(o.appeal.evidence_ends, now)}.</p> : null}
        {acts.fileClosed && seat ? <p className="t-small text-graphite">{acts.fileClosed}</p> : null}
      </>
    );
  }
  const card = "flex flex-col gap-3 border-t border-lichen pt-5 first:border-t-0 first:pt-0";
  return shell(
      <>
        {acts.accept && pending ? (
          <div className={card}>
            <p className="t-sub">Accept the terms.</p>
            <p className="t-small text-graphite">{gen(pending.payment_wei)} by {moment(pending.deadline)}.</p>
            <Act label={`Accept version ${pending.version}`} method="accept_work_order" args={[o.work_order_id, pending.version]} onAnswer={onChange} />
          </div>
        ) : null}
        {acts.assess ? (
          <div className={card}>
            <p className="t-sub">Ask for the assessment.</p>
            <p className="t-small text-graphite">One assessment; after it, only an appeal.<Info>Code checks the evidence rules first. Then validators examine the photographs and documents and must agree on the outcome and its grounds.</Info></p>
            <Act label="Request assessment" method="request_assessment" args={[o.work_order_id]}
                 working="Validators are examining the evidence. This takes a few minutes." onAnswer={onChange} />
          </div>
        ) : null}
        {acts.file ? (
          <div className={card}>
            <p className="t-sub">File evidence.</p>
            <a href="#evidence" className="t-label underline underline-offset-4">Open the evidence tab</a>
          </div>
        ) : null}
        {acts.appeal ? (
          <div className={card}>
            <p className="t-sub">Appeal the {(decisionOutcome ? outcome(decisionOutcome) : "").toLowerCase()} decision.</p>
            <p className="t-small text-graphite">Closes {relative(windowEnds, now)}.<Info>An appeal opens an evidence period, then validators decide again. The new decision is linked to this one, which is kept.</Info></p>
            <Act label="Open the appeal" method="open_appeal" prepare={() => (reason.trim() ? [o.work_order_id, reason.trim()] : "State the grounds.")} onAnswer={onChange}>
              <Field label="Grounds"><textarea value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} /></Field>
            </Act>
          </div>
        ) : null}
        {acts.readjudicate ? (
          <div className={card}>
            <p className="t-sub">Ask for the readjudication.</p>
            
            <Act label="Readjudicate" method="readjudicate" args={[o.work_order_id]} working="The validators are examining the evidence." onAnswer={onChange} />
          </div>
        ) : null}
        {acts.finalize ? (
          <div className={card}>
            <p className="t-sub">Finalize the decision.</p>
            <p className="t-small text-graphite">Ends the appeal window.<Info>An acceptance makes {gen(o.committed_wei)} releasable. Any other outcome closes the order unpaid and returns the commitment.</Info></p>
            <Act label="Finalize" method="finalize" args={[o.work_order_id]} onAnswer={onChange} />
          </div>
        ) : null}
        {acts.settle ? (
          <div className={card}>
            <p className="t-sub">Settle the payment.</p>
            <p className="t-small text-graphite">Pays {gen(o.committed_wei)} to the provider.</p>
            <Act label="Settle" method="settle" args={[o.work_order_id]} onAnswer={onChange} />
          </div>
        ) : null}
        {acts.close ? (
          <div className={card}>
            <p className="t-sub">Close it.</p>
            <p className="t-small text-graphite">
              {o.state === "UNDER_APPEAL" ? "The validators did not decide the appeal in time. The appealed decision stands and becomes final."
                : "The deadline passed without a decision. Closing returns the commitment to the treasury."}
            </p>
            <Act label="Close" variant="secondary" method="close_work_order" args={[o.work_order_id]} onAnswer={onChange} />
          </div>
        ) : null}
        {acts.cancel ? (
          <div className={card}>
            <p className="t-sub">Cancel it.</p>
            
            <Act label="Cancel" variant="secondary" method="cancel_work_order" args={[o.work_order_id, "Withdrawn before acceptance"]} onAnswer={onChange} />
          </div>
        ) : null}
        {acts.proposeTerms ? (
          <div className={card}>
            {revise ? (
              <div className="flex flex-col gap-4">
                <p className="t-sub">Revise the terms.</p>
                <div className="grid gap-4">
                  <Field label="Payment, GEN"><input inputMode="decimal" placeholder={gen(t.payment_wei, false)} value={rv.payment} onChange={(e) => setRv({ ...rv, payment: e.target.value })} /></Field>
                  <Field label="Deadline, UTC"><input type="datetime-local" value={rv.deadline} onChange={(e) => setRv({ ...rv, deadline: e.target.value })} /></Field>
                </div>
                <Field label="What has to be done"><textarea value={rv.requirements} onChange={(e) => setRv({ ...rv, requirements: e.target.value })} /></Field>
                <div className="flex flex-wrap gap-3">
                  <Act label="Propose the revision" method="propose_version" onAnswer={() => { setRevise(false); onChange(); }}
                       prepare={() => {
                         const pay = rv.payment.trim() ? parseGen(rv.payment) : BigInt(t.payment_wei);
                         if (pay === null) return "The payment must be in GEN.";
                         const budget = pay > BigInt(t.budget_wei) ? pay : BigInt(t.budget_wei);
                         return [o.work_order_id, JSON.stringify({
                           maintenance_type: t.maintenance_type, title: t.title, description: t.description, requirements: rv.requirements.trim(),
                           specification: t.specification, acceptance_criteria: t.acceptance_criteria.map((x) => ({ text: x.text })),
                           required_evidence: t.required_evidence, payment_wei: pay.toString(), budget_wei: budget.toString(),
                           deadline: rv.deadline ? `${rv.deadline}:00Z` : t.deadline })];
                       }} />
                  <Button variant="secondary" onClick={() => setRevise(false)}>Put it away</Button>
                </div>
              </div>
            ) : (
              <>
                <p className="t-sub">Revise the terms.</p>
                <p className="t-small mt-2 text-graphite">The current terms stay until the provider accepts.</p>
                <div className="mt-4"><Button variant="secondary" onClick={() => setRevise(true)}>Draft a revision</Button></div>
              </>
            )}
          </div>
        ) : null}
        {seat && acts.fileClosed && !acts.file ? <p className="t-small text-graphite">{acts.fileClosed}</p> : null}
      </>
  );
}

function Decisions({ o }: { o: WorkOrder }) {
  return (
    <div>
      {o.decisions.length === 0 ? <p className="t-body text-graphite">No assessment yet.</p> : null}
      {[...o.decisions].reverse().map((did) => <DecisionRow key={did} did={did} />)}
      {o.settlement ? <p className="t-body mt-6 text-graphite">Settled {moment(o.settlement.at)}: {gen(o.settlement.wei)} paid to the provider.</p> : null}
      {o.close_reason ? <p className="t-body mt-6 text-graphite">Closed {moment(o.closed_at)}: {o.close_reason}.</p> : null}
    </div>
  );
}

function DecisionRow({ did }: { did: string }) {
  const d = useChain(`decision.${did}`, (f) => getDecision(did, f));
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-lichen py-5 first:border-t">
      {d.data ? (
        <div>
          <p className="t-label text-graphite">{d.data.kind === "READJUDICATION" ? "Readjudication on appeal" : "Assessment"} · {moment(d.data.decided_at)} · {lifecycle(d.data.lifecycle).toLowerCase()}</p>
          <p className="t-sub mt-1">{outcome(d.data.outcome)}</p>
        </div>
      ) : <Loading what="the decision" />}
      <Arrow href={`/decisions/${did}`} label="Open the decision receipt" />
    </div>
  );
}
