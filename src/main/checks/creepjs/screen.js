/**
 * CreepJS — check muc Screen.
 *
 * Flow:
 *   1. Playwright CDP attach vao profile dang mo
 *   2. Mo tab https://abrahamjuliot.github.io/creepjs/
 *   3. Doi #creep-resize / Fingerprint.screen load xong
 *   4. Doc gia tri bang select element + so sanh config
 *   5. Highlight xanh (khop) / do (lech) tren trang CreepJS
 */
const { openPage, release } = require('../../browserCdp');

const CREEPJS_URL = 'https://abrahamjuliot.github.io/creepjs/';
const LOAD_TIMEOUT_MS = 90000;

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const CFG = {
  width: 'hidemium.navigator.screen.width',
  height: 'hidemium.navigator.screen.height',
  availWidth: 'hidemium.navigator.screen.avail_width',
  availHeight: 'hidemium.navigator.screen.avail_height',
  colorDepth: 'hidemium.navigator.screen.color_depth',
  pixelDepth: 'hidemium.navigator.screen.pixcel_depth',
  innerWidth: 'hidemium.navigator.screen.inner_width',
  innerHeight: 'hidemium.navigator.screen.inner_height',
  outerWidth: 'hidemium.navigator.screen.outer_width',
  outerHeight: 'hidemium.navigator.screen.outer_height',
  dpr: 'hidemium.navigator.pixel_ratio',
  maxTouch: 'hidemium.navigator.max_touch_point',
};

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function eqNum(a, b) {
  if (a == null || b == null) return null;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a).trim() === String(b).trim();
}

/**
 * Lay gia tri Screen tu DOM (#creep-resize) + window.Fingerprint.screen.
 * Chay trong browser context (page.evaluate).
 */
function scrapeScreenInPage() {
  const root = document.getElementById('creep-resize');
  const fp = window.Fingerprint && window.Fingerprint.screen;
  const text = root ? root.innerText || '' : '';

  const pick = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  const screenWH = pick(/\.\.\.screen:\s*([^\n]+)/i);
  const availWH = pick(/\.\.\.\.avail:\s*([^\n]+)/i);
  const touchRaw = pick(/touch:\s*([^\n]+)/i);
  const depthRaw = pick(/depth:\s*([^\n]+)/i);

  let width = fp?.width;
  let height = fp?.height;
  let availWidth = fp?.availWidth;
  let availHeight = fp?.availHeight;
  let colorDepth = fp?.colorDepth;
  let pixelDepth = fp?.pixelDepth;
  let touch = fp?.touch;

  if (screenWH) {
    const p = screenWH.split(/\s*x\s*/i);
    if (p.length === 2) {
      width = width ?? Number(p[0]);
      height = height ?? Number(p[1]);
    }
  }
  if (availWH) {
    const p = availWH.split(/\s*x\s*/i);
    if (p.length === 2) {
      availWidth = availWidth ?? Number(p[0]);
      availHeight = availHeight ?? Number(p[1]);
    }
  }
  if (depthRaw) {
    const p = depthRaw.split('|');
    if (p.length >= 1) colorDepth = colorDepth ?? Number(p[0]);
    if (p.length >= 2) pixelDepth = pixelDepth ?? Number(p[1]);
  }
  if (touch == null && touchRaw != null) {
    touch = /^(true|1|yes)$/i.test(touchRaw);
  }

  const outerW = document.querySelector('.screen-outer-w');
  const outerH = document.querySelector('.screen-outer-h');
  const innerW = document.querySelector('.screen-inner-w');
  const innerH = document.querySelector('.screen-inner-h');
  const dprEl = document.querySelector('.screen-dpr');

  return {
    width,
    height,
    availWidth,
    availHeight,
    colorDepth,
    pixelDepth,
    touch,
    outerWidth: outerW ? Number(outerW.textContent.trim()) : window.outerWidth,
    outerHeight: outerH ? Number(outerH.textContent.trim()) : window.outerHeight,
    innerWidth: innerW ? Number(innerW.textContent.trim()) : window.innerWidth,
    innerHeight: innerH ? Number(innerH.textContent.trim()) : window.innerHeight,
    dpr: dprEl ? Number(dprEl.textContent.trim()) : window.devicePixelRatio,
    rawText: text,
    hasDom: !!root,
  };
}

/**
 * Highlight tung dong Screen tren trang CreepJS (xanh = khop, do = lech).
 * @param {Array<{ needle:string, pass:boolean|null, selector?:string }>} marks
 */
function highlightScreenInPage(marks) {
  const STYLE_ID = 'autotest-creepjs-hl';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .at-hl-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e; border-radius: 3px; }
      .at-hl-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444; border-radius: 3px; }
      .at-hl-skip { background: rgba(148,163,184,.2) !important; border-radius: 3px; }
    `;
    document.head.appendChild(style);
  }

  const clsOf = (pass) =>
    pass === true ? 'at-hl-pass' : pass === false ? 'at-hl-fail' : 'at-hl-skip';

  const paint = (el, pass) => {
    if (!el) return;
    el.classList.remove('at-hl-pass', 'at-hl-fail', 'at-hl-skip');
    el.classList.add(clsOf(pass));
  };

  const root = document.getElementById('creep-resize') || document.getElementById('fingerprint-data');
  if (!root) return 0;

  let painted = 0;
  const all = Array.from(root.querySelectorAll('*'));

  for (const mark of marks) {
    if (mark.selector) {
      root.querySelectorAll(mark.selector).forEach((el) => {
        paint(el, mark.pass);
        painted++;
      });
      continue;
    }
    if (!mark.needle) continue;

    // Tim node co text ngan chua label (vd "...screen:")
    let best = null;
    let bestLen = Infinity;
    for (const node of all) {
      const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || !t.includes(mark.needle.replace(/\s+/g, ' ').trim())) continue;
      if (t.length < bestLen && t.length < 120) {
        best = node;
        bestLen = t.length;
      }
    }
    if (best) {
      paint(best, mark.pass);
      painted++;
    }
  }

  return painted;
}

/**
 * So sanh scraped vs configMap -> lines + pass/fail.
 */
function compareScreen(scraped, configMap) {
  const lines = [];

  const w = cfgStr(configMap, CFG.width);
  const h = cfgStr(configMap, CFG.height);
  const aw = cfgStr(configMap, CFG.availWidth);
  const ah = cfgStr(configMap, CFG.availHeight);
  const cd = cfgStr(configMap, CFG.colorDepth);
  const pd = cfgStr(configMap, CFG.pixelDepth);
  const iw = cfgStr(configMap, CFG.innerWidth);
  const ih = cfgStr(configMap, CFG.innerHeight);
  const ow = cfgStr(configMap, CFG.outerWidth);
  const oh = cfgStr(configMap, CFG.outerHeight);
  const dpr = cfgStr(configMap, CFG.dpr);
  const mt = cfgStr(configMap, CFG.maxTouch);

  // ...screen
  {
    const actual = `${scraped.width} x ${scraped.height}`;
    const expected = w != null && h != null ? `${w} x ${h}` : null;
    const pass =
      expected == null ? null : eqNum(scraped.width, w) && eqNum(scraped.height, h);
    lines.push({
      label: '...screen',
      value: actual,
      expected,
      pass,
      needle: '...screen:',
    });
  }

  // ....avail
  {
    const actual = `${scraped.availWidth} x ${scraped.availHeight}`;
    const expected = aw != null && ah != null ? `${aw} x ${ah}` : null;
    const pass =
      expected == null ? null : eqNum(scraped.availWidth, aw) && eqNum(scraped.availHeight, ah);
    lines.push({
      label: '....avail',
      value: actual,
      expected,
      pass,
      needle: '....avail:',
    });
  }

  // touch
  {
    const actual = String(!!scraped.touch);
    let expected = null;
    let pass = null;
    if (mt != null) {
      expected = String(Number(mt) > 0);
      pass = actual === expected;
    }
    lines.push({
      label: 'touch',
      value: actual,
      expected,
      pass,
      needle: 'touch:',
    });
  }

  // depth
  {
    const actual = `${scraped.colorDepth}|${scraped.pixelDepth}`;
    const expected = cd != null && pd != null ? `${cd}|${pd}` : null;
    const pass =
      expected == null
        ? null
        : eqNum(scraped.colorDepth, cd) && eqNum(scraped.pixelDepth, pd);
    lines.push({
      label: 'depth',
      value: actual,
      expected,
      pass,
      needle: 'depth:',
    });
  }

  // viewport pieces
  const vpParts = [
    { label: 'outerWidth', actual: scraped.outerWidth, cfg: ow, selector: '.screen-outer-w' },
    { label: 'outerHeight', actual: scraped.outerHeight, cfg: oh, selector: '.screen-outer-h' },
    { label: 'innerWidth', actual: scraped.innerWidth, cfg: iw, selector: '.screen-inner-w' },
    { label: 'innerHeight', actual: scraped.innerHeight, cfg: ih, selector: '.screen-inner-h' },
    { label: 'dpr', actual: scraped.dpr, cfg: dpr, selector: '.screen-dpr' },
  ];

  for (const p of vpParts) {
    const expected = p.cfg;
    const pass = expected == null ? null : eqNum(p.actual, expected);
    lines.push({
      label: p.label,
      value: String(p.actual),
      expected,
      pass,
      needle: null,
      selector: p.selector,
    });
  }

  const judged = lines.filter((l) => l.pass === true || l.pass === false);
  const allPass = judged.length > 0 && judged.every((l) => l.pass === true);
  const anyFail = judged.some((l) => l.pass === false);

  return {
    lines,
    state: anyFail ? 'fail' : allPass ? 'pass' : judged.length ? 'pass' : 'skipped',
    pass: anyFail ? false : allPass ? true : null,
    value: lines
      .filter((l) => !l.selector || ['outerWidth', 'innerWidth', 'dpr'].includes(l.label))
      .map((l) => `${l.label}: ${l.value}${l.pass === false ? ' ≠ ' + l.expected : ''}`)
      .join('\n'),
  };
}

/**
 * @param {{ openData:object, configMap:object, signal:AbortSignal, step:Function }} ctx
 * @returns {Promise<{ state:string, value:string, pass?:boolean, lines?:Array }>}
 */
async function checkScreen(ctx) {
  const { openData, configMap, signal, step, options } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  let session;
  try {
    step('CreepJS Screen: ket noi CDP + mo tab...');
    session = await openPage(openData);
    const { page } = session;

    if (signal?.aborted) throw new Error('aborted');

    step(`CreepJS Screen: goto ${CREEPJS_URL}`);
    await page.goto(CREEPJS_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT_MS });

    step('CreepJS Screen: doi fingerprint load...');
    await page.waitForFunction(
      () => {
        const fpReady = !!(window.Fingerprint && window.Fingerprint.screen);
        const el = document.getElementById('creep-resize');
        const textOk = el && /\.\.\.screen:\s*\d+/i.test(el.innerText || '');
        return fpReady || textOk;
      },
      { timeout: LOAD_TIMEOUT_MS }
    );

    await sleep(500, signal);

    step('CreepJS Screen: select #creep-resize + so sanh config...');
    const scraped = await page.evaluate(scrapeScreenInPage);
    if (!scraped.hasDom && scraped.width == null) {
      return { state: 'fail', value: 'Khong doc duoc Screen tu CreepJS', pass: false, lines: [] };
    }

    const compared = compareScreen(scraped, configMap);

    const marks = compared.lines.map((l) => ({
      needle: l.needle,
      selector: l.selector,
      pass: l.pass,
    }));
    const painted = await page.evaluate(highlightScreenInPage, marks);
    step(
      `CreepJS Screen: ${compared.state} — highlight ${painted} o (${compared.lines.filter((l) => l.pass === false).length} lech)`,
      compared.pass === false ? 'err' : 'ok'
    );

    // Neu sap dong profile thi khong can giu tab; nguoc lai giu tab de nhin highlight.
    const keepPage = !(options && options.autoClose);
    await release(session, { keepPage });
    session = null;

    return compared;
  } catch (err) {
    if (err.message === 'aborted') throw err;
    step('CreepJS Screen loi: ' + err.message, 'err');
    return { state: 'fail', value: err.message, pass: false, lines: [] };
  } finally {
    if (session) await release(session, { keepPage: false });
  }
}

module.exports = { checkScreen, compareScreen, CREEPJS_URL };
