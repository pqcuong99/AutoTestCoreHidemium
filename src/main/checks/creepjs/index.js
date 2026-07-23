/**
 * CHECK LOGIC CHO TRANG CREEPJS.
 *
 * Mo 1 lan CDP + 1 tab CreepJS, chay lan luot cac muc da tick.
 */
const { WEBSITES } = require('../../../shared/websites');
const { openPage, release } = require('../../browserCdp');
const { CREEPJS_URL, isCreepjsReady } = require('./helpers');
const { checkScreen } = require('./screen');
const { checkPlatformNavigator, checkPlatformUa } = require('./platform');
const {
  checkHardware,
  checkDeviceMemory,
  checkMaxTouchPoints,
  checkBrands,
} = require('./navigatorExtras');
const {
  checkPlatformVersion,
  checkUaFullVersion,
  checkModel,
} = require('./userAgentData');
const { checkFullVersionList } = require('./extraUserAgentData');
const { checkBattery, checkNetwork } = require('./systemStatus');
const { checkFont } = require('./font');
const { checkWebgl } = require('./webgl');
const { checkWebglParam } = require('./webglParam');
const { checkWebgpu } = require('./webgpu');

const SITE = WEBSITES.find((w) => w.key === 'creepjs');

/** webgl / webgl_param / webgpu chay song song (cung 1 page, evaluate DOM). */
const PARALLEL_KEYS = new Set(['webgl', 'webgl_param', 'webgpu']);

/** Handler nhan (page, configMap, ctx) — page da o CreepJS. */
const HANDLERS = {
  screen: checkScreen,
  platform_navigator: checkPlatformNavigator,
  platform_ua: checkPlatformUa,
  hardware: checkHardware,
  device_memory: checkDeviceMemory,
  max_touch_points: checkMaxTouchPoints,
  brands: checkBrands,
  platform_version: checkPlatformVersion,
  ua_full_version: checkUaFullVersion,
  model: checkModel,
  full_version_list: checkFullVersionList,
  // form_factors: CreepJS khong hien tren UI — skip (BrowserScan/BrowserLeaks van check).
  battery: checkBattery,
  network: checkNetwork,
  font: checkFont,
  webgl: checkWebgl,
  webgl_param: checkWebglParam,
  webgpu: checkWebgpu,
};

async function run(checkKeys, ctx) {
  const { openData, configMap, signal, step, options, emit, uuid } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  const results = {};
  const supported = checkKeys.filter((k) => HANDLERS[k]);

  for (const key of checkKeys) {
    if (!HANDLERS[key]) results[key] = { state: 'skipped', value: '-' };
  }

  if (!supported.length) {
    step('CreepJS: khong co muc check nao duoc ho tro — bo qua', 'warn');
    return results;
  }

  const emitRealtimeResult = (checkKey, result) => {
    if (typeof emit !== 'function' || !uuid) return;
    emit({
      type: 'site-result',
      uuid,
      checkKey,
      siteKey: 'creepjs',
      value: result?.value ?? '',
      pass: result?.pass,
      state: result?.state || 'fail',
      lines: result?.lines || null,
    });
  };

  const runOne = async (key) => {
    if (signal?.aborted) throw new Error('aborted');
    try {
      results[key] = await HANDLERS[key](page, configMap, ctx);
      emitRealtimeResult(key, results[key]);
    } catch (err) {
      if (err.message === 'aborted') throw err;
      step(`CreepJS ${key} loi: ${err.message}`, 'err');
      results[key] = { state: 'fail', value: err.message, pass: false, lines: [] };
      emitRealtimeResult(key, results[key]);
    }
  };

  let session;
  let page;
  try {
    step('CreepJS: ket noi CDP + tim tab creepjs...');
    session = await openPage(openData, {
      reuseUrl: CREEPJS_URL,
      pruneExtraMatchingPages: true,
      keepMatchingPages: 1,
    });
    page = session.page;

    if (signal?.aborted) throw new Error('aborted');

    const onCreepjs = /^https?:\/\/abrahamjuliot\.github\.io\/creepjs\/?/i.test(page.url() || '');
    if (!onCreepjs) {
      step(`CreepJS: goto ${CREEPJS_URL}`);
      await page.goto(CREEPJS_URL, { waitUntil: 'domcontentloaded' });
    } else if (await isCreepjsReady(page)) {
      step('CreepJS: dung lai tab da mo, du lieu san sang');
    } else {
      step('CreepJS: tab cu chua load xong — reload');
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    const sequential = supported.filter((key) => !PARALLEL_KEYS.has(key));
    const parallel = supported.filter((key) => PARALLEL_KEYS.has(key));

    for (const key of sequential) {
      await runOne(key);
    }
    if (parallel.length) {
      step(`CreepJS: chay song song ${parallel.join(', ')}...`);
      await Promise.all(parallel.map((key) => runOne(key)));
    }

    const keepPage = !(options && options.autoClose);
    await release(session, { keepPage });
    session = null;
  } catch (err) {
    if (err.message === 'aborted') throw err;
    step('CreepJS loi: ' + err.message, 'err');
    for (const key of supported) {
      if (!results[key]) {
        results[key] = { state: 'fail', value: err.message, pass: false, lines: [] };
      }
    }
  } finally {
    if (session) await release(session, { keepPage: false });
  }

  return results;
}

module.exports = {
  key: 'creepjs',
  label: SITE.label,
  url: SITE.url,
  run,
};
