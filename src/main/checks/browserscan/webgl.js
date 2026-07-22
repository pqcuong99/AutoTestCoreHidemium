/**
 * BrowserScan WebGL — hash + Unmasked Vendor + Unmasked Renderer.
 * Gia tri hydrate cham / bi quang cao ghep text → wait + fallback API + reload 1 lan.
 */
const { evaluateInPage } = require('./runtime');
const { BROWSERSCAN_URL } = require('./urls');

const CFG = {
  mode: 'hidemium.webgl.mode',
  vendor: 'hidemium.webgl.vendor',
  renderer: 'hidemium.webgl.renderer',
};
const READY_TIMEOUT_MS = 12000;
const LOAD_TIMEOUT_MS = 90000;

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
  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function findHeading(label) {
    return [...document.querySelectorAll('h3')].find(
      (element) =>
        normalize(element.textContent).toLowerCase() === label.toLowerCase()
    );
  }

  function cardOf(heading) {
    return (
      heading?.parentElement?.parentElement?.parentElement ||
      heading?.parentElement ||
      null
    );
  }

  function cleanAdNoise(text) {
    return normalize(text)
      .replace(
        /\s*(?:Free\s+DNS|Internet\s+Speed|Antidetect|Sign\s+In|Discover\s+more|blog\b).*$/i,
        ''
      )
      .trim();
  }

  function selectValue(label, marker, accept) {
    const heading = findHeading(label);
    if (!heading) return null;
    const card = cardOf(heading);
    if (!card) return null;

    const candidates = [...card.querySelectorAll('p, span, div')]
      .map((element) => ({
        element,
        text: cleanAdNoise(element.innerText || element.textContent || ''),
      }))
      .filter((item) => item.text && item.text.toLowerCase() !== label.toLowerCase())
      .filter((item) => !accept || accept(item.text));

    // Uu tien node ngan nhat (dung value, khong nham ca card).
    candidates.sort((a, b) => a.text.length - b.text.length);
    const best = candidates[0];
    if (!best) return null;
    best.element.setAttribute(`data-autotest-bs-webgl-${marker}`, '1');
    return best.text || null;
  }

  function apiVendorRenderer() {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const extension = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (!gl || !extension) return { vendor: null, renderer: null };
      return {
        vendor: String(gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) || '').trim() || null,
        renderer:
          String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) || '').trim() ||
          null,
      };
    } catch {
      return { vendor: null, renderer: null };
    }
  }

  const hashText = selectValue('WebGL', 'hash', (text) =>
    /\b(?:0x)?[a-f0-9]{6,128}\b/i.test(text)
  );
  let vendor = selectValue('Unmasked Vendor', 'vendor', (text) =>
    /inc|google|apple|nvidia|amd|intel|qualcomm|arm|mesa|microsoft/i.test(text)
  );
  let renderer = selectValue('Unmasked Renderer', 'renderer', (text) =>
    /angle|radeon|geforce|intel|apple|mali|adreno|swiftshader|metal|opengl|direct3d/i.test(
      text
    )
  );

  if (!vendor || !renderer) {
    const api = apiVendorRenderer();
    vendor = vendor || api.vendor;
    renderer = renderer || api.renderer;
  }

  return {
    hash: hashText?.match(/\b(?:0x)?[a-f0-9]{6,128}\b/i)?.[0] || null,
    vendor,
    renderer,
    ready: !!(hashText || vendor || renderer),
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

function isComplete(scraped) {
  return !!(scraped?.hash && scraped?.vendor && scraped?.renderer);
}

async function scrapeUntilReady(page, timeoutMs) {
  const started = Date.now();
  let last = { hash: null, vendor: null, renderer: null };
  while (Date.now() - started < timeoutMs) {
    last = (await evaluateInPage(page, scrapeWebglInPage)) || last;
    if (isComplete(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return last;
}

async function checkWebgl(page, configMap, ctx) {
  ctx.step('BrowserScan WebGL: cho hash/vendor/renderer hydrate...');
  let scraped = await scrapeUntilReady(page, READY_TIMEOUT_MS);

  if (!isComplete(scraped)) {
    if (ctx.signal?.aborted) throw new Error('aborted');
    ctx.step(
      'BrowserScan WebGL: thieu hash/vendor/renderer (hydrate/quang cao) — reload 1 lan',
      'warn'
    );
    if (/^https?:\/\/(?:www\.)?browserscan\.net\/?$/i.test(page.url())) {
      await page.reload({
        waitUntil: 'domcontentloaded',
        timeout: LOAD_TIMEOUT_MS,
      });
    } else {
      await page.goto(BROWSERSCAN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: LOAD_TIMEOUT_MS,
      });
    }
    if (ctx.signal?.aborted) throw new Error('aborted');
    scraped = await scrapeUntilReady(page, READY_TIMEOUT_MS);
  }

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
    `BrowserScan WebGL: hash=${scraped.hash || 'null'} vendor=${scraped.vendor || 'null'} (hl ${painted})`,
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
