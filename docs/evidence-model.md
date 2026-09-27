# The evidence model

## Kinds

| Kind | Types | Held | Adjudicated | Can establish a finding |
|---|---|---|---|---|
| `IMAGE` | before, after, nameplate, meter display, site, document scan | bytes on chain, at most 400,000, PNG or JFIF JPEG | examined by every node | yes |
| `DOCUMENT` | technician report, inspection report, inspection checklist, meter reading, maintenance log, work order document, equipment document, invoice | text on chain, at most 6,000 characters | read by every node | only the independent inspector's report or checklist |
| `TEXT_DECLARATION` | | text on chain | never | no |
| `REFERENCE` | video reference, external source | link and the hash the submitter claims | never, and never fetched | no |

Every item records its submitter and role, the work order version it was
filed against, the submission time, a SHA-256 the contract computed over the
bytes it holds, and provenance the submitter claims (description, capture
time, location, source). **Metadata is evidence validators may consider, and
never proof by itself**: a GPS position does not prove work happened there,
and a timestamp does not prove when a repair happened.

## Why photographs are stored on chain

The brief prefers off-chain storage with an on-chain hash. EVERKEEP stores
the photographs themselves, deliberately:

- every validator must examine identical bytes, and the runtime passes
  images to the model directly, so the contract needs the bytes anyway;
- an off-chain store would be a service someone must keep running, which is
  the dependency an autonomous organisation is meant not to have;
- a reader can fetch a photograph from the contract and recompute its hash,
  which the app does for every photograph it shows.

The cost is a size cap (400,000 bytes, enforced) and the runtime's formats.

## Who files

| Role | When | Allowance |
|---|---|---|
| The assigned provider | while the work is active, before the deadline; and during an appeal | 6 photographs, 6 texts; 2 and 2 more on appeal |
| The asset's inspector, once they accept and while not a steward | the same | 3 and 3; 2 and 2 more on appeal |
| A steward | only during the appeal they opened | 2 and 2 |

Only the inspector files an inspection report or checklist. Nothing is filed
after a decision except during an appeal, so evidence cannot change after it
has been assessed.

## Required evidence, checked in code

Before an assessment is allowed, the contract checks the constitution's
evidence rules for this kind of work, the work order's own requirements, the
inspector's report where the constitution requires one, and that at least one
photograph is on file. The counts:

| Requirement | Met by |
|---|---|
| Before, after, nameplate photograph | an image with that view |
| Operational reading | a meter display photograph, or a meter reading document |
| Technician report, equipment document | that document type |
| Inspection report, inspection checklist | that document, filed by the inspector |

## Snapshots

Every decision records an evidence snapshot: the organisation, the
constitution and work order versions, the asset, the time, and every item it
read with its kind, type, role, hash and whether it was filed during the
appeal. A decision is therefore never an unexplained boolean.

## Limits

Video is never interpreted; the runtime does not support it, so it is kept as
a reference. External links are never fetched, so a submitter can never
choose a source a panel reads. Two images per model prompt is the runtime's
limit, which is why photographs are examined in pairs.
