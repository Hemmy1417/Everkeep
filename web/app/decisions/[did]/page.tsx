"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Band, Card, Empty, Fact, Loading, Status, Tag } from "@/components/bits";
import { addressUrl, txUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import {
  decisionName, evidenceName, gen, imageView, lifecycle, maintenanceType, moment, outcomeHeadline, panelNote,
  requirementStatus, role, ruleName, shortAddress, shortDigest, snapshotName, source, writeOut,
} from "@/lib/present";
import { getAsset, getDecision, getOrganization, getSnapshot, getWorkOrder, listProviders } from "@/lib/read";
import { decisionTx } from "@/lib/txlog";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";

const EXPLAIN: Record<string, string> = {
  ACCEPTED: "The evidence establishes that the maintenance satisfies the organisation's constitution and this work order.",
  REJECTED: "The evidence establishes that at least one requirement is not satisfied. The requirements it rests on are marked below.",
  UNDETERMINED: "The submitted evidence did not establish the maintenance requirement with enough certainty for the organisation to authorise payment. Additional evidence and an appeal are the way forward where the constitution allows one.",
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
  const settlement = !w ? "Reading" : w.state === "SETTLED" && w.settlement ? `${gen(w.settlement.wei)} settled to the provider ${moment(w.settlement.at)}`
    : w.state === "PAYMENT_RELEASABLE" ? `${gen(w.committed_wei)} releasable; anyone may settle it`
    : x.outcome === "ACCEPTED" && x.lifecycle !== "FINALIZED" ? `${gen(x.payment_wei)} releasable once final`
    : "Nothing releasable on this decision";
  const appealStatus = x.lifecycle === "SUPERSEDED" ? "Appealed; superseded by a readjudication"
    : x.lifecycle === "APPEALED" ? "Under appeal"
    : x.lifecycle === "FINALIZED" ? "Closed; the decision is final"
    : x.appeals_left > 0 && now <= Date.parse(x.appeal_window_ends) ? `Available until ${moment(x.appeal_window_ends)}`
    : "No appeal available";

  return (
    <>
      <section className="band-dark">
        <div className="page pb-14 pt-12 md:pb-20">
          <div className="flex flex-wrap items-center gap-5">
            <Tag dark>EVERKEEP maintenance decision</Tag>
            <Status dark>{x.lifecycle === "APPEALABLE" && !(x.appeals_left > 0 && now <= Date.parse(x.appeal_window_ends))
              ? "Awaiting finalization" : lifecycle(x.lifecycle)}</Status>
            <span className="t-label text-haze">{decisionName(x.decision_id)}{x.kind === "READJUDICATION" ? " · readjudication on appeal" : ""}</span>
          </div>
          <h1 className="t-hero mt-8">{outcomeHeadline(x.outcome)}.</h1>
          <p className="t-body-lg mt-8 max-w-[62ch] text-haze">{EXPLAIN[x.outcome]}</p>
          <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-4">
            <Fact dark label="Organisation">{org.data?.name ?? "Reading"}</Fact>
            <Fact dark label="Asset">{asset.data?.name ?? "Reading"}</Fact>
            <Fact dark label="Work order">{terms?.title ?? "Reading"}</Fact>
            <Fact dark label="Version">Work order {x.work_order_version}, constitution {x.constitution_version}</Fact>
            <Fact dark label="Service provider">{provider?.name ?? shortAddress(x.provider)}</Fact>
            <Fact dark label="Payment">{gen(x.payment_wei)}</Fact>
            <Fact dark label="Appeal status">{appealStatus}</Fact>
            <Fact dark label="Treasury">{settlement}</Fact>
          </dl>
          {org.data ? <p className="t-small mt-8 text-lichen">Mission: {org.data.mission}</p> : null}
        </div>
      </section>

      <Band>
        <Tag>Requirements, as decided</Tag>
        <div className="mt-6">
          {x.requirements.map((r) => {
            const raw = x.notes.raw?.[r.id];
            const decisive = x.failed.includes(r.id) || x.not_established.includes(r.id);
            return (
              <div key={r.id} className="grid gap-4 border-t border-lichen py-6 md:grid-cols-[1fr_200px]">
                <div>
                  <p className="t-label text-graphite">{ruleName(r.id)} · {source(r.source)}{decisive && x.outcome !== "ACCEPTED" ? " · decided this" : ""}</p>
                  <p className="t-body-lg mt-2">{r.text}</p>
                  {x.notes.requirement_notes?.[r.id] ? <p className="t-small mt-3 text-graphite">The panel: {panelNote(x.notes.requirement_notes[r.id])}</p> : null}
                  {raw && raw !== r.status ? (
                    <p className="t-small mt-2 text-graphite">The panel rated it {requirementStatus(raw).toLowerCase()} on evidence that cannot establish it, so code set it to {requirementStatus(r.status).toLowerCase()}.</p>
                  ) : null}
                </div>
                <div className="md:text-right"><Status>{requirementStatus(r.status)}</Status></div>
              </div>
            );
          })}
          <div className="grid gap-4 border-t border-lichen py-6 md:grid-cols-2">
            <p className="t-body">Evidence sufficient as a whole: <strong>{x.evidence_sufficient ? "yes" : "no"}</strong></p>
            <p className="t-body">Material contradiction: <strong>{x.conflicts_detected ? `yes. ${writeOut(x.notes.conflict_note)}` : "none found"}</strong></p>
          </div>
        </div>
      </Band>

      {x.appeal || x.superseded_by ? (
        <Band className="border-t border-lichen">
          <Tag>Appeal</Tag>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {x.appeal ? (
              <Card>
                <p className="t-sub">This decision is a readjudication.</p>
                <dl className="mt-5 grid gap-4">
                  <Fact label="Original decision">
                    {prior.data ? <Link className="underline underline-offset-4" href={`/decisions/${x.appeal_of}`}>{outcomeHeadline(prior.data.outcome)}, {moment(prior.data.decided_at)}</Link> : "Reading"}
                  </Fact>
                  <Fact label="Appellant">{role(x.appeal.by)}, {moment(x.appeal.opened_at)}</Fact>
                  <Fact label="Reason">&ldquo;{x.appeal.reason}&rdquo;</Fact>
                  <Fact label="Same rules and terms">Constitution {x.constitution_version}, work order version {x.work_order_version}</Fact>
                  <Fact label="Additional evidence">{snap.data ? snap.data.evidence.filter((e) => e.new_on_appeal).map((e) => evidenceName(e.evidence_id)).join(", ") || "None" : "Reading"}</Fact>
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
        </Band>
      ) : null}

      <Band className="border-t border-lichen">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <Tag>The leader&apos;s reasoning</Tag>
            <p className="t-body-lg mt-5">{writeOut(x.notes.reasoning) || "No reasoning was recorded."}</p>
            <p className="t-small mt-5 text-graphite">Prose is not what consensus agreed on: validators agreed on the outcome and the requirements it rests on, each from its own examination.</p>
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
      </Band>

      <Band dark>
        <Tag dark>Evidence snapshot and verification</Tag>
        <h2 className="t-heading mt-6 max-w-[34ch]">{snap.data ? `${snapshotName(snap.data.snapshot_id)}: ${snap.data.evidence_count} items, with the hash the contract computed for each when it was filed.` : "Reading the snapshot."}</h2>
        {snap.data ? (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead><tr className="t-label text-haze"><th className="py-3 font-normal">Evidence</th><th className="py-3 font-normal">Type</th><th className="py-3 font-normal">Filed by</th><th className="py-3 font-normal">SHA-256</th></tr></thead>
              <tbody>
                {snap.data.evidence.map((e) => (
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
          This receipt is read from the contract&apos;s state, not written by this page: the contract&apos;s own history is on{" "}
          <a className="underline underline-offset-4" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the explorer</a>.
        </p>
      </Band>
    </>
  );
}
