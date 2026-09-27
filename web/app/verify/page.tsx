"use client";

import { Band, Card, Fact, Tag } from "@/components/bits";
import { addressUrl, CHAIN_ID, RPC_URL } from "@/lib/chain";
import { CONTRACT_ADDRESS, IS_RECORD, REPO_URL, SOURCE_SHA256, SOURCE_URL } from "@/lib/config";
import { gen } from "@/lib/present";
import { getConfig, getStats } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function Verify() {
  const config = useChain("config", () => getConfig());
  const stats = useChain("stats", (f) => getStats(f));
  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>Verify</Tag>
          <h1 className="t-display mt-6 max-w-[18ch]">Did this page invent the decision?</h1>
          <p className="t-body-lg mt-8 max-w-[60ch] text-haze">
            No. Every decision is produced by the contract and can be rebuilt from its state and its transactions. This is the
            one page that shows addresses and hashes in full, because they are what you compare.
          </p>
        </div>
      </section>
      <Band>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <dl className="flex flex-col gap-6">
              <Fact label={IS_RECORD ? "Deployment of record" : "Test deployment"}>
                <a className="t-mono break-all underline underline-offset-4" href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a>
              </Fact>
              <Fact label="Network">GenLayer Studio Next, chain {CHAIN_ID}</Fact>
              <Fact label="Read from"><span className="t-mono break-all">{RPC_URL}</span></Fact>
              <Fact label="Source SHA-256"><span className="t-mono break-all">{SOURCE_SHA256}</span></Fact>
              <Fact label="Source"><a className="underline underline-offset-4" href={SOURCE_URL} target="_blank" rel="noreferrer">contracts/everkeep.py</a></Fact>
              <Fact label="Ruleset">{config.data?.ruleset ?? "Reading"}</Fact>
            </dl>
          </Card>
          <Card tone="tissue">
            <p className="t-sub">Check it yourself.</p>
            <p className="t-body mt-4 text-graphite">Fetch the deployed code with the network&apos;s own call and compare it byte for byte with the repository:</p>
            <pre className="t-mono mt-4 overflow-x-auto rounded-[12px] bg-ink p-4 text-lichen">node scripts/deploy.mjs verify {CONTRACT_ADDRESS}</pre>
            <p className="t-body mt-6 text-graphite">
              Then open any decision receipt: it names the organisation, the constitution version, the asset, the work order and its
              version, the provider, the evidence snapshot with every hash, the appeal state and the settlement. Each is read from the
              contract, and the live proof runs with every transaction hash are committed in the repository.
            </p>
            <p className="t-small mt-4"><a className="underline underline-offset-4" href={`${REPO_URL}/tree/main/docs/proofs`} target="_blank" rel="noreferrer">The proof runs</a></p>
            {stats.data ? (
              <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-lichen pt-6">
                <Fact label="Decisions">{stats.data.decision}</Fact>
                <Fact label="Settlements">{stats.data.settled}</Fact>
                <Fact label="Paid">{gen(stats.data.settled_wei)}</Fact>
              </dl>
            ) : null}
          </Card>
        </div>
      </Band>
    </>
  );
}
