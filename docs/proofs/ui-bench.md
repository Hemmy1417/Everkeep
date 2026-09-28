# The app, proved in a browser

The proof scripts sign with the SDK, so they prove the contract and never the
pages. This is the proof of the pages: real writes, composed by the app,
signed through its own wallet picker, and confirmed from the chain.

Run on 27 September 2026 against the local development build, on the previous
deployment, `0x4418253D7332661BfdF917DfE6B554cD0399F97c` (ruleset everkeep-rules-2).
The deployment of record is now `0xF71522A090BFDd32f3C5B0d87E518563B19fec4f`
(everkeep-rules-3). The pages' signing path is unchanged; the action rules the
pages use are proved against the new deployment's chain by `scripts/proofs.mjs`,
which imports `web/lib/acts.ts` and checks it at twelve moments.

## Method

1. An EIP-6963 wallet was announced into the page for each funded test role
   in `.data/keys.json` (gitignored). It answers account and chain requests
   itself, signs `eth_sendTransaction` locally, and forwards every other
   method to the RPC. It was served from a localhost-only file, so no key
   entered a page, a log or this document.
2. The app chose the wallet in its own connect menu.
3. Before each signature, the composed `{method, args}` was read off the
   React tree.

## Writes

| Wallet | Page state before | What the app offered | Composed call | On chain after |
|---|---|---|---|---|
| a stranger | the restoration, "Undetermined on appeal. The decision can be finalized now." | one act: Finalize | `finalize("wo-00004")` | [finalized](https://explorer-studio-dev.genlayer.com/tx/0x8b6f765a2de050555ee3d5d53024c25771cf991a8fb26b12dfc25a4169d11ef6): the order `CLOSED_UNPAID`, the readjudication `FINALIZED`, the commitment returned |
| the provider | the next cycle's work order, "Waiting for the provider to accept the terms." | Accept version 1 | `accept_work_order("wo-00007", 1)` | [finalized](https://explorer-studio-dev.genlayer.com/tx/0x6dbd58c3107b6de35e21e2f3ddc76dedd96683f56e389d04898d64df2a5dc034): the order `ACTIVE` |
| the provider | the same order, now active; the page offered assessment and the evidence workspace | File the declaration | `submit_declaration("wo-00007", "Six-month check scheduled; …")` | [finalized](https://explorer-studio-dev.genlayer.com/tx/0x1305c392b15d41c5a6ac770b5b8a4b6c02c857ace703c5ef5ad57d2b0b262381): evidence 10, a provider declaration |

After each write, the page reread the state and a confirmation notice with
the transaction link stayed visible after the action card disappeared.

## What the bench also showed

- The dashboard, the organisation, the work orders and the decision
  receipts all read the live record.
- One inconsistency was found and fixed. A receipt showed "Open to appeal"
  while its appeal window had closed. It now shows "Awaiting finalization".

## What it does not prove

Of the 29 writes, three were signed through the pages here. The rest are covered three ways:
- `web/tests/calls.test.ts` checks against the deployed schema that every
  write is reachable from a page and that value goes only to the payable writes.
- `web/tests/acts.test.ts` pins who is offered what in each state the
  contract writes; its sweep kills 31 of 31 mutants.
- The writes themselves are proved live by `scripts/proofs.mjs` and
  `scripts/paths.mjs`, whose logs sit beside this file.
