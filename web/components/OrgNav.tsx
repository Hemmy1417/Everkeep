"use client";

/** The organisation's own sections: the brief's organisation, constitution, treasury, registry and activity. */
import Link from "next/link";
import { usePathname } from "next/navigation";

export function OrgNav({ oid }: { oid: string }) {
  const path = usePathname() ?? "";
  const base = `/organizations/${oid}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/constitution`, label: "Constitution" },
    { href: `${base}/treasury`, label: "Treasury" },
    { href: `${base}/providers`, label: "Providers" },
    { href: `${base}/work-orders/new`, label: "New work order" },
  ];
  return (
    <nav className="border-b border-graphite bg-ink">
      <div className="page flex flex-wrap gap-2 py-3">
        {tabs.map((t) => {
          const on = path === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
                  className={`t-label rounded-[12px] border px-3 py-1.5 ${on ? "border-lime bg-lime text-ink" : "border-graphite text-lichen hover:text-paper"}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
