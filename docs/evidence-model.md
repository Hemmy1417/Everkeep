# The evidence model

Four kinds of item, one rule about what can establish a fact, and one rule
about who may file.

## Kinds

| Kind | Held on chain | Read by a round | Can ground a finding |
|---|---|---|---|
| `IMAGE` | the bytes, PNG or JFIF JPEG, at most 400,000 | yes, two per prompt | yes |
| `DOCUMENT` | the text, at most 6,000 characters, with a type | yes, inside fences | only the accepted inspector's `INSPECTION_REPORT` |
| `DECLARATION` | the text | never | no |
| `REFERENCE` | a URL and the digest the filer claims for it | never, and never fetched | no |

Every item records its filer, its role at the time, the version of terms it
was filed against, and a SHA-256 the contract computed over the bytes it
holds. A round's record snapshots every item it read with that digest, so a
later reader can fetch the bytes back and prove what was judged.

Document types: `TECHNICAL_REPORT`, `INSPECTION_REPORT`, `METER_READING`,
`MAINTENANCE_LOG`, `WORK_ORDER_DOCUMENT`, `INVOICE`, `OTHER`. Only the asset's
accepted inspector may file an `INSPECTION_REPORT`; a provider who tries is
told to file a technical report instead. Image origins: `PHOTO`, `NAMEPLATE`,
`METER_DISPLAY`, `VIDEO_FRAME`, `SCAN`. An image filed as a meter display
counts toward a `METER_READING` evidence requirement.

## The grounding rule

A finding is an assertion about the site. A photograph witnesses the site.
The independent inspector's report witnesses the site. Everything else a
party files is that party's account: a datasheet says what was ordered, a
log says what the provider says they did, a steward's note says what the
steward believes. So:

- a criterion is `MET` or `NOT_MET`, and a principle `SATISFIED` or
  `VIOLATED`, only when the panel's cited basis holds an image or the
  inspector's report;
- the floor and its mirror fall the same way, so neither the provider's
  paperwork nor a steward's can move the outcome by itself;
- an ungrounded rating becomes `UNCLEAR`, and the round's record keeps the
  raw rating beside the grounded one so the difference is visible;
- `NOT_APPLICABLE` needs no observation, because it claims nothing about the
  site, and the derivation ignores it.

The rule is code (`_observed`, `_ground`). The prompt states it as well, but
nothing depends on the model remembering.

## Who files, and how much

| Role | Images per version | Texts per version | Named in an assessment |
|---|---|---|---|
| Provider | 12 | 8 | up to 4 images and 4 documents of their own |
| Steward | 3 | 3 | never named; always read |
| Inspector (accepted) | 4 | 3 | never named; always read |

The provider chooses what to present, never what the panel is allowed to
see: every image and document a steward or the inspector filed against the
version is read in every round. Declarations and references are shown to
every party and read by nobody.

Once a decision stands on a version, each party may add at most 2 new
images and 2 new documents before the next round, whether that round is a
re-assessment or an appeal, so the fullest round still fits one panel. A
re-assessment needs something new on the record; the same evidence is not
put to a second panel. Nobody files against a standing acceptance without
opening an appeal, so no answer can sit unread while money is free to move.

## What the enforced half checks before any panel

`_required_gap` runs before a round: the constitution's minimum image count,
its inspection-report requirement, and the work order's own
`required_evidence` counts. A shortfall is a refusal in words, and no prompt
is sent.
