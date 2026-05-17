const DATA_DIR = "./data/";
const MANIFEST_URL = `${DATA_DIR}manifest.json`;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;
const EXPOSURE_VALUES = [0, 0.2, 0.4, 0.6, 0.8, 1];

const panes = Array.from(document.querySelectorAll(".pane")).map((element, index) => ({
  element,
  index,
  image: element.querySelector(".photo"),
  status: element.querySelector(".status"),
  lensSelect: element.querySelector(".lens-select"),
  apertureSelect: element.querySelector(".aperture-select"),
  exposureSelect: element.querySelector(".exposure-select"),
  lens: "",
  apertureKey: "",
  localApertureChange: false,
  exposureEv: 0,
  naturalWidth: 0,
  naturalHeight: 0,
}));

const fitButton = document.querySelector("#fitButton");
const zoomReadout = document.querySelector("#zoomReadout");

const view = {
  zoom: 1,
  centerX: 0.5,
  centerY: 0.5,
};

let catalog = new Map();
let lenses = [];
let drag = null;
let testDataDir = DATA_DIR;

init().catch((error) => {
  panes.forEach((pane) => showStatus(pane, error.message));
});

async function init() {
  const selectedTest = await loadSelectedTest();
  testDataDir = `${DATA_DIR}${selectedTest.folder ? `${encodePathPart(selectedTest.folder)}/` : ""}`;
  document.title = `${selectedTest.title} | PhotoCompare`;

  const files = selectedTest.files;
  const entries = files.map(parseFileName).filter(Boolean);

  if (!entries.length) {
    throw new Error("Vybraný test neobsahuje žádný JPEG ve formátu „Objektiv - f2.8.jpg“.");
  }

  catalog = buildCatalog(entries);
  lenses = Array.from(catalog.keys()).sort(new Intl.Collator("cs", { numeric: true }).compare);

  panes.forEach((pane, index) => {
    pane.lens = lenses[index % lenses.length];
    fillLensOptions(pane);
    pane.lensSelect.value = pane.lens;
    pane.apertureKey = getDefaultAperture(pane.lens);
    fillApertureOptions(pane);
    fillExposureOptions(pane);
    bindPane(pane);
    updatePaneImage(pane);
    updatePaneExposure(pane);
  });

  fitButton.addEventListener("click", resetView);
  window.addEventListener("resize", renderAll);
  renderAll();
}

async function loadSelectedTest() {
  const tests = await loadTests();
  if (!tests.length) {
    throw new Error("Není dostupný žádný test.");
  }

  const requestedTest = new URLSearchParams(window.location.search).get("test");
  return tests.find((test) => test.id === requestedTest || test.folder === requestedTest) || tests[0];
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
    throw new Error("Chybí data/manifest.json. Spusť generátor manifestu a potom obnov stránku.");
  }

  const data = await response.json();
  return getTests(data);
}

async function discoverTestsFromDirectory() {
  const folders = await readDirectoryLinks(DATA_DIR);
  const tests = [];

  for (const folder of folders) {
    const files = (await readDirectoryLinks(`${DATA_DIR}${encodePathPart(folder)}/`))
      .filter((file) => /(?:\.jpe?g)+$/i.test(file))
      .sort(new Intl.Collator("cs", { numeric: true }).compare);

    if (!files.length) {
      continue;
    }

    tests.push({
      id: folder,
      title: folder,
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

function parseFileName(file) {
  const filename = String(file).split(/[\\/]/).pop();
  const stem = filename.replace(/(?:\.jpe?g)+$/i, "");
  const separator = stem.lastIndexOf(" - f");

  if (separator < 0 || stem === filename) {
    return null;
  }

  const lens = stem.slice(0, separator).trim();
  const apertureText = stem.slice(separator + 3).trim();
  const apertureNumber = Number.parseFloat(apertureText.replace(/^f/i, ""));

  if (!lens || !Number.isFinite(apertureNumber)) {
    return null;
  }

  return {
    file,
    lens,
    apertureKey: normalizeAperture(apertureNumber),
    apertureNumber,
    apertureLabel: `f/${formatAperture(apertureNumber)}`,
  };
}

function buildCatalog(entries) {
  const nextCatalog = new Map();

  for (const entry of entries) {
    if (!nextCatalog.has(entry.lens)) {
      nextCatalog.set(entry.lens, new Map());
    }
    nextCatalog.get(entry.lens).set(entry.apertureKey, entry);
  }

  for (const apertures of nextCatalog.values()) {
    const sortedEntries = Array.from(apertures.values()).sort((a, b) => a.apertureNumber - b.apertureNumber);
    apertures.clear();
    sortedEntries.forEach((entry) => apertures.set(entry.apertureKey, entry));
  }

  return nextCatalog;
}

function fillLensOptions(pane) {
  pane.lensSelect.replaceChildren(...lenses.map((lens) => new Option(lens, lens)));
}

function fillApertureOptions(pane) {
  const apertures = Array.from(catalog.get(pane.lens).values());
  pane.apertureSelect.replaceChildren(
    ...apertures.map((entry) => new Option(entry.apertureLabel, entry.apertureKey)),
  );
  pane.apertureSelect.value = pane.apertureKey;
}

function fillExposureOptions(pane) {
  pane.exposureSelect.replaceChildren(
    ...EXPOSURE_VALUES.map((value) => new Option(formatExposure(value), String(value))),
  );
  pane.exposureSelect.value = "0";
}

function getDefaultAperture(lens) {
  const firstEntry = catalog.get(lens).values().next().value;
  return firstEntry.apertureKey;
}

function bindPane(pane) {
  pane.lensSelect.addEventListener("change", () => {
    const previousAperture = pane.apertureKey;
    pane.lens = pane.lensSelect.value;
    fillApertureOptions(pane);
    setPaneAperture(pane, previousAperture, { fallbackToClosest: true, forceReload: true });
  });

  pane.apertureSelect.addEventListener("pointerdown", (event) => {
    pane.localApertureChange = event.ctrlKey;
  });

  pane.apertureSelect.addEventListener("keydown", (event) => {
    pane.localApertureChange = event.ctrlKey;
  });

  pane.apertureSelect.addEventListener("change", () => {
    const apertureKey = pane.apertureSelect.value;
    const localOnly = pane.localApertureChange;
    pane.localApertureChange = false;

    if (localOnly) {
      setPaneAperture(pane, apertureKey);
      return;
    }

    panes.forEach((targetPane) => setPaneAperture(targetPane, apertureKey, { fallbackToClosest: true }));
  });

  pane.exposureSelect.addEventListener("change", () => {
    pane.exposureEv = Number.parseFloat(pane.exposureSelect.value) || 0;
    updatePaneExposure(pane);
  });

  pane.element.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(pane, event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0016));
  }, { passive: false });

  pane.element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("select, button")) {
      return;
    }

    const metrics = getPaneMetrics(pane);
    if (!metrics) {
      return;
    }

    pane.element.setPointerCapture(event.pointerId);
    pane.element.classList.add("is-dragging");
    drag = {
      pane,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: view.centerX,
      centerY: view.centerY,
      displayWidth: metrics.displayWidth,
      displayHeight: metrics.displayHeight,
    };
  });

  pane.element.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    view.centerX = drag.centerX - (event.clientX - drag.startX) / drag.displayWidth;
    view.centerY = drag.centerY - (event.clientY - drag.startY) / drag.displayHeight;
    clampViewToPane(drag.pane);
    renderAll();
  });

  pane.element.addEventListener("pointerup", endDrag);
  pane.element.addEventListener("pointercancel", endDrag);
}

function updatePaneImage(pane) {
  const entry = catalog.get(pane.lens).get(pane.apertureKey);
  pane.naturalWidth = 0;
  pane.naturalHeight = 0;
  pane.image.classList.add("is-hidden");
  showStatus(pane, "Načítám...");

  pane.image.onload = () => {
    pane.naturalWidth = pane.image.naturalWidth;
    pane.naturalHeight = pane.image.naturalHeight;
    pane.image.alt = `${entry.lens}, ${entry.apertureLabel}`;
    pane.image.classList.remove("is-hidden");
    hideStatus(pane);
    renderAll();
  };

  pane.image.onerror = () => {
    showStatus(pane, `Soubor nejde načíst: ${entry.file}`);
  };

  pane.image.src = toDataUrl(entry.file);
}

function setPaneAperture(pane, apertureKey, options = {}) {
  const nextApertureKey = catalog.get(pane.lens).has(apertureKey)
    ? apertureKey
    : options.fallbackToClosest
      ? getClosestApertureKey(pane.lens, apertureKey)
      : pane.apertureKey;

  if (!nextApertureKey) {
    pane.apertureSelect.value = pane.apertureKey;
    return;
  }

  if (nextApertureKey === pane.apertureKey && !options.forceReload) {
    pane.apertureSelect.value = pane.apertureKey;
    return;
  }

  pane.apertureKey = nextApertureKey;
  pane.apertureSelect.value = nextApertureKey;
  updatePaneImage(pane);
}

function getClosestApertureKey(lens, apertureKey) {
  const requested = Number.parseFloat(apertureKey);
  const entries = Array.from(catalog.get(lens).values());

  if (!Number.isFinite(requested)) {
    return getDefaultAperture(lens);
  }

  return entries.reduce((closest, entry) => (
    Math.abs(entry.apertureNumber - requested) < Math.abs(closest.apertureNumber - requested) ? entry : closest
  ), entries[0]).apertureKey;
}

function updatePaneExposure(pane) {
  pane.image.style.setProperty("--brightness", String(2 ** pane.exposureEv));
}

function toDataUrl(file) {
  return `${testDataDir}${String(file).split("/").map(encodeURIComponent).join("/")}`;
}

function encodePathPart(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function zoomAt(pane, clientX, clientY, factor) {
  const oldMetrics = getPaneMetrics(pane);
  if (!oldMetrics) {
    return;
  }

  const rect = pane.element.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const imageX = view.centerX + (localX - rect.width / 2) / oldMetrics.displayWidth;
  const imageY = view.centerY + (localY - rect.height / 2) / oldMetrics.displayHeight;

  view.zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);

  const newMetrics = getPaneMetrics(pane);
  view.centerX = imageX - (localX - rect.width / 2) / newMetrics.displayWidth;
  view.centerY = imageY - (localY - rect.height / 2) / newMetrics.displayHeight;
  clampViewToPane(pane);
  renderAll();
}

function resetView() {
  view.zoom = 1;
  view.centerX = 0.5;
  view.centerY = 0.5;
  renderAll();
}

function renderAll() {
  panes.forEach(renderPane);
  zoomReadout.value = `${Math.round(view.zoom * 100)}%`;
}

function renderPane(pane) {
  const metrics = getPaneMetrics(pane);
  if (!metrics) {
    return;
  }

  const adjusted = getClampedCenter(metrics, view.centerX, view.centerY);
  pane.image.style.width = `${metrics.displayWidth}px`;
  pane.image.style.height = `${metrics.displayHeight}px`;
  pane.image.style.left = `${metrics.width / 2 - adjusted.centerX * metrics.displayWidth}px`;
  pane.image.style.top = `${metrics.height / 2 - adjusted.centerY * metrics.displayHeight}px`;
}

function getPaneMetrics(pane) {
  if (!pane.naturalWidth || !pane.naturalHeight) {
    return null;
  }

  const rect = pane.element.getBoundingClientRect();
  const baseScale = Math.min(rect.width / pane.naturalWidth, rect.height / pane.naturalHeight);

  return {
    width: rect.width,
    height: rect.height,
    displayWidth: pane.naturalWidth * baseScale * view.zoom,
    displayHeight: pane.naturalHeight * baseScale * view.zoom,
  };
}

function clampViewToPane(pane) {
  const metrics = getPaneMetrics(pane);
  if (!metrics) {
    return;
  }

  Object.assign(view, getClampedCenter(metrics, view.centerX, view.centerY));
}

function getClampedCenter(metrics, centerX, centerY) {
  return {
    centerX: getAxisCenter(metrics.width, metrics.displayWidth, centerX),
    centerY: getAxisCenter(metrics.height, metrics.displayHeight, centerY),
  };
}

function getAxisCenter(viewportSize, imageSize, center) {
  if (imageSize <= viewportSize) {
    return 0.5;
  }

  const edge = viewportSize / (2 * imageSize);
  return clamp(center, edge, 1 - edge);
}

function endDrag(event) {
  if (!drag || drag.pointerId !== event.pointerId) {
    return;
  }

  drag.pane.element.classList.remove("is-dragging");
  drag = null;
}

function normalizeAperture(value) {
  return String(Number(value.toFixed(2)));
}

function formatAperture(value) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function formatExposure(value) {
  return `${value > 0 ? "+" : ""}${formatAperture(value)} EV`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showStatus(pane, message) {
  pane.status.textContent = message;
  pane.status.classList.remove("is-hidden");
}

function hideStatus(pane) {
  pane.status.classList.add("is-hidden");
}
