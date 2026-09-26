# The app, proved in a browser

The live proof scripts sign with the SDK, so they prove the contract and
never the pages. This is the proof of the pages: real writes composed by the
app, signed through its own wallet picker, and checked from the chain.

Deployment of record: `0x3B144fEf76B942c3DE967c257cc56fde8AEBB79c` on GenLayer
Studio Next. Run on 26 September 2026 against the local dev build.

## How

An EIP-6963 stand-in wallet was announced into the page, one per role, using
the throwaway, faucet-funded keys in `.data/keys.json` (gitignored). It
answers account and chain requests itself, signs `eth_sendTransaction`
locally and sends the raw transaction; every other method goes to the RPC.
The stand-in was served from a localhost-only file, so no key appeared in
any page, log or document. The app chose the wallet in its own connect menu.

Before signing, the composed call was read off the React tree: the exact
`{method, args}` the panel was about to sign.

## What was proved

| Step | Wallet | What the app offered | Composed call | Result on chain |
|---|---|---|---|---|
| Settle an acceptance upheld on appeal | a stranger | exactly one act, "Settle"; the page said "Accepted on appeal. Final, and ready to settle." | `finalize("wo-00006")` | [finalized](https://explorer-studio-dev.genlayer.com/tx/0x12d5813f509d20a43fe40919df286a309270fcb48d012b8480b4b522aaf07896); the order read `FINALIZED`, treasury paid out 2 GEN more |
| Claim the payment | the provider | a claim bar for exactly 2 GEN, priced by simulation at 0.001217 GEN | `claim()` | [finalized](https://explorer-studio-dev.genlayer.com/tx/0x4c4cfa44850d27fdfd90eaed917a46ddade22d84ce449cb9b6095e0e2d5a0499); ledger claimable 0, claimed 4 GEN over the whole record |

The settlement is the case the ICARUS review taught: an acceptance that a
fresh panel upheld on appeal must be offered for settlement at once, and an
acceptance whose appeal is still open must not be. The first half is proved
here on chain; both halves are pinned in `web/tests/acts.test.ts`.

## What the bench found

After the settlement finalized, the page correctly re-read the order as paid
and offered nothing more, which removed the card that had shown the signing
progress: the person never saw "confirmed". A site-wide notice now outlives
the card for every write, and was seen after the claim.

## What the bench does not prove

The other twenty-two writes were not signed through the pages. Their calls
are pinned instead: `web/tests/calls.test.ts` checks against the deployed
contract's schema that every write the contract has is offered by some page,
that the app names no method the contract lacks, and that value goes only to
the two payable writes. `web/tests/acts.test.ts` pins who is offered what in
every state the contract writes, and its sweep kills 33 of 33 mutants. The
writes themselves were proved live by `scripts/proofs.mjs` and
`scripts/paths.mjs`.
