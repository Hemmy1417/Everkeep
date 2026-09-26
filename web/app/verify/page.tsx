"use client";

import { Band, Card, Fact, Tag } from "@/components/bits";
import { addressUrl, CHAIN_ID, RPC_URL } from "@/lib/chain";
import { CONTRACT_ADDRESS, IS_RECORD, REPO_URL, SOURCE_SHA256, SOURCE_URL } from "@/lib/config";
import { getConfig, getStats } from "@/lib/read";
import { gen } from "@/lib/present";
import { useChain } from "@/lib/useChain";

export default function Verify() {
  const config = useChain("config", () => getConfig());
  const stats = useChain("stats", (f) => getStats(f));
  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>Verify</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">Check the deployment yourself.</h1>
          <p className="t-body-lg mt-8 max-w-[58ch] text-haze">
            This is the one page where addresses and digests are shown in full: they are what you
            compare against the chain and the repository.
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
              <Fact label="Source sha256"><span className="t-mono break-all">{SOURCE_SHA256}</span></Fact>
              <Fact label="Source"><a className="underline underline-offset-4" href={SOURCE_URL} target="_blank" rel="noreferrer">contracts/everkeep.py</a></Fact>
              <Fact label="Ruleset">{config.data?.ruleset ?? "Reading"}</Fact>
            </dl>
          </Card>
          <Card tone="tissue">
            <p className="t-sub">Byte for byte.</p>
            <p className="t-body mt-4 text-graphite">
              The deployed code is fetched with the network&apos;s own call and compared with the file in the
              repository. The live proof runs, every transaction hash included, are committed beside it.
            </p>
            <pre className="t-mono mt-6 overflow-x-auto rounded-[12px] bg-ink p-4 text-lichen">node scripts/deploy.mjs verify {CONTRACT_ADDRESS}</pre>
            <p className="t-small mt-6"><a className="underline underline-offset-4" href={`${REPO_URL}/tree/main/docs/proofs`} target="_blank" rel="noreferrer">Read the proof runs</a></p>
            {stats.data ? (
              <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-lichen pt-6">
                <Fact label="Rounds">{stats.data.rounds}</Fact>
                <Fact label="Settled">{stats.data.finalized}</Fact>
                <Fact label="Paid">{gen(stats.data.paid_wei)}</Fact>
              </dl>
            ) : null}
          </Card>
        </div>
      </Band>
    </>
  );
}
