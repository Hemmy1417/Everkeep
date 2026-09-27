"use client";

/**
 * The detail below a page's summary, one subject at a time. The open tab
 * lives in the URL hash, so a link can land on it and the back button works.
 */
import { useEffect, useState, type ReactNode } from "react";

export type TabItem = { id: string; label: string; count?: number; content: ReactNode };

export function Tabs({ items, dark = false }: { items: TabItem[]; dark?: boolean }) {
  const shown = items.filter(Boolean);
  const [open, setOpen] = useState(shown[0]?.id);
  useEffect(() => {
    const pick = () => {
      const h = window.location.hash.slice(1);
      if (shown.some((t) => t.id === h)) setOpen(h);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, [shown.map((t) => t.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = shown.find((t) => t.id === open) ?? shown[0];
  const choose = (id: string) => {
    setOpen(id);
    try { window.history.replaceState(null, "", `#${id}`); } catch { /* the tab still opens */ }
  };
  return (
    <div>
      <div role="tablist" className={`flex gap-6 overflow-x-auto [scrollbar-width:none] border-b ${dark ? "border-graphite" : "border-lichen"}`}>
        {shown.map((t) => {
          const on = t.id === current?.id;
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={() => choose(t.id)}
                    className={`t-label -mb-px shrink-0 border-b-2 pb-3 pt-1 transition-colors ${on
                      ? dark ? "border-lime text-paper" : "border-ink text-ink"
                      : `border-transparent ${dark ? "text-haze hover:text-paper" : "text-graphite hover:text-ink"}`}`}>
              {t.label}{t.count !== undefined ? <span className="ml-2 opacity-60">{t.count}</span> : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-8">{current?.content}</div>
    </div>
  );
}

/** A small "i" that explains, on hover or focus, what a label means. */
export function Info({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <button type="button" aria-label="What this means"
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none ${
                dark ? "border-graphite text-haze" : "border-lichen text-graphite"}`}>i</button>
      <span role="tooltip"
            className="t-small pointer-events-none invisible absolute bottom-6 left-1/2 z-20 w-64 -translate-x-1/2 rounded-[10px] bg-ink p-3 normal-case tracking-normal text-paper opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {children}
      </span>
    </span>
  );
}

/** A stat the way the lending apps show it: small label, large figure. */
export function Stat({ label, value, info, dark = false }: { label: string; value: ReactNode; info?: ReactNode; dark?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className={`t-label ${dark ? "text-haze" : "text-graphite"}`}>{label}{info ? <Info dark={dark}>{info}</Info> : null}</dt>
      <dd className="text-[1.75rem] leading-none tracking-tight md:text-[2.125rem]">{value}</dd>
    </div>
  );
}
