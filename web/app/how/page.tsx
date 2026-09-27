import { Band, Card, Counter, Tag } from "@/components/bits";
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

export default function How() {
  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>How it works</Tag>
          <h1 className="t-display mt-6 max-w-[20ch]">What code decides, and what GenLayer decides.</h1>
          <p className="t-body-lg mt-8 max-w-[64ch] text-haze">
            A normal smart contract can enforce an organisation&apos;s rules and payment conditions. It cannot judge whether
            photographs, readings and reports show that physical maintenance meets a contractual and constitutional
            requirement. EVERKEEP uses GenLayer as the decentralized judgment layer between that evidence and the
            organisation&apos;s action.
          </p>
        </div>
      </section>
      <Band>
        <Counter n={1} of={3} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card><Tag>Decided in code, never put to a panel</Tag>
            <ol className="mt-5">{DETERMINISTIC.map((q) => <li key={q} className="t-body border-t border-lichen py-3 first:border-t-0">{q}</li>)}</ol>
          </Card>
          <Card tone="tissue"><Tag>Put to GenLayer validators</Tag>
            <ol className="mt-5">{JUDGED.map((q) => <li key={q} className="t-body border-t border-lichen py-3 first:border-t-0">{q}</li>)}</ol>
          </Card>
        </div>
      </Band>
      <Band className="border-t border-lichen">
        <Counter n={2} of={3} />
        <h2 className="t-heading-lg mt-6">One decision, from evidence to treasury.</h2>
        <ol className="mt-10">
          {[
            ["Preflight", "Every condition above is checked. If one fails the request is refused in words, and no panel is asked."],
            ["Examination", "Each validator examines the photographs, two at a time, before and after together: what is visible, legible text, readings, and anything suggesting another site."],
            ["Judgment", "Each validator rates every requirement: satisfied, not satisfied, not established, or (for a principle) not applicable, citing the evidence it relied on."],
            ["Grounding", "Code accepts a satisfied or not-satisfied rating only if it rests on a photograph or the independent inspector's observation. A datasheet, a declaration or a party's own report cannot prove or disprove the work."],
            ["Consensus", "A validator agrees with the leader only if it reached the same outcome on the same grounds from its own examination. Prose is free; the outcome is not."],
            ["Decision", "Code derives the outcome and records it with an evidence snapshot, citing the exact constitution and work-order versions."],
            ["Appeal", "The party it went against may appeal inside the window. After an evidence period, a fresh panel decides again. The new decision is linked to the old one, and neither is erased."],
            ["Finality and settlement", "Once no appeal is possible, anyone finalizes. An acceptance makes the payment releasable and anyone settles it to the provider. Anything else closes unpaid and the commitment returns to the treasury."],
          ].map(([t, b], i) => (
            <li key={t} className="grid gap-3 border-t border-lichen py-6 md:grid-cols-[80px_240px_1fr]">
              <span className="t-label text-graphite">{String(i + 1).padStart(2, "0")}</span>
              <span className="t-heading">{t}</span>
              <span className="t-body-lg text-graphite">{b}</span>
            </li>
          ))}
        </ol>
      </Band>
      <Band dark>
        <Counter n={3} of={3} dark />
        <h2 className="t-heading-lg mt-6 max-w-[24ch]">Then the asset goes back to monitoring, and the cycle continues.</h2>
        <div className="mt-10"><Cycle dark /></div>
        <p className="t-body mt-10 max-w-[70ch] text-haze">
          Limits, stated: GenLayer does not guarantee physical truth; it decides whether the evidence filed establishes the work.
          Video is kept as a reference and never interpreted. External links are never fetched. The organisation persists only
          while its treasury, its rules and the network do.
        </p>
      </Band>
    </>
  );
}
