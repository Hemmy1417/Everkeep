# EVERKEEP blueprint

The design, written before the code, so the code can be checked against it.

## The one decision

An EVERKEEP organisation is a rulebook and a treasury. The rulebook is a
**constitution**: versioned, ratified through a window, immutable once
effective, and split into two halves.

- **Enforced half.** Which infrastructure types the organisation supports,
  which maintenance categories it funds, how much a single work order may pay,
  how many may be open at once, what evidence a provider must file before a
  panel is asked, how long an appeal window lasts, and who the stewards are.
  Contract code enforces every one of these at the write that they govern.
  No panel is ever asked about them.
- **Judged half.** The **maintenance principles**: numbered sentences such as
  "replacement equipment is of equal or greater rating than what it replaces"
  or "a d.c. isolator is fitted and labelled". A panel of validators applies
  each principle to the evidence and reports whether it is satisfied,
  violated, not applicable to this work, or unclear.

A work order carries its own **acceptance criteria** on top (what this
particular job requires). Every decision therefore rests on two rated lists,
the organisation's principles and the job's criteria, and cites the exact
constitution version and work order version it applied.

That is what separates EVERKEEP from a milestone escrow. ICARUS asks "is the
equipment on the schedule installed?" EVERKEEP asks "does this work satisfy
the rules this organisation ratified?", and the rules can change without
changing a single past decision.

## What is deliberately reused from ICARUS

Engineering, not product: images stored and hashed on chain; the reading
step blind to what the evidence is supposed to prove; findings grounded in
code (a document cannot establish or refute a physical fact, only an image or
the independent inspector's report can, and the floor has its mirror); a
node that cannot see cannot vote; the decision derived in code from agreed
fields; consensus on consequences, never on prose; one appeal to a fresh
panel with the recorded evidence re-read and new evidence named; pull
payments; permissionless finality; every refusal a sentence.

## Entities

```
Organisation      org-00001        name, founder, state ACTIVE|PAUSED, constitution_version,
                                   treasury: escrow_wei, committed_wei, paid_wei
Constitution      org-00001|v1     the two halves above, plus stewards, windows, effective_at
Amendment         one pending      proposed by a steward, ratified by anyone after the window,
                                   withdrawn by any steward's objection inside it
Asset             as-00001         type (must be supported), name, location, technical profile,
                                   optional independent inspector who accepts the role
Work order        wo-00001         asset, provider (accepts by signing), versions of terms,
                                   payment reserved from the treasury at creation,
                                   constitution_version bound at creation
Evidence item     ev-000001        IMAGE (bytes on chain) | DOCUMENT (text on chain, typed)
                                   | DECLARATION (stored, never read) | REFERENCE (a URL and
                                   a claimed digest, shown as a claim, never fetched)
Round             wo-00001|1       one consensus judgment: principles, criteria, basis,
                                   conflicts, decision, evidence snapshot with digests
Ledger            address          claimable, claimed
```

## Roles, by signer

| Role | Who | What they alone may do |
|---|---|---|
| Founder | the wallet that created the organisation | nothing after ratifying v1 beyond being its first steward |
| Steward | an address in the effective constitution's list | register assets, create work orders, propose terms, propose or object to amendments, pause and resume, appeal an acceptance |
| Provider | named on the work order, must sign | accept terms, file evidence, request assessment, appeal a rejection or an undetermined finding |
| Inspector | named on the asset, must accept | file the one kind of document that can ground a finding |
| Anyone | | fund the treasury, ratify a lapsed amendment, decide or lapse an appeal, finalize, close, claim their own balance |

There is no owner key and no administrator method. The deployer holds no
power. A steward's authority is whatever the effective constitution says it
is, and the stewards list itself changes only by amendment.

## Lifecycles

Work order: `PROPOSED` (provider has not signed) → `AWAITING_EVIDENCE` →
a round writes `ACCEPTED | REJECTED | UNDETERMINED` as the standing →
`APPEALED` (one appeal; its outcome or its lapse is final for those terms) →
`FINALIZED` (acceptance paid) or `CLOSED` (deadline passed with nothing
accepted; commitment released) or `CANCELLED` (steward, before the provider
signs). A lapsed appeal leaves the order `UNDETERMINED` until it closes.

Amendment: `PROPOSED` → `EFFECTIVE` (after the window, by anyone) or
`WITHDRAWN` (a steward objected inside it). One pending at a time.

Organisation: `ACTIVE` ↔ `PAUSED`. Paused refuses new assets, work orders and
amendments; everything already in flight continues to its end. Dissolution
is out of scope and the README says so.

## The decision, in code

```
conflicts between observations                       -> UNDETERMINED
any criterion NOT_MET or any principle VIOLATED      -> REJECTED
any criterion UNCLEAR or any principle UNCLEAR       -> UNDETERMINED
otherwise                                            -> ACCEPTED
```

NOT_APPLICABLE principles are ignored by the derivation. A leader cannot hide
a violation behind NOT_APPLICABLE: a validator that finds it VIOLATED or
UNCLEAR refuses the acceptance, because the decision is compared and each
node derives its own.

## Floors and their mirrors

| Floor | Mirror |
|---|---|
| A criterion is MET, or a principle SATISFIED, only on an image or the inspector's report | NOT_MET and VIOLATED need the same |
| A party's own document cannot establish a fact | nor refute one, whichever party wrote it |
| A node counts as a reader only when it says it saw the image | a blind node votes against every outcome |

## Consensus

Compared exactly: the derived decision; for a rejection, every criterion and
principle the leader failed; for an acceptance, that this node also accepts;
conflicts; that both nodes received the images. Free: prose, notes, the
ratings that decided nothing. A validator that cannot judge disagrees.

## Standards pre-checked at design time

S7 every money field derived or compared · S8/S27 the provider chooses no
source the panel fetches; references are shown as claims · S17/S26 every hold
has a permissionless exit (close after deadline, lapse after three days) ·
S23 payment reserved at creation · S31 filer claims labelled as claims ·
S33 not applicable (no counterparty repudiation path; the appeal is the
contest) · S34/S42 floors with mirrors · S36/S39 rounds snapshot item digests
of on-chain bytes, so no fetched excerpt exists to bind · S37 one address in
every surface · S38 proofs assert · S40 whole path in the app · S43 every
recorded party is a signer · S44 every judged flag gets a live negative
control · S45 UI state derived from contract states and proved against the
chain.

## Out of scope, stated

Dissolution and treasury withdrawal (an organisation designed to outlive its
founder holds what it was given); fetching external sources; video
interpretation; fiat.
