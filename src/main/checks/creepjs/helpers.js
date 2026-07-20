/**
 * Helper chung cho cac check CreepJS.
 */
const CREEPJS_URL = 'https://abrahamjuliot.github.io/creepjs/';
const LOAD_TIMEOUT_MS = 90000;

/** Playwright: options phai la arg thu 3, khong phai arg thu 2. */
function waitForPageFunction(page, pageFunction, timeout = LOAD_TIMEOUT_MS) {
  return page.waitForFunction(pageFunction, undefined, { timeout, polling: 500 });
}

/**
 * CreepJS da render du lieu doc duoc (Fingerprint hoac DOM fallback).
 * Dung OR — screen/navigator load khong dong bo tren Hidemium.
 */
function creepjsReadyPredicate() {
  const fp = window.Fingerprint;
  const resizeEl = document.getElementById('creep-resize');
  const fpEl = document.getElementById('fingerprint-data');
  const resizeText = resizeEl ? resizeEl.innerText || '' : '';
  const fpText = fpEl ? fpEl.innerText || '' : '';

  const screenOk =
    !!(fp && fp.screen) ||
    /\.\.\.screen:\s*\d+/i.test(resizeText);

  const nav = fp && fp.navigator;
  const uad = nav && nav.userAgentData;
  const navOk =
    !!(nav && (
      nav.platform != null ||
      nav.userAgent ||
      nav.maxTouchPoints != null ||
      (uad && (
        uad.platform ||
        uad.uaFullVersion ||
        (uad.brandsVersion && uad.brandsVersion.length) ||
        (uad.brands && uad.brands.length)
      ))
    )) ||
    (/device\s*:/i.test(fpText) && /cores:\s*\d+/i.test(fpText)) ||
    (/userAgent\s*:/i.test(fpText) && /Mozilla\/5\.0/i.test(fpText));

  return screenOk || navOk;
}

async function waitCreepjsReady(page, timeout = LOAD_TIMEOUT_MS) {
  return waitForPageFunction(page, creepjsReadyPredicate, timeout);
}

async function isCreepjsReady(page) {
  try {
    return await page.evaluate(creepjsReadyPredicate);
  } catch {
    return false;
  }
}

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

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(v) {
  return v == null || v === '' || /^default$/i.test(String(v).trim());
}

function eqStr(a, b) {
  if (a == null || b == null) return null;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function eqNum(a, b) {
  if (a == null || b == null) return null;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a).trim() === String(b).trim();
}

/**
 * Inject CSS highlight + paint theo marks [{ needle, selector, pass }].
 * Chay trong page.evaluate.
 */
function highlightMarksInPage(marks, rootSelector) {
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

  const root =
    (rootSelector && document.querySelector(rootSelector)) ||
    document.getElementById('fingerprint-data') ||
    document.body;
  if (!root) return 0;

  let painted = 0;
  const all = Array.from(root.querySelectorAll('*'));

  for (const mark of marks || []) {
    if (mark.selector) {
      root.querySelectorAll(mark.selector).forEach((el) => {
        paint(el, mark.pass);
        painted++;
      });
      continue;
    }
    if (!mark.needle) continue;

    let best = null;
    let bestLen = Infinity;
    const needle = String(mark.needle).replace(/\s+/g, ' ').trim();
    for (const node of all) {
      const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || !t.includes(needle)) continue;
      if (t.length < bestLen && t.length < 200) {
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

function summarizeLines(lines) {
  const judged = lines.filter((l) => l.pass === true || l.pass === false);
  const allPass = judged.length > 0 && judged.every((l) => l.pass === true);
  const anyFail = judged.some((l) => l.pass === false);
  return {
    lines,
    state: anyFail ? 'fail' : allPass ? 'pass' : judged.length ? 'pass' : 'skipped',
    pass: anyFail ? false : allPass ? true : null,
    value: lines.map((l) => `${l.label}\n${l.value}`).join('\n'),
  };
}

/**
 * @param {string} label
 * @param {any} actual
 * @param {string|null} expected
 * @param {string|null} [needle]
 * @param {'str'|'num'} [mode]
 */
function lineResult(label, actual, expected, needle, mode = 'str') {
  let pass = null;
  if (!isDefault(expected) && actual != null && actual !== '') {
    pass = mode === 'num' ? eqNum(actual, expected) : eqStr(actual, expected);
  }
  return {
    label,
    value: actual == null || actual === '' ? '' : String(actual),
    expected: isDefault(expected) ? 'default' : expected,
    pass,
    needle: needle || (actual != null && actual !== '' ? String(actual) : null),
  };
}

/**
 * Chay 1 check: scrape -> lines -> highlight -> log.
 * @param {import('playwright-core').Page} page
 * @param {{ step:Function }} ctx
 * @param {string} title
 * @param {Array} lines
 * @param {boolean} [missing]
 */
async function finishCheck(page, ctx, title, lines, missing = false) {
  const { step } = ctx;
  if (missing) {
    step(`CreepJS ${title}: khong doc duoc`, 'err');
    const result = summarizeLines(lines);
    result.state = 'fail';
    result.pass = false;
    return result;
  }
  const result = summarizeLines(lines);
  const marks = lines
    .filter((l) => l.needle)
    .map((l) => ({ needle: l.needle, selector: l.selector || null, pass: l.pass }));
  const painted = await page.evaluate(highlightMarksInPage, marks);
  step(
    `CreepJS ${title}: ${result.state} (hl ${painted}, lech ${lines.filter((l) => l.pass === false).length})`,
    result.pass === false ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  CREEPJS_URL,
  LOAD_TIMEOUT_MS,
  creepjsReadyPredicate,
  waitCreepjsReady,
  isCreepjsReady,
  waitForPageFunction,
  sleep,
  cfgStr,
  isDefault,
  eqStr,
  eqNum,
  highlightMarksInPage,
  summarizeLines,
  lineResult,
  finishCheck,
};
