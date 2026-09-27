"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Button, Card, Counter, Empty, Fact, Field, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { EvidenceFile, FilePanel, RequiredEvidence } from "@/components/evidence";
import { OrderProgress } from "@/components/lifecycle";
import { currentTerms, orderActs, seatOn, situation } from "@/lib/acts";
import { gen, lifecycle, maintenanceType, moment, orderState, outcome, parseGen, relative, role } from "@/lib/present";
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
        <div className="page pb-14 pt-12 md:pb-20">
          <div className="flex flex-wrap items-center gap-5">
            <Status dark>{orderState(o.state)}</Status>
            {o.emergency ? <Tag dark>Emergency repair</Tag> : null}
            {asset.data ? <Link href={`/assets/${o.asset_id}`} className="t-label text-haze underline underline-offset-4">{asset.data.name}</Link> : null}
            {seat ? <Tag dark>You are the {role(seat).toLowerCase()}{seat === "STEWARD" ? " who appealed" : ""}</Tag> : null}
          </div>
          <h1 className="t-display mt-6 max-w-[22ch]">{t.title}</h1>
          <p className="t-body-lg mt-6 max-w-[62ch] text-haze">{situation(o, d, now)}</p>
          <dl className="mt-10 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-5">
            <Fact dark label="Payment">{gen(t.payment_wei)}</Fact>
            <Fact dark label="Budget">{gen(t.budget_wei)}</Fact>
            <Fact dark label="Deadline">{moment(t.deadline)}</Fact>
            <Fact dark label="Maintenance">{maintenanceType(t.maintenance_type)}</Fact>
            <Fact dark label="Rules and terms">Constitution {o.constitution_version}, version {o.current_version || o.pending_version}</Fact>
          </dl>
          <div className="mt-10"><OrderProgress w={o} d={d} now={now} dark /></div>
        </div>
      </section>

      {acts ? <Actions o={o} t={t} acts={acts} seat={seat} now={now} views={config.data?.image_views ?? []}
                       docs={config.data?.document_types ?? []} decisionOutcome={d?.outcome} windowEnds={d?.appeal_window_ends}
                       onChange={reload} /> : null}

      <Band className="border-t border-lichen">
        <Counter n={1} of={3} />
        <h2 className="t-heading-lg mt-6">What is required.</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <Tag>This work order{o.versions.length > 1 ? `, version ${t.version}` : ""}</Tag>
            <p className="t-body-lg mt-5">{t.requirements}</p>
            {t.specification ? <p className="t-small mt-3"><span className="text-graphite">Specification:</span> {t.specification}</p> : null}
            {t.description ? <p className="t-small mt-3 text-graphite">{t.description}</p> : null}
            <ol className="mt-6">
              {t.acceptance_criteria.map((x, i) => (
                <li key={x.id} className="grid grid-cols-[auto_1fr] gap-4 border-t border-lichen py-4">
                  <span className="t-label pt-1 text-graphite">Criterion {i + 1}</span><span className="t-body">{x.text}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card tone="tissue">
            <Tag>The constitution it answers to</Tag>
            {bound.data ? (
              <>
                <ol className="mt-5">
                  {bound.data.maintenance_principles.filter((p) => !p.applies_to.length || p.applies_to.includes(t.maintenance_type)).map((p) => (
                    <li key={p.id} className="grid grid-cols-[auto_1fr] gap-4 border-t border-lichen py-4 first:border-t-0">
                      <span className="t-label pt-1 text-graphite">Principle {p.id.slice(1)}</span><span className="t-body">{p.text}</span>
                    </li>
                  ))}
                </ol>
                <p className="t-small mt-4 text-graphite">
                  Only the principles that apply to {maintenanceType(t.maintenance_type).toLowerCase()} are put to validators.
                  Bound when the order was created; a later amendment never reaches it.
                </p>
              </>
            ) : <div className="mt-5"><Loading what="the constitution" /></div>}
          </Card>
        </div>
      </Band>

      <Band className="border-t border-lichen">
        <Counter n={2} of={3} />
        <h2 className="t-heading-lg mt-6">The evidence.</h2>
        <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_3fr]">
          <div>
            <Tag>Required before any assessment</Tag>
            <div className="mt-4">{bound.data ? <RequiredEvidence c={bound.data} t={t} items={items} /> : null}</div>
            <p className="t-small mt-5 text-graphite">
              Checked in code before validators are asked. Declarations and links are kept but never adjudicated, and
              metadata such as a capture time or place is the submitter&apos;s claim, never proof on its own.
            </p>
          </div>
          <EvidenceFile items={items} />
        </div>
      </Band>

      <Decisions o={o} />
    </>
  );
}

function Actions({ o, t, acts, seat, now, views, docs, decisionOutcome, windowEnds, onChange }: {
  o: WorkOrder; t: Terms; acts: ReturnType<typeof orderActs>; seat: string; now: number; views: string[]; docs: string[];
  decisionOutcome?: string; windowEnds?: string; onChange: () => void;
}) {
  const w = useWallet();
  const [reason, setReason] = useState("");
  const [revise, setRevise] = useState(false);
  const [rv, setRv] = useState({ payment: "", deadline: "", requirements: t.requirements });
  const pending = o.pending_version ? o.versions[o.pending_version - 1] : null;
  const any = Object.entries(acts).some(([k, v]) => k !== "fileClosed" && v === true);

  if (!w.address) return <Band><p className="t-body text-graphite">Connect a wallet to act. Anyone may finalize, settle or close work once its time comes.</p></Band>;
  if (!any) {
    return (
      <Band>
        <Tag>Nothing for this wallet to do now</Tag>
        {windowEnds && o.state === "DECIDED" ? <p className="t-body mt-4 text-graphite">The appeal window closes {moment(windowEnds)}, {relative(windowEnds, now)}.</p> : null}
        {o.appeal ? <p className="t-body mt-4 text-graphite">Appeal evidence closes {moment(o.appeal.evidence_ends)}, {relative(o.appeal.evidence_ends, now)}.</p> : null}
      </Band>
    );
  }
  const card = "flex flex-col gap-3";
  return (
    <Band>
      <Tag>What you can do</Tag>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {acts.accept && pending ? (
          <Card className={card}>
            <p className="t-sub">Accept the terms.</p>
            <p className="t-small text-graphite">Version {pending.version}: {gen(pending.payment_wei)} by {moment(pending.deadline)}. Accepting sets the commitment to exactly this payment.</p>
            <Act label={`Accept version ${pending.version}`} method="accept_work_order" args={[o.work_order_id, pending.version]} onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.assess ? (
          <Card className={card}>
            <p className="t-sub">Ask for the assessment.</p>
            <p className="t-small text-graphite">
              The contract first checks the evidence rules in code. Then validators each examine the photographs and read the documents,
              rate every requirement, and must agree on the outcome and its grounds. You get one assessment; after it, only an appeal.
            </p>
            <Act label="Request assessment" method="request_assessment" args={[o.work_order_id]}
                 working="Validators are examining the evidence. This takes a few minutes." onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.file ? (
          <Card className="lg:col-span-2">
            <p className="t-sub mb-5">File evidence as the {role(seat).toLowerCase()}{o.state === "UNDER_APPEAL" ? ", for the appeal" : ""}.</p>
            <FilePanel wid={o.work_order_id} seat={seat as never} views={views} docs={docs} onFiled={onChange} />
          </Card>
        ) : null}
        {acts.appeal ? (
          <Card className={card}>
            <p className="t-sub">Appeal the {(decisionOutcome ? outcome(decisionOutcome) : "").toLowerCase()} decision.</p>
            <p className="t-small text-graphite">
              Before {moment(windowEnds)}. An appeal opens an evidence period; then the validators decide again, and the new
              decision is linked to this one, which is kept.
            </p>
            <Act label="Open the appeal" method="open_appeal" prepare={() => (reason.trim() ? [o.work_order_id, reason.trim()] : "State the grounds.")} onAnswer={onChange}>
              <Field label="Grounds"><textarea value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} /></Field>
            </Act>
          </Card>
        ) : null}
        {acts.readjudicate ? (
          <Card className={card}>
            <p className="t-sub">Ask for the readjudication.</p>
            <p className="t-small text-graphite">The validators judge the whole file, including what was filed during the appeal.</p>
            <Act label="Readjudicate" method="readjudicate" args={[o.work_order_id]} working="The validators are examining the evidence." onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.finalize ? (
          <Card className={card}>
            <p className="t-sub">Finalize the decision.</p>
            <p className="t-small text-graphite">It can no longer be appealed. An acceptance makes {gen(o.committed_wei)} releasable; anything else closes the order unpaid and returns the commitment.</p>
            <Act label="Finalize" method="finalize" args={[o.work_order_id]} onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.settle ? (
          <Card className={card}>
            <p className="t-sub">Settle the payment.</p>
            <p className="t-small text-graphite">Pays {gen(o.committed_wei)} from the treasury to the provider. Anyone may send it.</p>
            <Act label="Settle" method="settle" args={[o.work_order_id]} onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.close ? (
          <Card tone="tissue" className={card}>
            <p className="t-sub">Close it.</p>
            <p className="t-small text-graphite">
              {o.state === "UNDER_APPEAL" ? "The validators did not decide the appeal in time. The appealed decision stands and becomes final."
                : "The deadline passed without a decision. Closing returns the commitment to the treasury."}
            </p>
            <Act label="Close" variant="secondary" method="close_work_order" args={[o.work_order_id]} onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.cancel ? (
          <Card tone="tissue" className={card}>
            <p className="t-sub">Cancel it.</p>
            <p className="t-small text-graphite">The provider has not accepted, so it can be withdrawn.</p>
            <Act label="Cancel" variant="secondary" method="cancel_work_order" args={[o.work_order_id, "Withdrawn before acceptance"]} onAnswer={onChange} />
          </Card>
        ) : null}
        {acts.proposeTerms ? (
          <Card tone="tissue" className="lg:col-span-2">
            {revise ? (
              <div className="flex flex-col gap-4">
                <p className="t-sub">Revise the terms.</p>
                <div className="grid gap-4 md:grid-cols-2">
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
                <p className="t-small mt-2 text-graphite">A revision is a new version, validated under constitution {o.constitution_version}. The current version stays in force until the provider accepts.</p>
                <div className="mt-4"><Button variant="secondary" onClick={() => setRevise(true)}>Draft a revision</Button></div>
              </>
            )}
          </Card>
        ) : null}
      </div>
      {seat && acts.fileClosed && !acts.file ? <p className="t-small mt-6 text-graphite">{acts.fileClosed}</p> : null}
    </Band>
  );
}

function Decisions({ o }: { o: WorkOrder }) {
  return (
    <Band dark>
      <Counter n={3} of={3} dark />
      <h2 className="t-heading-lg mt-6">Decisions.</h2>
      <div className="mt-8">
        {o.decisions.length === 0 ? <p className="t-body text-haze">No assessment has been requested yet.</p> : null}
        {[...o.decisions].reverse().map((did) => <DecisionRow key={did} did={did} />)}
        {o.settlement ? (
          <p className="t-body mt-8 border-t border-graphite pt-6 text-lichen">Settled {moment(o.settlement.at)}: {gen(o.settlement.wei)} paid to the provider.</p>
        ) : null}
        {o.close_reason ? <p className="t-body mt-8 border-t border-graphite pt-6 text-lichen">Closed {moment(o.closed_at)}: {o.close_reason}.</p> : null}
      </div>
    </Band>
  );
}

function DecisionRow({ did }: { did: string }) {
  const d = useChain(`decision.${did}`, (f) => getDecision(did, f));
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-6 border-t border-graphite py-6">
      {d.data ? (
        <div>
          <p className="t-label text-haze">{d.data.kind === "READJUDICATION" ? "Readjudication on appeal" : "Assessment"} · {moment(d.data.decided_at)} · {lifecycle(d.data.lifecycle).toLowerCase()}</p>
          <p className="t-heading mt-2">{outcome(d.data.outcome)}</p>
        </div>
      ) : <Loading what="the decision" dark />}
      <Arrow href={`/decisions/${did}`} label="Open the decision receipt" />
    </div>
  );
}
