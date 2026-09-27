# State machines

Every transition below is a guard in `contracts/everkeep.py`, has a direct
test, and is reached by the randomized walk in `tests/direct/test_invariants.py`.
All work order transitions pass through one method (`_move`), which keeps the
organisation's counts of open work, standing decisions and open appeals, and
each asset's open work, exactly equal to the states on record.

## Organisation

```text
create_organization ──► ACTIVE ◄── resume_organization ── PAUSED
                          │  ──── pause_organization ────►   │
                          │                                   │
                          └── enact_motion (dissolution) ─────┴──► DISSOLVING
                                                                      │ complete_dissolution
                                                                      │ (no open work orders)
                                                                      ▼
                                                                  DISSOLVED
```

| State | New assets, providers, work, amendments | Work in flight | Funding |
|---|---|---|---|
| ACTIVE | yes | continues | yes |
| PAUSED | no | continues | yes |
| DISSOLVING | no | continues to its end | refused, value refunded |
| DISSOLVED | no | none | refused |

## Governance motion

```text
propose_amendment / propose_dissolution ─► PENDING ─► ENACTED   (anyone, after the window)
                                               └────► WITHDRAWN (any steward, inside the window)
```

## Asset

Status is derived, never declared: `RETIRED` if retired, else
`UNDER_MAINTENANCE` while work is being done or judged on it, else
`SERVICE_DUE` once the service interval has run out since the last accepted
service, else `MONITORING`. A finalized acceptance records the service and
resets the interval.

## Work order

```text
create_work_order ─► PROPOSED ─ cancel_work_order ─► CANCELLED
                        │ accept_work_order (the provider)
                        ▼
                     ACTIVE ── evidence filed ── request_assessment (preflight, then GenLayer)
                        │                                   │
   close_work_order     │                                   ▼
   (deadline passed) ◄──┘                                DECIDED ◄───────────────┐
        │                                                   │  open_appeal        │ readjudicate
        │                                                   ▼                     │ (new decision,
        │                                             UNDER_APPEAL ───────────────┘  linked)
        │                                                   │ close_work_order, 3 days after the
        │                                                   │ evidence period: the appealed decision
        │                                                   │ stands and becomes final
        │                  finalize (window passed or       ▼
        │                  no appeal left)            finalized outcome
        │                                   ACCEPTED ──► PAYMENT_RELEASABLE ─ settle ─► SETTLED
        ▼                            REJECTED / UNDETERMINED ──► CLOSED_UNPAID
   CLOSED_UNPAID
```

Terms can be revised (a new version, validated under the order's own
constitution version) only while no decision exists; acceptance moves the
commitment to exactly the new payment. Only one first assessment is ever
requested; after it, only an appeal leads to another decision.

## Decision

```text
recorded ─► APPEALABLE ─ open_appeal ─► APPEALED ─ readjudicate ─► SUPERSEDED (kept as recorded)
               │                                   └ stale close ─► FINALIZED (the appealed decision stands)
               └ finalize ─► FINALIZED
```

A decision's outcome, requirements, snapshot and versions never change after
it is recorded; only its lifecycle moves.
