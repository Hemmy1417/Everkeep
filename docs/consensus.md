# Consensus

An assessment or a readjudication is one `gl.vm.run_nondet(leader_fn,
validator_fn)` round. Nondeterministic code produces a structured result and
never writes state; the contract records the decision afterwards, in
deterministic code.

## What each node does (`_assess`)

1. **Examine.** Photographs go to the model two at a time (the runtime's
   limit), before and after together so they can be compared. The node is
   given the asset and the work order and asked to report only what is
   visible: equipment and condition, legible text, readings as quantity,
   value and unit, anything suggesting a different site, and for a before
   and after pair what changed. A node counts as having seen a photograph
   only if it says so and describes it; otherwise it is blind.
2. **Judge.** The node rates every requirement in scope:
   - the constitution's maintenance principles that apply to this kind of work
     (the scope is chosen in code);
   - the work order's acceptance criteria;
   - three consistency checks the contract always asks: the evidence belongs
     to this asset (S1), before and after support the work (S2), the
     provider's documentation matches what was seen (S3).

   Each is `SATISFIED`, `NOT_SATISFIED`, `NOT_ESTABLISHED`, or, for a
   principle only, `NOT_APPLICABLE`, with the evidence it relied on. It also
   says whether the evidence as a whole suffices and whether anything
   contradicts anything else.
3. **Ground, in code.** A requirement is satisfied or not satisfied only if
   its basis includes a photograph or the independent inspector's report or
   checklist. S3 needs a provider document and an observation both. Anything
   else becomes not established. Whether S2 and S3 can apply at all is
   decided in code from the file.
4. **Derive, in code.** The outcome follows the decision rule in
   `constitution.md`.

## What is compared (`_dissent`)

A validator agrees only if it saw every photograph, the leader did too, and:

| The leader says | the validator must |
|---|---|
| anything | find every requirement rated with a known status by the leader |
| a conflict | see a conflict too |
| `ACCEPTED` | reach `ACCEPTED` itself |
| `REJECTED` | find every requirement the leader failed not satisfied too, and see no conflict |
| `UNDETERMINED` | not reach `ACCEPTED` |

Consensus binds the outcome and the grounds it rests on. Prose (the
reasoning, the notes) is free to differ and is stored only after being cut
back to shape; it is never what agreement was about.

## Why the asymmetry

Doubt never pays, so a validator that shares the leader's doubt agrees
whatever its wording. A leader cannot withhold an acceptance the validator
would grant, cannot invent a conflict, and cannot reject on grounds the
validator does not reproduce.

## Failure

If a node cannot answer (an unreadable model reply, a lost image), it asks
once more, then fails. A validator that cannot assess disagrees. A round
without a majority writes nothing: the work order is untouched and the
provider or appellant can ask again. Malformed output is read as nothing,
and never as agreement: an unknown status becomes not established, a string
where a list belongs becomes no basis, and `evidence_sufficient` counts only
if it is exactly `true`.

## Finality

A decision is appealable for the constitution's window, if appeals remain.
Readjudication records a new decision linked to the one it reviews, and
marks the old one superseded without changing it. When no appeal is open and
none remains possible, anyone finalizes. GenLayer's own transaction finality
is separate from this: the app shows a write as confirmed only once its
transaction is finalized with a successful execution.

This document describes what the contract does. It does not claim anything
about validator selection or network internals the runtime does not expose.
