# The treasury

EVERKEEP separates three things:

1. **The organisational treasury**: value the contract holds for the
   organisation.
2. **The maintenance decision**: a finalized acceptance that makes a payment
   releasable.
3. **Payment execution**: a settlement transaction that transfers it.

## Balances

| Field | Meaning |
|---|---|
| `escrow_wei` | held by the contract for the organisation |
| `committed_wei` | reserved for open work orders |
| `releasable_wei` | the part of the committed funds whose decision is final and accepted |
| `available_wei` | held minus committed |
| `spendable_wei` | available minus the constitution's reserve floor: what new work may commit |
| `paid_wei` | settled to providers |
| `returned_wei` | refunded to the beneficiary on dissolution |

At every step `funded = held + paid + returned`, and
`releasable ≤ committed ≤ held`. The direct suite's random walk asserts both
after every action, together with conservation of every wei sent into the
contract.

## The flow

- **Funding.** Anyone may fund an organisation that is not dissolving. A
  payable write the contract refuses returns the refusal and records the
  value as a refund the sender claims, because on this platform a payable
  write that raises keeps the value while reverting the record of it.
- **Commitment.** Creating a work order commits its payment at once, and only
  if the treasury can do so above its reserve. Accepting revised terms moves
  the commitment by the difference, and a paused or dissolving organisation
  takes on no larger commitment.
- **Releasable.** Only `finalize` on an accepted decision makes a payment
  releasable. An undetermined or rejected outcome never does: it closes the
  order unpaid and returns the commitment.
- **Settlement.** `settle` transfers the payment to the provider with
  `emit_transfer` on an empty contract interface at the provider's address.
  Anyone may send it, so a payment never waits on goodwill. It is the one
  write that pays maintenance out.
- **Refunds.** `claim_refund` pays refused-write refunds and the dissolution
  remainder to their owners.

## Limits of the environment

- Settlement and refunds emit value transfers. On Studio Next a write that
  transfers value must carry the fee message allocations the network's fee
  simulation measures; the app prices exactly those two writes by simulation
  (`web/lib/kit.ts`), and the proof scripts do the same.
- Amounts are GEN on the test network. The brief's dollar budgets are shown as
  GEN; no currency conversion happens anywhere.
- There is no withdrawal, by design: an organisation meant to outlive its
  founders holds what it was given until it pays for maintenance or dissolves.
