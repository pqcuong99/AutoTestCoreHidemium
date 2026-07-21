/**
 * CreepJS — WebGPU Adapter / Features / Limits.
 */
const { cfgStr, isDefault, summarizeLines } = require('./helpers');

const CFG = {
  vendor: 'hidemium.webgpu.vendor',
  architecture: 'hidemium.webgpu.architecture',
  features: 'hidemium.webgpu.features',
};
const PARAM_PREFIX = 'hidemium.webgpu.param.';
const OPEN_XPATH =
  '//*[@id="fingerprint-data"]/div[13]/div[1]/div[9]/label[1]';
const MODAL_SELECTOR =
  'label.modal-content[for="toggle-open-creep-navigator-webgpu"]';

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

async function scrapeWebgpuInPage() {
  function readBrLines(content) {
    const lines = [];
    let currentLine = '';
    for (const node of content.childNodes) {
      if (node.nodeName === 'BR') {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = '';
      } else {
        currentLine += node.textContent || '';
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    return lines;
  }

  const modal = document.querySelector(
    'label.modal-content[for="toggle-open-creep-navigator-webgpu"]'
  );
  const fingerprint = window.Fingerprint?.navigator?.webgpu || {};
  const adapterInfo = Array.isArray(fingerprint.adapterInfo)
    ? fingerprint.adapterInfo
    : [];
  const limits = { ...(fingerprint.limits || {}) };
  let vendor = adapterInfo[0] || null;
  let architecture = adapterInfo[1] || null;

  if (modal) {
    const root = modal.querySelector(':scope > div') || modal;
    const blocks = [...root.children].filter((element) => element.tagName === 'DIV');
    const adapterLines = blocks[0] ? readBrLines(blocks[0]) : [];
    const limitLines = blocks[1] ? readBrLines(blocks[1]) : [];
    vendor = adapterLines[1] || vendor;
    architecture = adapterLines[2] || architecture;
    for (const line of limitLines) {
      const separator = line.indexOf(':');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (key) limits[key] = value;
    }
    modal.setAttribute('data-autotest-creep-webgpu', '1');
  }

  let features = [];
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (adapter?.features) features = [...adapter.features.values()];
    if ((!vendor || /^unknown$/i.test(vendor)) && adapter?.info?.vendor) {
      vendor = adapter.info.vendor;
    }
    if (
      (!architecture || /^unknown$/i.test(architecture)) &&
      adapter?.info?.architecture
    ) {
      architecture = adapter.info.architecture;
    }
  } catch { /* ignore */ }

  return {
    vendor: vendor || null,
    architecture: architecture || null,
    features,
    limits,
  };
}

function paintWebgpuInPage(pass) {
  const modal = document.querySelector('[data-autotest-creep-webgpu="1"]');
  if (!modal) return 0;
  const styleId = 'autotest-creep-webgpu-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-creep-webgpu-pass { outline: 3px solid #22c55e !important; }
      .at-creep-webgpu-fail { outline: 3px solid #ef4444 !important; }
      .at-creep-webgpu-na { outline: 2px solid #94a3b8 !important; }
    `;
    document.head.appendChild(style);
  }
  modal.classList.remove(
    'at-creep-webgpu-pass',
    'at-creep-webgpu-fail',
    'at-creep-webgpu-na'
  );
  modal.classList.add(
    pass === true
      ? 'at-creep-webgpu-pass'
      : pass === false
        ? 'at-creep-webgpu-fail'
        : 'at-creep-webgpu-na'
  );
  return 1;
}

function makeLine(label, actual, expected, list = false) {
  return {
    label,
    value: actual == null ? '' : String(actual),
    expected: isDefault(expected) ? 'default' : String(expected),
    pass: isDefault(expected)
      ? null
      : actual != null &&
        (list
          ? normalizeList(actual) === normalizeList(expected)
          : normalizeValue(actual) === normalizeValue(expected)),
  };
}

async function checkWebgpu(page, configMap, ctx) {
  ctx.step(`CreepJS WebGPU: click ${OPEN_XPATH}`);
  const trigger = page.locator(`xpath=${OPEN_XPATH}`).first();
  if (await trigger.count()) {
    await trigger.click({ force: true }).catch(() => {});
  }

  const scraped = await page.evaluate(scrapeWebgpuInPage);
  const lines = [
    makeLine('vendor', scraped.vendor, cfgStr(configMap, CFG.vendor)),
    makeLine(
      'architecture',
      scraped.architecture,
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

  const result = summarizeLines(lines);
  const painted = await page.evaluate(paintWebgpuInPage, result.pass);
  ctx.step(
    `CreepJS WebGPU: ${scraped.features.length} features + ${Object.keys(scraped.limits).length} limits, ${result.state} (hl ${painted})`,
    result.pass === false ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  checkWebgpu,
  scrapeWebgpuInPage,
  normalizeValue,
  normalizeList,
  CFG,
  PARAM_PREFIX,
  OPEN_XPATH,
  MODAL_SELECTOR,
};
