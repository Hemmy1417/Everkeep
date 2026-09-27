"use client";

import { Card, Tag } from "@/components/bits";
import { Tabs } from "@/components/tabs";
import { Cycle } from "@/components/lifecycle";

const DETERMINISTIC = [
  "Is the asset enrolled, and of a kind the constitution supports?",
  "Is the provider authorised for this kind of work?",
  "Is the work a kind the constitution funds?",
  "Is the payment within the budget, the constitution's limit and the treasury's reserve?",
  "Is the deadline valid, and has the work order not already been decided or finalized?",
  "Is the evidence the rules require on file, from the parties allowed to file it?",
];
const JUDGED = [
  "Does the evidence show the required work was done?",
  "Does it show the organisation's maintenance principles were kept?",
  "Is the evidence associated with this asset?",
  "Do before and after photographs support the claimed work?",
  "Is the technician's documentation consistent with what was photographed and inspected?",
  "Is the evidence, taken together, enough to authorise payment?",
];

const STEPS: [string, string][] = [
  ["Preflight", "Code checks every rule. If one fails, the request is refused and no validator is asked."],
  ["Examination", "Each validator examines the photographs: what is visible, legible text and readings."],
  ["Judgment", "Each validator rates every requirement and cites the evidence it relied on."],
  ["Grounding", "A rating counts only if it rests on a photograph or the independent inspector."],
  ["Consensus", "Validators must reach the same outcome on the same grounds."],
  ["Decision", "Code derives the outcome and records it with an evidence snapshot."],
  ["Appeal", "The losing party may appeal. Validators decide again; the first decision is kept."],
  ["Settlement", "Once final, an acceptance is paid to the provider. Anything else returns the commitment."],
];

const LIMITS = [
  "GenLayer decides whether the evidence filed establishes the work. It does not guarantee physical truth.",
  "Video is kept as a reference and never interpreted. External links are never fetched.",
  "The organisation lasts only while its treasury, its rules and the network do.",
];

export default function How() {
  return (
    <>
      <section className="band-dark">
        <div className="page pb-12 pt-14">
          <Tag dark>How it works</Tag>
          <h1 className="t-display mt-6 max-w-[20ch]">What code decides, and what GenLayer decides.</h1>
          <p className="t-body-lg mt-6 max-w-[56ch] text-haze">
            Code enforces the rules and the money. Validators judge whether the evidence shows the work was done.
          </p>
          <div className="mt-10"><Cycle dark /></div>
        </div>
      </section>
      <section className="band-light py-12">
        <div className="page">
          <Tabs items={[
            { id: "split", label: "Code or validators", content: (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card><Tag>Decided in code</Tag>
                  <ol className="mt-5">{DETERMINISTIC.map((q) => <li key={q} className="t-body border-t border-lichen py-3 first:border-t-0">{q}</li>)}</ol>
                </Card>
                <Card tone="tissue"><Tag>Judged by GenLayer validators</Tag>
                  <ol className="mt-5">{JUDGED.map((q) => <li key={q} className="t-body border-t border-lichen py-3 first:border-t-0">{q}</li>)}</ol>
                </Card>
              </div>
            ) },
            { id: "steps", label: "The steps", count: STEPS.length, content: (
              <ol className="border-t border-lichen">
                {STEPS.map(([t, b], i) => (
                  <li key={t} className="grid gap-2 border-b border-lichen py-4 md:grid-cols-[48px_200px_1fr]">
                    <span className="t-label text-graphite">{String(i + 1).padStart(2, "0")}</span>
                    <span className="t-sub">{t}</span>
                    <span className="t-body text-graphite">{b}</span>
                  </li>
                ))}
              </ol>
            ) },
            { id: "limits", label: "Limits", content: (
              <ul className="border-t border-lichen">
                {LIMITS.map((l) => <li key={l} className="t-body border-b border-lichen py-4">{l}</li>)}
              </ul>
            ) },
          ]} />
        </div>
      </section>
    </>
  );
}
