# Evidence used in the demonstration

The photographs on the deployment of record are three public-domain photographs of one real, small off-grid
solar installation in Wisconsin, taken by Cody Kabus and published on Wikimedia Commons. The organisation,
asset, work orders and people on the record are fictional: a demonstration of how the record works, not
anyone's contract.

| File | What it shows | Author | Licence | Source |
|---|---|---|---|---|
| `bank-overview.jpg` | The equipment board: a solar charge controller (left), two deep-cycle batteries, and an inverter, with temporary clip leads on the battery terminals | Cody Kabus | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Kabus_000244_171294_516060_4578_(36775931686).jpg) |
| `controller-display.jpg` | The PWM solar charge controller, screwed to the board, cables landed in its terminals, its LCD reading 12.5 V | Cody Kabus | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Kabus_000245_171295_516064_4578_(36775931446).jpg) |
| `battery-terminals.jpg` | The two batteries with temporary clip leads on their terminals, and the controller alongside | Cody Kabus | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Kabus_000246_171296_516068_4578_(36775938376).jpg) |
| `panel-backside.jpg` | The back of one of the installation's solar panels: different equipment from the charge controller | Cody Kabus | Public domain | [Commons](https://commons.wikimedia.org/wiki/File:Kabus_000242_171290_516047_4578_(36775932096).jpg) |

`scripts/fixtures.mjs` fetches each at a width that keeps it under the contract's 400,000-byte cap. It inserts
a JFIF header, which is what validators read, and leaves every other byte as the photographer's. The contract
stores those exact bytes and hashes them, so what validators judged can be fetched back and checked.

## How each case uses them, honestly

- **Accepted.** A charge controller replacement: the overview as the after photograph, the close-up as the
  meter display, a technician report, and the inspector's checklist. The work order asks what the photographs
  can show: the controller fixed and wired, and a normal reading on its display.
- **Rejected.** A battery service that must leave every connection permanent. The battery photograph shows
  temporary clip leads on the terminals, which the constitution's battery principle forbids.
- **Mislabelled.** The panel photograph filed as "the new charge controller fixed to the board", to show
  that a label a photograph does not bear out counts against the filer.
- **Contradicted.** The controller close-up beside a reading on paper that states a different voltage, to
  show that a contradiction between two named pieces of evidence is flagged.
- **Undetermined, then decided on appeal.** A restoration first filed with the overview (on which the display
  cannot be read) and a reading on paper. The paper cannot establish the reading. On appeal the provider files
  the close-up of the display.

There is no before photograph in the demonstration, because none of this installation exists. The contract
therefore records its before-and-after check as not applicable for these files, rather than being shown a
fabricated "before".
