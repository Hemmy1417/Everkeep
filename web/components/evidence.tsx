"use client";

/**
 * The evidence workspace: filing, with provenance recorded as the
 * submitter's claim, and the file as the contract holds it, each photograph
 * fetched from the chain and hashed in this browser against the digest the
 * contract recorded when it was filed.
 */
import { useEffect, useState } from "react";

import { Act } from "./Act";
import { Field, Tag } from "./bits";
import { preparePhoto, type PreparedImage } from "@/lib/images";
import { docType, evidenceKind, evidenceName, imageView, moment, requirementType, role, shortDigest } from "@/lib/present";
import { getEvidenceText, getImage } from "@/lib/read";
import type { Seat } from "@/lib/acts";
import type { Constitution, Evidence, Terms } from "@/lib/types";

/* ── what is required, what is on file, what is missing ── */

function meets(e: Evidence, type: string): boolean {
  if (type === "BEFORE_PHOTO") return e.kind === "IMAGE" && e.view === "BEFORE";
  if (type === "AFTER_PHOTO") return e.kind === "IMAGE" && e.view === "AFTER";
  if (type === "NAMEPLATE_PHOTO") return e.kind === "IMAGE" && e.view === "NAMEPLATE";
  if (type === "OPERATIONAL_READING") return (e.kind === "IMAGE" && e.view === "METER_DISPLAY") || (e.kind === "DOCUMENT" && e.doc_type === "METER_READING");
  if (type === "INSPECTION_REPORT" || type === "INSPECTION_CHECKLIST") return e.kind === "DOCUMENT" && e.doc_type === type && e.role === "INSPECTOR";
  return e.kind === "DOCUMENT" && e.doc_type === type;
}

/** The same arithmetic as the contract's preflight, for display. */
export function requiredEvidence(c: Constitution, t: Terms): Array<{ type: string; min_count: number; source: string }> {
  const rules = c.evidence_requirements
    .filter((r) => r.maintenance_type === "ALL" || r.maintenance_type === t.maintenance_type)
    .map((r) => ({ type: r.type, min_count: r.min_count, source: "The constitution" }));
  rules.push(...t.required_evidence.map((r) => ({ ...r, source: "This work order" })));
  if (c.eligibility_rules.inspection_report_required_for.includes(t.maintenance_type)) {
    rules.push({ type: "INSPECTION_REPORT", min_count: 1, source: "The constitution" });
  }
  return rules;
}

export function RequiredEvidence({ c, t, items }: { c: Constitution; t: Terms; items: Evidence[] }) {
  const rules = requiredEvidence(c, t);
  const photos = items.some((e) => e.kind === "IMAGE");
  return (
    <ul className="flex flex-col">
      {rules.map((r, i) => {
        const have = items.filter((e) => meets(e, r.type)).length;
        const ok = have >= r.min_count;
        return (
          <li key={i} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-t border-lichen py-3">
            <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-lime" : "bg-lichen"}`} />
            <span className="t-body">{r.min_count} {requirementType(r.type, r.min_count)} <span className="t-small text-graphite">· {r.source}</span></span>
            <span className="t-label text-graphite">{ok ? "On file" : `${have} of ${r.min_count}`}</span>
          </li>
        );
      })}
      <li className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-t border-lichen py-3">
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${photos ? "bg-lime" : "bg-lichen"}`} />
        <span className="t-body">At least one photograph <span className="t-small text-graphite">· nothing else can show the site</span></span>
        <span className="t-label text-graphite">{photos ? "On file" : "Missing"}</span>
      </li>
    </ul>
  );
}

/* ── the file ── */

function Photo({ e }: { e: Evidence }) {
  const [src, setSrc] = useState("");
  const [match, setMatch] = useState<boolean | null>(null);
  useEffect(() => {
    let url = "", alive = true;
    getImage(e.evidence_id).then((img) => {
      if (!alive) return;
      url = URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: "image/jpeg" }));
      setSrc(url);
      setMatch(img.digest === e.content_hash);
    }).catch(() => alive && setMatch(false));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [e.evidence_id, e.content_hash]);
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-[12px] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt={e.description || imageView(e.view ?? "")} className="h-full w-full object-cover" /> : null}
      </div>
      <p className="t-label mt-2 text-graphite">
        {match === null ? "Fetching from the chain" : match ? "Bytes match the recorded hash" : "Could not verify these bytes"}
      </p>
    </div>
  );
}

function Body({ e }: { e: Evidence }) {
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open && text === null) void getEvidenceText(e.evidence_id).then((t) => setText(t ?? "")).catch(() => setText(""));
  }, [open, text, e.evidence_id]);
  return (
    <div>
      <button type="button" className="t-label text-graphite underline underline-offset-4" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide the text" : "Read the text"}
      </button>
      {open ? <p className="t-small mt-3 whitespace-pre-wrap">{text ?? "Reading"}</p> : null}
    </div>
  );
}

function standing(e: Evidence): string {
  if (e.kind === "IMAGE") return "Examined by validators; can establish a finding";
  if (e.kind === "DOCUMENT" && e.role === "INSPECTOR" && (e.doc_type === "INSPECTION_REPORT" || e.doc_type === "INSPECTION_CHECKLIST")) {
    return "The independent inspector's observation; can establish a finding";
  }
  if (e.kind === "DOCUMENT") return `Read as the ${role(e.role).toLowerCase()}'s own account`;
  return "Kept on the record; never adjudicated";
}

export function EvidenceFile({ items }: { items: Evidence[] }) {
  if (!items.length) return <p className="t-body text-graphite">Nothing on file against these terms yet.</p>;
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((e) => (
        <article key={e.evidence_id} className="flex flex-col gap-3 rounded-[20px] bg-paper p-6">
          {e.kind === "IMAGE" ? <Photo e={e} /> : null}
          <div className="flex flex-wrap items-center gap-3">
            <Tag>{evidenceKind(e)}</Tag>
            <span className="t-label text-graphite">{evidenceName(e.evidence_id)} · {role(e.role)}</span>
          </div>
          {e.title ? <p className="t-body">{e.title}</p> : null}
          {e.description ? <p className="t-small">&ldquo;{e.description}&rdquo; <span className="text-graphite">the submitter&apos;s description</span></p> : null}
          {e.kind === "REFERENCE" ? (
            <p className="t-small break-words text-graphite">
              Points to <a className="underline underline-offset-4" href={e.url} target="_blank" rel="noreferrer">{e.url}</a>.
              Never fetched{e.claimed_hash ? "; the hash beside it is the submitter's claim" : ""}.
            </p>
          ) : null}
          {e.kind === "DOCUMENT" || e.kind === "TEXT_DECLARATION" ? <Body e={e} /> : null}
          <dl className="t-small mt-auto flex flex-col gap-1 border-t border-lichen pt-3 text-graphite">
            <div>{standing(e)}</div>
            <div>Filed {moment(e.submitted_at)} against terms version {e.work_order_version}</div>
            {e.capture_timestamp || e.location_reference ? (
              <div>Claimed: {[e.capture_timestamp, e.location_reference].filter(Boolean).join(", ")}</div>
            ) : null}
            <div className="t-mono" title={e.content_hash}>Hash {shortDigest(e.content_hash)}</div>
          </dl>
        </article>
      ))}
    </div>
  );
}

/* ── filing ── */

type Kind = "IMAGE" | "DOCUMENT" | "TEXT_DECLARATION" | "REFERENCE";
const KINDS: Array<{ k: Kind; label: string; note: string }> = [
  { k: "IMAGE", label: "Photograph", note: "Held on chain and hashed there. Validators examine it; it can establish or refute a finding." },
  { k: "DOCUMENT", label: "Document", note: "Read by validators. The inspector's report or checklist can establish a finding; anyone else's document is their own account." },
  { k: "TEXT_DECLARATION", label: "Declaration", note: "Kept on the record and shown to everyone. Never adjudicated." },
  { k: "REFERENCE", label: "Video or link", note: "Recorded with the hash you claim for it. Never fetched and never adjudicated; the network does not interpret video." },
];

export function FilePanel({ wid, seat, views, docs, onFiled }:
    { wid: string; seat: Seat; views: string[]; docs: string[]; onFiled: () => void }) {
  const [kind, setKind] = useState<Kind>("IMAGE");
  const [view, setView] = useState("AFTER");
  const [doc, setDoc] = useState(seat === "INSPECTOR" ? "INSPECTION_CHECKLIST" : "TECHNICAL_REPORT");
  const [description, setDescription] = useState("");
  const [capture, setCapture] = useState("");
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [hash, setHash] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [problem, setProblem] = useState("");
  const allowedDocs = docs.filter((d) => seat === "INSPECTOR" || (d !== "INSPECTION_REPORT" && d !== "INSPECTION_CHECKLIST"));
  const provenance = { description: description.trim(), capture_timestamp: capture.trim(), location_reference: location.trim() };
  const done = () => { setDescription(""); setText(""); setTitle(""); setUrl(""); setHash(""); setImage(null); onFiled(); };

  const pick = async (f?: File) => {
    setProblem("");
    setImage(null);
    if (!f) return;
    try {
      const img = await preparePhoto(f);
      setImage(img);
      if (img.claimedCapture) setCapture(img.claimedCapture);
      if (img.claimedLocation) setLocation(img.claimedLocation);
    } catch (e) {
      setProblem(String((e as Error).message));
    }
  };

  const claims = (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="When it was captured" hint="Your claim; recorded as one."><input value={capture} onChange={(e) => setCapture(e.target.value)} /></Field>
      <Field label="Where" hint="Your claim; recorded as one."><input value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="tablist">
        {KINDS.map((x) => (
          <button key={x.k} type="button" role="tab" aria-selected={kind === x.k} onClick={() => setKind(x.k)}
                  className={`t-label rounded-[12px] border px-3 py-2 ${kind === x.k ? "border-lime bg-lime text-ink" : "border-lichen text-graphite"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="t-small max-w-[70ch] text-graphite">{KINDS.find((x) => x.k === kind)!.note}</p>

      {kind === "IMAGE" ? (
        <Act label="File the photograph" method="submit_image" onAnswer={done}
             prepare={() => (image ? [wid, JSON.stringify({ view, ...provenance }), image.bytes] : "Choose a photograph first.")}>
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div>
              <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-lichen bg-bone">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {image ? <img src={image.preview} alt="The photograph about to be filed" className="h-full w-full object-cover" />
                       : <span className="t-label text-graphite">Choose a photograph</span>}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
              </label>
              {problem ? <p className="t-small mt-2">{problem}</p> : null}
            </div>
            <div className="flex flex-col gap-4">
              <Field label="View">
                <select value={view} onChange={(e) => setView(e.target.value)}>
                  {views.map((v) => <option key={v} value={v}>{imageView(v)}</option>)}
                </select>
              </Field>
              <Field label="Description" hint="What you say it shows. Validators are told it is your claim.">
                <input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              {claims}
            </div>
          </div>
        </Act>
      ) : null}

      {kind === "DOCUMENT" ? (
        <Act label="File the document" method="submit_document" onAnswer={done}
             prepare={() => (text.trim() ? [wid, JSON.stringify({ doc_type: doc, title: title.trim(), ...provenance }), text] : "Write the document.")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <select value={doc} onChange={(e) => setDoc(e.target.value)}>
                {allowedDocs.map((d) => <option key={d} value={d}>{docType(d)}</option>)}
              </select>
            </Field>
            <Field label="Title"><input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
          </div>
          <Field label="Text"><textarea value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} /></Field>
          {claims}
        </Act>
      ) : null}

      {kind === "TEXT_DECLARATION" ? (
        <Act label="File the declaration" method="submit_declaration" onAnswer={done}
             prepare={() => (text.trim() ? [wid, text] : "Write the declaration.")}>
          <Field label="Declaration"><textarea value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} /></Field>
        </Act>
      ) : null}

      {kind === "REFERENCE" ? (
        <Act label="File the link" method="submit_reference" onAnswer={done}
             prepare={() => (/^https?:\/\//.test(url.trim())
               ? [wid, JSON.stringify({ reference_type: /video|\.mp4|youtu|vimeo/i.test(url) ? "VIDEO_REFERENCE" : "EXTERNAL_SOURCE",
                                        url: url.trim(), claimed_hash: hash.trim().toLowerCase(), ...provenance })]
               : "The link must start with http or https.")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Link"><input value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} /></Field>
            <Field label="Description"><input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <Field label="SHA-256 you claim for it, optional" hint="Sixty-four hexadecimal characters.">
            <input className="font-mono" value={hash} onChange={(e) => setHash(e.target.value)} />
          </Field>
        </Act>
      ) : null}
    </div>
  );
}
