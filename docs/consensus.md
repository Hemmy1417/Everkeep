# Consensus: what a validator must reproduce

One assessment is one `gl.vm.run_nondet` round. The leader observes the
evidence and returns its result; each validator observes the same evidence
for itself and then decides whether the leader's result can stand. The
code is `_run_round`, `_observe` and `_unconfirmed` in
`contracts/everkeep.py`.

## What one node does

1. **Look.** The images, two per prompt, are shown without the constitution
   or the work order: describe what is visible, transcribe legible text, note
   concerns, and say whether an image actually arrived. A node counts as a
   reader only when it says it saw the image and describes what it saw.
2. **Judge.** The node is given the organisation's principles, the order's
   acceptance criteria, its own reading of the images and every document,
   and rates each principle `SATISFIED | VIOLATED | NOT_APPLICABLE | UNCLEAR`
   and each criterion `MET | NOT_MET | UNCLEAR`, citing the items it relied
   on. Party text arrives inside fences it cannot close.
3. **Ground.** Code, not the model: a criterion is `MET` or `NOT_MET`, and a
   principle `SATISFIED` or `VIOLATED`, only when its basis holds an image or
   the accepted inspector's report. Otherwise the rating becomes `UNCLEAR`.
   The favourable floor and its mirror fall the same way.
4. **Derive.** Code again: conflicts give `UNDETERMINED`; any `NOT_MET` or
   `VIOLATED` gives `REJECTED`; any `UNCLEAR` gives `UNDETERMINED`; otherwise
   `ACCEPTED`. `NOT_APPLICABLE` is ignored.

## What is compared

| The leader says | A validator agrees only if |
|---|---|
| anything | it received the images, and the leader did |
| anything | the leader rated every principle and every criterion with a known status |
| a conflict | it sees a conflict too |
| `ACCEPTED` | it derives `ACCEPTED` from its own grounded ratings |
| `REJECTED` | every criterion the leader found `NOT_MET` it finds `NOT_MET`, every principle the leader found `VIOLATED` it finds `VIOLATED`, and it sees no conflict |
| `UNDETERMINED` | it would not accept |

Prose, notes, the leader's reasoning and the ratings that decided nothing
are free to differ. What is bound is the consequence: whether the money
moves, and on which findings.

## Why the asymmetries

- **Doubt is cheap to agree to.** A validator that finds a principle unclear
  where the leader found it satisfied refuses an acceptance, but a leader
  that reports doubt where a validator would reject is not overruled: the
  outcome either way withholds payment, and the provider's remedy is new
  evidence, never a re-roll of the same question.
- **A rejection names its grounds.** The record shows which findings the
  rejection rests on, and every validator that agreed reproduced each one.
  A leader cannot reject on a principle the panel did not find violated.
- **`NOT_APPLICABLE` is not a hiding place.** A leader that calls a principle
  not applicable and accepts is refused by any validator that finds it
  violated or unclear, because each node derives its own decision and the
  decisions are compared.
- **A blind node cannot vote.** Measured on Studio Next: a validator that
  received no image once reported it as readable and explained the missing
  image in the description. Now a node is a reader only when it says so and
  describes what it saw, and a round with a blind leader or a blind validator
  fails in words, writing nothing, so it can be asked again.

## What a failed round leaves

Nothing. A round that reaches no majority is `UNDETERMINED` at the network
level and the work order is untouched. The proof scripts ask again and keep
every attempt in the log, because a run that shows only the attempt that
carried is not reporting what this network does.
