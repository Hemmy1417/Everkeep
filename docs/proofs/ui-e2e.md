# The whole path, through the pages

On 28 September 2026 the path in the submission's how-to was walked through the
live site, https://everkeep-v1.vercel.app, against the deployment of record,
`0xF71522A090BFDd32f3C5B0d87E518563B19fec4f`. Every write below was composed by
a page, signed through the app's own wallet menu and confirmed from the chain.
Each transaction hash, with its final status and consensus result read back from
the network, is in [ui-e2e.json](ui-e2e.json).

## Method

Two stand-in wallets, the steward and the provider, were announced into the page
with EIP-6963 and chosen in the app's own connect menu. Each signs locally with a
throwaway test key from the git-ignored keys file and forwards everything else to
the network. Before every signature, the call the page had composed,
`{method, args, value}`, was read off the React tree and checked against what
had been entered. Photographs were put on the page's own file input.

## The path

| Step | Wallet | What the page composed | On chain |
|---|---|---|---|
| Found the organisation in the wizard | steward | `create_organization`, the reviewed constitution, 5 GEN | finalized, agreed: org-00002 |
| Authorise a provider | steward | `authorize_provider` for component replacement | finalized, agreed |
| Enrol the asset | steward | `register_asset` | finalized, agreed |
| Commission the work | steward | `create_work_order`: 2 GEN, two criteria, an operational reading required | finalized, agreed: wo-00008 |
| Accept the terms | provider | `accept_work_order`, version 1 | finalized, agreed |
| File the after photograph | provider | `submit_image`, after view, the JPEG bytes | finalized, agreed |
| File the display photograph | provider | `submit_image`, meter display view | finalized, agreed |
| Ask for the assessment | provider | `request_assessment` | **Rejected**: the work met the principle and both criteria, but validators judged the photographs to show a trailer-mounted setup rather than the fixed workshop board enrolled |
| Appeal | provider | `open_appeal` with grounds | finalized, agreed |
| Readjudicate | provider | `readjudicate` | the first asking reached no majority; nothing was recorded |
| Readjudicate again | provider | `readjudicate` | **Accepted on appeal**, a new decision linked to the rejection, which is kept as superseded |
| Finalize | provider | `finalize` | finalized, agreed: payment releasable |
| Settle | provider | `settle`, priced by simulation | finalized, agreed: settled |

After settlement the treasury went from 5 GEN to 3 GEN, the organisation's paid
total was 2 GEN, and the provider's wallet rose by 2 GEN less the fee it paid to
send the settlement.

## What the pages did right

- At every step the page offered the one act the contract would accept, and no other.
- Before the evidence was complete, the side panel named the missing rule in the
  contract's own words, first the after photograph, then the operational reading,
  and offered the assessment only once both were on file.
- After the rejection it offered the provider the appeal; during the appeal it
  offered filing and the readjudication; with no appeal left it offered
  finalization at once, and after that settlement.

## What the run found, and fixed

The first readjudication reached no majority. The transaction still finalized and
its leader's own execution still read as successful, so the transaction panel
said "Confirmed, finalized on chain with a successful execution" for a round that
recorded nothing. The page underneath showed the truth, still under appeal, but
the message was wrong. The panel now also reads the network's consensus result and
reports success only when the validators agreed; otherwise it says the validators
did not agree, nothing was recorded, and the request can be sent again. The rule is
pinned by `web/tests/consensus.test.ts` and a mutant in the web sweep.
