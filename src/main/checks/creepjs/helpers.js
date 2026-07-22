/**
 * Helper chung cho cac check CreepJS.
 * Highlight Detail Log dung chung SiteHighlight (giong BrowserLeaks).
 */
const { CREEPJS_URLS } = require('./urls');
const { summarizeFieldResults } = require('../../../shared/siteHighlight');

const CREEPJS_URL = CREEPJS_URLS.main;
const LOAD_TIMEOUT_MS = 90000;

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

async function isCreepjsReady(page) {
  try {
    return await page.evaluate(creepjsReadyPredicate);
  } catch {
    return false;
  }
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

/**
 * Chuyen line CreepJS -> field SiteHighlight (giong BrowserLeaks).
 * Chap nhan ca format cu { value, pass } va format moi { actual, infoOnly, ... }.
 */
function toFieldResult(line) {
  if (!line) return { label: '', actual: '', expected: '', pass: true, skipped: true };

  // Da dung contract SiteHighlight
  if (
    Object.prototype.hasOwnProperty.call(line, 'actual') &&
    (line.infoOnly ||
      line.noConfig ||
      line.missingOnWeb ||
      typeof line.pass === 'boolean' ||
      line.skipped)
  ) {
    return line;
  }

  const label = line.label || '';
  const actual =
    line.actual != null
      ? String(line.actual)
      : line.value == null || line.value === ''
        ? ''
        : String(line.value);
  const rawExp = line.expected;
  const defaultExp = isDefault(rawExp) || rawExp === 'default';
  const needle = line.needle || (actual || null);
  const selector = line.selector || null;
  const base = { label, actual, needle, selector };

  // pass: null + expected default / web-only → info
  if (line.infoOnly || (line.pass == null && defaultExp)) {
    return { ...base, expected: '', pass: true, skipped: true, infoOnly: true };
  }

  if (defaultExp) {
    return { ...base, expected: '', pass: true, skipped: true, infoOnly: true };
  }

  const expected = rawExp == null ? '' : String(rawExp);

  // CreepJS: thieu / undefined tren web → missingOnWeb (tim), khong do mismatch.
  if (!actual || /^undefined$/i.test(actual)) {
    return {
      label,
      actual: 'undefined',
      needle: needle || 'undefined',
      selector,
      expected,
      pass: false,
      skipped: true,
      missingOnWeb: true,
    };
  }

  if (line.pass === true || line.pass === false) {
    return { ...base, expected, pass: line.pass };
  }

  return { ...base, expected, pass: true };
}

/**
 * Gom field -> o Detail Log (cung SiteHighlight nhu BrowserLeaks).
 * @returns {{ state:string, value:string, pass:boolean, lines:Array }}
 */
function summarizeLines(lines, opts) {
  const fields = (lines || []).map(toFieldResult);
  return summarizeFieldResults(fields, opts || {});
}

/**
 * @param {string} label
 * @param {any} actual
 * @param {string|null} expected
 * @param {string|null} [needle]
 * @param {'str'|'num'} [mode]
 */
function lineResult(label, actual, expected, needle, mode = 'str') {
  const rawActual =
    actual == null || actual === '' || (typeof actual === 'number' && Number.isNaN(actual))
      ? ''
      : String(actual);
  const defaultExp = isDefault(expected);
  const base = {
    label,
    actual: rawActual,
    needle: needle || (rawActual || null),
  };

  if (defaultExp) {
    return {
      ...base,
      actual: rawActual || 'undefined',
      needle: needle || (rawActual || 'undefined'),
      expected: '',
      pass: true,
      skipped: true,
      infoOnly: true,
    };
  }

  const exp = String(expected);
  // Thieu / undefined tren web → missingOnWeb (khong do mismatch).
  if (!rawActual || /^undefined$/i.test(rawActual)) {
    return {
      label,
      actual: 'undefined',
      needle: needle || 'undefined',
      expected: exp,
      pass: false,
      skipped: true,
      missingOnWeb: true,
    };
  }

  const ok = mode === 'num' ? eqNum(actual, expected) : eqStr(rawActual, expected);
  return { ...base, expected: exp, pass: !!ok };
}

/** Chi hien thi tu web — khong so config (hash, canvas, …). */
function infoLine(label, actual, needle) {
  const actualStr = actual == null || actual === '' ? '' : String(actual);
  return {
    label,
    actual: actualStr,
    expected: '',
    pass: true,
    skipped: true,
    infoOnly: true,
    needle: needle || (actualStr || null),
  };
}

function paintPassForMark(f) {
  if (!f) return null;
  if (f.infoOnly || f.noConfig) return null;
  if (f.missingOnWeb) return false;
  return f.pass;
}

/**
 * Chay 1 check: scrape -> lines -> highlight page -> SiteHighlight Detail Log.
 * @param {import('playwright-core').Page} page
 * @param {{ step:Function }} ctx
 * @param {string} title
 * @param {Array} lines
 * @param {boolean} [missing]
 */
async function finishCheck(page, ctx, title, lines, missing = false) {
  const { step } = ctx;
  const fields = (lines || []).map(toFieldResult);
  const marks = fields
    .filter((l) => l.needle || l.selector)
    .map((l) => ({
      needle: l.needle,
      selector: l.selector || null,
      pass: paintPassForMark(l),
    }));

  let result = summarizeFieldResults(fields);
  if (missing) {
    step(`CreepJS ${title}: khong doc duoc`, 'err');
    result = { ...result, state: 'fail', pass: false };
  }

  const painted = await page.evaluate(highlightMarksInPage, marks);
  const mismatchN = fields.filter((l) => l.pass === false && !l.missingOnWeb).length;
  const missingN = fields.filter((l) => l.missingOnWeb).length;
  step(
    `CreepJS ${title}: ${result.state} (hl ${painted}, lech ${mismatchN}, missingWeb ${missingN})`,
    result.pass === false || missing ? 'err' : 'ok'
  );
  return result;
}

module.exports = {
  CREEPJS_URL,
  LOAD_TIMEOUT_MS,
  creepjsReadyPredicate,
  isCreepjsReady,
  cfgStr,
  isDefault,
  eqStr,
  eqNum,
  highlightMarksInPage,
  toFieldResult,
  summarizeLines,
  lineResult,
  infoLine,
  finishCheck,
};
