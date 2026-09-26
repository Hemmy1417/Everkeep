"use client";

/**
 * A payee's balance, drawn in their own transaction. Shown only when the
 * connected wallet is owed something: a finalized payment, or value sent
 * with a refused write.
 */
import { useState } from "react";

import { Button } from "./bits";
import { announceConfirmed } from "./Confirmed";
import { TxPanel } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { gen } from "@/lib/present";
import { getBalance } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export function ClaimBar() {
  const w = useWallet();
  const kit = useTransactionKit();
  const [open, setOpen] = useState(false);
  const bal = useChain(w.address ? `balance.${w.address}` : null, () => getBalance(w.address));
  const owed = BigInt(bal.data?.claimable ?? "0");
  if (!w.address || owed <= 0n) return null;
  return (
    <div className="border-b border-lichen bg-paper">
      <div className="page flex flex-wrap items-center justify-between gap-4 py-4">
        <p className="t-body">
          <span aria-hidden className="mr-3 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
          This wallet can claim {gen(owed)}.
        </p>
        {!open ? (
          <Button onClick={() => setOpen(true)} disabled={!kit}>Claim</Button>
        ) : null}
      </div>
      {open && kit ? (
        <div className="page pb-6">
          <TxPanel kit={kit} tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "claim", args: [] }}
                   confirmText="Claim" onClose={() => setOpen(false)}
                   onDone={(o) => { if (o.successful && o.hash) announceConfirmed(o.hash, "Claim"); }} />
        </div>
      ) : null}
    </div>
  );
}
