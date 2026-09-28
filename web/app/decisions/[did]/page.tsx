"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Band, Card, Empty, Fact, Loading, Status, Tag } from "@/components/bits";
import { Info, Stat, Tabs } from "@/components/tabs";
import { addressUrl, txUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import {
  evidenceName, gen, imageView, lifecycle, maintenanceType, moment, outcomeHeadline, validatorNote,
  requirementStatus, role, ruleName, shortAddress, shortDigest, snapshotName, source, writeOut,
} from "@/lib/present";
import { getAsset, getDecision, getOrganization, getSnapshot, getWorkOrder, listProviders } from "@/lib/read";
import { decisionTx } from "@/lib/txlog";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";

const EXPLAIN: Record<string, string> = {
  ACCEPTED: "The evidence shows the work meets the constitution and the work order.",
  REJECTED: "The evidence shows at least one requirement is not met.",
  UNDETERMINED: "The evidence did not establish the work well enough to authorise payment.",
};

export default function DecisionReceipt() {
  const { did } = useParams<{ did: string }>();
  const clock = useNow();
  const d = useChain(`decision.${did}`, (f) => getDecision(did, f));
  const x = d.data;
  const snap = useChain(x ? `snapshot.${x.snapshot_id}` : null, () => getSnapshot(x!.snapshot_id));
  const org = useChain(x ? `org.${x.organization_id}` : null, (f) => getOrganization(x!.organization_id, f));
  const asset = useChain(x ? `asset.${x.asset_id}` : null, (f) => getAsset(x!.asset_id, f));
  const order = useChain(x ? `order.${x.work_order_id}` : null, (f) => getWorkOrder(x!.work_order_id, f));
  const providers = useChain(x ? `providers.${x.organization_id}` : null, (f) => listProviders(x!.organization_id, f));
  const prior = useChain(x?.appeal_of ? `decision.${x.appeal_of}` : null, (f) => getDecision(x!.appeal_of!, f));

  if (d.loading) return <Band dark><Loading what="the decision" dark /></Band>;
  if (!x) return <Band><Empty>There is no such decision on this deployment.</Empty></Band>;
  const w = order.data;
  const terms = w?.versions[x.work_order_version - 1];
  const provider = providers.data?.providers.find((p) => p.address.toLowerCase() === x.provider.toLowerCase());
  const tx = decisionTx(did);
  const now = Math.max(clock, Date.parse(org.data?.now ?? "") || 0);
  const settlement = !w ? "Reading" : w.state === "SETTLED" && w.settlement ? "Paid"
    : w.state === "PAYMENT_RELEASABLE" ? "Releasable"
    : x.outcome === "ACCEPTED" && x.lifecycle !== "FINALIZED" ? "Once final"
    : "None";
  const appealStatus = x.lifecycle === "SUPERSEDED" ? "Superseded"
    : x.lifecycle === "APPEALED" ? "Under appeal"
    : x.lifecycle === "FINALIZED" ? "Final"
    : x.appeals_left > 0 && now <= Date.parse(x.appeal_window_ends) ? "Open"
    : "Closed";

  return (
    <>
      <section className="band-dark">
        <div className="page pb-12 pt-12">
          <div className="flex flex-wrap items-center gap-4">
            <Status dark>{x.lifecycle === "APPEALABLE" && !(x.appeals_left > 0 && now <= Date.parse(x.appeal_window_ends))
              ? "Awaiting finalization" : lifecycle(x.lifecycle)}</Status>
            <span className="t-label text-haze">{x.kind === "READJUDICATION" ? "Readjudication on appeal" : "Assessment"} · {moment(x.decided_at)}</span>
          </div>
          <h1 className="t-display mt-6">{outcomeHeadline(x.outcome)}.</h1>
          <p className="t-body mt-4 max-w-[60ch] text-haze">{EXPLAIN[x.outcome]}</p>
          <p className="t-small mt-3 text-haze">
            {terms ? <Link href={`/work-orders/${x.work_order_id}`} className="underline underline-offset-4">{terms.title}</Link> : "Reading"}
            {asset.data ? <> · {asset.data.name}</> : null}
            {org.data ? <> · {org.data.name}</> : null}
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat dark label="Payment" value={gen(x.payment_wei)} />
            <Stat dark label="Treasury" value={settlement} info={w?.settlement ? `${gen(w.settlement.wei)} settled ${moment(w.settlement.at)}.` : "A payment is releasable only after a finalized acceptance, and anyone may then settle it."} />
            <Stat dark label="Appeal" value={appealStatus} info={x.appeals_left > 0 ? `Window closes ${moment(x.appeal_window_ends)}.` : "No appeals remain on this work order."} />
            <Stat dark label="Provider" value={<span className="text-[1.25rem] md:text-[1.5rem]">{provider?.name ?? shortAddress(x.provider)}</span>} />
          </dl>
        </div>
      </section>

      <section className="band-light py-12">
        <div className="page">
          <Tabs items={[
            { id: "requirements", label: "Requirements", count: x.requirements.length, content: <Requirements x={x} /> },
            { id: "reasoning", label: "Reasoning", content: <Reasoning x={x} /> },
            ...(x.appeal || x.superseded_by ? [{ id: "appeal", label: "Appeal", content: <Appeal x={x} prior={prior.data ?? null} snap={snap.data ?? null} /> }] : []),
            { id: "verify", label: "Verification", content: <Verification x={x} snap={snap.data ?? null} tx={tx} /> },
          ]} />
        </div>
      </section>
    </>
  );
}

type D = NonNullable<Awaited<ReturnType<typeof getDecision>>>;
type S = NonNullable<Awaited<ReturnType<typeof getSnapshot>>>;

function Requirements({ x }: { x: D }) {
  return (
    <div>
        <div>
          {x.requirements.map((r) => {
            const raw = x.notes.raw?.[r.id];
            // A rejection rests on its failures; doubt rests on what was not established.
            const decisive = x.outcome === "REJECTED" ? x.failed.includes(r.id)
              : x.outcome === "UNDETERMINED" ? x.not_established.includes(r.id) : false;
            // An S check ruled out by the file is decided in code, not read by a validator.
            const byCode = r.id.startsWith("S") && r.status === "NOT_APPLICABLE";
            const agreed = !x.bound || byCode || x.bound.requirements.includes(r.id);
            return (
              <div key={r.id} className="grid gap-3 border-t border-lichen py-4 md:grid-cols-[1fr_200px]">
                <div>
                  <p className="t-label text-graphite">{ruleName(r.id)} · {source(r.source)}{decisive ? " · decided this" : ""}{byCode ? " · ruled out by the file, in code" : ""}</p>
                  <p className="t-body mt-2">{r.text}</p>
                  {x.notes.requirement_notes?.[r.id] ? (
                    <details className="mt-2">
                      <summary className="t-label cursor-pointer text-graphite">Why</summary>
                      <p className="t-small mt-2 text-graphite">{validatorNote(x.notes.requirement_notes[r.id])}</p>
                    </details>
                  ) : null}
                  {raw && raw !== r.status ? (
                    <p className="t-small mt-2 text-graphite">Validators rated it {requirementStatus(raw).toLowerCase()} on evidence that cannot establish it, so code set it to {requirementStatus(r.status).toLowerCase()}.</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 md:items-end md:text-right">
                  <Status>{requirementStatus(r.status)}</Status>
                  {agreed ? null : <span className="t-small text-graphite">One validator&apos;s reading<Info>Every validator agreed on the outcome. This rating is the leader&apos;s reading, recorded as such; the others did not have to match it.</Info></span>}
                </div>
              </div>
            );
          })}
          <div className="grid gap-4 border-t border-lichen py-6 md:grid-cols-2">
            <p className="t-body">Evidence sufficient as a whole: <strong>{x.evidence_sufficient ? "yes" : "no"}</strong></p>
            <p className="t-body">Material contradiction: <strong>{x.conflicts_detected ? `yes. ${writeOut(x.notes.conflict_note)}` : "none found"}</strong></p>
          </div>
        </div>
    </div>
  );
}

function Appeal({ x, prior, snap }: { x: D; prior: D | null; snap: S | null }) {
  return (
          <div className="grid gap-6 lg:grid-cols-2">
            {x.appeal ? (
              <Card>
                <p className="t-sub">This decision is a readjudication.</p>
                <dl className="mt-5 grid gap-4">
                  <Fact label="Original decision">
                    {prior ? <Link className="underline underline-offset-4" href={`/decisions/${x.appeal_of}`}>{outcomeHeadline(prior.outcome)}, {moment(prior.decided_at)}</Link> : "Reading"}
                  </Fact>
                  <Fact label="Appellant">{role(x.appeal.by)}, {moment(x.appeal.opened_at)}</Fact>
                  <Fact label="Reason">&ldquo;{x.appeal.reason}&rdquo;</Fact>
                  <Fact label="Same rules and terms">Constitution {x.constitution_version}, work order version {x.work_order_version}</Fact>
                  <Fact label="Additional evidence">{snap ? snap.evidence.filter((e) => e.new_on_appeal).map((e) => evidenceName(e.evidence_id)).join(", ") || "None" : "Reading"}</Fact>
                </dl>
              </Card>
            ) : null}
            {x.superseded_by ? (
              <Card tone="tissue">
                <p className="t-sub">This decision was appealed.</p>
                <p className="t-body mt-4">It is kept exactly as it was recorded. The readjudication that reviewed it is a separate decision.</p>
                <Link href={`/decisions/${x.superseded_by}`} className="t-label mt-5 inline-block underline underline-offset-4">Open the readjudication</Link>
              </Card>
            ) : null}
          </div>
  );
}

function Reasoning({ x }: { x: D }) {
  return (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <Tag>The leader&apos;s reasoning</Tag>
            <p className="t-body-lg mt-5">{writeOut(x.notes.reasoning) || "No reasoning was recorded."}</p>
            <p className="t-small mt-5 text-graphite">One validator&apos;s words.<Info>Consensus agreed on the outcome and the requirements it rests on, not on this prose.</Info></p>
          </Card>
          <Card tone="tissue">
            <Tag>What the photographs showed</Tag>
            <div className="mt-5">
              {(x.notes.observations ?? []).map((ob) => (
                <div key={ob.evidence_id} className="border-t border-lichen py-4 first:border-t-0">
                  <p className="t-label text-graphite">{evidenceName(ob.evidence_id)} · {imageView(ob.view)} · {role(ob.role)}</p>
                  <p className="t-body mt-2">{ob.seen ? ob.shows : "Could not be examined."}</p>
                  {ob.text.length ? <p className="t-mono mt-2 text-graphite">Legible: {ob.text.join(" | ")}</p> : null}
                  {ob.readings.length ? <p className="t-small mt-1">Readings: {ob.readings.map((r) => `${r.quantity} ${r.value} ${r.unit}`.trim()).join(", ")}</p> : null}
                  {ob.change ? <p className="t-small mt-1">Change from before: {ob.change}</p> : null}
                  {ob.same_asset_doubts ? <p className="t-small mt-1">Doubts it is this asset: {ob.same_asset_doubts}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
  );
}

function Verification({ x, snap, tx }: { x: D; snap: S | null; tx: ReturnType<typeof decisionTx> }) {
  return (
      <div className="rounded-[20px] bg-ink p-6 text-paper md:p-10">
        <p className="t-label text-haze">{snap ? `${snapshotName(snap.snapshot_id)}, ${snap.evidence_count} items` : "Reading the snapshot"}
          <Info dark>The hash the contract computed for each item when it was filed. Fetch the bytes and compare.</Info></p>
        {snap ? (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead><tr className="t-label text-haze"><th className="py-3 font-normal">Evidence</th><th className="py-3 font-normal">Type</th><th className="py-3 font-normal">Filed by</th><th className="py-3 font-normal">SHA-256</th></tr></thead>
              <tbody>
                {snap.evidence.map((e) => (
                  <tr key={e.evidence_id} className="border-t border-graphite">
                    <td className="t-small py-3">{evidenceName(e.evidence_id)}{e.new_on_appeal ? ", filed on appeal" : ""}</td>
                    <td className="t-small py-3">{e.kind === "IMAGE" ? imageView(e.type) : maintenanceType(e.type) || e.type.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="t-small py-3">{role(e.role)}</td>
                    <td className="t-mono py-3 text-lichen" title={e.content_hash}>{shortDigest(e.content_hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <dl className="mt-10 grid gap-6 border-t border-graphite pt-8 md:grid-cols-3">
          <Fact dark label="Decided">{moment(x.decided_at)}</Fact>
          <Fact dark label="Finalized">{x.finalized_at ? moment(x.finalized_at) : "Not yet"}</Fact>
          <Fact dark label="Record identifiers">{x.decision_id} · {x.snapshot_id} · {x.work_order_id}</Fact>
        </dl>
        <p className="t-small mt-8 text-haze">
          {tx ? <>Produced by <a className="underline underline-offset-4" href={txUrl(tx.hash)} target="_blank" rel="noreferrer">this transaction</a>, known from {tx.source}. </> : null}
          Read from the contract&apos;s state. Its history is on{" "}
          <a className="underline underline-offset-4" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the explorer</a>.
        </p>
      </div>
  );
}
