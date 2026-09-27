"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Card, Empty, Field, Loading } from "@/components/bits";
import { Info, Stat, Tabs } from "@/components/tabs";
import { orgActs } from "@/lib/acts";
import { gen, moment, parseGen } from "@/lib/present";
import { getConstitution, getEvents, getOrganization, invalidateReads, listWorkOrders } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

export default function Treasury() {
  const { oid } = useParams<{ oid: string }>();
  const w = useWallet();
  const clock = useNow();
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const v = org.data?.constitution_version;
  const c = useChain(v ? `c.${oid}.${v}` : null, (f) => getConstitution(oid, v!, f));
  const orders = useChain(`orders.${oid}`, (f) => listWorkOrders(oid, 0, 50, f));
  const events = useChain(`events.${oid}.treasury`, (f) => getEvents(oid, 0, 50, f));
  const [amount, setAmount] = useState("1");
  const o = org.data;
  if (!o) return <Band dark><Loading what="the treasury" dark /></Band>;
  const acts = c.data ? orgActs(o, c.data, w.address, Math.max(Date.parse(o.now), clock)) : null;
  const money = (events.data?.events ?? []).filter((e) => ["TREASURY_FUNDED", "SETTLED", "PAYMENT_RELEASABLE", "DISSOLVED"].includes(e.kind));
  const pending = (orders.data?.work_orders ?? []).filter((x) => x.state === "PAYMENT_RELEASABLE");
  const settled = (orders.data?.work_orders ?? []).filter((x) => x.state === "SETTLED");

  const row = (x: { work_order_id: string; title: string; payment_wei: string }, note: string) => (
    <div key={x.work_order_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-lichen py-4">
      <p className="t-body">{x.title}</p>
      <span className="t-small text-graphite">{gen(x.payment_wei)} {note}</span>
      <Arrow href={`/work-orders/${x.work_order_id}`} label={`Open ${x.title}`} />
    </div>
  );
  return (
    <>
      <section className="band-dark">
        <div className="page pb-12 pt-12">
          <p className="t-label text-haze">Treasury
            <Info dark>Held by the contract, with no owner and no withdrawal. Work commits its payment when created; only a finalized acceptance releases it, and a settlement pays it.</Info>
          </p>
          <h1 className="t-display mt-5">{gen(o.escrow_wei)}</h1>
          <dl className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat dark label="Committed" value={gen(o.committed_wei)} info={`${gen(o.releasable_wei)} of it is releasable now.`} />
            <Stat dark label="Free to commit" value={gen(o.spendable_wei)} info={`${gen(o.available_wei)} is uncommitted; the rest is the reserve.`} />
            <Stat dark label="Releasable" value={gen(o.releasable_wei)} />
            <Stat dark label="Paid out" value={gen(o.paid_wei)} />
          </dl>
        </div>
      </section>
      <section className="band-light py-12">
        <div className="page grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <Tabs items={[
              { id: "payments", label: "Payments", count: pending.length + settled.length, content: (
                <div className="border-t border-lichen">
                  {pending.length + settled.length === 0 ? <div className="py-5"><Empty>No payments yet.</Empty></div> : null}
                  {pending.map((x) => row(x, "releasable"))}
                  {settled.map((x) => row(x, "paid"))}
                </div>
              ) },
              { id: "activity", label: "Activity", count: money.length, content: (
                <ol className="border-t border-lichen">
                  {money.length === 0 ? <li className="py-5"><Empty>No treasury activity yet.</Empty></li> : null}
                  {money.map((e) => (
                    <li key={e.n} className="grid grid-cols-[1fr_auto] gap-4 border-b border-lichen py-3">
                      <span className="t-body">{e.kind === "TREASURY_FUNDED" ? "Funded" : e.kind === "SETTLED" ? "Paid to a provider" : e.kind === "PAYMENT_RELEASABLE" ? "Made releasable" : "Refunded on dissolution"}</span>
                      <span className="t-small text-graphite">{gen(e.detail)} · {moment(e.at)}</span>
                    </li>
                  ))}
                </ol>
              ) },
            ]} />
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="!p-6 border border-lichen">
              <p className="t-label text-graphite">Fund</p>
              {acts?.fund ? (
                <div className="mt-5">
                  <Act label="Fund the treasury" method="fund_treasury" value={parseGen(amount) ?? 0n}
                       prepare={() => ((parseGen(amount) ?? 0n) > 0n ? [oid] : "Send some GEN.")}
                       onAnswer={() => { invalidateReads(); org.reload(); events.reload(); }}>
                    <Field label="Amount, GEN"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                  </Act>
                </div>
              ) : <p className="t-body mt-5 text-graphite">{w.address ? "Funding is closed for this organisation." : "Connect a wallet to fund it."}</p>}
            </Card>
          </aside>
        </div>
      </section>
    </>
  );
}
