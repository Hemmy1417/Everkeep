"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Act } from "@/components/Act";
import { Band, Card, Field, Loading, Tag } from "@/components/bits";
import { ConstitutionForm, constitutionJson, draftFrom, type Draft } from "@/components/ConstitutionForm";
import { parseGen } from "@/lib/present";
import { getConfig, invalidateReads } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export default function Found() {
  const w = useWallet();
  const router = useRouter();
  const config = useChain("config", () => getConfig());
  const [draft, setDraft] = useState<Draft>(() => draftFrom(null, ""));
  const [fund, setFund] = useState("0");
  const [review, setReview] = useState(false);
  const shown = draft.stewards.some((s) => s.trim()) || !w.address ? draft : { ...draft, stewards: [w.address] };
  const json = constitutionJson(shown);

  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>Found an organisation</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">Write the rules before any money moves.</h1>
          <p className="t-body-lg mt-10 max-w-[58ch] text-haze">
            Signing ratifies the first constitution and, if you send value, funds the treasury in the
            same act. You become the first steward and nothing more: from then on the constitution governs.
          </p>
        </div>
      </section>
      <Band>
        {!config.data ? <Loading what="the contract's limits" /> : (
          <div className="flex flex-col gap-8">
            <Card><ConstitutionForm config={config.data} draft={shown} onChange={(d) => { setDraft(d); setReview(false); }} /></Card>
            <Card tone="tissue">
              <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
                <Field label="Opening treasury, GEN" hint="Anyone can add to the treasury later. Nothing leaves it except a settled payment or, on dissolution, the refund to its beneficiary.">
                  <input inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} />
                </Field>
                {!review ? (
                  <button type="button" onClick={() => setReview(true)} className="t-label rounded-[8px] bg-ink px-4 py-2.5 text-paper">Review</button>
                ) : null}
              </div>
              {review ? (
                <div className="mt-8 border-t border-lichen pt-8">
                  {json.startsWith("{") ? (
                    <>
                      <p className="t-sub">The exact constitution the contract will receive.</p>
                      <pre className="t-mono mt-4 max-h-[320px] overflow-auto rounded-[12px] bg-ink p-4 text-lichen">{JSON.stringify(JSON.parse(json), null, 2)}</pre>
                      <div className="mt-6">
                        <Act label="Ratify and found" method="create_organization" value={parseGen(fund) ?? 0n}
                             prepare={() => (parseGen(fund) === null ? "The opening treasury must be an amount of GEN." : [json])}
                             onAnswer={(a) => {
                               invalidateReads();
                               const oid = a && !a.refused ? String(a.organization_id ?? "") : "";
                               if (oid) router.push(`/organizations/${oid}`);
                             }} />
                      </div>
                    </>
                  ) : <p className="t-body">{json}</p>}
                </div>
              ) : null}
            </Card>
          </div>
        )}
      </Band>
    </>
  );
}
