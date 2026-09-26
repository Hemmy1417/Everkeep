"use client";

import { Arrow, Band, Button, Card, Counter, Hairline, Loading, Tag } from "@/components/bits";
import { gen, orgState, plural } from "@/lib/present";
import { getStats, listOrganizations } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import Link from "next/link";

export default function Home() {
  const stats = useChain("stats", (f) => getStats(f));
  const orgs = useChain("orgs.home", (f) => listOrganizations(0, 3, f));

  return (
    <>
      <section className="band-dark">
        <div className="page pb-24 pt-16 md:pb-40 md:pt-24">
          <Tag dark>Constitutional stewardship on GenLayer</Tag>
          <h1 className="t-hero mt-8 max-w-[11ch]">Paid when the work keeps the rules.</h1>
          <div className="mt-24 grid gap-10 md:mt-48 md:grid-cols-[1fr_1fr]">
            <p className="t-heading text-haze">
              A community fund ratifies a constitution. Code enforces what can be counted. A panel
              of validators judges what has to be seen.
            </p>
            <div className="flex flex-col justify-end gap-6">
              <p className="t-body text-lichen">
                Solar arrays, batteries, water systems: the maintenance a community pays for is
                judged against the rules it wrote, on photographs the contract holds itself. No one
                holds a key that can pay.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/organizations" className="t-label rounded-[8px] bg-paper px-4 py-2.5 text-ink">
                  See the organisations
                </Link>
                <Link href="/organizations/new" className="t-label rounded-[8px] border border-graphite px-4 py-2.5 text-paper">
                  Found one
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Band dark className="border-t border-graphite">
        <Counter n={1} of={3} dark />
        <div className="mt-8 grid gap-12 md:grid-cols-[1fr_1fr]">
          <h2 className="t-heading-lg">Two halves of one rulebook.</h2>
          <div className="flex flex-col gap-10">
            <div>
              <Tag dark>Enforced in code</Tag>
              <p className="t-body-lg mt-4">
                Which infrastructure the fund supports, which maintenance it pays for, the most one
                work order may pay, how many may be open, what evidence must be on file, how long
                an appeal window runs, and who the stewards are.
              </p>
              <p className="t-small mt-3 text-haze">Refused in words at the write it governs. No panel is asked.</p>
            </div>
            <Hairline dark />
            <div>
              <Tag dark>Judged by a panel</Tag>
              <p className="t-body-lg mt-4">
                Numbered maintenance principles, such as every replaced inverter being identifiable
                from its own rating plate, rated one at a time against the photographs and the
                independent inspector&apos;s report.
              </p>
              <p className="t-small mt-3 text-haze">Kept, broken, does not apply, or not settled. Code decides what counts.</p>
            </div>
          </div>
        </div>
      </Band>

      <Band dark className="border-t border-graphite">
        <Counter n={2} of={3} dark />
        <div className="mt-8 grid gap-12 md:grid-cols-[1fr_1fr]">
          <h2 className="t-heading-lg">A decision made in code.</h2>
          <ol className="flex flex-col">
            {[
              ["Observations conflict", "Undetermined"],
              ["A criterion unmet, or a principle broken", "Rejected"],
              ["Anything left unsettled", "Undetermined"],
              ["Everything met and kept", "Accepted"],
            ].map(([when, then], i) => (
              <li key={when} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-5 border-t border-graphite py-5">
                <span className="t-label text-haze">{String(i + 1).padStart(2, "0")}</span>
                <span className="t-body-lg">{when}</span>
                <span className="t-label text-lichen">{then}</span>
              </li>
            ))}
            <li className="border-t border-graphite pt-5 t-small text-haze">
              A finding stands only on a photograph or the inspector&apos;s report. A party&apos;s own
              paperwork can neither prove nor disprove anything, whoever wrote it.
            </li>
          </ol>
        </div>
      </Band>

      <Band>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Counter n={3} of={3} />
            <h2 className="t-heading-lg mt-8">On the record.</h2>
          </div>
          {stats.data ? (
            <dl className="grid grid-cols-3 gap-8">
              <div><dt className="t-label text-graphite">Organisations</dt><dd className="t-sub mt-1">{stats.data.organizations}</dd></div>
              <div><dt className="t-label text-graphite">Rounds judged</dt><dd className="t-sub mt-1">{stats.data.rounds}</dd></div>
              <div><dt className="t-label text-graphite">Paid out</dt><dd className="t-sub mt-1">{gen(stats.data.paid_wei)}</dd></div>
            </dl>
          ) : null}
        </div>
        <div className="mt-12 flex flex-col gap-4">
          {orgs.loading ? <Loading what="the organisations" /> : null}
          {orgs.data?.organizations.map((o) => (
            <Card key={o.organization_id} className="flex flex-wrap items-center justify-between gap-6">
              <div className="min-w-0">
                <Tag>{orgState(o.state)}</Tag>
                <p className="t-heading mt-3">{o.name}</p>
                <p className="t-small mt-2 text-graphite">
                  {plural(o.assets, "asset")}, {plural(o.work_orders, "work order")}, {gen(o.available_wei)} uncommitted
                </p>
              </div>
              <Arrow href={`/organizations/${o.organization_id}`} label={`Open ${o.name}`} />
            </Card>
          ))}
          {orgs.data && orgs.data.total > 3 ? (
            <div><Link href="/organizations"><Button variant="secondary">All {orgs.data.total} organisations</Button></Link></div>
          ) : null}
        </div>
      </Band>
    </>
  );
}
