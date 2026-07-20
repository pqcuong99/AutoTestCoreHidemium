/**
 * CHECK LOGIC CHO TRANG CREEPJS.
 *
 * URL: https://abrahamjuliot.github.io/creepjs/
 *
 * Nhiem vu:
 *   - Mo tab toi CreepJS qua CDP (web_socket tu openProfile)
 *   - Doc gia tri fingerprint thuc te theo tung checkKey da tick
 *   - Tra ve ket qua de pipeline ghi vao lane.ctx.rows[*].sites.creepjs
 *
 * Chua implement scrape — chi scaffold de viet logic.
 */
const { WEBSITES } = require('../../../shared/websites');

const SITE = WEBSITES.find((w) => w.key === 'creepjs');

/**
 * @param {string[]} checkKeys  cac muc check dang tick
 * @param {{
 *   openData: object,          // data tu openProfile (remote_port, web_socket, ...)
 *   configMap: object,         // config.hidemium da decode
 *   signal: AbortSignal,
 *   emit: (e:object)=>void,
 *   uuid: string,
 *   step: (msg:string, kind?:string)=>void,
 * }} ctx
 * @returns {Promise<Record<string, { state:string, value:string, pass?:boolean }>>}
 *   map checkKey -> ket qua site creepjs
 */
async function run(checkKeys, ctx) {
  const { signal, step } = ctx;

  if (signal?.aborted) throw new Error('aborted');

  step(`CreepJS: mo ${SITE.url}...`);

  // TODO: ket noi CDP qua ctx.openData.web_socket / remote_port
  // TODO: navigate toi SITE.url, doi page load xong
  // TODO: extract gia tri theo tung checkKey (screen, platform, webgl, ...)
  // TODO: so sanh voi cot B (config) neu can -> pass/fail

  const results = {};
  for (const key of checkKeys) {
    results[key] = { state: 'skipped', value: '-' };
  }

  step('CreepJS: chua implement scrape — bo qua', 'warn');
  return results;
}

module.exports = {
  key: 'creepjs',
  label: SITE.label,
  url: SITE.url,
  run,
};
