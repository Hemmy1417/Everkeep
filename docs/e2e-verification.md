# End-to-end verification

Two kinds of proof are committed, and this page gives the steps to repeat
both by hand.

- **The contract, live.** `scripts/proofs.mjs` runs the brief's flagship
  story on the deployment of record, and `scripts/paths.mjs` runs the
  organisational paths. Every claim is an assertion. The logs, with every
  transaction hash, are in `docs/proofs/`.
- **The app, in a browser.** Real writes composed by the pages, signed
  through the app's own wallet picker, and checked from the chain. See
  "Through the app" below.

## Before you start

- A browser wallet that speaks EIP-1193 (MetaMask, Rabby and the like).
- Test GEN on GenLayer Studio Next (chain 61997). The app adds the network
  when you connect.
- Either the hosted app, or `cd web && pnpm install && pnpm dev` and then
  http://localhost:3155.

## Journey A: found an organisation

1. Connect, open **Organisations**, then **Found an organisation**.
2. Fill the mission and the scope. Write principles that a photograph can
   answer, and scope each one to the work it applies to. Add evidence rules,
   funding, appeal rules, the stewards (your wallet is prefilled) and a
   dissolution beneficiary.
3. **Review** shows the exact JSON the contract receives. Sign **Ratify and
   found** with some opening GEN.
4. Expect the organisation page, **Active**, constitution 1, with the
   treasury showing what you sent. A refused founding says why and refunds
   the value, which appears in the refund bar.

## Journey B: enrol infrastructure and a provider

1. On the organisation, **Enrol infrastructure**: a kind the constitution
   supports, a service interval, and optionally an inspector's wallet.
   Expect the asset card to read **Monitoring**.
2. **Providers**: authorise a second wallet for the work it will do.
3. If you named an inspector, switch to that wallet, open the asset and
   **Accept the inspector role**.

## Journey C: commission work

1. **New work order**: ten steps, ending in a review. The review lists the
   constitution's checks (funded kind of work, authorised provider, budget
   and caps, reserve, open-work limit, inspector) and the exact terms JSON.
2. **Create**. Expect the work order page, **Awaiting the provider**, and the
   treasury's committed amount up by the payment.

## Journey D: submit evidence

1. Switch to the provider's wallet and **Accept version 1**.
2. File what the requirements list asks for. The **Required** list ticks off
   each item. Photographs are held on chain, and each card says **Bytes match
   the recorded hash** once the browser has fetched and hashed it.
3. Try **Request assessment** before the evidence is complete. The contract
   refuses in words and no panel is asked.

## Journey E: adjudicate

1. With the evidence complete, **Request assessment**. The panel shows the
   transaction's real lifecycle and nothing it cannot know.
2. Open the decision receipt: the outcome, every requirement with its
   source, the evidence snapshot with hashes, the appeal status and the
   treasury status.

## Journey F: appeal

1. On an undetermined or rejected decision, as the provider, **Open the
   appeal** with grounds, then file the additional evidence.
2. **Readjudicate**. Expect a new decision linked to the original. The
   original receipt reads **Superseded on appeal** with its outcome
   unchanged.

## Journey G: settle

1. When the window has passed, or no appeal is left, **Finalize**.
   - An acceptance reads **Payment releasable**.
   - Anything else reads **Closed unpaid**.
2. **Settle** from any wallet. Expect **Settled**, the provider's balance up
   by the payment, and the treasury down by exactly that amount.
3. The asset reads **Monitoring** again, with the service in its timeline and
   the next service due. **Commission the next service** starts the next
   cycle.

## Through the app, with a stand-in wallet

The browser proof (see `docs/proofs/ui-bench.md`) does the steps above without
a person at the wallet:
1. An EIP-6963 wallet is announced into the page for a funded test role. It
   signs `eth_sendTransaction` locally and forwards every other method to the
   RPC. It is served from a localhost-only file so no key ever enters a page
   or a log.
2. The app picks it in its own connect menu.
3. Before signing, the composed `{method, args}` is read off the React tree.
4. After signing, the result is checked from the chain.

## Reconstructing a decision without the app

```bash
node scripts/deploy.mjs verify <address>
```

Then read `get_decision`, `get_snapshot`, `get_work_order` and
`get_constitution` through any GenLayer client. Every field on a receipt is
one of those fields.
