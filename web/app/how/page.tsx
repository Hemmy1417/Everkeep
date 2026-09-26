import { Band, Card, Counter, Tag } from "@/components/bits";

const STEPS: Array<[string, string]> = [
  ["Ratify", "A founder writes the first constitution and funds the treasury. They become the first steward and nothing more."],
  ["Register", "Stewards register the infrastructure the constitution supports, each with an optional independent inspector who must accept."],
  ["Commission", "A steward creates a work order. Its payment is committed from the treasury at once, and it binds the constitution version in force."],
  ["Sign", "The provider signs the terms. Nothing can be filed before they do."],
  ["File", "Photographs, held and hashed on chain. Documents, read as their writer's account. Declarations and links, kept and never read."],
  ["Judge", "The contract checks the enforced rules in code. Then each validator describes the photographs without knowing the rules, and rates every principle and criterion."],
  ["Appeal", "The party a decision went against may appeal once. A fresh panel re-reads the whole record under the same constitution. Its answer is final for those terms."],
  ["Settle", "Anyone settles an acceptance once it can no longer be contested; the provider claims the payment. An order nobody accepted closes after its deadline and its commitment returns."],
];

export default function How() {
  return (
    <>
      <section className="band-dark">
        <div className="page py-16 md:py-24">
          <Tag dark>How it works</Tag>
          <h1 className="t-display mt-6 max-w-[16ch]">A rulebook, a treasury, and a panel that looks.</h1>
        </div>
      </section>
      <Band>
        <Counter n={1} of={2} />
        <ol className="mt-10">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="grid gap-4 border-t border-lichen py-8 md:grid-cols-[80px_260px_1fr]">
              <span className="t-label text-graphite">{String(i + 1).padStart(2, "0")}</span>
              <span className="t-heading">{title}</span>
              <span className="t-body-lg text-graphite">{body}</span>
            </li>
          ))}
        </ol>
      </Band>
      <Band className="border-t border-lichen">
        <Counter n={2} of={2} />
        <h2 className="t-heading-lg mt-8">The floors, written in code.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[
            ["Seen, not said", "A criterion is met, or a principle kept, only on a photograph or the inspector's report. The same holds for unmet and broken: paperwork cannot refute either."],
            ["Blind nodes do not vote", "A validator counts as a reader only when it says it received the photograph and describes it. A round with a blind node fails and writes nothing."],
            ["Doubt never pays", "Anything unsettled or in conflict is undetermined. Only a full set of met criteria and kept principles is an acceptance."],
            ["The same question once", "An appeal's answer is final for its terms, and a re-assessment needs new evidence on the record."],
          ].map(([t, b]) => (
            <Card key={t}><p className="t-sub">{t}</p><p className="t-body mt-4 text-graphite">{b}</p></Card>
          ))}
        </div>
      </Band>
    </>
  );
}
