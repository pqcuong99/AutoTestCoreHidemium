/**
 * BrowserScan runner — reuse 1 tab, check cac muc da ho tro.
 */
const { WEBSITES } = require('../../../shared/websites');
const { connectBrowser, release } = require('../../browserCdp');
const { BROWSERSCAN_URL } = require('./urls');
const { runNavigatorChecks } = require('./navigator');
const { checkScreen } = require('./screen');
const { runUserAgentDataChecks } = require('./userAgentData');
const { runClientHintsChecks } = require('./clientHints');
const { checkFont } = require('./font');
const { checkWebgl } = require('./webgl');
const { checkWebgpu } = require('./webgpu');

const SITE = WEBSITES.find((website) => website.key === 'browserscan');
const SUPPORTED = new Set([
  'screen',
  'platform_navigator',
  'hardware',
  'device_memory',
  'max_touch_points',
  'brands',
  'platform_ua',
  'platform_version',
  'ua_full_version',
  'model',
  'full_version_list',
  'form_factors',
  'font',
  'webgl',
  'webgpu',
]);
const NAVIGATOR_KEYS = new Set([
  'platform_navigator',
  'hardware',
  'device_memory',
  'max_touch_points',
]);
const USER_AGENT_DATA_KEYS = new Set([
  'brands',
  'platform_ua',
  'platform_version',
  'ua_full_version',
]);
const CLIENT_HINTS_KEYS = new Set([
  'model',
  'full_version_list',
  'form_factors',
]);
const MAIN_PAGE_KEYS = new Set([
  ...NAVIGATOR_KEYS,
  ...USER_AGENT_DATA_KEYS,
  'screen',
  'font',
  'webgl',
]);

async function openBrowserScanMainPage(openData) {
  const browser = await connectBrowser(openData);
  const context = browser.contexts()[0] || await browser.newContext();
  const matches = context.pages().filter((candidate) => {
    if (candidate.isClosed()) return false;
    try {
      const url = new URL(candidate.url());
      return (
        /^(?:www\.)?browserscan\.net$/i.test(url.hostname) &&
        (url.pathname === '/' || url.pathname === '')
      );
    } catch {
      return false;
    }
  });
  const page = matches[matches.length - 1] || await context.newPage();
  for (const extra of matches.slice(0, -1)) {
    await extra.close({ runBeforeUnload: false }).catch(() => {});
  }
  await page.bringToFront().catch(() => {});
  return { browser, page };
}

function policyConfigMap(configMap, skipConfigKeys) {
  if (!skipConfigKeys?.size) return configMap || {};
  const next = { ...(configMap || {}) };
  for (const key of skipConfigKeys) delete next[key];
  return next;
}

async function run(checkKeys, ctx) {
  const { openData, configMap, signal, step, options, emit, uuid, platform } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  const skipChecks = platform?.skipChecks || new Set();
  const skipConfigKeys = platform?.skipConfigKeys || new Set();
  const policyTag = platform?.browser
    ? `${platform.id}/${platform.browser}`
    : platform?.id || 'policy';
  const compareMap = policyConfigMap(configMap, skipConfigKeys);

  const results = {};
  const supported = checkKeys.filter(
    (key) => SUPPORTED.has(key) && !skipChecks.has(key)
  );
  for (const key of checkKeys) {
    if (skipChecks.has(key)) {
      results[key] = {
        state: 'skipped',
        value: `skipped (${policyTag} policy)`,
        pass: false,
        lines: [],
      };
    } else if (!SUPPORTED.has(key)) {
      results[key] = { state: 'skipped', value: '-' };
    }
  }
  if (skipChecks.size) {
    const skippedHere = checkKeys.filter((key) => skipChecks.has(key));
    if (skippedHere.length) {
      step(
        `BrowserScan: skipChecks (${policyTag}): ${skippedHere.join(', ')}`,
        'ok'
      );
    }
  }
  if (!supported.length) {
    for (const key of checkKeys) {
      if (results[key] && typeof emit === 'function' && uuid) {
        emit({
          type: 'site-result',
          uuid,
          checkKey: key,
          siteKey: 'browserscan',
          value: results[key].value ?? '',
          pass: results[key].pass,
          state: results[key].state || 'skipped',
          lines: results[key].lines || null,
        });
      }
    }
    return results;
  }

  const emitResult = (checkKey, result) => {
    if (typeof emit !== 'function' || !uuid) return;
    emit({
      type: 'site-result',
      uuid,
      checkKey,
      siteKey: 'browserscan',
      value: result?.value ?? '',
      pass: result?.pass,
      state: result?.state || 'fail',
      lines: result?.lines || null,
    });
  };
  const saveResult = (checkKey, result) => {
    results[checkKey] =
      result || { state: 'fail', value: 'Khong doc duoc', pass: false, lines: [] };
    emitResult(checkKey, results[checkKey]);
  };
  const saveBundle = (bundle, keys) => {
    for (const key of keys) saveResult(key, bundle?.[key]);
  };

  // Emit policy skips ngay, truoc khi chay cac muc con lai.
  for (const key of checkKeys) {
    if (skipChecks.has(key)) emitResult(key, results[key]);
  }

  let session;
  try {
    step('BrowserScan: ket noi CDP + tim tab...');
    session = await openBrowserScanMainPage(openData);
    const { page } = session;

    if (signal?.aborted) throw new Error('aborted');
    const needsMainPage = supported.some((key) => MAIN_PAGE_KEYS.has(key));
    let onBrowserScan = false;
    try {
      const current = new URL(page.url());
      onBrowserScan =
        /^(?:www\.)?browserscan\.net$/i.test(current.hostname) &&
        (current.pathname === '/' || current.pathname === '');
    } catch { /* ignore */ }
    if (needsMainPage && !onBrowserScan) {
      step(`BrowserScan: goto ${BROWSERSCAN_URL}`);
      await page.goto(BROWSERSCAN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
    } else if (needsMainPage) {
      step('BrowserScan: dung lai tab da mo');
    }

    const navigatorKeys = supported.filter((key) => NAVIGATOR_KEYS.has(key));
    if (navigatorKeys.length) {
      const checked = await runNavigatorChecks(page, navigatorKeys, compareMap, ctx);
      saveBundle(checked, navigatorKeys);
    }
    if (supported.includes('screen')) {
      saveResult('screen', await checkScreen(page, compareMap, ctx));
    }
    if (supported.includes('font')) {
      saveResult('font', await checkFont(page, compareMap, ctx));
    }
    if (supported.includes('webgl')) {
      saveResult('webgl', await checkWebgl(page, compareMap, ctx));
    }
    const userAgentDataKeys = supported.filter((key) =>
      USER_AGENT_DATA_KEYS.has(key)
    );
    if (userAgentDataKeys.length) {
      saveBundle(
        await runUserAgentDataChecks(page, userAgentDataKeys, compareMap, ctx),
        userAgentDataKeys
      );
    }
    const clientHintsKeys = supported.filter((key) =>
      CLIENT_HINTS_KEYS.has(key)
    );
    if (clientHintsKeys.length) {
      saveBundle(
        await runClientHintsChecks(page, clientHintsKeys, compareMap, ctx),
        clientHintsKeys
      );
    }
    if (supported.includes('webgpu')) {
      saveResult('webgpu', await checkWebgpu(page, compareMap, ctx));
    }

    await release(session, { keepPage: !(options && options.autoClose) });
    session = null;
  } catch (error) {
    if (error.message === 'aborted') throw error;
    step(`BrowserScan loi: ${error.message}`, 'err');
    for (const key of supported) {
      if (!results[key]) {
        results[key] = {
          state: 'fail',
          value: error.message,
          pass: false,
          lines: [],
        };
        emitResult(key, results[key]);
      }
    }
  } finally {
    if (session) await release(session, { keepPage: false });
  }

  return results;
}

module.exports = {
  key: 'browserscan',
  label: SITE.label,
  url: SITE.url,
  run,
};
