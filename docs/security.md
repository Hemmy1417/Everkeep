# Security

## Access control, in the contract

| Act | Who |
|---|---|
| found | anyone; they must be a steward in the constitution they ratify |
| propose or withdraw a motion, pause, resume, authorise or revoke providers, enrol or retire assets, commission, revise or cancel work | a steward under the constitution in force |
| enact a motion, complete a dissolution, fund, finalize, settle, close | anyone, when the state allows |
| accept terms, request the assessment | the assigned provider |
| file evidence | the provider, the accepted independent inspector (not a steward), the appellant steward during their appeal |
| appeal | a steward against an acceptance; the provider against a rejection or an undetermined outcome |
| readjudicate | the appellant at once; anyone after the evidence period |

No check lives only in the app.

## The security matrix from the brief

| Case | Where it is refused | Pinned by |
|---|---|---|
| unauthorised organisation, constitution, asset or work order mutation | `_require_steward` | `test_organization.py`, `test_assets_and_orders.py` |
| unauthorised evidence submission | `_filer` | `test_adjudication.py`, `test_boundaries.py` |
| unauthorised assessment or appeal | `request_assessment`, `open_appeal` | `test_adjudication.py`, `test_lifecycle.py` |
| wrong constitution version | work orders bind the version at creation; revisions validate under it | `test_assets_and_orders.py`, `test_audit.py` |
| wrong work order version | only the current version's evidence is read; acceptance names the version | `test_assets_and_orders.py` |
| duplicate assessment | one per order; after it, only appeal | `test_lifecycle.py` |
| replay | each write checks state; a state it has left refuses it again | the random walk |
| expired work order | deadline checks on filing, assessment, acceptance, close | `test_boundaries.py` |
| already finalized | `finalize`, `settle`, `close_work_order` guards | `test_lifecycle.py` |
| invalid evidence reference | only filed ids ground a finding; references never read | `test_adjudication.py` |
| malformed nondeterministic result | read as nothing, never as acceptance; notes cut to shape | `test_adjudication.py`, `test_boundaries.py` |
| external evidence failure | nothing is fetched; a lost image blinds a node, which cannot vote | `test_adjudication.py` |
| validator disagreement | no majority writes nothing | `test_adjudication.py` |
| unsafe settlement | only from `PAYMENT_RELEASABLE` | `test_lifecycle.py` |
| treasury underfunding | reserve-aware `_spendable` at commitment | `test_assets_and_orders.py` |

The mutation sweep (`tests/mutation/mutate.py`) breaks each of these rules
in turn and proves a test fails. Its record is in `docs/proofs/sweep.txt`.

## Fail-closed behaviour

LLM uncertainty, missing images, malformed answers and consensus failure can
produce `UNDETERMINED` or a failed transaction, never `ACCEPTED`. Undetermined
never releases treasury funds.

## Evidence integrity and trust in the page

Photographs and documents are hashed by the contract when filed and never
change. The app fetches each photograph back from the contract, hashes it in
the browser and says whether it matches. The app holds no authoritative
state: decisions, balances and lifecycle are read from the contract, and a
write is shown as confirmed only when its transaction is finalized with a
successful execution. The wallet signs every write; there is no backend
signer and no key in the page.

## What an adversarial review found

Before the deployment of record, an independent reviewer audited the rebuilt
contract. It found eight defects, all fixed and pinned in
`tests/direct/test_audit.py`:
1. A panel could mark a work order's own criteria "does not apply".
2. A steward's appeal left undecided could cancel an acceptance.
3. A provider who had used their full quota could not answer an appeal.
4. Independence was not rechecked after an amendment.
5. A paused or dissolving organisation could grow a commitment.
6. A pending revision could hold an expired order open.
7. Required evidence given as a non-list crashed instead of refusing.
8. The leader's notes were stored as sent.

## A review against the judges' standards (everkeep-rules-3)

A read-only audit of the v2 deployment against the judges' standards found one
standard unmet and several partly met. Each is answered in the contract, the
app or the wording, and pinned by a test in `tests/direct/test_standards.py`,
a mutant in `tests/mutation/mutate.py`, or an assertion in the live proofs.

| Finding | What changed |
|---|---|
| The payer's own photographs could fail a requirement | `_witnessed`: a steward's photographs ground NOT SATISFIED only beside a provider photograph or the inspector's observation |
| The provider's own photographs alone could pass work past an inspector | the mirror: on an asset with an accepted inspector, SATISFIED on a principle or criterion needs the inspector's observation |
| A rejection could be recorded on evidence found insufficient | `_outcome` checks sufficiency and conflict before anything conclusive; the published rule says so; sufficiency now means enough to decide either way |
| The same bytes could count twice | `_file` refuses bytes already on file for the work order |
| A leader's recorded ratings were not re-checked | `_shape` and grounding run again on the recorded result after consensus |
| The record did not say what consensus bound | each decision records `bound`: the outcome, and the requirements every validator reproduced |
| Labels and conflicts were loosely defined for the panel | the prompt says labels are the filer's claims and a conflict must name two pieces of evidence |
| Stewards were recorded on someone else's say-so | `accept_steward_role`: a named steward acts only after accepting |
| An organisation whose stewards vanish stranded its treasury | `dissolve_abandoned`: anyone, after 365 days without a steward acting |
| Records grew without bound | an asset keeps its last 50 work orders and service entries, an organisation its last 20 motions, with totals |
| The app offered an assessment the contract would refuse | `preflightGap` in `web/lib/acts.ts` mirrors `_preflight_gap` |
| The live proofs never ran the app's own rules | `scripts/proofs.mjs` imports `web/lib/acts.ts` and asserts it against chain state at every stage |
| No live test of the conflict and different-equipment flags | the proofs now include a mislabelled photograph and a report contradicting the photographed display, with the flagship as the negative control |
| No test that a write is signed by the connected wallet | `web/tests/signed.test.ts` |

## Known limits

- GenLayer does not establish physical truth. A skilled forgery of a site
  photograph can deceive validators as it would deceive a person; the
  independent inspector role exists for work that matters enough to need one.
- Professional inspection cannot be replaced by photographs for every kind of
  work; the constitution can require the inspector's report per kind of work.
- A steward can no longer fail a requirement on their own photographs (see
  below), but a contradiction the panel names between a steward's photograph
  and the provider's file still gives `UNDETERMINED`. The record shows exactly
  who filed what, and an appeal nobody decides lets the appealed decision
  stand.
- Video is not interpreted and links are not fetched.
