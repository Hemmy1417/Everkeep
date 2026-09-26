"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Band, Card, Field, Loading, Tag } from "@/components/bits";
import { ConstitutionForm, constitutionJson, draftFrom, type ConstitutionDraft } from "@/components/ConstitutionForm";
import { invalidateReads, getConfig } from "@/lib/read";
import { parseGen } from "@/lib/present";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export default function Found() {
  const w = useWallet();
  const router = useRouter();
  const config = useChain("config", () => getConfig());
  const [draft, setDraft] = useState<ConstitutionDraft>(() => draftFrom(null, ""));
  const [fund, setFund] = useState("0");

  // The founder sits among the stewards: until someone is named, the connected wallet is.
  const shown = draft.stewards.some((s) => s.trim()) || !w.address ? draft : { ...draft, stewards: [w.address] };

  const value = parseGen(fund) ?? 0n;

  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>Found an organisation</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">Write the rules before the money moves.</h1>
          <p className="t-body-lg mt-10 max-w-[56ch] text-haze">
            Signing this ratifies the first constitution and, if you send value, funds the treasury in
            the same act. You become the first steward and nothing more: from here on the
            constitution governs.
          </p>
        </div>
      </section>
      <Band>
        {!config.data ? <Loading what="the contract's limits" /> : (
          <div className="flex flex-col gap-8">
            <Card><ConstitutionForm config={config.data} draft={shown} onChange={setDraft} /></Card>
            <Card tone="tissue">
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Opening treasury, GEN" hint="Anyone can add to the treasury later. Nothing leaves it except a finalized payment.">
                  <input inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} />
                </Field>
                <Act label="Ratify and found" method="create_organization" value={value}
                     working="One validator set checks the constitution and records it."
                     prepare={() => {
                       const json = constitutionJson(shown);
                       if (!json.startsWith("{")) return json;
                       if (parseGen(fund) === null) return "The opening treasury must be an amount of GEN.";
                       return [json];
                     }}
                     onAnswer={(a) => {
                       invalidateReads();
                       const oid = a && !a.refused ? String(a.organization_id ?? "") : "";
                       if (oid) router.push(`/organizations/${oid}`);
                     }} />
              </div>
            </Card>
          </div>
        )}
      </Band>
    </>
  );
}
