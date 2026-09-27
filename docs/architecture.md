# Architecture

## The problem

Community infrastructure (a village solar array, a battery bank, a water
pump) needs maintenance for decades, long after the people who built it have
moved on. Money for that maintenance is usually held by a person or a
committee who must decide, job by job, whether a repair was actually done
before paying for it. When that person leaves, the infrastructure stops being
maintained.

An organisation that could keep paying for legitimate maintenance by itself
needs two things no ordinary smart contract has:

1. **Rules that outlive their authors,** written down before the money moves
   and changed only in the open.
2. **A way to judge the physical world.** Whether a charge controller was
   replaced and the bank is charging again is not a fact on any chain. It is
   shown, more or less convincingly, by photographs, meter readings,
   technician reports and inspection checklists.

A normal smart contract can do the first and the payments. It cannot judge
the second. A centralized oracle can report a number, but "does this set of
photographs and reports establish that the repair meets our rules" is not a
number; it is a judgment, and an oracle that makes it becomes the operator
the organisation was meant not to need.

EVERKEEP uses GenLayer as the decentralized judgment layer between that
evidence and the organisation's action. It does not claim GenLayer
establishes physical truth. It decides whether the evidence filed establishes
the work, and it fails closed when it does not.

## Components

```text
ORGANISATION MEMBERS / SERVICE PROVIDERS
                 │  wallet-signed transactions (EIP-1193, Transaction Kit)
                 ▼
┌───────────────────── contracts/everkeep.py ──────────────────────┐
│ ORGANISATION ── CONSTITUTION (versioned) ── TREASURY             │
│      │               │                                            │
│      │        PROVIDER REGISTRY                                   │
│      ▼                                                            │
│ INFRASTRUCTURE ASSET ── service log, interval, status             │
│      │                                                            │
│      ▼                                                            │
│ WORK ORDER (versioned terms, bound constitution version)          │
│      │                                                            │
│      ▼                                                            │
│ EVIDENCE (photographs and documents on chain, hashed)             │
│      │                                                            │
│      ▼                                                            │
│ DETERMINISTIC PREFLIGHT  ── refuses in words, no panel            │
│      │                                                            │
│      ▼                                                            │
│ GENLAYER ADJUDICATION  gl.vm.run_nondet(leader_fn, validator_fn)  │
│   examine photographs → rate requirements → ground in code        │
│   validators repeat it independently and compare outcomes         │
│      │                                                            │
│      ▼                                                            │
│ DECISION + EVIDENCE SNAPSHOT  (deterministic, after consensus)    │
│      │                                                            │
│   APPEAL → READJUDICATION (new decision, linked)                  │
│      │                                                            │
│ FINALIZATION → PAYMENT RELEASABLE → SETTLEMENT (transfer)         │
│      │                                                            │
│ ASSET BACK TO MONITORING → NEXT WORK ORDER                        │
└──────────────────────────────────────────────────────────────────┘
                 ▲
                 │ reads (unsigned, budgeted)
          web/ (Next.js): an interface to that state, never its source
```

There is no backend. The contract is authoritative for organisation
identity, mission, constitution, treasury, infrastructure, work orders,
evidence, snapshots, decisions, appeals and settlement. The app only reads
and asks the wallet to sign.

## Lifecycles

- **Evidence.** Filed by the assigned provider, the asset's accepted
  independent inspector, or a steward during their own appeal; bound to the
  work order version in force; hashed by the contract; frozen once filed.
  See `evidence-model.md`.
- **Adjudication.** Preflight in code, then one consensus round, then a
  deterministic record. See `consensus.md`.
- **Treasury.** Funded by anyone; a payment is committed when work is
  commissioned, becomes releasable only on a finalized acceptance, and leaves
  only by settlement. See `treasury.md`.
- **Organisation.** Active, paused, dissolving, dissolved; the constitution
  changes only by a motion with a window. See `constitution.md` and
  `state-machine.md`.

## The design principle

For every question: can ordinary code decide it? If yes, it is decided in
code and never put to a panel (who may act, what is funded, whether the
payment fits, whether the required evidence is on file, whether a window is
open). Only what needs judgment of real-world evidence against written rules
goes to GenLayer.
