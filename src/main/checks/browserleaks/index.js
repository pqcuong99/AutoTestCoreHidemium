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
const { resolve: resolvePlatform } = require('../../../shared/platformPolicy');
const {
  summarizeFieldResults,
} = require('../../../shared/siteHighlight');

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
  fieldPresentInConfig,
  scrapeWebGpuBundle,
  findWebgpuLimitConfigKey,
  WEBGPU_PAGE_LIMITS,
  WEBGPU_PAGE_INFO,
  SKIP_CHECKS,
} = loadRecipes();

function refreshRecipes() {
  ({
    PAGES,
    RECIPES,
    fieldsForCheck,
    fieldPresentInConfig,
    scrapeWebGpuBundle,
    findWebgpuLimitConfigKey,
    WEBGPU_PAGE_LIMITS,
    WEBGPU_PAGE_INFO,
    SKIP_CHECKS,
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
    // Config that nhung web khong show — highlight missingOnWeb (khong im lang SKIP)
    return {
      pass: false,
      skipped: true,
      missingOnWeb: true,
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

  // Danh sach feature: expected CSV — moi ten phai True tren web (actual CSV hoac "name: True").
  if (match === 'featureSet') {
    const need = String(expected)
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const got = new Set();
    for (const line of String(actual).split(/[\n,;]+/)) {
      const raw = line.trim();
      if (!raw) continue;
      if (/:\s*(false|0|no|✘|✗)\s*$/i.test(raw)) continue;
      const name = (raw.split(':')[0] || '').trim().toLowerCase();
      if (!name) continue;
      // "name: True" / "name: ✔" / chi "name" (CSV dang bat)
      if (/:\s*(true|✔|yes|1)\s*$/i.test(raw) || !raw.includes(':')) {
        got.add(name);
      }
    }
    const missing = need.filter((f) => !got.has(f));
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
 * @param {import('playwright-core').Page} page
 * @param {string[]} checkKeys
 * @param {Record<string,string>} configMap
 * @param {(msg:string, kind?:string)=>void} step
 * @param {object} [platform]
 */
async function scrapePage(page, checkKeys, configMap, step, platform) {
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

    let fields = fieldsForCheck(checkKey, configMap, platform);

    // WebGPU: dung bundle lam nguon chinh — dam bao moi limit/info/feature deu thanh field
    if (checkKey === 'webgpu' && webgpuBundle) {
      fields = fieldsFromWebGpuBundle(webgpuBundle, configMap);
      const skipKeys = platform?.skipConfigKeys;
      if (skipKeys) {
        fields = fields.filter((f) => !f.configKey || !skipKeys.has(f.configKey));
      }
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
      const hasConfigKey = fieldPresentInConfig(field, configMap);
      const expected = exp ? exp.value : '';
      // Co key nhung value rong / default → khong so sanh (khong danh vang).
      const placeholder = !exp || isPlaceholderExpected(expected);

      // Key khong co trong config → khong lay / khong hien tu web.
      if (!hasConfigKey) {
        continue;
      }

      let actual = '';
      if (checkKey === 'webgpu' && webgpuBundle) {
        actual = actualFromWebGpuBundle(webgpuBundle, field, expected);
      } else {
        actual = await textBySelector(page, field);
        // Fallback DOM scrape features → CSV theo config
        if (
          field.match === 'featureSet' ||
          field.label === 'features' ||
          /features$/i.test(field.configKey || '')
        ) {
          actual = featuresCsvFromWeb(actual, expected);
        }
      }

      // Config = default/placeholder: khong so sanh, khong danh vang (infoOnly).
      if (placeholder) {
        out[checkKey].push({
          label: field.label,
          configKey: exp?.key || field.configKey,
          expected: '',
          actual,
          pass: true,
          skipped: true,
          infoOnly: true,
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

      // Brands / Font: chi hien thi tren BL (hash / brandlist), khong fail mismatch vs config list.
      if (checkKey === 'brands' || checkKey === 'font') {
        out[checkKey].push({
          label: field.label,
          configKey: exp?.key || field.configKey,
          expected,
          actual,
          pass: true,
          skipped: true,
          infoOnly: true,
          detail: actual
            ? `${field.label}: ${actual} (display only)`
            : `${field.label}: empty on page`,
        });
        step(
          `BrowserLeaks [${checkKey}/${field.label}]: SHOW — ${actual || '(empty)'} (no compare)`,
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
        missingOnWeb: !!cmp.missingOnWeb,
        detail: cmp.detail,
        match: field.match,
      });

      const tag = cmp.missingOnWeb
        ? 'MISSING_WEB'
        : cmp.skipped
          ? 'SKIP'
          : cmp.pass
            ? 'PASS'
            : 'FAIL';
      step(
        `BrowserLeaks [${checkKey}/${field.label}]: ${tag} — ${cmp.detail}`,
        cmp.pass || (cmp.skipped && !cmp.missingOnWeb) ? 'ok' : 'warn'
      );
    }
  }

  return out;
}

/**
 * WebGPU features → CSV giong config: chi feature nam trong expected va True tren web.
 * @param {Record<string,string>|string} featSource — map name→True/False hoac text "name: True\\n..."
 * @param {string} expectedCsv — hidemium.webgpu.features
 */
function featuresCsvFromWeb(featSource, expectedCsv) {
  const want = String(expectedCsv || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!want.length) return '';

  /** @type {Map<string, boolean>} */
  const onByLower = new Map();
  if (featSource && typeof featSource === 'object' && !Array.isArray(featSource)) {
    for (const [name, val] of Object.entries(featSource)) {
      onByLower.set(String(name).toLowerCase(), /true|✔|yes|1/i.test(String(val)));
    }
  } else {
    for (const line of String(featSource || '').split(/\r?\n/)) {
      const rawLine = line.trim();
      if (!rawLine) continue;
      // "name: True" / "name: False" — 1 feature/dong; CSV thuan tach theo dau phay
      const chunks = /:\s*(true|false|✔|✘|✗|yes|no|0|1)\s*$/i.test(rawLine)
        ? [rawLine]
        : rawLine.split(/[,;]+/);
      for (const raw of chunks) {
        const part = raw.trim();
        if (!part) continue;
        const name = (part.split(':')[0] || '').trim();
        if (!name) continue;
        const on = /:\s*(true|✔|yes|1)\s*$/i.test(part)
          ? true
          : /:\s*(false|0|no|✘|✗)\s*$/i.test(part)
            ? false
            : !part.includes(':');
        onByLower.set(name.toLowerCase(), on);
      }
    }
  }

  // Giu thu tu + casing nhu config; chi nhung feature True tren web
  return want.filter((name) => onByLower.get(name.toLowerCase()) === true).join(',');
}

/**
 * Map field webgpu -> gia tri tu bundle (info / limits / features).
 * @param {string} [expected] — dung khi field features (CSV config)
 */
function actualFromWebGpuBundle(bundle, field, expected = '') {
  const label = field.label || '';
  const key = field.configKey || '';

  if (label === 'features' || /features$/i.test(key)) {
    return featuresCsvFromWeb(bundle.features || {}, expected);
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
 * Tao field list tu bundle, CHI cac key co trong config (khong discover key thua tren web).
 * Limits co trong config → doi chieu; thieu config → bo qua.
 */
function fieldsFromWebGpuBundle(bundle, configMap) {
  const fields = [];
  const seen = new Set();
  const map = configMap || {};

  const hasKey = (k) => !!(k && Object.prototype.hasOwnProperty.call(map, k));

  const pushInfo = (title) => {
    if (!title || seen.has(title)) return;
    const configKey =
      title === 'vendor'
        ? 'hidemium.webgpu.vendor'
        : title === 'architecture'
          ? 'hidemium.webgpu.architecture'
          : findWebgpuLimitConfigKey(map, title);
    if (!hasKey(configKey)) return;
    fields.push({
      label: title,
      configKey,
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  };

  pushInfo('vendor');
  pushInfo('architecture');
  for (const title of WEBGPU_PAGE_INFO) {
    pushInfo(title);
  }
  for (const title of Object.keys(bundle.info || {})) {
    pushInfo(title);
  }

  if (hasKey('hidemium.webgpu.features')) {
    fields.push({
      label: 'features',
      configKey: 'hidemium.webgpu.features',
      match: 'featureSet',
      fromWeb: true,
    });
    seen.add('features');
  }

  for (const title of WEBGPU_PAGE_LIMITS) {
    if (seen.has(title)) continue;
    const configKey = findWebgpuLimitConfigKey(map, title);
    if (!hasKey(configKey)) continue;
    fields.push({
      label: title,
      configKey,
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  }
  for (const title of Object.keys(bundle.limits || {})) {
    if (seen.has(title)) continue;
    const configKey = findWebgpuLimitConfigKey(map, title);
    if (!hasKey(configKey)) continue;
    fields.push({
      label: title,
      configKey,
      match: 'includes',
      fromWeb: true,
    });
    seen.add(title);
  }

  // Config param.* con thua — van so sanh (ke ca khi DOM thieu)
  const prefix = 'hidemium.webgpu.param.';
  for (const key of Object.keys(map).sort()) {
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
 * Gom ket qua field -> 1 o site tren Detail Log (qua shared siteHighlight).
 */
function summarize(fieldResults, checkKey) {
  // features da format CSV giong config — khong can discover tung dong True/False
  const discover = checkKey === 'webgl_param';
  return summarizeFieldResults(fieldResults, { discoverMode: discover });
}

/** @deprecated — dung SiteHighlight.formatFieldLines; giu export neu can. */
function displayLinesForField(f, { discoverMode }) {
  const { formatFieldLines } = require('../../../shared/siteHighlight');
  return formatFieldLines(f, { discoverMode }).map((l) => l.text);
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
 *   platform?: object,
 *   targetOs?: string,
 * }} ctx
 */
async function run(checkKeys, ctx) {
  refreshRecipes();
  const { openData, configMap, signal, step } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  const platform = ctx.platform || resolvePlatform(ctx.targetOs || 'windows');
  // Gop SKIP_CHECKS (recipe site) + policy OS.
  const skipChecks = new Set([
    ...(SKIP_CHECKS || []),
    ...(platform.skipChecks || []),
  ]);

  const policyTag = platform.browser
    ? `${platform.id}/${platform.browser}`
    : platform.id;
  step(
    `BrowserLeaks: targetOs=${policyTag} (policy ${platform.supported ? 'ok' : 'unsupported'})`,
    'ok'
  );

  const results = {};
  for (const key of checkKeys) {
    results[key] = { state: 'skipped', value: '-', pass: false };
  }

  // checkKey bi policy skip (font / mac_address / desktop_name tren Windows)
  for (const key of checkKeys) {
    if (skipChecks.has(key)) {
      results[key] = {
        state: 'skipped',
        value: `skipped (${policyTag} policy)`,
        pass: false,
      };
    }
  }

  const known = checkKeys.filter((k) => RECIPES[k] && !skipChecks.has(k));
  const unknown = checkKeys.filter((k) => !RECIPES[k] && !skipChecks.has(k));
  for (const k of unknown) {
    results[k] = { state: 'skipped', value: 'not supported on browserleaks', pass: false };
  }
  if (!known.length) {
    step('BrowserLeaks: khong co checkKey nao co recipe (sau policy)', 'warn');
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
      const scraped = await scrapePage(session.page, keys, configMap, step, platform);
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
