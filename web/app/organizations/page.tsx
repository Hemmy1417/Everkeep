"use client";

import Link from "next/link";

import { Arrow, Band, Card, Empty, Loading, ReadFailure, Status, Tag } from "@/components/bits";
import { gen, orgState, plural } from "@/lib/present";
import { listOrganizations } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function Organizations() {
  const orgs = useChain("orgs.all", (f) => listOrganizations(0, 50, f));
  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>Organisations</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">Funds that answer to their own rules.</h1>
          <Link href="/organizations/new" className="t-label mt-10 inline-block rounded-[8px] bg-paper px-4 py-2.5 text-ink">Found an organisation</Link>
        </div>
      </section>
      <Band>
        <div className="flex flex-col gap-4">
          {orgs.loading ? <Loading what="the organisations" /> : null}
          {orgs.error ? <ReadFailure what="the organisations" detail={String((orgs.error as Error).message)} /> : null}
          {orgs.data?.total === 0 ? <Empty>No organisation has been founded on this deployment yet.</Empty> : null}
          {orgs.data?.organizations.map((o) => (
            <Card key={o.organization_id} className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-4">
                  <Status>{orgState(o.state)}</Status>
                  <span className="t-label text-graphite">Constitution {o.constitution_version}</span>
                </div>
                <p className="t-heading mt-3">{o.name}</p>
                <p className="t-body mt-3 max-w-[72ch] text-graphite">{o.mission}</p>
                <p className="t-label mt-5 text-graphite">
                  {gen(o.escrow_wei)} held · {plural(o.asset_count, "asset")} · {plural(o.open_work_orders, "open work order")} · {plural(o.provider_count, "provider")}
                </p>
              </div>
              <Arrow href={`/organizations/${o.organization_id}`} label={`Open ${o.name}`} />
            </Card>
          ))}
        </div>
      </Band>
    </>
  );
}
