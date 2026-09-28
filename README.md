<p align="center"><img src="https://raw.githubusercontent.com/Hemmy1417/Everkeep/main/web/public/logo.svg" width="320" alt="EVERKEEP"/></p>

# EVERKEEP - Autonomous Infrastructure Stewardship Fund

**Infrastructure that can keep itself funded, verified and maintained.**

EVERKEEP is an autonomous organisation that keeps community infrastructure maintained. It has a mission,
a versioned constitution, a treasury, a registry of the infrastructure it maintains and a registry of the
service providers it may pay. When a provider claims a repair is done, the organisation asks one question:

> Given this constitution, this asset, this exact version of the work order and the evidence filed against
> it, does the evidence establish that the maintenance was done as required?

A normal smart contract can enforce deterministic organisational rules and payment conditions, but it cannot
natively adjudicate whether multimodal real-world evidence demonstrates that physical infrastructure
maintenance satisfies a contractual and constitutional requirement. EVERKEEP uses GenLayer as the
decentralized judgment layer between that evidence and autonomous organisational action. GenLayer does not
guarantee physical truth. It decides whether the evidence filed establishes the work, and fails closed when
it does not.

## The problem

Community infrastructure needs maintenance for decades: a solar array's controller fails, a battery bank's
connections corrode, an inverter trips. Someone must decide, job by job, whether the repair was actually done
before paying for it. That someone leaves, and the infrastructure stops being maintained.

- **Ordinary smart contracts are not enough.** They can hold the money and enforce the rules, but "the
  photographs, the meter reading, the technician's report and the inspector's checklist together show the
  controller was replaced and the bank is charging" is not a fact any chain holds.
- **A centralized oracle is not the answer.** Whoever makes that judgment becomes the operator the
  organisation was meant not to need, and a single point that can pay for work nobody did.

## Why GenLayer

The judgment is made by GenLayer validators under consensus:
1. Each validator examines the photographs itself, before and after together, and reads the documents.
2. It rates every requirement in scope.
3. Contract code grounds each rating: only a photograph or the independent inspector's observation can
   establish or refute a finding, and no finding rests only on the photographs of the party it favours
   when anything else could carry it (see below).
4. Code derives the outcome. Evidence the validators find not enough to decide, or a contradiction they can name
   between two pieces of evidence, gives `UNDETERMINED`, never a conclusive verdict.
5. Each validator repeats the whole assessment and votes against the leader when it would not reach the
   same outcome. An acceptance must be every validator's own acceptance. A rejection must be reproduced
   on each requirement it fails. A doubtful result stands unless a validator would accept. The record
   marks which ratings every validator reproduced; the rest are the leader's reading, labelled as such.

Everything ordinary code can decide stays deterministic: who may act, whether the asset and the provider are
enrolled for this work, whether the payment fits the budget, the constitution's limits and the treasury's
reserve, whether the required evidence is on file, and whether a window is open.

## The autonomous organisation

```text
MISSION → CONSTITUTION → TREASURY → MAINTENANCE RULES → REAL-WORLD WORK → EVIDENCE
   → DETERMINISTIC PREFLIGHT → GENLAYER ADJUDICATION → DECISION → APPEAL / READJUDICATION
   → FINALITY → TREASURY ACTION → ASSET BACK TO MONITORING → NEXT MAINTENANCE CYCLE
```

| Part | What it is |
|---|---|
| **Constitution** | Versioned and immutable once in force. The enforced half covers scope, funded work, the inspector requirement, evidence rules, payment limits, reserve, emergency rules, appeal rules and stewards; code checks all of it. The judged half is the maintenance principles, each scoped to the kinds of work it governs; GenLayer rates those. Every work order and every decision cites its version. It changes only by a motion that waits out a window any one steward can withdraw it in. See [docs/constitution.md](docs/constitution.md). |
| **Treasury** | Funded by anyone. A payment is committed when work is commissioned, becomes releasable only on a finalized acceptance, and leaves only by settlement to the provider. There is no withdrawal and no owner. See [docs/treasury.md](docs/treasury.md). |
| **Infrastructure registry** | Assets with a type the constitution supports, a technical profile, a service interval, an optional independent inspector who must accept, and a service log. Status is derived: monitoring, service due, under maintenance, retired. |
| **Service providers** | Authorised by stewards for named kinds of work. Revocation stops new assignments and never strands work already done. |
| **Work orders** | Versioned terms with acceptance criteria, required evidence, budget, payment and deadline, bound to the constitution version in force at creation. |
| **Multimodal evidence** | Photographs held and hashed on chain, examined by every validator. Documents are read. Declarations and video or external links are kept and never adjudicated. See [docs/evidence-model.md](docs/evidence-model.md). |
| **Appeal and readjudication** | The party a decision went against appeals inside the window. Every party may add bounded evidence. The validators record a new decision linked to the original, which is never overwritten. |
| **Finality and settlement** | When no appeal is possible, anyone finalizes. An acceptance makes the payment releasable and anyone settles it. Anything else closes unpaid and returns the commitment. The asset returns to monitoring and the next work order can follow. |
| **Dissolution** | By motion. No new commitments. Once open work ends, the treasury is refunded in full to the beneficiary the constitution names. |

## Architecture

```text
 wallet (EIP-1193, Transaction Kit)              web/ (Next.js): an interface, never the source of truth
            │ signed writes                                    ▲ budgeted unsigned reads
            ▼                                                  │
 contracts/everkeep.py ── organisation, constitution versions, treasury, providers, assets, work orders,
                          evidence, decisions, snapshots, refunds, events
            │
            ├─ deterministic preflight  (refuses in words; no validator asked)
            ├─ gl.vm.run_nondet(leader_fn, validator_fn)
            │     examine photographs → rate requirements → ground in code → derive outcome
            │     validators repeat independently; outcome and grounds must match
            └─ deterministic record: decision + evidence snapshot, lifecycle, treasury
```

There is no backend, database or server signer. The reasoning behind this shape is in
[docs/design.md](docs/design.md). See [docs/architecture.md](docs/architecture.md),
[docs/consensus.md](docs/consensus.md), [docs/state-machine.md](docs/state-machine.md) and
[docs/security.md](docs/security.md).

## Decision states

| Outcome | When |
|---|---|
| `ACCEPTED` | every requirement in scope satisfied on photographs or the inspector's observation, the evidence sufficient, no contradiction |
| `REJECTED` | at least one requirement shown not satisfied |
| `UNDETERMINED` | anything not established, the evidence insufficient, or a material contradiction. Never pays. |

A decision's lifecycle runs appealable, then appealed or finalized; an appealed decision is superseded by
its readjudication and kept exactly as recorded. A work order runs:
- proposed, active, decided;
- optionally under appeal;
- then payment releasable and settled, or closed unpaid, or cancelled.

## Verified end to end

| | |
|---|---|
| Deployment of record | `0xF71522A090BFDd32f3C5B0d87E518563B19fec4f` on GenLayer Studio Next |
| Explorer | https://explorer-studio-dev.genlayer.com/address/0xF71522A090BFDd32f3C5B0d87E518563B19fec4f |
| Source | byte-for-byte identical to `contracts/everkeep.py` (`node scripts/deploy.mjs verify`) |
| Contract tests | 120 direct tests, including a randomized walk that asserts the brief's invariants after every action and reaches every work order state, and one test per judges' standard in `tests/direct/test_standards.py` |
| Contract sweep | 99 mutants, 99 killed, control passes ([docs/proofs/sweep.txt](docs/proofs/sweep.txt)) |
| App tests | 25, including every contract write reachable from a page, the action rules on shapes the contract writes, and a write signed by the connected wallet |
| App sweep | 37 mutants, 37 killed |
| Adversarial review | eight defects found before deployment, all fixed and pinned ([docs/security.md](docs/security.md)) |

**The flagship story, live** ([docs/proofs/proof-run.txt](docs/proofs/proof-run.txt), every hash in
[proofs.json](docs/proofs/proofs.json)). Every row below is an assertion in `scripts/proofs.mjs`; a row
the script only logs says so.

| Case | Evidence | Outcome on chain |
|---|---|---|
| Enforced half | an unsupported asset type, unfunded work, a payment over the cap, an unauthorised provider, a stranger commissioning, an assessment with nothing on file, a provider's "inspection report", the same photograph filed twice, a named steward acting before accepting | nine refusals in words; no panel asked |
| Charge controller replacement | after photograph, controller display, technician report, the inspector's checklist | **Accepted**. Every principle and criterion met cites the inspector's checklist, as the inspector floor requires. No conflict raised and the photographs found to show the enrolled asset: the negative controls. Early finalize, settle and a provider's appeal of an acceptance were each refused. Finalized after its window, then **settled**: the treasury paid exactly 2 GEN and the asset's service was recorded, with the next service scheduled |
| Battery connections service | a photograph showing temporary clip leads on the terminals | **Rejected**, on evidence found sufficient to decide, with the clip-lead principle among the failures (logged: the mounting principle and the criterion too). The record lists those failures as the ones every validator reproduced. Finalized: closed unpaid |
| Mislabelled equipment | the back of a solar panel, filed as "the new charge controller fixed to the board" | not accepted, and the criterion not met (asserted). Logged: **rejected** on the check that the evidence shows this asset; the panel's own observation was of "a photovoltaic solar panel mounted outdoors on a black metal pole-and-brace stand ... no battery bank, charge controller, LCD display" |
| Contradicted report | the controller close-up beside a reading on paper stating 14.6 V | **conflict flagged** (asserted) and not accepted. Logged: the panel's note names both pieces of evidence and the two voltages |
| Return to charging | the overview photograph and a reading on paper | not accepted (asserted). Logged: **rejected** on the mounting principle |
| A steward contests an acceptance | after photograph and the inspector's checklist; on appeal, the steward's own photograph of the battery terminals | **Accepted**, then the steward appealed with their own photograph. The **readjudication** kept the acceptance, and no requirement failed on the steward's photograph alone (asserted from the recorded basis). The readjudication is linked to the decision it reviewed, which is kept as superseded ([readjudication-link.json](docs/proofs/readjudication-link.json)). The first assessment took a second asking to reach a majority |
| The app's own rules | `web/lib/acts.ts`, run against chain state at twelve moments | all twelve matched: seven acts the page offered just before the contract accepted them, and five it withheld where the contract refuses or has not yet opened the act |
| The next cycle | | a new work order commissioned on the same asset |

One round reached no majority and was asked again, and every assessment needed at least one leader
rotation, mostly past a node that could not see the photographs. The run records which in its last lines.

**Found by these proofs, and fixed.** A first run on a disposable deployment showed the examining
model the submitter's description with the photograph. One leader then described "a solar charge
controller mounted on a wooden board" in the photograph of the panel's back: it repeated the claim
instead of looking. Only the inspector floor kept that from being paid. The examination now sees the
photograph alone; descriptions are weighed afterwards, as claims, against what was seen. A second run
then showed panels splitting on the "this asset" check, read by some as proof of identity, and on a
reading of 12.8 V beside a report of 12.5 V raised as a conflict. The judging prompt now says the check
asks whether anything shows a different site, and that a slightly different reading meeting the same
requirement is not a conflict. The deployments those runs used are superseded; the run above is on the
deployment of record, with the contract as it stands.

**The organisation, live** ([docs/proofs/paths-run.txt](docs/proofs/paths-run.txt)), on a second deployment of the
same bytes, `0xb4665b7c7189B4800bbCD1bbA6b9ecB4FD485d8A`, so that a network stall in this long run could never
block the contract the app writes to (one once did):
- **Motions.** A steward's amendment was withdrawn by another steward's objection. A second amendment was
  enacted by a stranger after its window. A work order created under v1 kept v1.
- **Providers.** A revoked provider could not be assigned new work.
- **Pause.** Pausing refused new work, while work in flight continued.
- **Revisions.** A revision moved the commitment only when the provider accepted it.
- **Endings.** Cancellation and closing each returned their commitment.
- **Dissolution.** It was proposed and enacted, refused while work was open, then completed, and the
  beneficiary claimed the full treasury.

**The app, in a browser** ([docs/proofs/ui-bench.md](docs/proofs/ui-bench.md)): on the previous
deployment, a stranger finalized a decision, and the provider accepted the next cycle's terms and filed a
declaration, each composed by the pages, signed through the app's own wallet picker and confirmed from
the chain. The signing path is unchanged in this deployment; its action rules are proved against this
deployment's chain in the run above.

## Deployment, environment and testing

| | |
|---|---|
| Network | GenLayer Studio Next, chain 61997, `https://studio-next.genlayer.com/api` |
| Contract | `contracts/everkeep.py`, runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| App | `web/`: Next.js 16, React 19, TypeScript strict, Tailwind 4, `@genlayer/transaction-kit` 0.1.0-rc.2, `genlayer-js` 2.0.0-rc.1 |
| Scripts | `scripts/`: keys, deploy and verify, fixtures, proofs, paths |

Environment variables for the app (all optional; defaults point at the deployment of record):

```text
NEXT_PUBLIC_EVERKEEP_CONTRACT     contract address
NEXT_PUBLIC_EVERKEEP_ORG          the organisation the dashboard opens on (default org-00001)
NEXT_PUBLIC_GENLAYER_RPC_URL      RPC endpoint
NEXT_PUBLIC_GENLAYER_CHAIN_ID     chain id
```

```bash
pip install -r requirements.txt
genvm-lint check contracts/everkeep.py
python -m pytest tests/direct -q
python tests/mutation/mutate.py
```

```bash
cd web && pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm mutate && pnpm build && pnpm dev
```

```bash
cd scripts && pnpm install && cd ..
node scripts/keys.mjs                   # creates and funds .data/keys.json (gitignored)
node scripts/fixtures.mjs               # fetches the demonstration photographs
node scripts/deploy.mjs v2.0.0          # then: node scripts/deploy.mjs verify 0x…
node --experimental-strip-types scripts/proofs.mjs 0x…   # the flagship story, live
node scripts/paths.mjs 0x…              # the organisational paths, live
```

CI runs three jobs on every push: the contract (lint, validation, direct suite), the contract mutation
sweep, and the app (lint, types, tests, the web sweep, a build and a one-address check). Manual browser and
wallet steps are in [docs/e2e-verification.md](docs/e2e-verification.md).

## Security assumptions and known limitations

- **Access control.** Every permission is checked in the contract; none lives only in the app. The brief's
  security matrix is mapped to its guards and tests in [docs/security.md](docs/security.md).
- **Fail closed.** Uncertainty, blindness, malformed output and consensus failure give `UNDETERMINED` or a
  failed transaction, never `ACCEPTED`.
- **Physical truth.** GenLayer does not establish it. A convincing forgery can deceive validators as it would
  a person; the independent inspector role exists for work that needs one.
- **Interested parties.** A steward files photographs only on their own appeal, against the payment, so
  their photographs can fail a requirement only beside a provider photograph or the inspector's
  observation. The mirror: on an asset with an accepted inspector, the provider's photographs can pass a
  principle or a criterion only beside the inspector's observation. On an asset with no inspector, the
  provider's photographs are the whole site record, judged by validators as the constitution chose.
- **Labels are claims.** Photograph views and document types are the filer's own labels. Validators are
  told a label a photograph does not bear out counts against the filer. The same bytes cannot be filed
  twice on one work order.
- **Funding is a grant.** Anyone may fund a treasury. Nothing is tracked per funder and no funder can
  withdraw; on dissolution the remainder goes to the constitution's beneficiary.
- **Appeals are unbonded.** A steward can appeal an acceptance without a bond. The delay this can cause is
  bounded: the evidence period is at most 30 days, the provider may then ask for the readjudication
  themselves, and an appeal nobody decides closes three days later on the appealed decision.
- **Stewards accept their role.** A wallet the constitution names holds no steward power until it accepts.
  If no steward acts for 365 days, anyone may dissolve the organisation, so its treasury reaches the
  beneficiary instead of being stranded.
- **Bounded records.** An asset keeps its last 50 work orders and service entries and an organisation its
  last 20 motions in the record, with running totals; the full history is in the event log.
- **Evidence scope.** Video is kept as a reference and never interpreted, links are never fetched, and the
  runtime reads two images per prompt.
- **Storage.** Photographs are stored on chain, capped at 400,000 bytes, so every validator judges identical
  bytes without an off-chain service to keep running.
- **Money.** Amounts are GEN on a test network.
- **Persistence.** The organisation persists only while its treasury, its rules and the network do. It does
  not claim more.
- **The demonstration.** The organisations on the record are fictional. The photographs are public-domain
  images of a real small solar installation ([fixtures/ATTRIBUTION.md](fixtures/ATTRIBUTION.md)). Nothing
  here is anyone's actual contract.
