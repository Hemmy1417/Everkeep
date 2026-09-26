# Security notes

What the contract defends against, what it deliberately leaves to the
parties, and what an adversarial reading found before the deployment of
record.

## No owner, no administrator

The deployer is recorded and read by no method. After the founder ratifies
the first constitution, every steward-only write checks the sender against
the stewards list of the constitution in force, and that list changes only
by a ratified amendment. A founder who is not on the list they proposed is
refused at creation. There is no pause that outlasts a steward's decision to
resume, no withdrawal, and no dissolution: the treasury holds what it was
given until a finalized acceptance pays it out.

## Money

- Every payment is committed from the treasury at the moment the order is
  created, and the commitment follows the version the provider signed. Two
  orders can never be funded from the same GEN.
- Nothing is pushed. A finalized acceptance credits the provider's claimable
  balance; the provider draws it. The balance is zeroed before the transfer.
- A payable write that refuses returns normally and credits the value back,
  because on this platform a payable write that raises keeps the value while
  reverting the state that would have recorded it.
- Money fields are whole numbers or digit strings. A JSON float, a boolean
  or a list is refused, never converted.
- The random walk in the direct suite asserts after every action that
  `held + claimable + claimed` equals everything ever sent in.

## The panel

- Party text reaches the panel inside fences it cannot close: `<<<`, `>>>`
  and `END ITEM` are rewritten in every party string.
- The reading step is blind to the rules, so a node cannot read the
  expected answer into a blurred label.
- Findings are grounded in code and the decision is derived in code. No
  model is asked whether a work order should pay.
- A node that did not receive the images cannot vote; a leader that did not
  is not agreed with.
- A malformed model answer (a string where a list was asked for, an image
  number that is not a number) is read as nothing, never as a crash and
  never as agreement.
- Consensus binds the decision and its grounds, not prose. See
  `docs/consensus.md`.

## Finality

- One appeal per decision, inside the constitution's window, by the party
  the decision went against. Its outcome, or its lapse, is final for those
  terms: the provider cannot ask another panel; a steward can propose new
  terms and the provider can sign them.
- A panel is not asked the same question twice: a re-assessment needs new
  evidence on the record since the last decision.
- Once a decision stands, each party adds at most two images and two
  documents before the next round, counted from the decision rather than
  from the appeal, so nothing filed in between escapes the bound.
- Signing new terms clears the old decision: no window, appeal or mark
  survives a new signature.

## Deadlines

Deadlines must carry their timezone. A naive datetime would be read in each
node's local zone, and two nodes in two zones would disagree on when a
deadline passed. Stored values are always emitted in UTC with `Z`.

## Known limits, stated

- **A steward can hold a payment in doubt.** Steward evidence is always
  read, and a conflict between observations makes the round undetermined,
  which is not appealable. A steward who files photographs of different
  equipment can therefore keep an order from paying until its deadline. The
  treasury is the stewards' to commit, and the record shows exactly what
  was filed and by whom; the provider's remedy is new evidence and, beyond
  that, the record. A future version could make an undetermined standing
  appealable by the provider.
- **A leader may report doubt where a validator would reject.** The outcome
  either way withholds payment; the difference is whether the record says
  rejected or undetermined. Since a re-assessment needs new evidence and an
  appeal is the only contest, doubt cannot be re-rolled into an acceptance.
- **Views are unauthenticated and unpaginated within an item.** Evidence
  bytes are public by design; an organisation's record is meant to be read.
- **No fetching.** References are shown as claims and never resolved. A
  provider chooses no source the panel reads.

## What the adversarial audit found

Before the deployment of record a fresh reader audited the contract against
the blueprint. Seven findings were fixed and pinned in
`tests/direct/test_finality.py`: re-assessment after a decided or lapsed
appeal; the additions bound counting only from the appeal; a stale standing
after a new signature; naive deadlines; model answers that could crash a
leader; JSON-number money; and re-priced terms while paused. Two were
recorded above as limits. Two were judged low and left: an evidence
requirement above what one round reads (now capped), and the cost of
deriving asset status from its orders on a long-lived organisation.
