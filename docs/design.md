# Design

The reasoning behind EVERKEEP's shape. What the brief fixed is marked as fixed;
everything else is a decision this document owns.

## The question the contract answers

> **Given an organisation's constitution in force, a work order's accepted terms,
> and the evidence on file, does that evidence establish that the maintenance was
> carried out as the constitution and the work order require?**

Not "is this asset in good condition", not "is this provider trustworthy". One
work order, bound to one constitution version and one terms version, judged on
evidence whose bytes are stored on chain and hashed when filed.

**Delete GenLayer and what breaks:** a community fund that is meant to run without
a permanent operator needs someone to decide, job by job, whether a repair was
actually done before paying for it. A single reviewer becomes that operator, and
a single point that can pay for work nobody did. Ordinary contract code cannot
read a photograph of a charge controller against "fixed in place, cables landed
in its terminals". Several independent validators can each read it and compare.

## Why this needs consensus at all

The brief fixed the product: an autonomous stewardship fund with a constitution,
a treasury, an infrastructure registry, providers, work orders, adjudication,
appeal, finality, settlement and dissolution, used through a web app on GenLayer
Studio Next.

| Deterministic code | GenLayer consensus |
|---|---|
| who may act, in which state, before which deadline | whether the photographs show the work the order describes |
| the constitution's scope, funded work, payment caps and reserve | whether each principle in scope was kept |
| the evidence rules, checked before any validator is asked | whether each acceptance criterion is met |
| grounding: which evidence can carry which rating, and for whom | whether the evidence shows this asset |
| the outcome, derived from the ratings | whether the provider's documentation matches what was seen |
| commitments, releases, settlement, refunds, dissolution | whether the evidence is enough to decide, and whether it contradicts itself |

The model never returns an outcome. It returns ratings; code grounds them and
derives the outcome.

## Scope, and what was left out

- **Video and links** are recorded with a claimed hash and never interpreted or
  fetched. Photographs and documents are stored on chain, so every validator
  judges identical bytes with no off-chain host to keep running.
- **Physical truth** is out of reach. A skilled forgery can deceive validators as
  it would a person; the independent inspector role exists for work that needs one.
- **Bonded appeals** are not used. The delay an unbonded appeal can cause is
  bounded by the evidence period, the appellant-or-anyone readjudication, and the
  stale-appeal close.
- **Per-funder accounting** is not kept. Funding is a grant; the remainder goes to
  the constitution's beneficiary on dissolution.

## Against the nearest neighbours

EVERKEEP was first built too close to ICARUS, an earlier build that also judges
photographs of solar equipment. That version was rejected and rebuilt from the
brief: the adjudication engine, the demonstration story and the wording are its
own. What it shares with earlier builds is engineering practice, not product:
evidence stored and hashed on chain, grounding in code, a validator that repeats
the assessment rather than checking the leader's JSON, and proofs that assert
what they claim.

## The standards audit, and what it changed

A read-only audit against the judges' standards found one standard unmet and
several partly met. Each is answered and pinned; the table is in
[docs/security.md](docs/security.md) and the tests are in
`tests/direct/test_standards.py`. The ones that changed the design:

1. **Interested parties, mirrored.** A steward's photographs are filed against the
   payment, so they can fail a requirement only beside a provider photograph or
   the inspector's observation. On an asset with an accepted inspector, the
   provider's photographs can pass a principle or a criterion only beside the
   inspector's observation.
2. **Insufficiency first.** Neither an acceptance nor a rejection is recorded on
   evidence the panel found not enough to decide.
3. **One piece of evidence counts once.** The same bytes cannot be filed twice on
   a work order.
4. **The record says what consensus bound**, and every recorded rating obeys the
   rules whoever wrote it.
5. **Stewards accept their role**, and an organisation whose stewards vanish can
   be dissolved by anyone after 365 days, so its treasury is never stranded.

The live runs then found two more, both fixed before the deployment of record:

6. **The examination looks before it reads the claim.** A model shown the
   submitter's description described a charge controller in a photograph of the
   back of a solar panel. The examination now sees the photograph alone, and
   descriptions are weighed afterwards, as claims.
7. **The rubric says what S1 and a conflict are.** Panels split when some read the
   "this asset" check as proof of identity, and a reading of 12.8 V beside a
   report of 12.5 V was raised as a conflict. The judging prompt now says the
   check asks whether anything shows a different site, and that a slightly
   different reading that meets the same requirement is not a conflict.

## Design decisions worth naming

- **Every state change goes through one function**, which keeps the organisation's
  counters exact; a randomized walk asserts them after every action.
- **A decision is never edited.** A readjudication is a new decision linked to the
  one it reviews, which is kept as superseded.
- **The app mirrors the contract's guards** in `web/lib/acts.ts`, and the live
  run imports that file and checks it against chain state, so the pages never
  offer an act the contract would refuse.
- **Long live runs use a second deployment of the same bytes.** A network stall
  once blocked a contract's queue for good; the organisation paths now run on a
  separate deployment so a stall there cannot block the app's contract.
