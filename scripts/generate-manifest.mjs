import { readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dataDir = new URL("../data/", import.meta.url);
const manifestPath = fileURLToPath(new URL("manifest.json", dataDir));
const collator = new Intl.Collator("cs", { numeric: true });
const items = await readdir(dataDir, { withFileTypes: true });
const tests = [];

for (const item of items.filter((entry) => entry.isDirectory()).sort((a, b) => collator.compare(a.name, b.name))) {
  const testDir = new URL(`${encodeURIComponent(item.name).replace(/%2F/gi, "/")}/`, dataDir);
  const files = (await readdir(testDir))
    .filter((file) => /(?:\.jpe?g)+$/i.test(file))
    .sort(collator.compare);

  if (!files.length) {
    continue;
  }

  tests.push({
    id: item.name,
    title: item.name,
    folder: item.name,
    files,
  });
}

await writeFile(
  manifestPath,
  `${JSON.stringify({ tests }, null, 2)}\n`,
  "utf8",
);

console.log(`Manifest updated with ${tests.length} test(s).`);
