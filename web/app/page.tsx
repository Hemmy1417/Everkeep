"use client";

import Link from "next/link";

import { Arrow, Band, Empty, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { Info, Stat, Tabs } from "@/components/tabs";
import { Cycle } from "@/components/lifecycle";
import { FEATURED_ORG } from "@/lib/config";
import { assetStatus, day, eventKind, gen, maintenanceType, moment, orderState, orgState, outcome } from "@/lib/present";
import { getEvents, getOrganization, listAssets, listWorkOrders } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function Dashboard() {
  const oid = FEATURED_ORG;
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const orders = useChain(`orders.${oid}.home`, (f) => listWorkOrders(oid, 0, 8, f));
  const assets = useChain(`assets.${oid}.home`, (f) => listAssets(oid, 0, 6, f));
  const events = useChain(`events.${oid}.home`, (f) => getEvents(oid, 0, 12, f));
  const o = org.data;

  return (
    <>
      <section className="band-dark">
        <div className="page pb-14 pt-14 md:pb-16 md:pt-20">
          <Tag dark>Autonomous infrastructure stewardship on GenLayer</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">Infrastructure that keeps itself maintained.</h1>
          <p className="t-body-lg mt-6 max-w-[52ch] text-haze">
            A community fund run by its constitution. Code enforces the rules; validators judge the work.
          </p>
        </div>
      </section>

      <section className="band-dark border-t border-graphite">
        <div className="page py-12">
          {org.loading ? <Loading what="the organisation" dark /> : null}
          {org.error ? <ReadFailure what="the organisation" detail={String((org.error as Error).message)} /> : null}
          {!org.loading && !o ? <p className="t-body text-haze">No organisation has been founded on this deployment yet. <Link className="underline" href="/organizations/new">Found one</Link>.</p> : null}
          {o ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <Status dark>{orgState(o.state)}</Status>
                  <h2 className="t-heading-lg mt-4 max-w-[24ch]">{o.name}</h2>
                  <p className="t-body mt-3 line-clamp-2 max-w-[60ch] text-haze">{o.mission}</p>
                </div>
                <Link href={`/organizations/${oid}`} className="t-label rounded-[8px] bg-paper px-4 py-2.5 text-ink">Open the organisation</Link>
              </div>
              <dl className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
                <Stat dark label="Treasury" value={gen(o.escrow_wei)} info={`${gen(o.spendable_wei)} is free to commit to new work.`} />
                <Stat dark label="Open work" value={o.open_work_orders} info={`${gen(o.committed_wei)} committed. ${o.pending_decisions} decision${o.pending_decisions === 1 ? "" : "s"} awaiting finality, ${o.open_appeals} appeal${o.open_appeals === 1 ? "" : "s"} open.`} />
                <Stat dark label="Paid out" value={gen(o.paid_wei)} info={`${gen(o.releasable_wei)} releasable now.`} />
                <Stat dark label="Infrastructure" value={o.asset_count} info={`${o.provider_count} authorised provider${o.provider_count === 1 ? "" : "s"}, ${o.work_order_count} work order${o.work_order_count === 1 ? "" : "s"} to date.`} />
              </dl>
            </>
          ) : null}
        </div>
      </section>

      {o ? (
        <section className="band-light py-12">
          <div className="page">
            <Tabs items={[
              { id: "work", label: "Current work", count: orders.data?.total, content: (
                <div className="border-t border-lichen">
                  {orders.data?.total === 0 ? <div className="py-5"><Empty>No work has been commissioned yet.</Empty></div> : null}
                  {orders.data?.work_orders.map((w) => (
                    <div key={w.work_order_id} className="grid items-center gap-3 border-b border-lichen py-4 md:grid-cols-[2fr_1fr_1fr_auto]">
                      <div className="min-w-0"><p className="t-sub">{w.title}</p><p className="t-small text-graphite">{maintenanceType(w.maintenance_type)}</p></div>
                      <div><Status>{w.current_outcome && w.state !== "SETTLED" ? outcome(w.current_outcome) : orderState(w.state)}</Status></div>
                      <span className="t-small text-graphite">{gen(w.payment_wei)}</span>
                      <Arrow href={`/work-orders/${w.work_order_id}`} label={`Open ${w.title}`} />
                    </div>
                  ))}
                </div>
              ) },
              { id: "infrastructure", label: "Infrastructure", count: assets.data?.total, content: (
                <div className="border-t border-lichen">
                  {assets.data?.assets.map((a) => (
                    <div key={a.asset_id} className="grid items-center gap-3 border-b border-lichen py-4 md:grid-cols-[2fr_1fr_1fr_auto]">
                      <p className="t-sub">{a.name}</p>
                      <div><Status>{assetStatus(a.status)}</Status></div>
                      <span className="t-small text-graphite">{a.next_service_due ? `Next due ${day(a.next_service_due)}` : "No schedule"}</span>
                      <Arrow href={`/assets/${a.asset_id}`} label={`Open ${a.name}`} />
                    </div>
                  ))}
                </div>
              ) },
              { id: "activity", label: "Activity", content: (
                <ol className="border-t border-lichen">
                  {events.loading ? <Loading what="the record" /> : null}
                  {events.data?.events.slice(0, 8).map((e) => (
                    <li key={e.n} className="grid gap-1 border-b border-lichen py-3 md:grid-cols-[1fr_240px]">
                      <span className="t-body">{eventKind(e.kind)}</span>
                      <span className="t-small text-graphite md:text-right">{moment(e.at)}</span>
                    </li>
                  ))}
                </ol>
              ) },
            ]} />
          </div>
        </section>
      ) : null}

      <Band dark>
        <p className="t-label text-haze">The cycle
          <Info dark>It keeps its mission without a permanent operator, for as long as its treasury, its rules and the network hold. GenLayer decides whether the evidence establishes the work; it does not guarantee physical truth.</Info>
        </p>
        <div className="mt-8"><Cycle dark /></div>
      </Band>
    </>
  );
}
