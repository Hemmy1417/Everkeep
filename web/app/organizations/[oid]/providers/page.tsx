"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Band, Card, Empty, Field, Loading, Status, Tag } from "@/components/bits";
import { orgActs } from "@/lib/acts";
import { maintenanceType, moment, shortAddress } from "@/lib/present";
import { getConstitution, getOrganization, invalidateReads, listProviders } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useNow } from "@/lib/useNow";
import { useWallet } from "@/lib/wallet";

export default function Providers() {
  const { oid } = useParams<{ oid: string }>();
  const w = useWallet();
  const clock = useNow();
  const org = useChain(`org.${oid}`, (f) => getOrganization(oid, f));
  const v = org.data?.constitution_version;
  const c = useChain(v ? `c.${oid}.${v}` : null, (f) => getConstitution(oid, v!, f));
  const providers = useChain(`providers.${oid}`, (f) => listProviders(oid, f));
  const [addr, setAddr] = useState("");
  const [name, setName] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  if (!org.data || !c.data) return <Band dark><Loading what="the provider registry" dark /></Band>;
  const acts = orgActs(org.data, c.data, w.address, Math.max(Date.parse(org.data.now), clock));
  const reload = () => { invalidateReads(); providers.reload(); };
  const approved = c.data.eligibility_rules.approved_maintenance_types;

  return (
    <>
      <section className="band-dark">
        <div className="page py-14 md:py-20">
          <Tag dark>Service providers</Tag>
          <h1 className="t-display mt-6 max-w-[18ch]">Who may be paid, and for what.</h1>
          <p className="t-body-lg mt-6 max-w-[62ch] text-haze">
            Stewards authorise providers for named kinds of work. A work order can be assigned only to an
            authorised provider, for work they are authorised for. Revoking stops new assignments; work
            already assigned runs to its end, so a revocation can never be used to avoid paying for work done.
          </p>
        </div>
      </section>
      <Band>
        <div className="flex flex-col gap-4">
          {providers.data?.total === 0 ? <Empty>No provider has been authorised yet.</Empty> : null}
          {providers.data?.providers.map((p) => (
            <Card key={p.address} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Status>{p.revoked_at ? "Revoked" : "Authorised"}</Status>
                  <span className="t-label text-graphite">{shortAddress(p.address)}</span>
                </div>
                <p className="t-heading mt-3">{p.name}</p>
                <p className="t-small mt-2 text-graphite">
                  {p.maintenance_types.map(maintenanceType).join(", ")}. Authorised {moment(p.authorized_at)}
                  {p.revoked_at ? `; revoked ${moment(p.revoked_at)}` : ""}.
                </p>
              </div>
              {acts.revokeProvider && !p.revoked_at ? (
                <Act label="Revoke" method="revoke_provider" variant="secondary" args={[oid, p.address]} onAnswer={reload} />
              ) : null}
            </Card>
          ))}
          {acts.authorizeProvider ? (
            <Card tone="tissue">
              <p className="t-sub">Authorise a provider.</p>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <Field label="Wallet" hint="Not a steward."><input className="font-mono" value={addr} placeholder="0x…" onChange={(e) => setAddr(e.target.value)} /></Field>
                <Field label="Name"><input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></Field>
              </div>
              <div className="mt-5">
                <Field label="Authorised for">
                  <div className="flex flex-wrap gap-2">
                    {approved.map((t) => {
                      const on = types.includes(t);
                      return (
                        <button key={t} type="button" aria-pressed={on} onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}
                                className={`t-label rounded-full border px-3 py-1.5 ${on ? "border-ink bg-ink text-paper" : "border-lichen text-graphite"}`}>
                          {maintenanceType(t)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
              <div className="mt-6">
                <Act label="Authorise" method="authorize_provider" onAnswer={reload}
                     prepare={() => (!/^0x[0-9a-fA-F]{40}$/.test(addr.trim()) ? "Enter the provider's wallet."
                       : !name.trim() ? "Name the provider." : !types.length ? "Choose the work they may do."
                       : [oid, addr.trim(), JSON.stringify({ name: name.trim(), maintenance_types: types })])} />
              </div>
            </Card>
          ) : null}
        </div>
      </Band>
    </>
  );
}
