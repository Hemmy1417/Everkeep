"use client";

/**
 * Filing evidence against the terms in force. Four kinds, and the page says
 * plainly what each one can do: a photograph and the inspector's report can
 * ground a finding; a party's document is read as that party's account; a
 * declaration and a reference are kept for the record and never read.
 */
import { useState } from "react";

import { Act } from "./Act";
import { Field } from "./bits";
import { preparePhoto, type PreparedImage } from "@/lib/images";
import { docType, imageOrigin } from "@/lib/present";
import type { Seat } from "@/lib/acts";
import type { Terms } from "@/lib/types";

type Kind = "IMAGE" | "DOCUMENT" | "DECLARATION" | "REFERENCE";
const KINDS: Array<{ k: Kind; label: string; note: string }> = [
  { k: "IMAGE", label: "Photograph", note: "Held and hashed on chain. A photograph can establish or refute a finding." },
  { k: "DOCUMENT", label: "Document", note: "Read by the panel. Only the independent inspector's report can ground a finding; anyone else's is their own account." },
  { k: "DECLARATION", label: "Declaration", note: "Kept on the record and shown to everyone. No panel ever reads it." },
  { k: "REFERENCE", label: "Link", note: "A video or a source held elsewhere, with the digest you claim for it. Shown as your claim; never fetched." },
];
const ORIGINS = ["PHOTO", "NAMEPLATE", "METER_DISPLAY", "VIDEO_FRAME", "SCAN"];
const DOCS = ["TECHNICAL_REPORT", "INSPECTION_REPORT", "METER_READING", "MAINTENANCE_LOG", "WORK_ORDER_DOCUMENT", "INVOICE", "OTHER"];

export function FilePanel({ wid, terms, seat, onFiled }:
    { wid: string; terms: Terms; seat: Seat; onFiled: () => void }) {
  const [kind, setKind] = useState<Kind>("IMAGE");
  const [crit, setCrit] = useState("");
  const [caption, setCaption] = useState("");
  const [origin, setOrigin] = useState("PHOTO");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageProblem, setImageProblem] = useState("");
  const [doc, setDoc] = useState(seat === "INSPECTOR" ? "INSPECTION_REPORT" : "TECHNICAL_REPORT");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [digest, setDigest] = useState("");
  const docs = DOCS.filter((d) => d !== "INSPECTION_REPORT" || seat === "INSPECTOR");
  const reset = () => { setCaption(""); setText(""); setUrl(""); setDigest(""); setImage(null); onFiled(); };

  const pick = async (file: File | undefined) => {
    setImageProblem("");
    setImage(null);
    if (!file) return;
    try {
      setImage(await preparePhoto(file));
    } catch (e) {
      setImageProblem(String((e as Error).message));
    }
  };

  const critSelect = (
    <Field label="Offered for" hint="Your claim about what it shows. The panel judges from the content.">
      <select value={crit} onChange={(e) => setCrit(e.target.value)}>
        <option value="">No particular criterion</option>
        {terms.acceptance_criteria.map((c, i) => <option key={c.id} value={c.id}>Criterion {i + 1}</option>)}
      </select>
    </Field>
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
        <Act label="File the photograph" method="submit_image"
             prepare={() => image ? [wid, JSON.stringify({
               criterion_id: crit, caption: caption.trim(), origin,
               claimed_capture: image.claimedCapture, claimed_location: image.claimedLocation }), image.bytes]
               : "Choose a photograph first."}
             onAnswer={reset}>
          <div className="grid gap-6 md:grid-cols-[240px_1fr]">
            <div>
              <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-lichen bg-bone">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.preview} alt="The photograph about to be filed" className="h-full w-full object-cover" />
                ) : <span className="t-label text-graphite">Choose a photograph</span>}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
              </label>
              {imageProblem ? <p className="t-small mt-2">{imageProblem}</p> : null}
            </div>
            <div className="flex flex-col gap-5">
              <Field label="What it is">
                <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                  {ORIGINS.map((o) => <option key={o} value={o}>{imageOrigin(o)}</option>)}
                </select>
              </Field>
              <Field label="Caption"><input value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} /></Field>
              {critSelect}
            </div>
          </div>
        </Act>
      ) : null}

      {kind === "DOCUMENT" ? (
        <Act label="File the document" method="submit_document"
             prepare={() => text.trim() ? [wid, JSON.stringify({ criterion_id: crit, title: caption.trim(), doc_type: doc }), text] : "Write the document."}
             onAnswer={reset}>
          <div className="grid gap-6 md:grid-cols-3">
            <Field label="Type">
              <select value={doc} onChange={(e) => setDoc(e.target.value)}>
                {docs.map((d) => <option key={d} value={d}>{docType(d)}</option>)}
              </select>
            </Field>
            <Field label="Title"><input value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} /></Field>
            {critSelect}
          </div>
          <Field label="Text"><textarea value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} /></Field>
        </Act>
      ) : null}

      {kind === "DECLARATION" ? (
        <Act label="File the declaration" method="submit_declaration"
             prepare={() => text.trim() ? [wid, text] : "Write the declaration."} onAnswer={reset}>
          <Field label="Declaration"><textarea value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} /></Field>
        </Act>
      ) : null}

      {kind === "REFERENCE" ? (
        <Act label="File the link" method="submit_reference"
             prepare={() => /^https?:\/\//.test(url.trim())
               ? [wid, JSON.stringify({ url: url.trim(), claimed_sha256: digest.trim().toLowerCase(), caption: caption.trim(),
                                        reference_type: /video|\.mp4|youtu/i.test(url) ? "VIDEO_REFERENCE" : "EXTERNAL_SOURCE" })]
               : "The link needs to start with http or https."}
             onAnswer={reset}>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Link"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
            <Field label="Caption"><input value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} /></Field>
          </div>
          <Field label="Digest you claim for it, optional" hint="Sixty-four hexadecimal characters. Recorded as your claim.">
            <input className="font-mono" value={digest} onChange={(e) => setDigest(e.target.value)} />
          </Field>
        </Act>
      ) : null}
    </div>
  );
}
