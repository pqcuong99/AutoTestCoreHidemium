/**
 * PIPELINE CHECK CHO 1 PROFILE - luon chay trong dung 1 lane.
 *
 * Cac buoc:
 *   1. openProfile qua Local API   -> lay profile_path / remote_port / web_socket
 *   2. Doc + decode config.hidemium -> configMap
 *   3. Build COT B (config) cho cac muc check da tick
 *   4. (TODO) Lay gia tri thuc te tu cac website -> cac cot sannysoft/iphey/...
 *
 * MOI ghi du lieu deu qua lane.assertOwns(uuid) va lane.ctx -> khong the lan sang lane khac.
 */
const { openProfile, closeProfile } = require('../hidemiumApi');
const { readProfileConfig } = require('../configReader');
const { buildConfigColumn } = require('../configMapper');
const { WEBSITES } = require('../../shared/websites');
const { t } = require('../../shared/i18n');
const creepjs = require('./creepjs');

/** Site checker theo key — them website moi thi dang ky o day. */
const SITE_RUNNERS = {
  [creepjs.key]: creepjs,
};

/**
 * @param {import('../laneManager').Lane} lane
 * @param {string[]} checkKeys
 * @param {{ signal:AbortSignal, emit:(evt:object)=>void, options:object }} ctx
 */
async function runProfileCheck(lane, checkKeys, ctx) {
  const { uuid, name } = lane.job;
  const { signal, emit, options } = ctx;
  const step = (message, kind) => emit({ type: 'log', uuid, message, kind });

  const abortCheck = () => {
    if (signal.aborted) throw new Error('aborted');
  };

  // ---------- 1. Mo profile ----------
  abortCheck();
  step(t('check.opening', { name: name || uuid }));
  const opened = await openProfile(uuid, { baseUrl: options.apiBase, signal });
  lane.assertOwns(uuid);

  if (!opened.ok) {
    emit({ type: 'profile-error', uuid, stage: 'open', error: opened.error });
    return { ok: false, status: t('err.openProfile'), error: opened.error, rows: {} };
  }

  lane.ctx.openData = opened.data;
  emit({ type: 'profile-opened', uuid, data: opened.data });
  step(t('check.opened', { port: opened.data.remote_port, path: opened.data.profile_path }), 'ok');

  try {
    // ---------- 2. Doc + decode config ----------
    abortCheck();
    const cfg = readProfileConfig(opened.data.profile_path);
    lane.assertOwns(uuid);

    if (!cfg.ok) {
      emit({ type: 'profile-error', uuid, stage: 'config', error: cfg.error });
      return { ok: false, status: t('err.readConfig'), error: cfg.error, rows: {} };
    }

    lane.ctx.configMap = cfg.map;
    step(t('check.decodeOk', { n: Object.keys(cfg.map).length }), 'ok');

    // ---------- 3. Cot B ----------
    abortCheck();
    const columnB = buildConfigColumn(checkKeys, cfg.map);
    lane.assertOwns(uuid);

    for (const key of checkKeys) {
      lane.ctx.rows[key] = {
        config: columnB[key],
        sites: Object.fromEntries(WEBSITES.map((w) => [w.key, { state: 'pending', value: '' }])),
      };
    }

    emit({
      type: 'detail-rows',
      uuid,
      profileName: opened.data.profile_name || name,
      rows: lane.ctx.rows,
      checkKeys,
    });

    // ---------- 4. Lay gia tri that tu tung website ----------
    // Site co runner rieng (vd creepjs/) thi goi run(); con lai skipped.
    // Moi ghi lane.ctx.rows deu qua lane.assertOwns(uuid).
    for (const w of WEBSITES) {
      abortCheck();
      lane.assertOwns(uuid);

      const runner = SITE_RUNNERS[w.key];
      if (!runner) {
        for (const key of checkKeys) {
          lane.ctx.rows[key].sites[w.key] = { state: 'skipped', value: '-' };
        }
        emit({ type: 'site-done', uuid, siteKey: w.key, state: 'skipped' });
        continue;
      }

      const siteResults = await runner.run(checkKeys, {
        openData: lane.ctx.openData,
        configMap: lane.ctx.configMap,
        signal,
        emit,
        uuid,
        step,
      });
      lane.assertOwns(uuid);

      for (const key of checkKeys) {
        const r = siteResults[key] || { state: 'skipped', value: '-' };
        lane.ctx.rows[key].sites[w.key] = r;
        emit({
          type: 'site-result',
          uuid,
          checkKey: key,
          siteKey: w.key,
          value: r.value,
          pass: r.pass,
          state: r.state,
        });
      }
      emit({ type: 'site-done', uuid, siteKey: w.key, state: 'done' });
    }

    return { ok: true, status: t('err.pass'), rows: lane.ctx.rows };
  } finally {
    // Dong khi: autoClose bat, HOAC bi bam Dung (abort) — tranh bo browser mo coi.
    const shouldClose = options.autoClose || signal.aborted;
    if (shouldClose) {
      step(t('check.closing'));
      const closed = await closeProfile(uuid, { baseUrl: options.apiBase });
      if (closed.ok) emit({ type: 'profile-closed', uuid });
      else step(t('check.closeFail', { error: closed.error }), 'err');
    }
  }
}

module.exports = { runProfileCheck };
