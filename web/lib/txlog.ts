/**
 * Which transaction produced which decision. The contract cannot know its own
 * transaction hash, so a decision's hash is known in two honest ways: this
 * browser sent it, or it is in the published proof log for the deployment of
 * record (docs/proofs). Otherwise the receipt links to the contract's page on
 * the explorer rather than guessing.
 */
import { CONTRACT_ADDRESS } from "./config";
import proofLog from "./proof-log.json";

const KEY = `everkeep.${CONTRACT_ADDRESS}.decision-tx`;

function read(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberDecisionTx(did: string, hash: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [did]: hash }));
  } catch {
    /* not remembered: the receipt links to the explorer instead */
  }
}

export interface DecisionTx { hash: string; source: "this browser" | "the published proof log" }

export function decisionTx(did: string): DecisionTx | null {
  const mine = read()[did];
  if (mine) return { hash: mine, source: "this browser" };
  const log = proofLog as { address?: string; decisions?: Record<string, string> };
  if (log.address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() && log.decisions?.[did]) {
    return { hash: log.decisions[did], source: "the published proof log" };
  }
  return null;
}
