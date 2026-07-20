/**
 * CHECK LOGIC CHO TRANG BROWSERLEAKS.
 *
 * Cong thuc XPath nam o recipes.js (theo mo ta user).
 * CDP attach profile Hidemium qua playwright-core (cdp.js).
 *
 * Luong:
 *   1. Gom checkKeys theo page (javascript / webgl)
 *   2. Mo tung page 1 lan, scrape tat ca field cua cac checkKey tren page do
 *   3. So sanh actual vs configMap[configKey]
 *   4. Tra map checkKey -> { state, value, pass }
 */
const { WEBSITES } = require('../../../shared/websites');
const { maybeBase64 } = require('../../configMapper');
const { openPage, textBySelector } = require('./cdp');

const SITE = WEBSITES.find((w) => w.key === 'browserleaks');
const isDev = process.argv.includes('--dev');

/** Reload recipes khi --dev de khong can restart Electron moi lan sua scrape. */
function loadRecipes() {
  if (isDev) {
    try {
      delete require.cache[require.resolve('./recipes')];
    } catch {
      /* ignore */
    }
  }
  return require('./recipes');
}

let {
  PAGES,
  RECIPES,
  fieldsForCheck,
  scrapeWebGpuBundle,
  findWebgpuLimitConfigKey,
  WEBGPU_PAGE_LIMITS,
  WEBGPU_PAGE_INFO,
} = loadRecipes();

function refreshRecipes() {
  ({
    PAGES,
    RECIPES,
    fieldsForCheck,
    scrapeWebGpuBundle,
    findWebgpuLimitConfigKey,
    WEBGPU_PAGE_LIMITS,
    WEBGPU_PAGE_INFO,
  } = loadRecipes());
}

/** Gia tri config khong so sanh duoc voi DOM (placeholder Hidemium). */
const PLACEHOLDER_EXPECTED = new Set(['', 'default', 'null', 'undefined', 'none', 'n/a']);

/** webgl.mode = noise/off/... la che do spoof, khong phai ten context tren #gl-context. */
const WEBGL_MODE_SKIP = new Set(['noise', 'off', 'block', 'real', 'default', 'natural']);

function normalize(v) {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeBool(v) {
  const s = normalize(v);
  if (['1', 'true', 'yes', 'on'].includes(s)) return 'true';
  if (['0', 'false', 'no', 'off'].includes(s)) return 'false';
  return s;
}

function isPlaceholderExpected(v) {
  return PLACEHOLDER_EXPECTED.has(normalize(v));
}

/**
 * Lay gia tri expected tu configMap (co altConfigKeys + base64 decode).
 */
function expectedValue(field, configMap) {
  const keys = [field.configKey, ...(field.altConfigKeys || [])].filter(Boolean);
  for (const k of keys) {
    if (k in configMap && configMap[k] !== undefined && configMap[k] !== '') {
      let v = configMap[k];
      if (field.base64) v = maybeBase64(v);
      return { key: k, value: String(v) };
    }
  }
  return null;
}

/**
 * So sanh 1 field.
 * @returns {{ pass:boolean, skipped?:boolean, detail:string }}
 */
function compareOne(field, expected, actual) {
  if (field.skip) {
    return { pass: true, skipped: true, detail: `${field.label}: skipped` };
  }

  if (expected == null || isPlaceholderExpected(expected)) {
    return { pass: true, skipped: true, detail: `${field.label}: skipped (default/no config)` };
  }

  // webgl.mode: noise/off khong so voi "webgl2, webgl"
  if (
    field.configKey === 'hidemium.webgl.mode' ||
    normalize(field.label) === 'mode'
  ) {
    if (WEBGL_MODE_SKIP.has(normalize(expected))) {
      return { pass: true, skipped: true, detail: `${field.label}: skipped (mode=${expected})` };
    }
  }

  if (actual == null || actual === '') {
    // Config co nhung web khong show / khong scrape duoc -> bo qua, khong FAIL
    return {
      pass: true,
      skipped: true,
      detail: `${field.label}: skipped (not on page)`,
    };
  }

  const match = field.match || 'exact';
  const a = normalize(actual);
  const e = normalize(expected);

  if (match === 'bool') {
    const ok = normalizeBool(actual) === normalizeBool(expected);
    return { pass: ok, detail: ok ? 'ok' : `${field.label}: ${actual} != ${expected}` };
  }

  if (match === 'includes') {
    const ok = a.includes(e) || e.includes(a);
    return { pass: ok, detail: ok ? 'ok' : `${field.label}: "${actual}" vs "${expected}"` };
  }

  if (match === 'formFactors') {
    const want = normalizeBool(expected) === 'true';
    const key = normalize(field.configKey || field.label || '');
    const needle = key.includes('tablet') ? 'tablet' : 'mobile';
    const ok = want ? a.includes(needle) : !a.includes(needle);
    return {
      pass: ok,
      detail: ok ? 'ok' : `${field.label}: expect ${want ? '' : 'no '}${needle} in ${actual}`,
    };
  }

  // Danh sach feature: expected CSV phai co mat va True tren page
  if (match === 'featureSet') {
    const need = String(expected)
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const missing = need.filter((f) => {
      const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return !new RegExp(`${esc}[^\\n]*?(?:✔|true)`, 'i').test(actual);
    });
    const ok = missing.length === 0;
    return {
      pass: ok,
      detail: ok ? 'ok' : `${field.label}: missing ${missing.join(', ')}`,
    };
  }

  const ok = a === e;
  return { pass: ok, detail: ok ? 'ok' : `${field.label}: ${actual} != ${expected}` };
}

/**
 * Scrape tat ca field cua cac checkKey tren 1 page Playwright.
 */
async function scrapePage(page, checkKeys, configMap, step) {
  /** @type {Record<string, Array>} */
  const out = {};

  // WebGPU: scrape 1 lan ca info/limits/features (tranh CSS dinh placeholder noscript)
  let webgpuBundle = null;
  if (checkKeys.includes('webgpu')) {
    try {
      webgpuBundle = await scrapeWebGpuBundle(page);
      const nLim = Object.keys(webgpuBundle.limits || {}).length;
      const nFeat = Object.keys(webgpuBundle.features || {}).length;
      const nInfo = Object.keys(webgpuBundle.info || {}).length;
      const sample =
        webgpuBundle.limits?.maxTextureDimension1D ||
        webgpuBundle.limits?.maxBindGroups ||
        Object.values(webgpuBundle.limits || {})[0] ||
        '';
      step(
        `BrowserLeaks [webgpu]: bundle info=${nInfo} limits=${nLim} features=${nFeat}` +
          (sample ? ` sample=${sample}` : ' (limits rong!)'),
        nLim > 0 ? 'ok' : 'warn'
      );
    } catch (err) {
      step(`BrowserLeaks [webgpu]: bundle fail — ${err.message}`, 'warn');
      webgpuBundle = null;
    }
  }

  for (const checkKey of checkKeys) {
    if (!RECIPES[checkKey]) continue;
    out[checkKey] = [];

    let fields = fieldsForCheck(checkKey, configMap);

    // WebGPU: dung bundle lam nguon chinh — dam bao moi limit/info/feature deu thanh field
    if (checkKey === 'webgpu' && webgpuBundle) {
      fields = fieldsFromWebGpuBundle(webgpuBundle, configMap);
    }

    if (!fields.length) {
      step(`BrowserLeaks [${checkKey}]: khong co field`, 'warn');
      continue;
    }

    for (const field of fields) {
      if (field.skip) {
        out[checkKey].push({
          label: field.label,
          configKey: field.configKey,
          expected: '',
          actual: '',
          pass: true,
          skipped: true,
          detail: `${field.label}: skipped`,
        });
        step(`BrowserLeaks [${checkKey}/${field.label}]: SKIP — not on browserleaks`, 'warn');
        continue;
      }

      const exp = expectedValue(field, configMap);
      const hasConfigKey =
        field.configKey &&
        Object.prototype.hasOwnProperty.call(configMap || {}, field.configKey);
      const expected = exp ? exp.value : '';
      const placeholder = isPlaceholderExpected(expected);
      const noRealConfig = !hasConfigKey || placeholder;
      const discover = checkKey === 'webgl_param' || checkKey === 'webgpu';

      let actual = '';
      if (checkKey === 'webgpu' && webgpuBundle) {
        actual = actualFromWebGpuBundle(webgpuBundle, field);
      } else {
        actual = await textBySelector(page, field);
      }

      // webgl_param / webgpu: hien moi key tren web; thieu config -> ⚠ de bo sung
      if (discover && noRealConfig) {
        out[checkKey].push({
          label: field.label,
          configKey: field.configKey,
          expected: '',
          actual,
          pass: true,
          skipped: true,
          noConfig: true,
          detail: actual
            ? `${field.label}: ${actual} (no config — can add)`
            : `${field.label}: empty on page`,
        });
        if (actual) {
          step(`BrowserLeaks [${checkKey}/${field.label}]: NO_CONFIG — ${actual}`, 'warn');
        }
        continue;
      }

      if (placeholder) {
        out[checkKey].push({
          label: field.label,
          configKey: exp?.key || field.configKey,
          expected: '',
          actual,
          pass: true,
          skipped: true,
          detail: actual
            ? `${field.label}: ${actual} (config=default, chi hien thi)`
            : `${field.label}: skipped (default, empty on page)`,
        });
        step(
          `BrowserLeaks [${checkKey}/${field.label}]: SHOW — ${actual || '(empty)'} (config=default)`,
          'ok'
        );
        continue;
      }

      const cmp = compareOne(field, expected, actual);

      out[checkKey].push({
        label: field.label,
        configKey: exp?.key || field.configKey,
        expected,
        actual,
        pass: cmp.pass,
        skipped: !!cmp.skipped,
        detail: cmp.detail,
        match: field.match,
      });

      const tag = cmp.skipped ? 'SKIP' : cmp.pass ? 'PASS' : 'FAIL';
      step(
        `BrowserLeaks [${checkKey}/${field.label}]: ${tag} — ${cmp.detail}`,
        cmp.pass || cmp.skipped ? 'ok' : 'warn'
      );
    }
  }

  return out;
}

/**
 * Map field webgpu -> gia tri tu bundle (info / limits / features).
 */
function actualFromWebGpuBundle(bundle, field) {
  const label = field.label || '';
  const key = field.configKey || '';

  if (label === 'features' || /features$/i.test(key)) {
    return Object.entries(bundle.features || {})
      .map(([name, on]) => `${name}: ${on}`)
      .join('\n');
  }

  if (bundle.info && bundle.info[label] != null && bundle.info[label] !== '') {
    return String(bundle.info[label]);
  }
  if (bundle.limits && bundle.limits[label] != null && bundle.limits[label] !== '') {
    return String(bundle.limits[label]);
  }
  if (bundle.features && bundle.features[label] != null && bundle.features[label] !== '') {
    return String(bundle.features[label]);
  }
  return '';
}

/**
 * Tao field list day du tu bundle (info + features + limits) de UI khong thieu.
 * Limits: luon du 36 Adapter Limits (thu tu trang /webgpu), ke ca khi bundle thieu key.
 */
function fieldsFromWebGpuBundle(bundle, configMap) {
  const fields = [];
  const seen = new Set();

  const pushInfo = (title) => {
    if (!title || seen.has(title)) return;
    const configKey =
      title === 'vendor'
        ? 'hidemium.webgpu.vendor'
        : title === 'architecture'
          ? 'hidemium.webgpu.architecture'
          : findWebgpuLimitConfigKey(configMap, title);
    fields.push({
      label: title,
      configKey,
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  };

  // info: whitelist thu tu page, roi key thua trong bundle
  pushInfo('vendor');
  pushInfo('architecture');
  for (const title of WEBGPU_PAGE_INFO) {
    pushInfo(title);
  }
  for (const title of Object.keys(bundle.info || {})) {
    pushInfo(title);
  }

  fields.push({
    label: 'features',
    configKey: 'hidemium.webgpu.features',
    match: 'featureSet',
    fromWeb: true,
  });
  seen.add('features');

  // Adapter Limits — dung thu tu WEBGPU_PAGE_LIMITS (= nth-child 1..36 tren #gpu-limits)
  for (const title of WEBGPU_PAGE_LIMITS) {
    if (seen.has(title)) continue;
    fields.push({
      label: title,
      configKey: findWebgpuLimitConfigKey(configMap, title),
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  }
  for (const title of Object.keys(bundle.limits || {})) {
    if (seen.has(title)) continue;
    fields.push({
      label: title,
      configKey: findWebgpuLimitConfigKey(configMap, title),
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  }

  // Config param.* chua co tren page bundle — van giu field de hien no config / empty
  const prefix = 'hidemium.webgpu.param.';
  for (const key of Object.keys(configMap || {}).sort()) {
    if (!key.startsWith(prefix)) continue;
    const title = key.slice(prefix.length);
    if (!title || seen.has(title)) continue;
    fields.push({
      label: title,
      configKey: key,
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  }

  return fields;
}

/**
 * Hien thi dong field. discoverMode: giu toan bo key/features tren web.
 */
function displayLinesForField(f, { discoverMode }) {
  const a = String(f.actual || '').trim();
  if (!a) return [];

  const mark = !f.skipped && !f.pass ? ' ✗' : f.noConfig ? ' ⚠ no config' : '';

  const isFeatures =
    f.match === 'featureSet' ||
    /features/i.test(f.label || '') ||
    /features/i.test(f.configKey || '');

  if (a.includes('\n') || isFeatures) {
    const lines = a
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (discoverMode && isFeatures && f.expected) {
      const want = new Set(
        String(f.expected)
          .split(/[,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      );
      return lines.map((l) => {
        const name = (l.split(':')[0] || '').trim().toLowerCase();
        const on = /:\s*true\s*$/i.test(l);
        let suffix = mark;
        if (want.size && on && !want.has(name)) suffix = ' ⚠ no config';
        if (want.size && want.has(name) && !on) suffix = ' ✗';
        return (l.includes(':') ? l : `${f.label}: ${l}`) + suffix;
      });
    }

    return lines.map((l) => (l.includes(':') ? l : `${f.label}: ${l}`) + mark);
  }

  return [`${f.label}: ${a}${mark}`];
}

/**
 * Gom ket qua field -> 1 o site tren Detail Log.
 * webgl_param / webgpu: hien TAT CA key tren web; thieu config => ⚠ no config.
 */
function summarize(fieldResults, checkKey) {
  if (!fieldResults || !fieldResults.length) {
    return { state: 'skipped', value: '-', pass: false };
  }

  const discover = checkKey === 'webgl_param' || checkKey === 'webgpu';
  const scored = fieldResults.filter((f) => !f.skipped && f.expected !== '');
  const shown = fieldResults.filter((f) => String(f.actual || '').trim() !== '');

  if (!shown.length && !scored.length) {
    return { state: 'skipped', value: '-', pass: false };
  }

  const failed = scored.filter((f) => !f.pass);
  const missingConfig = shown.filter((f) => f.noConfig);
  const lines = shown.flatMap((f) => displayLinesForField(f, { discoverMode: discover }));

  if (!scored.length) {
    return {
      state: missingConfig.length ? 'fail' : 'skipped',
      value: lines.join('\n') || '-',
      pass: false,
    };
  }

  return {
    state: failed.length || (discover && missingConfig.length) ? 'fail' : 'pass',
    value: lines.join('\n') || '-',
    pass: failed.length === 0 && !(discover && missingConfig.length),
  };
}

/**
 * @param {string[]} checkKeys
 * @param {{
 *   openData: object,
 *   configMap: Record<string,string>,
 *   signal: AbortSignal,
 *   emit: (e:object)=>void,
 *   uuid: string,
 *   step: (msg:string, kind?:string)=>void,
 * }} ctx
 */
async function run(checkKeys, ctx) {
  refreshRecipes();
  const { openData, configMap, signal, step } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  const results = {};
  for (const key of checkKeys) {
    results[key] = { state: 'skipped', value: '-', pass: false };
  }

  const known = checkKeys.filter((k) => RECIPES[k]);
  const unknown = checkKeys.filter((k) => !RECIPES[k]);
  for (const k of unknown) {
    results[k] = { state: 'skipped', value: 'not supported on browserleaks', pass: false };
  }
  if (!known.length) {
    step('BrowserLeaks: khong co checkKey nao co recipe', 'warn');
    return results;
  }

  /** @type {Record<string, string[]>} */
  const byPage = {};
  for (const key of known) {
    const p = RECIPES[key].page;
    if (!byPage[p]) byPage[p] = [];
    byPage[p].push(key);
  }

  for (const [pageKey, keys] of Object.entries(byPage)) {
    if (signal?.aborted) throw new Error('aborted');
    const url = PAGES[pageKey];
    step(`BrowserLeaks: mo ${url} (${keys.join(', ')})...`);

    let session = null;
    try {
      session = await openPage(openData, url, { signal, step });
      const scraped = await scrapePage(session.page, keys, configMap, step);
      for (const key of keys) {
        results[key] = summarize(scraped[key], key);
      }
    } catch (err) {
      step(`BrowserLeaks: loi page ${pageKey}: ${err.message}`, 'err');
      for (const key of keys) {
        results[key] = { state: 'fail', value: err.message, pass: false };
      }
    } finally {
      if (session) await session.close();
    }
  }

  return results;
}

module.exports = {
  key: 'browserleaks',
  label: SITE.label,
  url: SITE.url,
  run,
  RECIPES,
  PAGES,
  normalize,
  compareOne,
  expectedValue,
  summarize,
  isPlaceholderExpected,
};
