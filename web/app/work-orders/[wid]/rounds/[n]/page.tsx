"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Band, Card, Empty, Fact, Loading, Status, Tag } from "@/components/bits";
import { addressUrl, txUrl } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/config";
import {
  criterionStatus, decision, docType, itemName, moment, panelNote, principleStatus, quality, role, roundName,
  shortDigest, writeOut,
} from "@/lib/present";
import { getConstitution, getRound, getWorkOrder } from "@/lib/read";
import { roundTx } from "@/lib/txlog";
import { useChain } from "@/lib/useChain";

export default function RoundPage() {
  const { wid, n } = useParams<{ wid: string; n: string }>();
  const num = Number(n);
  const round = useChain(`round.${wid}.${num}`, () => getRound(wid, num));
  const order = useChain(`order.${wid}`, (f) => getWorkOrder(wid, f));
  const r = round.data;
  const c = useChain(r ? `c.${r.organization_id}.${r.constitution_version}` : null,
                     (f) => getConstitution(r!.organization_id, r!.constitution_version, f));

  if (round.loading) return <Band dark><Loading what="the round" dark /></Band>;
  if (!r) return <Band><Empty>There is no such round.</Empty></Band>;
  const terms = order.data?.versions[r.version - 1];
  const tx = roundTx(wid, num);
  const decisive = new Set([...r.decisive.criteria, ...r.decisive.principles]);

  return (
    <>
      <section className="band-dark">
        <div className="page pb-16 pt-14 md:pb-24 md:pt-20">
          <div className="flex flex-wrap items-center gap-5">
            <Tag dark>{roundName(r.kind, r.round)}</Tag>
            <Link href={`/work-orders/${wid}`} className="t-label text-haze underline underline-offset-4">
              {terms?.title ?? "The work order"}
            </Link>
          </div>
          <h1 className="t-hero mt-6">{decision(r.decision)}.</h1>
          <p className="t-body-lg mt-10 max-w-[56ch] text-haze">{quality(r.quality)}.</p>
          <dl className="mt-14 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-4">
            <Fact dark label="Recorded">{moment(r.at)}</Fact>
            <Fact dark label="Applied">Constitution {r.constitution_version}, terms version {r.version}</Fact>
            <Fact dark label="Read">{r.evidence.length} items</Fact>
            {r.reviewed_round ? <Fact dark label="Reviewed">Round {r.reviewed_round}</Fact> : <Fact dark label="Kind">First assessment</Fact>}
          </dl>
        </div>
      </section>

      <Band>
        <Tag>Principles</Tag>
        <div className="mt-6 flex flex-col">
          {(c.data?.principles ?? Object.keys(r.principles).map((id) => ({ id, text: "" }))).map((p, i) => {
            const status = r.principles[p.id] ?? "UNCLEAR";
            const raw = r.notes.principles_raw?.[p.id];
            return (
              <div key={p.id} className="grid gap-4 border-t border-lichen py-6 md:grid-cols-[1fr_200px]">
                <div>
                  <p className="t-label text-graphite">Principle {i + 1}{decisive.has(p.id) && r.decision !== "ACCEPTED" ? " · decided this" : ""}</p>
                  <p className="t-body-lg mt-2">{p.text}</p>
                  {r.notes.principle_notes?.[p.id] ? <p className="t-small mt-3 text-graphite">The panel: {panelNote(r.notes.principle_notes[p.id])}</p> : null}
                  {raw && raw !== status ? (
                    <p className="t-small mt-2 text-graphite">
                      The panel said {principleStatus(raw).toLowerCase()}, on paperwork alone. Code set it to not settled.
                    </p>
                  ) : null}
                </div>
                <div className="md:text-right"><Status>{principleStatus(status)}</Status></div>
              </div>
            );
          })}
        </div>

        <div className="mt-16"><Tag>Acceptance criteria</Tag></div>
        <div className="mt-6 flex flex-col">
          {(terms?.acceptance_criteria ?? Object.keys(r.criteria).map((id) => ({ id, text: "" }))).map((x, i) => {
            const status = r.criteria[x.id] ?? "UNCLEAR";
            const raw = r.notes.criteria_raw?.[x.id];
            return (
              <div key={x.id} className="grid gap-4 border-t border-lichen py-6 md:grid-cols-[1fr_200px]">
                <div>
                  <p className="t-label text-graphite">Criterion {i + 1}{decisive.has(x.id) && r.decision !== "ACCEPTED" ? " · decided this" : ""}</p>
                  <p className="t-body-lg mt-2">{x.text}</p>
                  {r.notes.criterion_notes?.[x.id] ? <p className="t-small mt-3 text-graphite">The panel: {panelNote(r.notes.criterion_notes[x.id])}</p> : null}
                  {raw && raw !== status ? (
                    <p className="t-small mt-2 text-graphite">
                      The panel said {criterionStatus(raw).toLowerCase()}, on paperwork alone. Code set it to not settled.
                    </p>
                  ) : null}
                </div>
                <div className="md:text-right"><Status>{criterionStatus(status)}</Status></div>
              </div>
            );
          })}
        </div>
      </Band>

      <Band className="border-t border-lichen">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <Tag>The leader&apos;s reasoning</Tag>
            <p className="t-body-lg mt-6">{writeOut(r.notes.reasoning) || "No reasoning was recorded."}</p>
            {r.conflicts_detected ? <p className="t-small mt-4 text-graphite">Conflict: {writeOut(r.notes.conflict_note)}</p> : null}
            <p className="t-small mt-6 text-graphite">
              Prose is not what consensus agreed on. Validators agreed on the decision and the findings it rests on.
            </p>
            {r.appeal_reason ? (
              <p className="t-small mt-6 border-t border-lichen pt-4">The appellant argued: &ldquo;{r.appeal_reason}&rdquo;</p>
            ) : null}
          </Card>
          <Card tone="tissue">
            <Tag>What the panel saw, before it knew the rules</Tag>
            <div className="mt-6 flex flex-col">
              {(r.notes.images ?? []).map((img) => (
                <div key={img.item_id} className="border-t border-lichen py-4 first:border-t-0">
                  <p className="t-label text-graphite">{itemName(img.item_id)} · {role(img.role)}</p>
                  <p className="t-body mt-2">{img.readable ? img.shows : "Could not be read by the leader."}</p>
                  {img.labels.length ? <p className="t-mono mt-2 text-graphite">Read on labels: {img.labels.join(" | ")}</p> : null}
                  {img.concerns.length ? <p className="t-small mt-2 text-graphite">Concerns: {img.concerns.join("; ")}</p> : null}
                </div>
              ))}
              {(r.notes.images ?? []).length === 0 ? <p className="t-body text-graphite">No photographs in this round.</p> : null}
            </div>
          </Card>
        </div>
      </Band>

      <Band dark>
        <Tag dark>Verification</Tag>
        <h2 className="t-heading mt-6 max-w-[30ch]">Every item this round read, with the digest the contract computed when it was filed.</h2>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="t-label text-haze">
                <th className="py-3 font-normal">Item</th><th className="py-3 font-normal">Kind</th>
                <th className="py-3 font-normal">Filed by</th><th className="py-3 font-normal">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {r.evidence.map((e) => (
                <tr key={e.item_id} className="border-t border-graphite">
                  <td className="t-small py-3">{itemName(e.item_id)}{e.new ? ", new on appeal" : ""}</td>
                  <td className="t-small py-3">{e.kind === "DOCUMENT" ? docType(e.doc_type) : "Photograph"}</td>
                  <td className="t-small py-3">{role(e.role)}</td>
                  <td className="t-mono py-3 text-lichen" title={e.sha256}>{shortDigest(e.sha256)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="t-small mt-8 text-haze">
          {tx ? (
            <>Decided in <a className="underline underline-offset-4" href={txUrl(tx.hash)} target="_blank" rel="noreferrer">this transaction</a>, known from {tx.source}.</>
          ) : (
            <>The contract cannot record its own transaction hash. Its history is on <a className="underline underline-offset-4" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">the explorer</a>.</>
          )}
        </p>
      </Band>
    </>
  );
}
