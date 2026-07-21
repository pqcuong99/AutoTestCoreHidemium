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

async function run(checkKeys, ctx) {
  const { openData, configMap, signal, step, options, emit, uuid } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  const results = {};
  const supported = checkKeys.filter((key) => SUPPORTED.has(key));
  for (const key of checkKeys) {
    if (!SUPPORTED.has(key)) results[key] = { state: 'skipped', value: '-' };
  }
  if (!supported.length) return results;

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

  let session;
  try {
    step('BrowserScan: ket noi CDP + tim tab...');
    session = await openBrowserScanMainPage(openData);
    const { page } = session;

    if (signal?.aborted) throw new Error('aborted');
    let onBrowserScan = false;
    try {
      const current = new URL(page.url());
      onBrowserScan =
        /^(?:www\.)?browserscan\.net$/i.test(current.hostname) &&
        (current.pathname === '/' || current.pathname === '');
    } catch { /* ignore */ }
    if (!onBrowserScan) {
      step(`BrowserScan: goto ${BROWSERSCAN_URL}`);
      await page.goto(BROWSERSCAN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
    } else {
      step('BrowserScan: dung lai tab da mo');
    }

    const navigatorKeys = supported.filter((key) => NAVIGATOR_KEYS.has(key));
    const checked = navigatorKeys.length
      ? await runNavigatorChecks(page, navigatorKeys, configMap, ctx)
      : {};
    if (supported.includes('screen')) {
      checked.screen = await checkScreen(page, configMap, ctx);
    }
    if (supported.includes('font')) {
      checked.font = await checkFont(page, configMap, ctx);
    }
    if (supported.includes('webgl')) {
      checked.webgl = await checkWebgl(page, configMap, ctx);
    }
    const userAgentDataKeys = supported.filter((key) =>
      USER_AGENT_DATA_KEYS.has(key)
    );
    if (userAgentDataKeys.length) {
      Object.assign(
        checked,
        await runUserAgentDataChecks(page, userAgentDataKeys, configMap, ctx)
      );
    }
    const clientHintsKeys = supported.filter((key) =>
      CLIENT_HINTS_KEYS.has(key)
    );
    if (clientHintsKeys.length) {
      Object.assign(
        checked,
        await runClientHintsChecks(page, clientHintsKeys, configMap, ctx)
      );
    }
    for (const key of supported) {
      results[key] =
        checked[key] || { state: 'fail', value: 'Khong doc duoc', pass: false, lines: [] };
      emitResult(key, results[key]);
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
