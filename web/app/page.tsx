"use client";

import Link from "next/link";

import { Arrow, Band, Card, Counter, Empty, Hairline, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { Cycle } from "@/components/lifecycle";
import { FEATURED_ORG } from "@/lib/config";
import { eventKind, gen, maintenanceType, moment, orderState, orgState, outcome, plural } from "@/lib/present";
import { getEvents, getOrganization, listAssets, listWorkOrders } from "@/lib/read";
import { useChain } from "@/lib/useChain";

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2 border-t border-graphite pt-4">
      <dt className="t-label text-haze">{label}</dt>
      <dd className="t-heading">{value}</dd>
      {note ? <dd className="t-small text-haze">{note}</dd> : null}
    </div>
  );
}

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
        <div className="page pb-20 pt-14 md:pb-28 md:pt-20">
          <Tag dark>Autonomous infrastructure stewardship on GenLayer</Tag>
          <h1 className="t-hero mt-8 max-w-[13ch]">Infrastructure that keeps itself maintained.</h1>
          <p className="t-heading mt-16 max-w-[34ch] text-haze">
            A community fund with a constitution, a treasury and a registry of what it maintains. Code
            enforces the rules that can be counted. Validators judge whether the work was done.
          </p>
        </div>
      </section>

      <section className="band-dark border-t border-graphite">
        <div className="page py-16 md:py-20">
          {org.loading ? <Loading what="the organisation" dark /> : null}
          {org.error ? <ReadFailure what="the organisation" detail={String((org.error as Error).message)} /> : null}
          {!org.loading && !o ? <p className="t-body text-haze">No organisation has been founded on this deployment yet. <Link className="underline" href="/organizations/new">Found one</Link>.</p> : null}
          {o ? (
            <>
              <div className="flex flex-wrap items-center gap-5">
                <Status dark>{orgState(o.state)}</Status>
                <span className="t-label text-haze">Constitution {o.constitution_version} · decision engine: GenLayer</span>
              </div>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
                <div>
                  <h2 className="t-display max-w-[20ch]">{o.name}</h2>
                  <p className="t-body-lg mt-5 max-w-[62ch] text-haze">{o.mission}</p>
                </div>
                <Link href={`/organizations/${oid}`} className="t-label rounded-[8px] bg-paper px-4 py-2.5 text-ink">Open the organisation</Link>
              </div>
              <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
                <Figure label="Treasury" value={gen(o.escrow_wei)} note={`${gen(o.spendable_wei)} free to commit`} />
                <Figure label="Active infrastructure" value={String(o.asset_count)} />
                <Figure label="Open work orders" value={String(o.open_work_orders)} note={`${gen(o.committed_wei)} committed`} />
                <Figure label="Maintenance spend" value={gen(o.paid_wei)} note={`${gen(o.releasable_wei)} releasable`} />
                <Figure label="Decisions pending finality" value={String(o.pending_decisions)} />
                <Figure label="Appeals open" value={String(o.open_appeals)} />
                <Figure label="Authorised providers" value={String(o.provider_count)} />
                <Figure label="Work orders to date" value={String(o.work_order_count)} />
              </dl>
            </>
          ) : null}
        </div>
      </section>

      {o ? (
        <Band>
          <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
            <div>
              <Counter n={1} of={2} />
              <h2 className="t-heading-lg mt-6">Current work.</h2>
              <div className="mt-8">
                {orders.data?.total === 0 ? <Empty>No work has been commissioned yet.</Empty> : null}
                {orders.data?.work_orders.map((w) => (
                  <div key={w.work_order_id} className="grid grid-cols-[1fr_auto] items-center gap-5 border-t border-lichen py-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Status>{orderState(w.state)}</Status>
                        {w.current_outcome ? <span className="t-label text-graphite">Latest decision: {outcome(w.current_outcome).toLowerCase()}</span> : null}
                      </div>
                      <p className="t-sub mt-2">{w.title}</p>
                      <p className="t-label mt-1 text-graphite">{maintenanceType(w.maintenance_type)} · {gen(w.payment_wei)}</p>
                    </div>
                    <Arrow href={`/work-orders/${w.work_order_id}`} label={`Open ${w.title}`} />
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Counter n={2} of={2} />
                <h2 className="t-heading-lg mt-6">Infrastructure.</h2>
                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  {assets.data?.assets.map((a) => (
                    <Card key={a.asset_id} className="flex flex-col gap-3">
                      <Tag>{a.status === "UNDER_MAINTENANCE" ? "Under maintenance" : a.status === "SERVICE_DUE" ? "Service due" : a.status === "RETIRED" ? "Retired" : "Monitoring"}</Tag>
                      <p className="t-sub">{a.name}</p>
                      <p className="t-small text-graphite">
                        {a.last_serviced_at ? `Last serviced ${moment(a.last_serviced_at)}` : "No service recorded yet"}
                        {a.next_service_due ? `. Next due ${moment(a.next_service_due)}.` : "."}
                      </p>
                      <div className="mt-auto"><Arrow href={`/assets/${a.asset_id}`} label={`Open ${a.name}`} /></div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
            <aside>
              <Tag>Recent activity</Tag>
              <ol className="mt-6">
                {events.loading ? <Loading what="the record" /> : null}
                {events.data?.events.map((e) => (
                  <li key={e.n} className="border-t border-lichen py-3">
                    <p className="t-body">{eventKind(e.kind)}</p>
                    <p className="t-label mt-1 text-graphite">{moment(e.at)}</p>
                  </li>
                ))}
              </ol>
              <p className="t-small mt-4 text-graphite">{plural(events.data?.total ?? 0, "event")} on the record.</p>
            </aside>
          </div>
        </Band>
      ) : null}

      <Band dark>
        <Tag dark>The cycle</Tag>
        <h2 className="t-heading-lg mt-6 max-w-[22ch]">One finished cycle leaves the organisation ready for the next.</h2>
        <div className="mt-10"><Cycle dark /></div>
        <Hairline dark className="mt-12" />
        <p className="t-body mt-8 max-w-[70ch] text-haze">
          It is designed to keep its mission without a permanent operator, for as long as its treasury,
          its rules and the network hold. It does not claim more than that, and GenLayer does not
          guarantee physical truth: it decides whether the evidence filed establishes the work.
        </p>
      </Band>
    </>
  );
}
