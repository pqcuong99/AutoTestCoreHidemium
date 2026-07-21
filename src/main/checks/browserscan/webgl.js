/**
 * BrowserScan WebGL — hash + Unmasked Vendor + Unmasked Renderer.
 */
const { evaluateInPage } = require('./runtime');

const CFG = {
  mode: 'hidemium.webgl.mode',
  vendor: 'hidemium.webgl.vendor',
  renderer: 'hidemium.webgl.renderer',
};

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function equalText(actual, expected) {
  if (actual == null || expected == null) return null;
  return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

function decodeExpectedRenderer(value) {
  if (!value || isDefault(value)) return value;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (/^[\x20-\x7E]+$/.test(decoded) && decoded.length > 3) return decoded;
  } catch { /* ignore */ }
  return value;
}

function scrapeWebglInPage() {
  function selectValue(label, marker) {
    const heading = [...document.querySelectorAll('h3')].find(
      (element) =>
        (element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() ===
        label.toLowerCase()
    );
    if (!heading) return null;
    const card =
      heading.parentElement?.parentElement?.parentElement ||
      heading.parentElement;
    const valueElement = card?.querySelector('p');
    if (!valueElement) return null;
    valueElement.setAttribute(`data-autotest-bs-webgl-${marker}`, '1');
    return (valueElement.textContent || '').replace(/\s+/g, ' ').trim() || null;
  }

  const hashText = selectValue('WebGL', 'hash');
  return {
    hash: hashText?.match(/\b(?:0x)?[a-f0-9]{8,128}\b/i)?.[0] || null,
    vendor: selectValue('Unmasked Vendor', 'vendor'),
    renderer: selectValue('Unmasked Renderer', 'renderer'),
  };
}

function paintWebglInPage(marks) {
  const styleId = 'autotest-browserscan-webgl-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-bs-webgl-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-webgl-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-webgl-na { background: rgba(148,163,184,.2) !important; }
    `;
    document.head.appendChild(style);
  }

  let count = 0;
  for (const mark of marks) {
    const element = document.querySelector(
      `[data-autotest-bs-webgl-${mark.key}="1"]`
    );
    if (!element) continue;
    element.classList.remove(
      'at-bs-webgl-pass',
      'at-bs-webgl-fail',
      'at-bs-webgl-na'
    );
    element.classList.add(
      mark.pass === true
        ? 'at-bs-webgl-pass'
        : mark.pass === false
          ? 'at-bs-webgl-fail'
          : 'at-bs-webgl-na'
    );
    count++;
  }
  return count;
}

function comparedLine(label, actual, expected) {
  const pass = isDefault(expected)
    ? null
    : actual == null || actual === ''
      ? false
      : equalText(actual, expected);
  return {
    label,
    value: actual == null ? '' : String(actual),
    expected: isDefault(expected) ? 'default' : expected,
    pass,
  };
}

async function checkWebgl(page, configMap, ctx) {
  ctx.step('BrowserScan WebGL: select hash/vendor/renderer...');
  const scraped = await evaluateInPage(page, scrapeWebglInPage);
  const lines = [
    {
      label: 'hash',
      value: scraped.hash || '',
      expected: cfgStr(configMap, CFG.mode) || 'default',
      pass: null,
    },
    comparedLine('vendor', scraped.vendor, cfgStr(configMap, CFG.vendor)),
    comparedLine(
      'renderer',
      scraped.renderer,
      decodeExpectedRenderer(cfgStr(configMap, CFG.renderer))
    ),
  ];

  const judged = lines.filter((line) => line.pass === true || line.pass === false);
  const anyFail = judged.some((line) => line.pass === false);
  const allPass = judged.length > 0 && judged.every((line) => line.pass === true);
  const result = {
    lines,
    state: anyFail ? 'fail' : allPass ? 'pass' : 'skipped',
    pass: anyFail ? false : allPass ? true : null,
    value: lines.map((line) => `${line.label}\n${line.value}`).join('\n'),
  };
  const painted = await evaluateInPage(page, paintWebglInPage, [
    { key: 'hash', pass: null },
    { key: 'vendor', pass: lines[1].pass },
    { key: 'renderer', pass: lines[2].pass },
  ]);
  ctx.step(
    `BrowserScan WebGL: hash=${scraped.hash || 'null'} (hl ${painted})`,
    result.pass === false ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  checkWebgl,
  scrapeWebglInPage,
  paintWebglInPage,
  CFG,
};
