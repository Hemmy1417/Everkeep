"use client";

/**
 * The evidence on file, as the contract holds it. An image is fetched from
 * the chain and hashed in this browser; the page says whether the bytes
 * match the digest the contract recorded when it was filed.
 */
import { useEffect, useState } from "react";

import { Tag } from "./bits";
import { itemKind, itemName, moment, role } from "@/lib/present";
import { getImage, getItemText } from "@/lib/read";
import type { EvidenceItem, Terms } from "@/lib/types";

function Picture({ item }: { item: EvidenceItem }) {
  const [src, setSrc] = useState("");
  const [match, setMatch] = useState<boolean | null>(null);
  useEffect(() => {
    let url = "";
    let alive = true;
    getImage(item.item_id).then((img) => {
      if (!alive) return;
      url = URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: "image/jpeg" }));
      setSrc(url);
      setMatch(img.digest === item.sha256);
    }).catch(() => setMatch(false));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [item.item_id, item.sha256]);
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-[16px] bg-ink">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.caption || itemKind(item)} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="t-label mt-2 text-graphite">
        {match === null ? "Fetching from the chain" : match ? "Bytes match the recorded digest" : "Could not verify these bytes"}
      </p>
    </div>
  );
}

function Text({ item }: { item: EvidenceItem }) {
  const [body, setBody] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && body === null) void getItemText(item.item_id).then(setBody).catch(() => setBody(""));
  }, [open, body, item.item_id]);
  return (
    <div>
      <button type="button" className="t-label text-graphite underline underline-offset-4" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide the text" : "Read the text"}
      </button>
      {open ? <p className="t-small mt-3 whitespace-pre-wrap">{body ?? "Reading"}</p> : null}
    </div>
  );
}

function criterionName(id: string, terms: Terms): string {
  const i = terms.acceptance_criteria.findIndex((c) => c.id === id);
  return i >= 0 ? `criterion ${i + 1}` : "";
}

export function EvidenceList({ items, terms }: { items: EvidenceItem[]; terms: Terms }) {
  if (!items.length) return <p className="t-body text-graphite">Nothing filed against these terms yet.</p>;
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const read = it.kind === "IMAGE" || it.kind === "DOCUMENT";
        const grounds = it.kind === "IMAGE" || (it.kind === "DOCUMENT" && it.role === "INSPECTOR" && it.doc_type === "INSPECTION_REPORT");
        return (
          <article key={it.item_id} className="flex flex-col gap-4 rounded-[20px] bg-paper p-6">
            {it.kind === "IMAGE" ? <Picture item={it} /> : null}
            <div className="flex flex-wrap gap-3">
              <Tag>{itemKind(it)}</Tag>
              <span className="t-label self-center text-graphite">{itemName(it.item_id)} · {role(it.role)}</span>
            </div>
            {it.caption ? <p className="t-body">&ldquo;{it.caption}&rdquo;</p> : null}
            {it.criterion_id ? (
              <p className="t-small text-graphite">Offered for {criterionName(it.criterion_id, terms)}, which is the filer&apos;s claim.</p>
            ) : null}
            {it.kind === "REFERENCE" ? (
              <p className="t-small break-words text-graphite">
                Points to <a className="underline underline-offset-4" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>. Never fetched by a panel.
              </p>
            ) : null}
            {it.kind === "DOCUMENT" || it.kind === "DECLARATION" ? <Text item={it} /> : null}
            <p className="t-label mt-auto border-t border-lichen pt-3 text-graphite">
              {grounds ? "Can ground a finding" : read ? "Read as the filer's account" : "Never read by a panel"} · {moment(it.filed_at)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
