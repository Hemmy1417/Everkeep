/**
 * Which transaction decided which round. The contract cannot know its own
 * transaction hash, so a round's hash is known in two honest ways: this
 * browser sent it (remembered here after it finalized), or it is in the
 * published proof log for the deployment of record (docs/proofs, committed
 * with the run that produced it). Anything else links to the contract's
 * page on the explorer instead of guessing.
 */
import { CONTRACT_ADDRESS } from "./config";
import proofLog from "./proof-log.json";

const KEY = `everkeep.${CONTRACT_ADDRESS}.round-tx`;

function read(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberRoundTx(mid: string, round: number, hash: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [`${mid}/${round}`]: hash }));
  } catch {
    /* not remembered: the certificate links to the explorer instead */
  }
}

export interface RoundTx {
  hash: string;
  source: "this browser" | "the published proof log";
}

export function roundTx(mid: string, round: number): RoundTx | null {
  const key = `${mid}/${round}`;
  const mine = read()[key];
  if (mine) return { hash: mine, source: "this browser" };
  const log = proofLog as { address?: string; rounds?: Record<string, string> };
  if (log.address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() && log.rounds?.[key]) {
    return { hash: log.rounds[key], source: "the published proof log" };
  }
  return null;
}
