"use client";

/**
 * The frame: a single horizontal bar on ink (logo left, links right, a pill
 * marking where you are), the page, and a pure black footer that says which
 * deployment every page on this site reads.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { RefundBar } from "./RefundBar";
import { ConfirmedNotice } from "./Confirmed";
import { WalletDock } from "./WalletDock";
import { CONTRACT_ADDRESS, IS_RECORD, REPO_URL } from "@/lib/config";
import { addressUrl } from "@/lib/chain";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/organizations", label: "Organisations" },
  { href: "/mine", label: "My work" },
  { href: "/how", label: "How it works" },
  { href: "/verify", label: "Verify" },
];

export function Mark({ size = 34 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon.svg" width={size} height={size} alt="" aria-hidden className="rounded-[8px]" />
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="band-dark">
        <div className="page flex flex-wrap items-center justify-between gap-4 py-5">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Mark />
            <span className="t-label tracking-[0.04em]">Everkeep</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {LINKS.map((l) => {
              const active = l.href === "/" ? path === "/" : path === l.href || path.startsWith(`${l.href}/`);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                      className={`t-label rounded-[12px] border px-3 py-2 ${
                        active ? "border-lime bg-lime text-ink" : "border-graphite text-lichen hover:text-paper"}`}>
                  {l.label}
                </Link>
              );
            })}
            <WalletDock />
          </nav>
        </div>
        {!IS_RECORD ? (
          <div className="page pb-4">
            <p className="t-label text-haze">
              This build reads a test deployment, not the deployment of record.
            </p>
          </div>
        ) : null}
      </header>
      <ConfirmedNotice />
      <RefundBar />
      <main className="flex-1">{children}</main>
      <footer className="bg-void text-paper">
        <div className="page grid gap-10 py-16 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <p className="t-heading">Infrastructure that keeps itself funded, verified and maintained.</p>
            <p className="t-small mt-4 max-w-[46ch] text-haze">
              A demonstration on GenLayer Studio Next. The organisations on the record are fictional,
              and the photographs are public-domain images of a real installation.
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <li key={l.href}><Link href={l.href} className="t-label text-lichen hover:text-paper">{l.label}</Link></li>
            ))}
          </ul>
          <ul className="flex flex-col gap-3">
            <li><a href={REPO_URL} target="_blank" rel="noreferrer" className="t-label text-lichen hover:text-paper">Source</a></li>
            <li><a href={addressUrl(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="t-label text-lichen hover:text-paper">Explorer</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
