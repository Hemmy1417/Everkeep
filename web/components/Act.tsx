"use client";

/**
 * One act on the chain: a button that opens the signing panel for one
 * frozen transaction. A payable write that the contract refuses still
 * finalizes (it returns the refusal and credits the value back), so the
 * panel's "confirmed" is followed by the contract's own answer.
 */
import { useState, type ReactNode } from "react";

import { Button } from "./bits";
import { announceConfirmed } from "./Confirmed";
import { TxPanel, type TxOutcome } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { refusal } from "@/lib/present";
import { returnedJson } from "@/lib/receipt";
import { useWallet } from "@/lib/wallet";

export type Answer = Record<string, unknown> & { refused?: boolean; reason?: string };

export function Act({
  label, method, args, value, confirm, working, variant = "primary", dark = false, disabled = false,
  prepare, onAnswer, children,
}: {
  label: string;
  method: string;
  args?: unknown[];
  value?: bigint;
  confirm?: string;
  working?: string;
  variant?: "primary" | "secondary";
  dark?: boolean;
  disabled?: boolean;
  /** Build the arguments at the moment of opening; return a sentence to refuse locally. */
  prepare?: () => unknown[] | string;
  onAnswer?: (answer: Answer | null, outcome: TxOutcome) => void;
  children?: ReactNode;
}) {
  const w = useWallet();
  const kit = useTransactionKit();
  const [open, setOpen] = useState<unknown[] | null>(null);
  const [problem, setProblem] = useState("");
  const [answer, setAnswer] = useState<string>("");

  const start = () => {
    setAnswer("");
    const built = prepare ? prepare() : args ?? [];
    if (typeof built === "string") {
      setProblem(built);
      return;
    }
    setProblem("");
    setOpen(built);
  };

  if (!w.address) {
    return <p className="t-small text-graphite">Connect a wallet to {label.toLowerCase()}.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {children}
      {!open ? (
        <div>
          <Button variant={variant} dark={dark} disabled={disabled || !kit} onClick={start}>{label}</Button>
          {!kit && w.address ? <p className="t-small mt-2 text-graphite">Switch the wallet to Studio Next to sign.</p> : null}
        </div>
      ) : kit ? (
        <TxPanel
          kit={kit}
          tx={{ kind: "write", address: CONTRACT_ADDRESS, method, args: open }}
          value={value}
          confirmText={confirm ?? label}
          working={working}
          onClose={() => setOpen(null)}
          onDone={(outcome) => {
            if (!outcome.hash || !outcome.successful) {
              onAnswer?.(null, outcome);
              return;
            }
            const hash = outcome.hash;
            void returnedJson<Answer>(hash).then((a) => {
              if (a?.refused) setAnswer(refusal(String(a.reason ?? "")));
              else announceConfirmed(hash, label);
              onAnswer?.(a, outcome);
            }).catch(() => onAnswer?.(null, outcome));
          }}
        />
      ) : null}
      {problem ? <p className="t-small text-ink">{problem}</p> : null}
      {answer ? (
        <p className="t-small rounded-[12px] border border-lichen p-4">
          The contract refused it: {answer}
        </p>
      ) : null}
    </div>
  );
}
