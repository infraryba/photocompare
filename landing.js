const MANIFEST_URL = "./data/manifest.json";
const lensSummary = document.querySelector("#lensSummary");

initLanding();

async function initLanding() {
  try {
    const tests = await loadTests();
    renderTests(tests);
  } catch {
    lensSummary.textContent = "(seznam testů se načte po spuštění přes lokální server)";
  }
}

async function loadTests() {
  try {
    const discoveredTests = await discoverTestsFromDirectory();
    if (discoveredTests.length) {
      return discoveredTests;
    }
  } catch {
    // Directory discovery works with Python's local server, while hosted sites use the manifest fallback.
  }

  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error("Manifest nejde načíst.");
  }

  const data = await response.json();
  return getTests(data);
}

async function discoverTestsFromDirectory() {
  const folders = await readDirectoryLinks("./data/");
  const tests = [];

  for (const folder of folders) {
    const files = (await readDirectoryLinks(`./data/${encodePath(folder)}/`))
      .filter((file) => /(?:\.jpe?g)+$/i.test(file))
      .sort(new Intl.Collator("cs", { numeric: true }).compare);

    if (!files.length) {
      continue;
    }

    tests.push({
      id: folder,
      title: `${folder} comparison`,
      folder,
      files,
    });
  }

  return tests;
}

async function readDirectoryLinks(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Složku nejde načíst: ${url}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("a"))
    .map((link) => link.getAttribute("href") || "")
    .filter((href) => href && href !== "../")
    .map((href) => decodeURIComponent(href.replace(/\/$/, "")))
    .filter((href) => !href.includes("/") && href !== "manifest.json")
    .sort(new Intl.Collator("cs", { numeric: true }).compare);
}

function getTests(data) {
  if (Array.isArray(data.tests)) {
    return data.tests;
  }

  const files = Array.isArray(data) ? data : data.files;
  return files ? [{ id: "default", title: "35 mm lens comparison", folder: "", files }] : [];
}

function renderTests(tests) {
  const list = document.querySelector("#testList");
  list.replaceChildren(
    ...tests.map((test) => {
      const lenses = Array.from(new Set(test.files.map(parseLensName).filter(Boolean)))
        .sort(new Intl.Collator("cs", { numeric: true }).compare);
      const link = document.createElement("a");
      link.className = "test-card";
      link.href = `./compare.html?test=${encodeURIComponent(test.id || test.folder)}`;
      link.innerHTML = `
        <span class="test-card-title"></span>
        <span class="test-card-meta"></span>
      `;
      link.querySelector(".test-card-title").textContent = test.title || `${test.folder} comparison`;
      link.querySelector(".test-card-meta").textContent = lenses.length ? `(${lenses.join(", ")})` : "(bez rozpoznaných objektivů)";
      return link;
    }),
  );
}

function parseLensName(file) {
  const filename = String(file).split(/[\\/]/).pop();
  const stem = filename.replace(/(?:\.jpe?g)+$/i, "");
  const separator = stem.lastIndexOf(" - f");
  return separator >= 0 ? stem.slice(0, separator).trim() : "";
}

function encodePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}
