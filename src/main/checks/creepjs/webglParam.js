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

function findActual(params, configName, extensions, expected) {
  const normalized = normalizeParamName(configName);
  if (normalized === 'webgl_extension') {
    return (extensions || []).join(',');
  }
  if (normalized === 'webgl_extension_2') {
    return isDefault(expected) ? 'default' : null;
  }
  if (normalized in params) return params[normalized];
  if (normalized.endsWith('2')) {
    const withoutContextSuffix = normalized.slice(0, -1);
    if (withoutContextSuffix in params) return params[withoutContextSuffix];
  }
  return null;
}

async function checkWebglParam(page, configMap, ctx) {
  ctx.step(`CreepJS WebGL Param: click ${OPEN_XPATH}`);
  const trigger = page.locator(`xpath=${OPEN_XPATH}`).first();
  if (await trigger.count()) {
    await trigger.click({ force: true }).catch(() => {});
  }
  const extensionTrigger = page.locator(EXTENSION_OPEN_SELECTOR).first();
  if (await extensionTrigger.count()) {
    await extensionTrigger.click({ force: true }).catch(() => {});
  }

  const scraped = await page.evaluate(scrapeWebglParamsInPage);
  const configured = Object.keys(configMap)
    .filter((key) => key.startsWith(CFG_PREFIX))
    .sort();

  const lines = configured.length
    ? configured.map((configKey) => {
        const label = configKey.slice(CFG_PREFIX.length);
        const expected = configMap[configKey];
        const actual = findActual(
          scraped.params,
          label,
          scraped.extensions,
          expected
        );
        return {
          label,
          value: actual == null ? '' : String(actual),
          expected: isDefault(expected) ? 'default' : String(expected),
          pass: isDefault(expected)
            ? null
            : actual != null &&
              (/^webgl_extension$/i.test(label)
                ? normalizeExtensionList(actual) ===
                  normalizeExtensionList(expected)
                : normalizeValue(actual) === normalizeValue(expected)),
        };
      })
    : Object.entries(scraped.params).map(([label, value]) => ({
        label,
        value: String(value),
        expected: 'default',
        pass: null,
      }));

  const result = summarizeLines(lines);
  const painted = await page.evaluate(
    paintWebglParamsInPage,
    result.pass
  );
  ctx.step(
    `CreepJS WebGL Param: ${scraped.count} params + ${scraped.extensions.length} extensions, ${result.state} (hl ${painted})`,
    result.pass === false ? 'err' : 'ok'
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
