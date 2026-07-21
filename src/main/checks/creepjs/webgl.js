/**
 * CreepJS — WebGL hash + vendor + renderer.
 */
const { cfgStr, isDefault, eqStr, finishCheck } = require('./helpers');

const CFG = {
  mode: 'hidemium.webgl.mode',
  vendor: 'hidemium.webgl.vendor',
  renderer: 'hidemium.webgl.renderer',
};

function scrapeWebglInPage() {
  const data =
    window.Fingerprint &&
    window.Fingerprint.canvasWebgl;
  const parameters = (data && data.parameters) || {};

  let hash = data && data.$hash ? String(data.$hash).slice(0, 8) : null;
  let vendor = parameters.UNMASKED_VENDOR_WEBGL || null;
  let renderer = parameters.UNMASKED_RENDERER_WEBGL || null;

  const root = document.getElementById('fingerprint-data') || document.body;
  const nodes = Array.from(root.querySelectorAll('*'));
  let sectionText = '';
  let bestLength = Infinity;
  for (const node of nodes) {
    const text = (node.innerText || '').trim();
    if (!/^WebGL\s+[a-f0-9]{6,}/im.test(text) || !/\bgpu\s*:/i.test(text)) continue;
    if (text.length < bestLength) {
      sectionText = text;
      bestLength = text.length;
    }
  }

  if (!hash && sectionText) {
    const match = sectionText.match(/\bWebGL\s+([a-f0-9]{6,})/i);
    if (match) hash = match[1];
  }

  // API fallback neu Fingerprint chua expose parameters.
  if (!vendor || !renderer) {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      const extension = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (gl && extension) {
        if (!vendor) vendor = gl.getParameter(extension.UNMASKED_VENDOR_WEBGL);
        if (!renderer) renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
      }
    } catch { /* ignore */ }
  }

  return {
    hash: hash == null ? null : String(hash),
    vendor: vendor == null ? null : String(vendor),
    renderer: renderer == null ? null : String(renderer),
  };
}

function decodeExpectedRenderer(value) {
  if (!value || isDefault(value)) return value;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (/^[\x20-\x7E]+$/.test(decoded) && decoded.length > 3) return decoded;
  } catch { /* ignore */ }
  return value;
}

function comparedLine(label, actual, expected) {
  const pass =
    isDefault(expected) || actual == null || actual === ''
      ? null
      : eqStr(actual, expected);
  return {
    label,
    value: actual == null ? '' : actual,
    expected: isDefault(expected) ? 'default' : expected,
    pass,
    needle: actual,
  };
}

async function checkWebgl(page, configMap, ctx) {
  ctx.step('CreepJS WebGL: select hash/vendor/renderer...');
  const scraped = await page.evaluate(scrapeWebglInPage);

  const expectedVendor = cfgStr(configMap, CFG.vendor);
  const expectedRenderer = decodeExpectedRenderer(cfgStr(configMap, CFG.renderer));
  const lines = [
    {
      label: 'hash',
      value: scraped.hash || '',
      expected: cfgStr(configMap, CFG.mode) || 'default',
      pass: null, // mode=noise duoc thay bang hash, khong boi do
      needle: scraped.hash,
    },
    comparedLine('vendor', scraped.vendor, expectedVendor),
    comparedLine('renderer', scraped.renderer, expectedRenderer),
  ];

  ctx.step(
    `CreepJS WebGL: hash=${scraped.hash || 'null'} vendor=${scraped.vendor || 'null'}`
  );
  return finishCheck(
    page,
    ctx,
    'WebGL',
    lines,
    !scraped.vendor && !scraped.renderer
  );
}

module.exports = { checkWebgl, scrapeWebglInPage, CFG };
