// One address everywhere: the deployment of record the app reads must be the
// one both proof runs were recorded on, the one the published round log
// names, and the one the README and the UI bench name. A judge clones and
// runs; a checkout whose surfaces disagree does not reproduce what was
// judged, so this fails the build rather than leaving it to be discovered.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => readFileSync(at(p), "utf8");
const ADDRESS = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;

const config = read("../lib/config.ts").match(/RECORD_ADDRESS = "(0x[0-9a-fA-F]{40})"/)?.[1];
if (!config) {
  console.error("lib/config.ts names no RECORD_ADDRESS");
  process.exit(1);
}
const same = (a) => String(a).toLowerCase() === config.toLowerCase();
const problems = [];

for (const [file, value] of [
  ["lib/proof-log.json", JSON.parse(read("../lib/proof-log.json")).address],
  ["docs/proofs/proofs.json", JSON.parse(read("../../docs/proofs/proofs.json")).address],
  ["docs/proofs/paths.json", JSON.parse(read("../../docs/proofs/paths.json")).address],
]) {
  if (!same(value ?? "")) problems.push(`${file} records ${value || "no address"}`);
}

for (const doc of ["../../README.md", "../../docs/ui-bench.md", "../../docs/proofs/proof-run.txt",
                   "../../docs/proofs/paths-run.txt"]) {
  const text = read(doc);
  const named = (text.match(ADDRESS) ?? []).filter((a) => /proofs? (run )?on|paths on|Contract|deployment of record/i
    .test(text.split("\n").find((l) => l.includes(a)) ?? ""));
  if (!named.length) problems.push(`${doc.replace(/^(\.\.\/)+/, "")} never names the deployment`);
  for (const a of named) if (!same(a)) problems.push(`${doc.replace(/^(\.\.\/)+/, "")} names ${a}`);
}

if (problems.length) {
  console.error(`The deployment of record is ${config}, but:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`one address everywhere: ${config}`);
