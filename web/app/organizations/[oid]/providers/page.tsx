"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Band, Button, Card, Empty, Field, Loading, Status } from "@/components/bits";
import { Info } from "@/components/tabs";
import { orgActs } from "@/lib/acts";
import { maintenanceType, moment } from "@/lib/present";
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
  const [adding, setAdding] = useState(false);
  if (!org.data || !c.data) return <Band dark><Loading what="the provider registry" dark /></Band>;
  const acts = orgActs(org.data, c.data, w.address, Math.max(Date.parse(org.data.now), clock));
  const reload = () => { invalidateReads(); providers.reload(); };
  const approved = c.data.eligibility_rules.approved_maintenance_types;

  return (
    <>
      <section className="band-dark">
        <div className="page pb-12 pt-12">
          <p className="t-label text-haze">Service providers
            <Info dark>A work order goes only to a provider authorised for that kind of work. Revoking stops new assignments; work already assigned runs to its end, so a revocation cannot avoid paying for work done.</Info>
          </p>
          <h1 className="t-heading-lg mt-5">Who may be paid, and for what.</h1>
        </div>
      </section>
      <Band>
        <div className="flex flex-col gap-4">
          {providers.data?.total === 0 ? <Empty>No provider has been authorised yet.</Empty> : null}
          <div className="border-t border-lichen">
            {providers.data?.providers.map((p) => (
              <div key={p.address} className="grid items-center gap-3 border-b border-lichen py-4 md:grid-cols-[2fr_2fr_1fr_auto]">
                <div><p className="t-sub">{p.name}</p><p className="t-small text-graphite">Authorised {moment(p.authorized_at)}{p.revoked_at ? `, revoked ${moment(p.revoked_at)}` : ""}</p></div>
                <span className="t-small text-graphite">{p.maintenance_types.map(maintenanceType).join(", ")}</span>
                <div><Status>{p.revoked_at ? "Revoked" : "Authorised"}</Status></div>
                <div>{acts.revokeProvider && !p.revoked_at ? <Act label="Revoke" method="revoke_provider" variant="secondary" args={[oid, p.address]} onAnswer={reload} /> : null}</div>
              </div>
            ))}
          </div>
          {acts.authorizeProvider && !adding ? <div className="mt-2"><Button variant="secondary" onClick={() => setAdding(true)}>Authorise a provider</Button></div> : null}
          {acts.authorizeProvider && adding ? (
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
                <Act label="Authorise" method="authorize_provider" onAnswer={() => { setAdding(false); reload(); }}
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
