# The constitution

The constitution is the organisation's durable rulebook. It is versioned,
immutable once in force, and every work order is bound to the version in
force when it was created. Every decision cites that version, so a later
amendment never changes the meaning of an earlier decision.

## What it holds

| Section | Field | Enforced by |
|---|---|---|
| Mission | `organization_name`, `mission` | shown on every decision |
| Scope | `supported_infrastructure_types` | code: assets of other kinds are refused |
| Eligibility | `approved_maintenance_types` | code: other work is refused, and providers are authorised only for approved work |
| Eligibility | `inspection_report_required_for` | code: that work needs the asset's inspector and their report before assessment |
| Maintenance principles | numbered sentences, each with `applies_to` | GenLayer: rated for the kinds of work they apply to; scope chosen in code |
| Evidence requirements | rules `{maintenance_type or ALL, type, min_count}` | code: checked before any panel is asked |
| Funding rules | `max_payment_wei`, `max_open_work_orders`, `reserve_floor_wei` | code: at commissioning and acceptance |
| Emergency rules | `emergency_max_payment_wei`, `emergency_appeal_window_seconds` | code: for emergency repairs |
| Appeal rules | `appeal_window_seconds`, `evidence_period_seconds`, `max_appeals_per_work_order` | code |
| Decision rules | fixed in the contract and published in `get_config` | code |
| Governance | `stewards`, `motion_window_seconds`, `dissolution_beneficiary` | code |

The decision rule is the same for every organisation, so no constitution can
make doubt pay:

```text
conflicting evidence                              -> UNDETERMINED
any requirement NOT SATISFIED                     -> REJECTED
any requirement NOT ESTABLISHED, or the evidence
  judged insufficient as a whole                  -> UNDETERMINED
otherwise                                         -> ACCEPTED
```

## Versioning and governance

- The founder ratifies version 1 at founding and must be one of its stewards.
  The founder has no other power.
- A steward proposes an amendment: a whole new constitution. It waits out the
  motion window the constitution **in force** sets. Any one steward can
  withdraw it inside the window. After the window anyone can enact it.
- One motion is pending at a time. Version numbers are never reused.
- The stewards list changes only by amendment. Independence is checked
  against the stewards in force: an inspector who becomes a steward no longer
  files as an independent inspector, and a steward cannot be paid as a
  provider.
- Dissolution is the same kind of motion. Enacted, the organisation takes no
  new commitments; once every open work order has settled or closed, anyone
  completes the dissolution and the treasury is refunded in full to the
  beneficiary the constitution names.
- A pause stops new assets, providers, work orders and amendments, and lets
  work already in flight finish, so a pause cannot starve a provider who has
  done the work.

## Governance boundaries

There is no owner key and no administrator method. Nothing can withdraw from
the treasury except a settlement to a provider on a finalized acceptance, a
refund of value sent with a refused write, or the dissolution refund. The
deployer's address is recorded and read by no rule.
