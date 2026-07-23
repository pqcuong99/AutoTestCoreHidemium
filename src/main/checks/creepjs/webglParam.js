/**
 * CreepJS — WebGL parameters trong modal.
 */
const { isDefault, summarizeLines } = require('./helpers');

const CFG_PREFIX = 'hidemium.webgl.webgl_param.';
const OPEN_XPATH =
  '//*[@id="fingerprint-data"]/div[6]/div[1]/div[3]/label[1]';
const MODAL_SELECTOR =
  '#fingerprint-data > div:nth-child(6) > div:nth-child(1) > div:nth-child(6) > label.modal-container > label';
const EXTENSION_OPEN_SELECTOR =
  'label.modal-open-btn[for="toggle-open-creep-canvas-webgl-extensions"]';
const EXTENSION_MODAL_SELECTOR =
  'label.modal-content[for="toggle-open-creep-canvas-webgl-extensions"]';

function normalizeParamName(value) {
  return String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function normalizeValue(value) {
  return String(value == null ? '' : value)
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function normalizeExtensionList(value) {
  const extensions = String(value == null ? '' : value)
    .split(',')
    .map((extension) => extension.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(extensions)].sort().join(',');
}

function scrapeWebglParamsInPage() {
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

  // Mo modal bang DOM click — khong dung Playwright locator (tranh timeout).
  try {
    const open = document.evaluate(
      '//*[@id="fingerprint-data"]/div[6]/div[1]/div[3]/label[1]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
    if (open) open.click();
  } catch { /* ignore */ }
  try {
    document
      .querySelector('label.modal-open-btn[for="toggle-open-creep-canvas-webgl-extensions"]')
      ?.click();
  } catch { /* ignore */ }

  const modal = document.querySelector(
    '#fingerprint-data > div:nth-child(6) > div:nth-child(1) > div:nth-child(6) > label.modal-container > label'
  );
  const extensionModal = document.querySelector(
    'label.modal-content[for="toggle-open-creep-canvas-webgl-extensions"]'
  );
  if (!modal) return { params: {}, count: 0, extensions: [] };

  const content = modal.querySelector(':scope > div') || modal;
  const params = {};
  for (const rawLine of readBrLines(content)) {
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line
      .slice(0, separator)
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key) params[key] = value;
  }
  modal.setAttribute('data-autotest-creep-webgl-param', '1');
  if (extensionModal) {
    extensionModal.setAttribute('data-autotest-creep-webgl-param', '1');
  }
  const extensionContent =
    extensionModal?.querySelector(':scope > div') || extensionModal;
  const extensions = extensionContent ? readBrLines(extensionContent) : [];
  return { params, count: Object.keys(params).length, extensions };
}

function paintWebglParamsInPage(pass) {
  const modals = document.querySelectorAll(
    '[data-autotest-creep-webgl-param="1"]'
  );
  if (!modals.length) return 0;
  const styleId = 'autotest-creep-webgl-param-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-creep-webgl-param-pass { outline: 3px solid #22c55e !important; }
      .at-creep-webgl-param-fail { outline: 3px solid #ef4444 !important; }
      .at-creep-webgl-param-na { outline: 2px solid #94a3b8 !important; }
    `;
    document.head.appendChild(style);
  }
  for (const modal of modals) {
    modal.classList.remove(
      'at-creep-webgl-param-pass',
      'at-creep-webgl-param-fail',
      'at-creep-webgl-param-na'
    );
    modal.classList.add(
      pass === true
        ? 'at-creep-webgl-param-pass'
        : pass === false
          ? 'at-creep-webgl-param-fail'
          : 'at-creep-webgl-param-na'
    );
  }
  return modals.length;
}

function findActual(params, configName, extensions) {
  const normalized = normalizeParamName(configName);
  if (normalized === 'webgl_extension') {
    return (extensions || []).join(',');
  }
  // WebGL2 extension list: CreepJS khong expose rieng — khong so khi co config.
  if (normalized === 'webgl_extension_2') {
    return null;
  }
  if (normalized in params) return params[normalized];
  if (normalized.endsWith('2')) {
    const withoutContextSuffix = normalized.slice(0, -1);
    if (withoutContextSuffix in params) return params[withoutContextSuffix];
  }
  return null;
}

function buildLine(label, actual, expected) {
  const rawActual = actual == null || actual === '' ? '' : String(actual);

  // default / empty config → chi hien thi, khong so sanh vs config.
  if (isDefault(expected)) {
    return {
      label,
      actual: rawActual || 'undefined',
      value: rawActual || 'undefined',
      expected: '',
      pass: true,
      skipped: true,
      infoOnly: true,
    };
  }

  if (!rawActual || /^undefined$/i.test(rawActual)) {
    return {
      label,
      actual: 'undefined',
      value: 'undefined',
      expected: String(expected),
      pass: false,
      skipped: true,
      missingOnWeb: true,
    };
  }

  const ok = /^webgl_extension$/i.test(label)
    ? normalizeExtensionList(rawActual) === normalizeExtensionList(expected)
    : normalizeValue(rawActual) === normalizeValue(expected);

  return {
    label,
    actual: rawActual,
    value: rawActual,
    expected: String(expected),
    pass: ok,
  };
}

async function checkWebglParam(page, configMap, ctx) {
  ctx.step('CreepJS WebGL Param: scrape params/extensions...');
  const scraped = await page.evaluate(scrapeWebglParamsInPage);
  const configured = Object.keys(configMap)
    .filter((key) => key.startsWith(CFG_PREFIX))
    .sort();
  const comparable = configured.filter((key) => !isDefault(configMap[key]));

  if (configured.length && !comparable.length) {
    ctx.step(
      'CreepJS WebGL Param: tat ca config=default — chi hien thi, khong so sanh',
      'ok'
    );
  }

  const lines = configured.length
    ? configured.map((configKey) => {
        const label = configKey.slice(CFG_PREFIX.length);
        const expected = configMap[configKey];
        const actual = findActual(
          scraped.params,
          label,
          scraped.extensions
        );
        return buildLine(label, actual, expected);
      })
    : Object.entries(scraped.params).map(([label, value]) =>
        buildLine(label, value, null)
      );

  const result = summarizeLines(lines);
  const hasMismatch = (result.lines || []).some((line) => line.status === 'mismatch');
  const paintPass = hasMismatch ? false : result.state === 'pass' ? true : null;
  const painted = await page.evaluate(paintWebglParamsInPage, paintPass);
  ctx.step(
    `CreepJS WebGL Param: ${scraped.count} params + ${scraped.extensions.length} extensions, compare=${comparable.length}, ${result.state} (hl ${painted})`,
    hasMismatch ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  checkWebglParam,
  scrapeWebglParamsInPage,
  normalizeParamName,
  normalizeValue,
  normalizeExtensionList,
  findActual,
  CFG_PREFIX,
  OPEN_XPATH,
  MODAL_SELECTOR,
  EXTENSION_OPEN_SELECTOR,
  EXTENSION_MODAL_SELECTOR,
};
