const MANIFEST_URL = "./data/manifest.json";
const lensSummary = document.querySelector("#lensSummary");

initLanding();

async function initLanding() {
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) {
      throw new Error("Manifest nejde načíst.");
    }

    const data = await response.json();
    const files = Array.isArray(data) ? data : data.files;
    const lenses = Array.from(new Set(files.map(parseLensName).filter(Boolean)))
      .sort(new Intl.Collator("cs", { numeric: true }).compare);

    lensSummary.textContent = lenses.length ? `(${lenses.join(", ")})` : "(bez rozpoznaných objektivů)";
  } catch {
    lensSummary.textContent = "(seznam objektivů se načte po spuštění přes lokální server)";
  }
}

function parseLensName(file) {
  const filename = String(file).split(/[\\/]/).pop();
  const stem = filename.replace(/(?:\.jpe?g)+$/i, "");
  const separator = stem.lastIndexOf(" - f");
  return separator >= 0 ? stem.slice(0, separator).trim() : "";
}
