"use client";

/**
 * The write lifecycle, driven by the Transaction Kit's headless flow: price,
 * review, sign, track.
 *
 * Two things this is careful about. "Confirmed" appears only when the
 * transaction reports finalized with a successful execution; a write the
 * validators accepted but the network has not finalized is shown as exactly
 * that, because it can still be walked back. And a refused write shows the
 * contract's own sentence, fetched from the receipt, rather than this app's
 * guess at why.
 */
import {
  describeError,
  formatGen as kitFormatGen,
  useTransactionFlow,
  type SubmitInput,
  type TransactionKit,
} from "@genlayer/transaction-kit-react";
import { useEffect, useRef, useState } from "react";

import { Button, InkLink } from "./bits";
import { txUrl } from "@/lib/chain";
import { plural, prose, refusal } from "@/lib/present";
import { refusalOf } from "@/lib/receipt";

const PHASES = ["submitted", "pending", "processing", "decided", "finalized"] as const;
const PHASE_TEXT: Record<(typeof PHASES)[number], string> = {
  submitted: "Signed and submitted",
  pending: "Waiting in the queue",
  processing: "Validators are executing it",
  decided: "Decided by the validators",
  finalized: "Finalized on chain",
};

export interface TxOutcome {
  successful: boolean;
  hash: string | null;
}

/** Tell every page that the chain changed, so it reads again. */
export function announceChange(): void {
  window.dispatchEvent(new Event("everkeep:changed"));
}

/**
 * One panel is one review of one transaction. The transaction and its value
 * are frozen when the panel opens, so a re-render can neither re-price the
 * quote mid-review nor change what is about to be signed.
 */
export function TxPanel({
  kit,
  tx: txProp,
  value: valueProp,
  confirmText,
  working,
  onDone,
  onClose,
}: {
  kit: TransactionKit;
  tx: SubmitInput;
  value?: bigint;
  confirmText: string;
  /** What the validators are doing while it runs, for the long adjudications. */
  working?: string;
  onDone?: (outcome: TxOutcome) => void;
  onClose?: () => void;
}) {
  const [tx] = useState(txProp);
  const [value] = useState(valueProp);
  const flow = useTransactionFlow({ kit, tx, userValue: value, trackUntil: "finalized" });
  const { state } = flow;
  const fired = useRef(false);
  const [refused, setRefused] = useState<string | null>(null);

  const status = state.step === "tracking" || state.step === "done" ? state.status : null;
  const hash = status?.genlayerTxId ?? null;
  const done = state.step === "done";
  const finalized = status?.phase === "finalized";
  const succeeded = done && finalized && status?.successful === true;

  useEffect(() => {
    if (!done || fired.current) return;
    fired.current = true;
    if (status?.successful === false && hash) {
      void refusalOf(hash).then(setRefused).catch(() => setRefused(null));
    }
    if (succeeded) announceChange();
    onDone?.({ successful: succeeded, hash });
  }, [done, succeeded, status, hash, onDone]);

  const shell = "rounded-[16px] border border-lichen bg-paper p-8";

  if (state.step === "estimating") {
    return (
      <div className={shell}>
        <p className="t-small text-ink">
          Pricing this against the network&apos;s live fee policy.
        </p>
      </div>
    );
  }

  if (state.step === "blocked") {
    return (
      <div className={shell}>
        <p className="t-sub">The fee quote no longer matches the network</p>
        <p className="t-small text-graphite mt-2">Nothing was signed.</p>
        <div className="mt-5">
          <Button variant="secondary" onClick={() => flow.reset()}>
            Price it again
          </Button>
        </div>
      </div>
    );
  }

  if (state.step === "error") {
    const err = describeError(state.message);
    return (
      <div className={shell}>
        <p className="t-sub">{prose(err.title)}</p>
        <p className="mt-2 t-small text-graphite">{prose(err.detail)}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => flow.reset()}>
            Start over
          </Button>
          {onClose ? (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (state.step === "review" || state.step === "signing") {
    const q = state.quote;
    const signing = state.step === "signing";
    return (
      <div className={shell}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="t-sub">Review before signing</p>
          {q.verification.status === "verified" ? (
            <span className="t-small text-graphite">Fee policy verified</span>
          ) : null}
        </div>
        <dl className="mt-6 flex flex-col gap-3">
          {value && value > 0n ? (
            <div className="flex items-baseline justify-between gap-5">
              <dt className="t-small text-graphite">Sent to the contract</dt>
              <dd className="font-mono t-small text-ink">{kitFormatGen(value)} GEN</dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-5">
            <dt className="t-small text-graphite">Refundable fee deposit</dt>
            <dd className="font-mono t-small text-ink">
              {q.gasless ? "None" : `${kitFormatGen(q.feeValue)} GEN`}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-5 border-t border-lichen pt-3">
            <dt className="t-small text-ink">Total leaving your wallet</dt>
            <dd className="font-mono t-small text-ink">{kitFormatGen(q.total)} GEN</dd>
          </div>
        </dl>
        {q.queue?.pendingAhead ? (
          <p className="t-small text-graphite mt-4">
            {plural(q.queue.pendingAhead, "transaction")} ahead of this wallet.
          </p>
        ) : null}
        <p className="t-small text-graphite mt-1">Prices are live, and unused fees are refunded.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button disabled={signing} onClick={() => void flow.approve()}>
            {signing ? "Waiting for your wallet" : confirmText}
          </Button>
          <Button
            variant="secondary"
            disabled={signing}
            onClick={() => {
              flow.reset();
              onClose?.();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const phaseIdx = status ? PHASES.indexOf(status.phase as (typeof PHASES)[number]) : -1;
  return (
    <div className={shell}>
      <ol className="flex flex-col gap-3">
        {PHASES.map((p, i) => {
          const reached = i < phaseIdx || done;
          const now = i === phaseIdx && !done;
          return (
            <li key={p} className="grid grid-cols-[10px_1fr] items-start gap-4">
              <span
                aria-hidden
                className={`mt-2 inline-block h-2.5 w-2.5 rounded-full ${
                  reached ? "bg-graphite" : now ? "bg-lime" : "bg-lichen"
                }`}
              />
              <span className={`t-small ${reached || now ? "text-ink" : "text-graphite"}`}>
                {PHASE_TEXT[p]}
                {now && p === "pending" && status?.queuePosition !== undefined
                  ? `, position ${status.queuePosition}`
                  : ""}
                {now && p === "processing" && working ? (
                  <span className="t-small text-graphite block">{working}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {done && status ? (
        <div className="mt-6 border-t border-lichen pt-5">
          {succeeded ? (
            <>
              <p className="t-sub">Confirmed</p>
              <p className="t-small text-graphite mt-1">
                Finalized on chain with a successful execution.
              </p>
            </>
          ) : finalized ? (
            <>
              <p className="t-sub">The contract refused it</p>
              <p className="mt-2 t-small text-graphite">
                {refused ? refusal(refused) : "Reading the contract's reason."}
              </p>
            </>
          ) : (
            <>
              <p className="t-sub">Decided, not yet final</p>
              <p className="mt-2 t-small text-graphite">
                The validators accepted it. It can still be walked back at network level until it
                finalizes.
              </p>
            </>
          )}
          {hash ? (
            <p className="t-small text-graphite mt-3">
              <InkLink href={txUrl(hash)} external>
                See the transaction
              </InkLink>
            </p>
          ) : null}
          {onClose ? (
            <div className="mt-5">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : null}
        </div>
      ) : flow.canCancel ? (
        <div className="mt-5">
          <Button variant="secondary" onClick={() => void flow.cancel()}>
            Cancel while still queued
          </Button>
        </div>
      ) : null}
    </div>
  );
}
