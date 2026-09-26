"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Button, Card, Counter, Empty, Fact, Field, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { EvidenceList } from "@/components/Evidence";
import { FilePanel } from "@/components/FilePanel";
import { blankTerms, TermsForm, termsJson, type TermsDraft } from "@/components/TermsForm";
import { currentTerms, isSteward, orderActs, orderSituation, seatOn } from "@/lib/acts";
import {
  decision, gen, itemName, maintenanceType, moment, orderState, relative, requirement, role, roundName,
} from "@/lib/present";
import { getAsset, getConfig, getConstitution, getOrganization, getRound, getWorkOrder, invalidateReads } from "@/lib/read";
import type { Constitution, WorkOrder } from "@/lib/types";
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

  if (order.loading) return <Band dark><Loading what="the work order" dark /></Band>;
  if (order.error) return <Band><ReadFailure what="the work order" detail={String((order.error as Error).message)} /></Band>;
  if (!o) return <Band><Empty>There is no such work order on this deployment.</Empty></Band>;

  const now = Math.max(Date.parse(o.now) || 0, clock);
  const terms = currentTerms(o);
  const reload = () => { invalidateReads(); order.reload(); org.reload(); asset.reload(); };
  const ready = org.data && asset.data;
  const stewards = org.data?.stewards ?? [];
  const seat = ready ? seatOn(o, asset.data!, stewards, w.address) : "";
  const acts = ready ? orderActs(o, org.data!, seat, isSteward(stewards, w.address), now) : null;

  return (
    <>
      <section className="band-dark">
        <div className="page pb-16 pt-14 md:pb-24 md:pt-20">
          <div className="flex flex-wrap items-center gap-5">
            <Status dark>{orderState(o.state)}</Status>
            {org.data ? (
              <Link href={`/organizations/${o.organization_id}`} className="t-label text-haze underline underline-offset-4">
                {org.data.name}
              </Link>
            ) : null}
            {seat ? <Tag dark>You are the {role(seat).toLowerCase()}</Tag> : null}
          </div>
          <h1 className="t-display mt-6 max-w-[20ch]">{terms.title}</h1>
          <p className="t-body-lg mt-8 max-w-[60ch] text-haze">{orderSituation(o, now)}</p>
          <dl className="mt-14 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-4">
            <Fact dark label="Pays">{gen(terms.payment_wei)}</Fact>
            <Fact dark label="Deadline">{moment(terms.deadline)}</Fact>
            <Fact dark label="Maintenance">{maintenanceType(terms.maintenance_type)}</Fact>
            <Fact dark label="Judged under">Constitution {o.constitution_version}</Fact>
          </dl>
          {asset.data ? <p className="t-small mt-8 text-lichen">On {asset.data.name}{asset.data.location ? `, ${asset.data.location}` : ""}.</p> : null}
        </div>
      </section>

      {acts ? <Actions o={o} acts={acts} seat={seat} bound={bound.data ?? null} onChange={reload} now={now} /> : null}

      <Band className="border-t border-lichen">
        <Counter n={1} of={3} />
        <h2 className="t-heading-lg mt-8">What was agreed.</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <Tag>This work order{o.versions.length > 1 ? `, version ${terms.version}` : ""}</Tag>
            <p className="t-body-lg mt-6">{terms.requirements}</p>
            {terms.description ? <p className="t-small mt-4 text-graphite">{terms.description}</p> : null}
            <ol className="mt-8">
              {terms.acceptance_criteria.map((c, i) => (
                <li key={c.id} className="grid grid-cols-[auto_1fr] gap-5 border-t border-lichen py-4">
                  <span className="t-label pt-1 text-graphite">Criterion {i + 1}</span>
                  <span className="t-body">{c.text}</span>
                </li>
              ))}
            </ol>
            <p className="t-label mt-4 text-graphite">
              Needs on file first: {terms.required_evidence.map(requirement).join(", ") || "nothing beyond the constitution"}
            </p>
            {o.pending_version && o.pending_version !== o.current_version ? (
              <p className="t-small mt-6 rounded-[12px] border border-lichen p-4">
                New terms, version {o.pending_version}, wait for the provider&apos;s signature. The version
                above stays in force until then.
              </p>
            ) : null}
          </Card>
          <Card tone="tissue">
            <Tag>The constitution it answers to</Tag>
            {bound.data ? (
              <>
                <ol className="mt-6">
                  {bound.data.principles.map((p, i) => (
                    <li key={p.id} className="grid grid-cols-[auto_1fr] gap-5 border-t border-lichen py-4 first:border-t-0">
                      <span className="t-label pt-1 text-graphite">Principle {i + 1}</span>
                      <span className="t-body">{p.text}</span>
                    </li>
                  ))}
                </ol>
                <p className="t-small mt-4 text-graphite">
                  Bound when the order was created. An amendment ratified later governs later orders, never this one.
                </p>
              </>
            ) : <div className="mt-6"><Loading what="the constitution" /></div>}
          </Card>
        </div>
      </Band>

      <Band className="border-t border-lichen">
        <Counter n={2} of={3} />
        <h2 className="t-heading-lg mt-8">The evidence on file.</h2>
        <div className="mt-10 flex flex-col gap-12">
          {Object.keys(o.evidence).sort((a, b) => Number(b) - Number(a)).map((v) => (
            <div key={v}>
              {o.versions.length > 1 ? <p className="t-label mb-4 text-graphite">Against version {v}</p> : null}
              <EvidenceList items={o.evidence[v] ?? []} terms={o.versions[Number(v) - 1] ?? terms} />
            </div>
          ))}
          {Object.keys(o.evidence).length === 0 ? <Empty>Nothing filed yet.</Empty> : null}
        </div>
      </Band>

      <Rounds o={o} />
    </>
  );
}

function Actions({ o, acts, seat, bound, onChange, now }: {
  o: WorkOrder; acts: ReturnType<typeof orderActs>; seat: string; bound: Constitution | null;
  onChange: () => void; now: number;
}) {
  const w = useWallet();
  const config = useChain("config", () => getConfig());
  const [proposing, setProposing] = useState(false);
  const [draft, setDraft] = useState<TermsDraft | null>(null);
  const [reason, setReason] = useState("");
  const [named, setNamed] = useState<string[]>([]);
  const terms = currentTerms(o);
  const mine = (o.evidence[String(o.current_version)] ?? [])
    .filter((it) => it.role === "PROVIDER" && (it.kind === "IMAGE" || it.kind === "DOCUMENT"));
  const any = Object.entries(acts).some(([k, v]) => k !== "fileClosed" && v === true);
  const pendingTerms = o.pending_version ? o.versions[o.pending_version - 1] : null;

  if (!w.address) {
    return (
      <Band>
        <p className="t-body text-graphite">Connect a wallet to act on this work order. Anyone can settle, close or decide an appeal once its time comes.</p>
      </Band>
    );
  }
  if (!any) {
    return (
      <Band>
        <Tag>Nothing for this wallet to do right now</Tag>
        {seat && acts.fileClosed ? <p className="t-body mt-4 text-graphite">{acts.fileClosed}</p> : null}
        {o.standing?.window_ends && o.standing.appealable && !o.standing.appealed && now <= Date.parse(o.standing.window_ends) ? (
          <p className="t-body mt-4 text-graphite">The appeal window closes {moment(o.standing.window_ends)}, {relative(o.standing.window_ends, now)}.</p>
        ) : null}
      </Band>
    );
  }

  return (
    <Band>
      <Tag>What you can do</Tag>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {acts.sign && pendingTerms ? (
          <Card>
            <p className="t-sub">Sign the terms.</p>
            <p className="t-small mt-3 text-graphite">
              Version {pendingTerms.version}: {gen(pendingTerms.payment_wei)} by {moment(pendingTerms.deadline)}. Signing moves the
              treasury&apos;s commitment to exactly this payment, and nothing can be filed before you sign.
            </p>
            <div className="mt-6"><Act label={`Sign version ${pendingTerms.version}`} method="accept_work_order" args={[o.work_order_id, pendingTerms.version]} onAnswer={onChange} /></div>
          </Card>
        ) : null}

        {acts.assess ? (
          <Card>
            <p className="t-sub">Ask for an assessment.</p>
            <p className="t-small mt-3 text-graphite">
              Choose what you present, up to {config.data?.max_named.IMAGE ?? 4} photographs and {config.data?.max_named.TEXT ?? 4} documents.
              Everything a steward or the inspector filed is read as well. The constitution&apos;s evidence rules are checked
              first; a panel is not asked the same question twice, so ask again only after filing something new.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {mine.length === 0 ? <p className="t-small">You have not filed a photograph or document yet.</p> : null}
              {mine.map((it) => (
                <label key={it.item_id} className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" checked={named.includes(it.item_id)}
                         onChange={(e) => setNamed(e.target.checked ? [...named, it.item_id] : named.filter((x) => x !== it.item_id))} />
                  <span className="t-small">{itemName(it.item_id)}{it.caption ? `, ${it.caption}` : ""}</span>
                </label>
              ))}
            </div>
            <div className="mt-6">
              <Act label="Ask the panel" method="request_assessment"
                   working="Each validator reads the photographs blind, then rates every principle and criterion. This takes a few minutes."
                   prepare={() => [o.work_order_id, JSON.stringify(named)]}
                   onAnswer={() => { setNamed([]); onChange(); }} />
            </div>
          </Card>
        ) : null}

        {acts.file ? (
          <Card className="lg:col-span-2">
            <p className="t-sub mb-6">File evidence as the {role(seat).toLowerCase()}.</p>
            <FilePanel wid={o.work_order_id} terms={terms} seat={seat as never} onFiled={onChange} />
          </Card>
        ) : null}

        {acts.appeal && o.standing ? (
          <Card>
            <p className="t-sub">Appeal the {decision(o.standing.decision).toLowerCase()} decision.</p>
            <p className="t-small mt-3 text-graphite">
              Once, before {moment(o.standing.window_ends)}. Every party may add evidence during the appeal; then a fresh
              panel re-reads the whole record under the same constitution. Its answer is final for these terms.
            </p>
            <div className="mt-5">
              <Act label="Open the appeal" method="open_appeal"
                   prepare={() => (reason.trim() ? [o.work_order_id, reason.trim()] : "State the grounds.")} onAnswer={onChange}>
                <Field label="Grounds"><textarea value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} /></Field>
              </Act>
            </div>
          </Card>
        ) : null}

        {acts.decideAppeal ? (
          <Card>
            <p className="t-sub">Decide the appeal.</p>
            <p className="t-small mt-3 text-graphite">The evidence period is over. Anyone may ask a fresh panel to decide it.</p>
            <div className="mt-6"><Act label="Ask a fresh panel" method="decide_appeal" args={[o.work_order_id]}
                                       working="A fresh panel re-reads the record and anything filed since." onAnswer={onChange} /></div>
          </Card>
        ) : null}

        {acts.lapseAppeal ? (
          <Card tone="tissue">
            <p className="t-sub">Let the appeal lapse.</p>
            <p className="t-small mt-3 text-graphite">No panel decided it in three days. Lapsing leaves the order undetermined; nothing pays.</p>
            <div className="mt-6"><Act label="Lapse the appeal" variant="secondary" method="lapse_appeal" args={[o.work_order_id]} onAnswer={onChange} /></div>
          </Card>
        ) : null}

        {acts.finalize ? (
          <Card>
            <p className="t-sub">Settle the acceptance.</p>
            <p className="t-small mt-3 text-graphite">It can no longer be contested. Settling credits {gen(o.committed_wei)} to the provider, who claims it.</p>
            <div className="mt-6"><Act label="Settle" method="finalize" args={[o.work_order_id]} onAnswer={onChange} /></div>
          </Card>
        ) : null}

        {acts.close ? (
          <Card tone="tissue">
            <p className="t-sub">Close it.</p>
            <p className="t-small mt-3 text-graphite">The deadline has passed with nothing accepted. Closing returns {gen(o.committed_wei)} to the treasury.</p>
            <div className="mt-6"><Act label="Close the work order" variant="secondary" method="close_work_order" args={[o.work_order_id]} onAnswer={onChange} /></div>
          </Card>
        ) : null}

        {acts.cancel ? (
          <Card tone="tissue">
            <p className="t-sub">Withdraw it.</p>
            <p className="t-small mt-3 text-graphite">The provider has not signed, so it can still be withdrawn and its commitment returned.</p>
            <div className="mt-6"><Act label="Withdraw" variant="secondary" method="cancel_work_order" args={[o.work_order_id, "Withdrawn before signing"]} onAnswer={onChange} /></div>
          </Card>
        ) : null}

        {acts.proposeTerms && bound && config.data ? (
          <Card tone="tissue" className="lg:col-span-2">
            {proposing ? (
              <>
                <p className="t-sub mb-6">New terms, checked against constitution {o.constitution_version}.</p>
                <TermsForm config={config.data} constitution={bound} draft={draft ?? blankTerms(bound)} onChange={setDraft} />
                <div className="mt-8 flex flex-wrap gap-3">
                  <Act label="Propose these terms" method="propose_version"
                       prepare={() => {
                         const json = termsJson(draft ?? blankTerms(bound), bound);
                         return json.startsWith("{") ? [o.work_order_id, json] : json;
                       }}
                       onAnswer={() => { setProposing(false); onChange(); }} />
                  <Button variant="secondary" onClick={() => setProposing(false)}>Put it away</Button>
                </div>
              </>
            ) : (
              <>
                <p className="t-sub">Revise the terms.</p>
                <p className="t-small mt-3 text-graphite">The current version stays in force until the provider signs the new one. Signing clears any decision about the old terms.</p>
                <div className="mt-6"><Button variant="secondary" onClick={() => { setDraft(blankTerms(bound)); setProposing(true); }}>Draft new terms</Button></div>
              </>
            )}
          </Card>
        ) : null}
      </div>
    </Band>
  );
}

function Rounds({ o }: { o: WorkOrder }) {
  const ns = Array.from({ length: o.rounds_count }, (_, i) => o.rounds_count - i);
  return (
    <Band dark>
      <Counter n={3} of={3} dark />
      <h2 className="t-heading-lg mt-8">Decisions.</h2>
      <div className="mt-10">
        {ns.length === 0 ? <p className="t-body text-haze">No panel has been asked yet.</p> : null}
        {ns.map((n) => <RoundRow key={n} wid={o.work_order_id} n={n} />)}
        {o.appeal ? (
          <p className="t-body mt-8 border-t border-graphite pt-6 text-lichen">
            {role(o.appeal.by)} appealed on {moment(o.appeal.opened_at)}: &ldquo;{o.appeal.reason}&rdquo;. Evidence closes {moment(o.appeal.evidence_ends)}.
          </p>
        ) : null}
      </div>
    </Band>
  );
}

function RoundRow({ wid, n }: { wid: string; n: number }) {
  const r = useChain(`round.${wid}.${n}`, () => getRound(wid, n));
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-6 border-t border-graphite py-6">
      {r.data ? (
        <div>
          <p className="t-label text-haze">{roundName(r.data.kind, r.data.round)} · {moment(r.data.at)}</p>
          <p className="t-heading mt-2">{decision(r.data.decision)}</p>
        </div>
      ) : <Loading what={`round ${n}`} dark />}
      <Arrow href={`/work-orders/${wid}/rounds/${n}`} label={`Open round ${n}`} />
    </div>
  );
}
