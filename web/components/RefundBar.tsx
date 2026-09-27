"use client";

/**
 * Value the contract owes this wallet outside a settlement: what was sent
 * with a refused payable write, or a dissolved treasury's remainder for its
 * beneficiary. Drawn in the owner's own transaction.
 */
import { useState } from "react";

import { Button } from "./bits";
import { announceConfirmed } from "./Confirmed";
import { TxPanel } from "./TxPanel";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { useTransactionKit } from "@/lib/kit";
import { gen } from "@/lib/present";
import { getRefund } from "@/lib/read";
import { useChain } from "@/lib/useChain";
import { useWallet } from "@/lib/wallet";

export function RefundBar() {
  const w = useWallet();
  const kit = useTransactionKit();
  const [open, setOpen] = useState(false);
  const owed = useChain(w.address ? `refund.${w.address}` : null, () => getRefund(w.address));
  const wei = BigInt(owed.data?.owed ?? "0");
  if (!w.address || wei <= 0n) return null;
  return (
    <div className="border-b border-lichen bg-paper">
      <div className="page flex flex-wrap items-center justify-between gap-4 py-4">
        <p className="t-body">
          <span aria-hidden className="mr-3 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
          The contract holds {gen(wei)} refundable to this wallet.
        </p>
        {!open ? <Button onClick={() => setOpen(true)} disabled={!kit}>Claim the refund</Button> : null}
      </div>
      {open && kit ? (
        <div className="page pb-6">
          <TxPanel kit={kit} tx={{ kind: "write", address: CONTRACT_ADDRESS, method: "claim_refund", args: [] }}
                   confirmText="Claim" onClose={() => setOpen(false)}
                   onDone={(o) => { if (o.successful && o.hash) announceConfirmed(o.hash, "Refund"); }} />
        </div>
      ) : null}
    </div>
  );
}
