"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Info, Stat } from "@/components/tabs";
import { Act } from "@/components/Act";
import { Arrow, Band, Card, Empty, Field, Loading, Status, Tag } from "@/components/bits";
import { acting, assetActs, isSteward } from "@/lib/acts";
import { assetStatus, infraType, maintenanceType, day, moment, orderState, outcome } from "@/lib/present";
import { getAsset, getOrganization, invalidateReads, listWorkOrders } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

const MARK: Record<string, string> = { ACCEPTED: "Accepted and paid for", REJECTED: "Rejected", UNDETERMINED: "Undetermined",
                                       CLOSED: "Closed without a decision", CANCELLED: "Cancelled" };

export default function AssetPage() {
  const { aid } = useParams<{ aid: string }>();
  const w = useWallet();
  const asset = useChain(`asset.${aid}`, (f) => getAsset(aid, f));
  const a = asset.data;
  const org = useChain(a ? `org.${a.organization_id}` : null, (f) => getOrganization(a!.organization_id, f));
  const orders = useChain(a ? `orders.${a.organization_id}` : null, (f) => listWorkOrders(a!.organization_id, 0, 50, f));
  const [why, setWhy] = useState("");
  if (asset.loading) return <Band dark><Loading what="the asset" dark /></Band>;
  if (!a) return <Band><Empty>There is no such asset on this deployment.</Empty></Band>;
  const mine = (orders.data?.work_orders ?? []).filter((x) => x.asset_id === aid);
  const open = mine.filter((x) => !["SETTLED", "CLOSED_UNPAID", "CANCELLED"].includes(x.state));
  const acts = org.data ? assetActs(a, org.data, w.address) : null;
  const steward = org.data ? isSteward(acting(org.data), w.address) : false;
  const reload = () => { invalidateReads(); asset.reload(); };

  return (
    <>
      <section className="band-dark">
        <div className="page pb-12 pt-12">
          <div className="flex flex-wrap items-center gap-5">
            <Status dark>{assetStatus(a.status)}</Status>
            <Tag dark>{infraType(a.asset_type)}</Tag>
            {org.data ? <Link href={`/organizations/${a.organization_id}`} className="t-label text-haze underline underline-offset-4">{org.data.name}</Link> : null}
          </div>
          <h1 className="t-heading-lg mt-5 max-w-[24ch]">{a.name}</h1>
          {a.description ? <p className="t-body mt-3 line-clamp-2 max-w-[60ch] text-haze">{a.description}</p> : null}
          <p className="t-small mt-3 text-haze">{[a.location_reference, a.operator].filter(Boolean).join(" · ")}</p>
          <dl className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-3">
            <Stat dark label="Last serviced" value={a.last_serviced_at ? day(a.last_serviced_at) : "Not yet"} />
            <Stat dark label="Next due" value={a.next_service_due ? day(a.next_service_due) : "None"} info={a.maintenance_interval_days ? `Serviced every ${a.maintenance_interval_days} days.` : "No service interval."} />
            <Stat dark label="Service records" value={a.service_log.length} />
          </dl>
        </div>
      </section>

      <Band>
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <div>
            <Tag>Maintenance timeline</Tag>
            <ol className="mt-6">
              <li className="grid grid-cols-[auto_1fr] gap-5 border-t border-lichen py-4">
                <span aria-hidden className="mt-2 inline-block h-2 w-2 rounded-full bg-ink" />
                <div><p className="t-body">Enrolled</p><p className="t-label mt-1 text-graphite">{moment(a.enrolled_at)}{a.installation_date ? ` · installed ${a.installation_date}` : ""}</p></div>
              </li>
              {a.service_log.map((s) => (
                <li key={s.work_order_id + s.at} className="grid grid-cols-[auto_1fr_auto] items-start gap-5 border-t border-lichen py-4">
                  <span aria-hidden className={`mt-2 inline-block h-2 w-2 rounded-full ${s.outcome === "ACCEPTED" ? "bg-ink" : "bg-lichen"}`} />
                  <div>
                    <p className="t-body">{maintenanceType(s.maintenance_type)}: {s.title}</p>
                    <p className="t-label mt-1 text-graphite">{MARK[s.outcome] ?? s.outcome} · {moment(s.at)}</p>
                  </div>
                  <Arrow href={s.decision_id ? `/decisions/${s.decision_id}` : `/work-orders/${s.work_order_id}`} label="Open the record" />
                </li>
              ))}
              {open.map((x) => (
                <li key={x.work_order_id} className="grid grid-cols-[auto_1fr_auto] items-start gap-5 border-t border-lichen py-4">
                  <span aria-hidden className="mt-2 inline-block h-2 w-2 rounded-full bg-lime" />
                  <div>
                    <p className="t-body">{maintenanceType(x.maintenance_type)}: {x.title}</p>
                    <p className="t-label mt-1 text-graphite">{orderState(x.state)}{x.current_outcome ? ` · ${outcome(x.current_outcome).toLowerCase()}` : ""}</p>
                  </div>
                  <Arrow href={`/work-orders/${x.work_order_id}`} label={`Open ${x.title}`} />
                </li>
              ))}
              {a.next_service_due && a.status !== "RETIRED" ? (
                <li className="grid grid-cols-[auto_1fr] gap-5 border-t border-lichen py-4">
                  <span aria-hidden className="mt-2 inline-block h-2 w-2 rounded-full border border-lichen" />
                  <div><p className="t-body text-graphite">Next scheduled service</p><p className="t-label mt-1 text-graphite">due {moment(a.next_service_due)}</p></div>
                </li>
              ) : null}
            </ol>
            {steward && org.data?.state === "ACTIVE" && !a.retired_at ? (
              <Link href={`/organizations/${a.organization_id}/work-orders/new?asset=${aid}`} className="t-label mt-8 inline-block rounded-[8px] bg-ink px-4 py-2.5 text-paper">Commission the next service</Link>
            ) : null}
          </div>
          <aside className="flex flex-col gap-6">
            <Card tone="tissue">
              <Tag>Technical profile</Tag>
              <p className="t-body mt-4">{a.technical_profile || "Not given."}</p>

            </Card>
            <Card>
              <Tag>Independent inspector</Tag><Info>Their reports and checklists can establish findings once they accept the role.</Info>
              <p className="t-body mt-4">
                {!a.inspector ? "None named. Findings rest on photographs alone."
                  : a.inspector_accepted_at ? `Accepted ${moment(a.inspector_accepted_at)}.`
                  : "Named, not yet accepted."}
              </p>
              {acts?.acceptInspector ? <div className="mt-5"><Act label="Accept the inspector role" method="accept_inspector_role" args={[aid]} onAnswer={reload} /></div> : null}
            </Card>
            {acts?.retire ? (
              <Card>
                <Act label="Retire this asset" method="retire_asset" variant="secondary" prepare={() => [aid, why.trim()]} onAnswer={reload}>
                  <p className="t-small text-graphite">A retired asset takes no new work; its history stays.</p>
                  <Field label="Reason"><input value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
                </Act>
              </Card>
            ) : null}
          </aside>
        </div>
      </Band>
    </>
  );
}

