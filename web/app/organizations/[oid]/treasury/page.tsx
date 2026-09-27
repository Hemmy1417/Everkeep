"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Arrow, Band, Card, Empty, Fact, Field, Loading, Tag } from "@/components/bits";
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

  return (
    <>
      <section className="band-dark">
        <div className="page py-14 md:py-20">
          <Tag dark>Treasury</Tag>
          <h1 className="t-display mt-6">{gen(o.escrow_wei)}</h1>
          <p className="t-body-lg mt-6 max-w-[62ch] text-haze">
            Held by the contract. A work order commits its payment when it is created; only a finalized acceptance
            makes it releasable, and only a settlement pays it. There is no withdrawal and no owner.
          </p>
          <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-graphite pt-8 md:grid-cols-5">
            <Fact dark label="Committed to open work">{gen(o.committed_wei)}</Fact>
            <Fact dark label="Of which releasable">{gen(o.releasable_wei)}</Fact>
            <Fact dark label="Available">{gen(o.available_wei)}</Fact>
            <Fact dark label="Free to commit, above the reserve">{gen(o.spendable_wei)}</Fact>
            <Fact dark label="Paid to providers">{gen(o.paid_wei)}</Fact>
          </dl>
        </div>
      </section>
      <Band>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <Tag>Pending payments</Tag>
            <div className="mt-5">
              {pending.length === 0 ? <Empty>Nothing is waiting to be settled.</Empty> : null}
              {pending.map((x) => (
                <div key={x.work_order_id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-lichen py-4">
                  <div><p className="t-body">{x.title}</p><p className="t-label mt-1 text-graphite">{gen(x.payment_wei)} releasable; anyone may settle it</p></div>
                  <Arrow href={`/work-orders/${x.work_order_id}`} label={`Open ${x.title}`} />
                </div>
              ))}
            </div>
            <div className="mt-8"><Tag>Finalized payments</Tag></div>
            <div className="mt-5">
              {settled.length === 0 ? <Empty>No payment has been settled yet.</Empty> : null}
              {settled.map((x) => (
                <div key={x.work_order_id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-lichen py-4">
                  <div><p className="t-body">{x.title}</p><p className="t-label mt-1 text-graphite">{gen(x.payment_wei)} paid</p></div>
                  <Arrow href={`/work-orders/${x.work_order_id}`} label={`Open ${x.title}`} />
                </div>
              ))}
            </div>
          </Card>
          <Card tone="tissue">
            <Tag>Recent treasury activity</Tag>
            <ol className="mt-5">
              {money.length === 0 ? <Empty>No treasury activity yet.</Empty> : null}
              {money.map((e) => (
                <li key={e.n} className="grid grid-cols-[1fr_auto] gap-4 border-t border-lichen py-3">
                  <span className="t-body">{e.kind === "TREASURY_FUNDED" ? "Funded" : e.kind === "SETTLED" ? "Paid to a provider" : e.kind === "PAYMENT_RELEASABLE" ? "Made releasable" : "Refunded on dissolution"}</span>
                  <span className="t-label text-graphite">{gen(e.detail)} · {moment(e.at)}</span>
                </li>
              ))}
            </ol>
            {acts?.fund ? (
              <div className="mt-8 border-t border-lichen pt-6">
                <Act label="Fund the treasury" method="fund_treasury" value={parseGen(amount) ?? 0n}
                     prepare={() => ((parseGen(amount) ?? 0n) > 0n ? [oid] : "Send some GEN.")}
                     onAnswer={() => { invalidateReads(); org.reload(); events.reload(); }}>
                  <p className="t-sub">Anyone may add to it.</p>
                  <Field label="Amount, GEN"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
                </Act>
              </div>
            ) : null}
          </Card>
        </div>
      </Band>
    </>
  );
}
