import { readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dataDir = new URL("../data/", import.meta.url);
const manifestPath = fileURLToPath(new URL("manifest.json", dataDir));
const files = (await readdir(dataDir))
  .filter((file) => /(?:\.jpe?g)+$/i.test(file))
  .sort(new Intl.Collator("cs", { numeric: true }).compare);

await writeFile(
  manifestPath,
  `${JSON.stringify({ files }, null, 2)}\n`,
  "utf8",
);

console.log(`Manifest updated with ${files.length} JPEG files.`);
