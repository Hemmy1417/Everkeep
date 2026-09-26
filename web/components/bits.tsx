/**
 * The kit every page is built from. Flat ink on flat paper: hairlines do the
 * delineation, size and tracking do the hierarchy, and lime appears only as
 * a signal (the arrow button, the tag dot, progress).
 */
import Link from "next/link";
import type { ReactNode } from "react";

export function Band({ dark = false, children, className = "" }:
    { dark?: boolean; children: ReactNode; className?: string }) {
  return (
    <section className={`${dark ? "band-dark" : "band-light"} py-20 md:py-28 ${className}`}>
      <div className="page">{children}</div>
    </section>
  );
}

/** The section counter: "01 / 04" in a hairline pill. */
export function Counter({ n, of, dark = false }: { n: number; of: number; dark?: boolean }) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <span className={`t-label inline-block rounded-full border px-3 py-1 ${
      dark ? "border-graphite text-haze" : "border-lichen text-graphite"}`}>
      {pad(n)} / {pad(of)}
    </span>
  );
}

/** A classification marker: a 6px lime dot and a mono label. */
export function Tag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`t-label inline-flex items-center gap-2 ${dark ? "text-haze" : "text-graphite"}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-lime" />
      {children}
    </span>
  );
}

/** A quiet state marker, no colour: the words carry the meaning. */
export function Status({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`t-label inline-block rounded-full border px-3 py-1 ${
      dark ? "border-graphite text-paper" : "border-lichen text-ink"}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "", tone = "paper" }:
    { children: ReactNode; className?: string; tone?: "paper" | "tissue" }) {
  return (
    <div className={`rounded-[20px] ${tone === "paper" ? "bg-paper" : "bg-tissue"} p-6 md:p-10 ${className}`}>
      {children}
    </div>
  );
}

export function Hairline({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return <hr className={`border-0 border-t ${dark ? "border-graphite" : "border-lichen"} ${className}`} />;
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  dark?: boolean;
  type?: "button" | "submit";
};

/** Filled on the opposite surface for primary; a hairline ghost for secondary. Never lime. */
export function Button({ children, onClick, disabled, variant = "primary", dark = false, type = "button" }: ButtonProps) {
  const base = "t-label rounded-[8px] px-4 py-2.5 transition-opacity disabled:cursor-not-allowed disabled:opacity-40";
  const look = variant === "primary"
    ? dark ? "bg-paper text-ink" : "bg-ink text-paper"
    : dark ? "border border-graphite text-paper" : "border border-graphite text-ink";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${look}`}>
      {children}
    </button>
  );
}

/** The 40px lime arrow: the one filled lime shape, pointing forward. */
export function Arrow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-lime text-ink">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

export function InkLink({ href, children, external = false, dark = false }:
    { href: string; children: ReactNode; external?: boolean; dark?: boolean }) {
  const cls = `underline decoration-1 underline-offset-4 ${dark ? "decoration-graphite text-paper" : "decoration-lichen text-ink"} hover:decoration-current`;
  return external
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>
    : <Link href={href} className={cls}>{children}</Link>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="t-label text-graphite">{label}</span>
      {children}
      {hint ? <span className="t-small text-graphite">{hint}</span> : null}
    </label>
  );
}

/** A labelled fact: mono label over the value. */
export function Fact({ label, children, dark = false }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className={`t-label ${dark ? "text-haze" : "text-graphite"}`}>{label}</dt>
      <dd className="t-body">{children}</dd>
    </div>
  );
}

export function Loading({ what, dark = false }: { what: string; dark?: boolean }) {
  return (
    <p className={`t-label flex items-center gap-2 ${dark ? "text-haze" : "text-graphite"}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />
      Reading {what} from the chain
    </p>
  );
}

export function ReadFailure({ what, detail }: { what: string; detail?: string }) {
  return (
    <div className="rounded-[16px] border border-lichen p-6">
      <p className="t-sub">Could not read {what}</p>
      {detail ? <p className="t-small mt-2 text-graphite">{detail}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="t-body text-graphite">{children}</p>;
}
