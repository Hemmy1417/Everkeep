"use client";

/**
 * The wallet, as the one graphite button the reference puts on the right of
 * the nav pill.
 *
 * The connected address is machine text and never reaches the page surface.
 * It is shown inside the dropdown, where somebody has asked which account is
 * about to sign, which is the one moment they need to know.
 */
import { useEffect, useRef, useState } from "react";

import { Button } from "./bits";
import { useWallet } from "@/lib/wallet";

export function WalletDock() {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (w.restoring) {
    return <span className="t-small text-graphite">Reconnecting</span>;
  }

  if (w.address) {
    return (
      <div className="relative" ref={box}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono rounded-full bg-paper px-4 py-2 t-mono text-ink"
        >
          Connected
        </button>
        {open ? (
          <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] rounded-[16px] border border-lichen bg-paper p-5">
            <p className="t-small text-graphite">Signing as</p>
            <p className="font-mono mt-1 break-all t-mono text-ink">{w.address}</p>
            {!w.chainOk ? (
              <div className="mt-4">
                <p className="t-small text-graphite mb-2">
                  This wallet is on another network, so it cannot sign here.
                </p>
                <Button variant="secondary" onClick={() => void w.switchNetwork()}>
                  Switch network
                </Button>
              </div>
            ) : null}
            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  w.disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <Button dark onClick={() => setOpen((v) => !v)} disabled={w.connecting}>
        {w.connecting ? "Connecting" : "Connect wallet"}
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] rounded-[16px] border border-lichen bg-paper p-5">
          {w.wallets.length === 0 ? (
            <p className="t-small text-graphite">
              No wallet was offered to this page. Install one that speaks to GenLayer, then
              reload.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {w.wallets.map((d) => (
                <li key={d.info.rdns ?? d.info.uuid}>
                  <button
                    type="button"
                    onClick={() => {
                      void w.connect(d);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2 text-left t-small text-ink hover:bg-tissue"
                  >
                    {d.info.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.info.icon} alt="" width={20} height={20} aria-hidden="true" />
                    ) : null}
                    {d.info.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {w.error ? <p className="t-small text-graphite mt-3 text-ink">{w.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
