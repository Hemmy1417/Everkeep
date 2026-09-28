/**
 * Fetch the demonstration photographs from Wikimedia Commons and normalize
 * them to what validators read: a JFIF-headed JPEG under the contract's
 * 400,000-byte cap. Commons serves the width asked for; a JFIF APP0 segment
 * is inserted after the start-of-image marker and every other byte is left
 * as the photographer's. See fixtures/ATTRIBUTION.md.
 *
 *   node scripts/fixtures.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 400_000;
const APP0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
                          0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
const UA = { "user-agent": "EverkeepDemo/1.0 (build)" };

const FILES = [
  { name: "bank-overview", widths: [1200, 1000, 800], title: "File:Kabus 000244 171294 516060 4578 (36775931686).jpg" },
  { name: "controller-display", widths: [1400, 1200, 1000], title: "File:Kabus 000245 171295 516064 4578 (36775931446).jpg" },
  { name: "battery-terminals", widths: [1200, 1000, 800], title: "File:Kabus 000246 171296 516068 4578 (36775938376).jpg" },
  { name: "panel-backside", widths: [800, 640, 500], title: "File:Kabus 000242 171290 516047 4578 (36775932096).jpg" },
];

function jfif(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a JPEG");
  if (buf[2] === 0xff && buf[3] === 0xe0) return buf;
  return Buffer.concat([buf.subarray(0, 2), APP0, buf.subarray(2)]);
}

async function thumb(title, width) {
  const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url"
    + `&iiurlwidth=${width}&titles=${encodeURIComponent(title)}`;
  const data = await (await fetch(api, { headers: UA })).json();
  const page = Object.values(data.query.pages)[0];
  return page.imageinfo[0].thumburl;
}

const out = fileURLToPath(new URL("../fixtures/images/", import.meta.url));
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  for (const width of f.widths) {
    const url = await thumb(f.title, width);
    const bytes = jfif(Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer()));
    if (bytes.length <= MAX_BYTES) {
      writeFileSync(`${out}${f.name}.jpg`, bytes);
      console.log(`${f.name}.jpg  ${width}px  ${bytes.length} bytes`);
      break;
    }
    console.log(`${f.name}: ${width}px is ${bytes.length} bytes, trying smaller`);
  }
}
