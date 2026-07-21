/**
 * BrowserScan WebGPU — Adapter Info / Features / Limits.
 * Du lieu duoc doc tu cac table bang Playwright locator, khong goi WebGPU API.
 */
const { summarizeFieldResults } = require('../../../shared/siteHighlight');
const { BROWSERSCAN_WEBGPU_URL } = require('./urls');

const CFG = {
  vendor: 'hidemium.webgpu.vendor',
  architecture: 'hidemium.webgpu.architecture',
  features: 'hidemium.webgpu.features',
};
const PARAM_PREFIX = 'hidemium.webgpu.param.';
const LOAD_TIMEOUT_MS = 90000;

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function normalizeValue(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeList(value) {
  const values = String(value == null ? '' : value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(values)].sort().join(',');
}

function sectionTable(page, headingName) {
  return page
    .getByRole('heading', { name: headingName, exact: true })
    .locator('xpath=following::table[1]');
}

async function readTable(table) {
  const values = {};
  const rows = table.locator('tbody tr');
  const count = await rows.count();
  for (let index = 0; index < count; index++) {
    const cells = rows.nth(index).locator('td');
    if ((await cells.count()) < 2) continue;
    const key = (await cells.nth(0).innerText()).trim();
    const value = (await cells.nth(1).innerText()).replace(/\s+/g, ' ').trim();
    if (key) values[key] = value;
  }
  return values;
}

async function scrapeWebgpuWithLocators(page) {
  const adapterInfoTable = sectionTable(page, 'WebGPU Adapter Info');
  const limitsTable = sectionTable(page, 'Adapter Limits');
  const featuresTable = sectionTable(page, 'Adapter Features');

  await adapterInfoTable.locator('tbody tr').first().waitFor({
    state: 'visible',
    timeout: LOAD_TIMEOUT_MS,
  });
  await limitsTable.locator('tbody tr').first().waitFor({
    state: 'visible',
    timeout: LOAD_TIMEOUT_MS,
  });
  await featuresTable.locator('tbody tr').first().waitFor({
    state: 'visible',
    timeout: LOAD_TIMEOUT_MS,
  });

  const [adapterInfo, limits, featureStates] = await Promise.all([
    readTable(adapterInfoTable),
    readTable(limitsTable),
    readTable(featuresTable),
  ]);
  const features = Object.entries(featureStates)
    .filter(([, enabled]) => /^true$/i.test(enabled))
    .map(([name]) => name);

  return {
    adapterInfo,
    limits,
    featureStates,
    features,
    tables: { adapterInfoTable, limitsTable, featuresTable },
  };
}

function makeLine(label, actual, expected, list = false) {
  const actualText = actual == null ? '' : String(actual);
  if (isDefault(expected)) {
    return {
      label,
      actual: actualText,
      expected: '',
      pass: true,
      skipped: true,
      infoOnly: true,
    };
  }
  return {
    label,
    actual: actualText,
    expected: String(expected),
    pass:
      actual != null &&
      (list
        ? normalizeList(actual) === normalizeList(expected)
        : normalizeValue(actual) === normalizeValue(expected)),
  };
}

async function addHighlightStyle(page) {
  await page.addStyleTag({
    content: `
      .at-bs-webgpu-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-webgpu-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-webgpu-na { background: rgba(148,163,184,.2) !important; }
    `,
  }).catch(() => {});
}

async function paintRow(table, label, pass) {
  const rows = table.locator('tbody tr');
  const count = await rows.count();
  for (let index = 0; index < count; index++) {
    const row = rows.nth(index);
    const key = (await row.locator('td').first().innerText()).trim();
    if (key.toLowerCase() !== String(label).toLowerCase()) continue;
    await row.evaluate((element, state) => {
      element.classList.remove(
        'at-bs-webgpu-pass',
        'at-bs-webgpu-fail',
        'at-bs-webgpu-na'
      );
      element.classList.add(
        state === true
          ? 'at-bs-webgpu-pass'
          : state === false
            ? 'at-bs-webgpu-fail'
            : 'at-bs-webgpu-na'
      );
    }, pass);
    return 1;
  }
  return 0;
}

async function checkWebgpu(page, configMap, ctx) {
  ctx.step(`BrowserScan WebGPU: goto ${BROWSERSCAN_WEBGPU_URL}`);
  if (!/^https?:\/\/(?:www\.)?browserscan\.net\/webgpu\/?$/i.test(page.url())) {
    await page.goto(BROWSERSCAN_WEBGPU_URL, {
      waitUntil: 'domcontentloaded',
      timeout: LOAD_TIMEOUT_MS,
    });
  }

  const scraped = await scrapeWebgpuWithLocators(page);
  const lines = [
    makeLine('vendor', scraped.adapterInfo.vendor, cfgStr(configMap, CFG.vendor)),
    makeLine(
      'architecture',
      scraped.adapterInfo.architecture,
      cfgStr(configMap, CFG.architecture)
    ),
    makeLine(
      'features',
      scraped.features.join(','),
      cfgStr(configMap, CFG.features),
      true
    ),
  ];

  const configuredParams = Object.keys(configMap)
    .filter((key) => key.startsWith(PARAM_PREFIX))
    .sort();
  if (configuredParams.length) {
    for (const configKey of configuredParams) {
      const label = configKey.slice(PARAM_PREFIX.length);
      const actualKey = Object.keys(scraped.limits).find(
        (key) => key.toLowerCase() === label.toLowerCase()
      );
      lines.push(
        makeLine(
          label,
          actualKey ? scraped.limits[actualKey] : null,
          configMap[configKey]
        )
      );
    }
  } else {
    for (const [label, value] of Object.entries(scraped.limits)) {
      lines.push(makeLine(label, value, null));
    }
  }

  const result = summarizeFieldResults(lines, { discoverMode: true });
  await addHighlightStyle(page);
  let painted = 0;
  painted += await paintRow(
    scraped.tables.adapterInfoTable,
    'vendor',
    lines[0].infoOnly ? null : lines[0].pass
  );
  painted += await paintRow(
    scraped.tables.adapterInfoTable,
    'architecture',
    lines[1].infoOnly ? null : lines[1].pass
  );
  const featurePass = lines[2].infoOnly ? null : lines[2].pass;
  for (const feature of Object.keys(scraped.featureStates)) {
    painted += await paintRow(scraped.tables.featuresTable, feature, featurePass);
  }
  for (const line of lines.slice(3)) {
    painted += await paintRow(
      scraped.tables.limitsTable,
      line.label,
      line.infoOnly ? null : line.pass
    );
  }

  ctx.step(
    `BrowserScan WebGPU: ${scraped.features.length} features + ${Object.keys(scraped.limits).length} limits, ${result.state} (hl ${painted})`,
    result.pass === false ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  checkWebgpu,
  scrapeWebgpuWithLocators,
  normalizeValue,
  normalizeList,
  CFG,
  PARAM_PREFIX,
};
