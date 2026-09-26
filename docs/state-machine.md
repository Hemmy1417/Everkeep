# The state machine

Three machines, nested. An organisation holds a constitution and a treasury;
an amendment holds a proposed constitution through a window; a work order
holds terms, evidence and a decision. Every transition below is enforced in
`contracts/everkeep.py` and has at least one direct test, and the random walk
in `tests/direct/test_invariants.py` reaches every work order state.

## An organisation

```text
  create_organization (payable; the founder ratifies v1 and may fund)
       │
       ▼
    ACTIVE ◄──────── resume_organization (a steward) ──────── PAUSED
       │                                                        ▲
       └──────────── pause_organization (a steward) ────────────┘
```

Paused refuses new assets, new work orders and new amendments. Everything
already in flight continues: the provider signs, files, asks for assessment,
appeals, is paid. A pause cannot starve a provider who has done the work.
There is no dissolution and no withdrawal: what the treasury was given stays
in it until a finalized acceptance pays it out.

## A constitution and its amendments

```text
  v1 EFFECTIVE at creation
       │
       │  propose_amendment (a steward under the constitution in force)
       ▼
   vN PROPOSED ── object_amendment (any steward, inside the window) ──► WITHDRAWN
       │
       │  ratify_amendment (anyone, after the window the CURRENT constitution sets)
       ▼
   vN EFFECTIVE, and the organisation's constitution_version becomes N
```

One amendment is pending at a time. Version numbers are never reused: a
withdrawn v2 leaves the next proposal v3. Once effective a constitution never
changes. A work order binds `constitution_version` at creation, so a later
amendment governs later orders and never a past decision: its terms are
validated, its evidence rules enforced and its panel briefed under the
version it was created under, and every round record names that version.

## A work order

```text
  create_work_order (a steward; payment committed from the treasury)
       │
       ▼
   PROPOSED ── cancel_work_order (a steward) ──► CANCELLED (commitment released)
       │
       │  accept_work_order (the provider signs the pending version)
       ▼
   AWAITING_EVIDENCE ◄──────────────────────────────────────────┐
       │                                                        │
       │  request_assessment (the provider; enforced half       │ a later assessment,
       │  checked in code first, then one consensus round)      │ up to five per version
       ▼                                                        │
   ACCEPTED │ REJECTED │ UNDETERMINED ──────────────────────────┘
       │         │
       │         │  open_appeal: a steward contests an acceptance, the provider a
       │         │  rejection, once, inside the constitution's appeal window
       ▼         ▼
     APPEALED ── decide_appeal (anyone, after the evidence period) ──► ACCEPTED │ REJECTED │ UNDETERMINED
       │                                                                  (final; not appealable)
       └──────── lapse_appeal (anyone, three days after the period) ──► UNDETERMINED
                                                                      (commitment stays until close)
   ACCEPTED ── finalize (anyone, after the window or after an upheld appeal) ──► FINALIZED
                                                                              (provider credited; claim)
   REJECTED │ UNDETERMINED │ AWAITING_EVIDENCE │ PROPOSED
            ── close_work_order (anyone, after the deadline and any standing window) ──► CLOSED
                                                                              (commitment released)
```

Terms may be revised while nothing stands: a steward proposes a version, the
provider signs it, and the commitment moves to the payment they actually
agreed. Terms are locked once an acceptance stands, an appeal is open, or
the order is settled. Evidence is filed per version; a round reads only the
version in force.

## Where money moves

| Event | Treasury | Work order | Ledger |
|---|---|---|---|
| create_organization, fund_treasury | escrow up | | |
| create_work_order | committed up | committed = payment | |
| accept_work_order of a revision | committed moves by the difference | committed = new payment | |
| cancel_work_order, close_work_order | committed down | committed = 0 | |
| finalize | escrow down, committed down, paid up | committed = 0 | provider claimable up |
| claim | | | claimable to 0, claimed up, transfer |
| a refused payable write | | | sender claimable up by the value sent |

At every step `escrow = funded - paid`, `committed = sum of open orders'
committed`, and `held + claimable + claimed = everything ever sent in`. The
random walk asserts all three after every action.
