/**
 * CHECK LOGIC CHO TRANG CREEPJS.
 *
 * URL: https://abrahamjuliot.github.io/creepjs/
 *
 * Hien tai: Screen (Playwright CDP + select #creep-resize, so sanh config, highlight xanh/do).
 * Muc khac se them file rieng trong folder nay.
 */
const { WEBSITES } = require('../../../shared/websites');
const { checkScreen } = require('./screen');

const SITE = WEBSITES.find((w) => w.key === 'creepjs');

/** Muc check da ho tro tren CreepJS */
const HANDLERS = {
  screen: checkScreen,
};

/**
 * @param {string[]} checkKeys
 * @param {{
 *   openData: object,
 *   configMap: object,
 *   signal: AbortSignal,
 *   emit: (e:object)=>void,
 *   uuid: string,
 *   step: (msg:string, kind?:string)=>void,
 * }} ctx
 * @returns {Promise<Record<string, { state:string, value:string, pass?:boolean, lines?:Array }>>}
 */
async function run(checkKeys, ctx) {
  const { signal, step } = ctx;
  if (signal?.aborted) throw new Error('aborted');

  const results = {};
  const supported = checkKeys.filter((k) => HANDLERS[k]);

  for (const key of checkKeys) {
    if (!HANDLERS[key]) {
      results[key] = { state: 'skipped', value: '-' };
    }
  }

  if (!supported.length) {
    step('CreepJS: khong co muc check nao duoc ho tro (vd Screen) — bo qua', 'warn');
    return results;
  }

  // Screen can 1 lan mo trang — chay handler tung muc (sau nay co the gom chung 1 tab).
  for (const key of supported) {
    if (signal?.aborted) throw new Error('aborted');
    results[key] = await HANDLERS[key](ctx);
  }

  return results;
}

module.exports = {
  key: 'creepjs',
  label: SITE.label,
  url: SITE.url,
  run,
};
