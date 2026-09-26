# EVERKEEP - Constitutional stewardship of community infrastructure

**An organisation is a rulebook and a treasury. Maintenance work is paid when the evidence
shows it kept the rules the organisation ratified. A document saying so is not that evidence,
and no person holds a key that can pay.**

An EVERKEEP organisation ratifies a constitution. Half of it is enforced by contract code at the
write it governs: which infrastructure it supports, which maintenance it funds, how much one work
order may pay, how many may be open, what evidence must be on file before a panel is asked, how
long an appeal window lasts, and who the stewards are. The other half is judged: numbered
maintenance principles that a panel of GenLayer validators applies to photographs and reports
filed against a work order. Contract code grounds every finding, derives the decision, and moves
the money. Amendments take effect through a window and never change a past decision.

## What it is

- **Two halves, two enforcers.** Rules a constitution can state as facts are checked in code and
  refused in words, with no panel asked. Rules it can only state as principles are put to a
  panel, one principle at a time, and rated against what the evidence shows.
- **A decision that cites its law.** Every round records the constitution version and the terms
  version it applied, and a snapshot of every item it read with the digest the contract computed
  over the bytes it holds.
- **Looking separated from judging.** A node first describes the images and transcribes any
  legible text without being told what the evidence must prove. Only then is it given the
  principles and the criteria.
- **Findings grounded in code.** A criterion is met or unmet, and a principle satisfied or
  violated, only on an image or the independent inspector's report. A party's own paperwork can
  neither establish a finding nor refute one, whichever party wrote it. Doubt never pays.
- **Governance without an owner.** The founder is the first steward and nothing more. Stewards
  act under the constitution in force; the stewards list changes only by amendment; any steward's
  objection withdraws an amendment inside its window; anyone ratifies one after it.
- **Every hold has an exit.** An acceptance pays after its window or an upheld appeal. An order
  nobody accepted closes after its deadline and its commitment returns. An appeal nobody decided
  lapses. All three are permissionless.
- **Pull payments.** A finalized acceptance credits the provider's balance; they draw it. Nothing
  is pushed, so a payee that cannot receive can never block a decision.

## The decision, in code

```text
conflicting observations                          -> UNDETERMINED
any criterion NOT_MET or any principle VIOLATED   -> REJECTED
any criterion or principle left UNCLEAR           -> UNDETERMINED
otherwise                                         -> ACCEPTED
```

| Principle rating | Meaning |
|---|---|
| `SATISFIED` | an image or the inspector's report shows the work kept it |
| `VIOLATED` | an image or the inspector's report shows the work broke it |
| `NOT_APPLICABLE` | the work did not touch what it governs; ignored by the derivation |
| `UNCLEAR` | nothing observed settles it, or the panel's basis was paperwork |

Criteria are rated `MET`, `NOT_MET` or `UNCLEAR` on the same rule.

## The floors the code enforces

| Floor | Mirror |
|---|---|
| a criterion is `MET`, or a principle `SATISFIED`, only on an image or the inspector's report | `NOT_MET` and `VIOLATED` need the same |
| a party's own document cannot establish a fact | nor refute one, whichever party wrote it |
| a node counts as a reader only when it says it saw the image | a blind node votes against every outcome |
| a panel is not asked the same question twice | a decided or lapsed appeal is final for those terms |

## Lifecycle

```text
  create_organization ─► ACTIVE ◄──► PAUSED            (a steward pauses new commitments)
        │
        ├─ propose_amendment ─► vN PROPOSED ─► EFFECTIVE (anyone, after the window)
        │                                   └► WITHDRAWN (any steward, inside it)
        │
        └─ register_asset ─► create_work_order (payment committed; constitution version bound)
                                   │
                                PROPOSED ─► cancel_work_order ─► CANCELLED
                                   │ accept_work_order (the provider signs)
                                   ▼
                            AWAITING_EVIDENCE ─► request_assessment ─► ACCEPTED │ REJECTED │ UNDETERMINED
                                                                              │
                                              open_appeal (one; steward v acceptance, provider v rejection)
                                                                              ▼
                                                                          APPEALED ─► decide_appeal ─► final
                                                                              └─► lapse_appeal ─► UNDETERMINED
                            ACCEPTED ─► finalize ─► FINALIZED ─► claim
                            anything unaccepted, past its deadline ─► close_work_order ─► CLOSED
```

The full machine, with every guard, is in [docs/state-machine.md](docs/state-machine.md).

## Contract

`contracts/everkeep.py`, one file, no owner and no administrator method.

### Write methods

| Method | Who | What |
|---|---|---|
| `create_organization(constitution_json)` | anyone, payable | ratify v1 and fund; the founder must be among its stewards |
| `fund_treasury(oid)` | anyone, payable | add to the treasury |
| `propose_amendment(oid, constitution_json)` | a steward | a whole new constitution, pending through the current window |
| `object_amendment(oid, reason)` | a steward | withdraw the pending amendment inside its window |
| `ratify_amendment(oid)` | anyone | make it effective once the window has passed |
| `pause_organization(oid, reason)`, `resume_organization(oid)` | a steward | stop and restart new commitments |
| `register_asset(oid, asset_json)` | a steward | infrastructure of a supported type, with an optional inspector |
| `accept_inspector_role(aid)` | the named inspector | take the appointment |
| `create_work_order(aid, provider, terms_json)` | a steward | commit the payment, bind the constitution version |
| `accept_work_order(wid, version)` | the provider | sign the pending terms |
| `propose_version(wid, terms_json)` | a steward | revise terms nothing stands on |
| `cancel_work_order(wid, reason)` | a steward | withdraw an unsigned order |
| `submit_image(wid, meta_json, bytes)` | a party | a PNG or JFIF JPEG, held and hashed on chain |
| `submit_document(wid, meta_json, text)` | a party | typed text; only the inspector files an inspection report |
| `submit_declaration(wid, text)` | a party | for the record; never read by a round |
| `submit_reference(wid, meta_json)` | a party | a URL and a claimed digest; shown as a claim, never fetched |
| `request_assessment(wid, named_json)` | the provider | enforced half checked in code, then one consensus round |
| `open_appeal(wid, reason)` | the party the decision went against | once, inside the window |
| `decide_appeal(wid)` | anyone | after the evidence period; a fresh panel re-reads the record |
| `lapse_appeal(wid)` | anyone | three days after that; the appealed decision is never confirmed |
| `finalize(wid)` | anyone | pay an acceptance nobody can still contest |
| `close_work_order(wid)` | anyone | release an unaccepted order past its deadline |
| `claim()` | the payee | draw your own balance |

### Read methods

`get_config`, `get_stats`, `list_organizations`, `get_organization`, `get_constitution`,
`list_assets`, `get_asset`, `list_work_orders`, `work_orders_of`, `get_work_order`, `get_round`,
`get_item`, `get_item_text`, `get_image`, `get_events`, `get_balance`. Every limit the contract
enforces is in `get_config`, so a client never guesses one.

### Consensus guarantees

A validator agrees with the leader only when both received the images, the leader rated every
principle and criterion, and the validator reproduces the decision and its grounds: the same
acceptance, or every finding a rejection rests on, and the same view of conflicts. Prose is
free. The detail is in [docs/consensus.md](docs/consensus.md).

## Verified end to end

Deployment of record on GenLayer Studio Next (chain 61997):

| | |
|---|---|
| Contract | `0x3B144fEf76B942c3DE967c257cc56fde8AEBB79c` |
| Explorer | https://explorer-studio-dev.genlayer.com/address/0x3B144fEf76B942c3DE967c257cc56fde8AEBB79c |
| Source | `contracts/everkeep.py`, byte-for-byte identical to the deployed code (`node scripts/deploy.mjs verify`) |
| Direct tests | 147, including a randomized walk asserting conservation and immutability after every action |
| Mutation sweep | see `docs/proofs/sweep.txt`: every mutant killed, control passes |

The live runs are in `docs/proofs/`. Every claim below is an assertion in the script that
produced the log; a run that failed one would have stopped there.

VERIFIED_BLOCK

## Tech stack

| Layer | Choice |
|---|---|
| Contract | GenLayer intelligent contract, Python, runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| Network | GenLayer Studio Next, chain 61997 |
| Scripts | Node 22, `genlayer-js` 2.0.0-rc.1 |
| Tests | pytest direct mode against a strict stub of the runtime; a mutation sweep over the contract |
| CI | GitHub Actions: lint and validate, direct suite, mutation sweep |

## Repository

```text
contracts/everkeep.py        the contract
tests/direct/                the direct suite and its harness (conftest.py, _fixtures.py)
tests/mutation/mutate.py     the sweep
scripts/                     keys, deploy and verify, proofs, paths
docs/                        blueprint, state machine, consensus, evidence model, security, proofs
fixtures/images/             the demonstration photographs, attributed in fixtures/ATTRIBUTION.md
```

## Getting started

```bash
python -m venv .venv && . .venv/Scripts/activate      # or .venv/bin/activate
pip install -r requirements.txt
genvm-lint check contracts/everkeep.py
python -m pytest tests/direct -q
python tests/mutation/mutate.py
```

```bash
cd scripts && pnpm install && cd ..
node scripts/keys.mjs                    # creates and funds .data/keys.json (gitignored)
node scripts/deploy.mjs v0.1.1           # deploys; then: node scripts/deploy.mjs verify 0x…
node scripts/proofs.mjs 0x…              # the adjudication, about an hour of real windows
node scripts/paths.mjs 0x…               # governance and money paths, about twenty minutes
```

## Security

No owner, no administrator, no withdrawal, pull payments, refusals in words, an adversarial
audit before the deployment of record with its findings fixed and pinned. Known limits are
stated in [docs/security.md](docs/security.md).

## Disclaimer

A demonstration built for the GenLayer hackathon. The organisation on the record is fictional,
the photographs are freely licensed and attributed, and nothing here is anyone's contract.
