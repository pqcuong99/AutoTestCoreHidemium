/**
 * PIPELINE CHECK CHO 1 PROFILE - luon chay trong dung 1 lane.
 *
 * Cac buoc:
 *   1. openProfile qua Local API   -> lay profile_path / remote_port / web_socket
 *   2. Doc + decode config.hidemium -> configMap
 *   3. Build COT B (config) cho cac muc check da tick
 *   4. Lay gia tri thuc te tu cac website -> cot sannysoft/iphey/browserleaks/creepjs/...
 *
 * MOI ghi du lieu deu qua lane.assertOwns(uuid) va lane.ctx -> khong the lan sang lane khac.
 */
const { openProfile, closeProfile } = require('../hidemiumApi');
const { readProfileConfig } = require('../configReader');
const { buildConfigColumn } = require('../configMapper');
const { WEBSITES } = require('../../shared/websites');
const { t } = require('../../shared/i18n');
const {
  resolve: resolvePlatform,
  profileMatchesTargetOs,
  osFromConfigMap,
  normalizeProfileOs,
  normalizeBrowserId,
} = require('../../shared/platformPolicy');
const {
  pickBrowserFromBrowser,
  pickBrowserVersion,
  formatBrowserLabel,
  browserFromConfigMap,
} = require('../../shared/profileOs');

/** Danh dau check bi skip theo OS/browser policy cho 1 site. */
function applyPolicySkips(lane, checkKeys, platform, siteKey, emit, uuid) {
  const tag = platform.browser
    ? `${platform.id}/${platform.browser}`
    : platform.id;
  for (const key of checkKeys) {
    if (!platform.skipChecks?.has(key)) continue;
    if (!lane.ctx.rows[key]) continue;
    const r = {
      state: 'skipped',
      value: `skipped (${tag} policy)`,
      pass: false,
    };
    lane.ctx.rows[key].sites[siteKey] = r;
    emit?.({
      type: 'site-result',
      uuid,
      checkKey: key,
      siteKey,
      value: r.value,
      pass: false,
      state: 'skipped',
    });
  }
}
const creepjs = require('./creepjs');
const browserleaks = require('./browserleaks');
const browserscan = require('./browserscan');

/** Site runner kieu run(checkKeys, ctx) — CreepJS / BrowserLeaks / BrowserScan. */
const SITE_RUNNERS = {
  [creepjs.key]: creepjs,
  [browserleaks.key]: browserleaks,
  [browserscan.key]: browserscan,
};

/** Site kieu scrape + apply — sannysoft / iphey (nhanh son). */
const SITES = {
  sannysoft: require('./bot_sannysoft'),
  iphey: require('./iphey'),
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
  let platform = resolvePlatform(options?.targetOs);
  step(t('check.targetOs', { os: platform.label || platform.id }), 'ok');

  if (!platform.supported) {
    const msg = t('check.osUnsupported', {
      os: platform.id,
      reason: platform.reason || '',
    });
    step(msg, 'err');
    emit({ type: 'profile-error', uuid, stage: 'platform', error: msg });
    return { ok: false, status: msg, error: msg, rows: {} };
  }

  // Chi chan khi DA BIET OS tu list va lech target. Thieu os → mo profile roi doc config.
  if (
    lane.job?.os &&
    !profileMatchesTargetOs(lane.job.os, platform.id, { requireKnown: true })
  ) {
    const msg = t('check.osMismatch', {
      profile: lane.job.os,
      target: platform.id,
    });
    step(msg, 'err');
    emit({ type: 'profile-error', uuid, stage: 'platform', error: msg });
    return { ok: false, status: msg, error: msg, rows: {} };
  }

  const abortCheck = () => {
    if (signal.aborted) throw new Error('aborted');
  };

  // ---------- 1. Mo profile ----------
  abortCheck();
  step(t('check.opening', { name: name || uuid }));
  const restoreSession = options.disableRestoreSession === false;
  if (!restoreSession) step(t('check.restoreSessionOff'), 'ok');
  const opened = await openProfile(uuid, {
    baseUrl: options.apiBase,
    signal,
    restoreSession,
  });
  lane.assertOwns(uuid);

  if (!opened.ok) {
    emit({ type: 'profile-error', uuid, stage: 'open', error: opened.error });
    return { ok: false, status: t('err.openProfile'), error: opened.error, rows: {} };
  }

  const openedOs = opened.data?.os || opened.data?.OS || opened.data?.platform || '';
  if (openedOs && !profileMatchesTargetOs(openedOs, platform.id, { requireKnown: true })) {
    const msg = t('check.osMismatch', {
      profile: openedOs,
      target: platform.id,
    });
    step(msg, 'err');
    emit({ type: 'profile-error', uuid, stage: 'platform', error: msg });
    try {
      await closeProfile(uuid, { baseUrl: options.apiBase, signal });
    } catch {
      /* ignore */
    }
    return { ok: false, status: msg, error: msg, rows: {} };
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

    // Doc OS / browser tu config — list API thuong thieu field.
    const configOs = osFromConfigMap(cfg.map) || normalizeProfileOs(openedOs);
    const configBrowser = browserFromConfigMap(cfg.map);
    // UA trong config tin cay hon list (list hay thieu / nham Chrome khi co chrome.version).
    const listBrowser = formatBrowserLabel(
      pickBrowserFromBrowser(opened.data) || pickBrowserFromBrowser(lane.job) || lane.job?.browser,
      pickBrowserVersion(opened.data) || pickBrowserVersion(lane.job)
    );
    const browserLabel = configBrowser || listBrowser;
    const browserId =
      normalizeBrowserId(configBrowser) ||
      normalizeBrowserId(listBrowser) ||
      normalizeBrowserId(lane.job?.browser);

    // Gom policy OS + browsers[browserId] (vd mac/safari → skip webgpu).
    platform = resolvePlatform(options?.targetOs, browserId);
    emit({
      type: 'profile-meta',
      uuid,
      os: configOs || openedOs || '',
      browser: browserLabel,
      name: opened.data?.profile_name || name,
    });
    if (configOs) {
      step(`Profile OS (config): ${configOs}`, 'ok');
      if (!profileMatchesTargetOs(configOs, platform.id, { requireKnown: true })) {
        const msg = t('check.osMismatch', {
          profile: configOs,
          target: platform.id,
        });
        step(msg, 'err');
        emit({ type: 'profile-error', uuid, stage: 'platform', error: msg });
        return { ok: false, status: msg, error: msg, rows: {} };
      }
    } else if (platform.id !== 'all') {
      step('Profile OS: chua xac dinh tu list/config — van chay (target=' + platform.id + ')', 'warn');
    }
    if (browserLabel) step(`Profile browser: ${browserLabel}`, 'ok');
    if (platform.browser) {
      step(`Policy: ${platform.label}/${platform.browser}`, 'ok');
      if (platform.skipChecks.size) {
        step(`Policy skipChecks: ${[...platform.skipChecks].join(', ')}`, 'ok');
      }
    }

    const runKeys = checkKeys.filter((k) => !platform.skipChecks.has(k));

    const profileOs = configOs || normalizeProfileOs(openedOs) || '';

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

    // ---------- 4. Lay gia tri that tu tung website (thu tu WEBSITES) ----------
    for (const w of WEBSITES) {
      abortCheck();
      lane.assertOwns(uuid);

      applyPolicySkips(lane, checkKeys, platform, w.key, emit, uuid);

      const runner = SITE_RUNNERS[w.key];
      if (runner?.run) {
        const siteResults = await runner.run(runKeys, {
          openData: lane.ctx.openData,
          configMap: lane.ctx.configMap,
          signal,
          emit,
          uuid,
          step,
          platform,
          targetOs: platform.id,
          profileOs,
          options,
        });
        lane.assertOwns(uuid);

        for (const key of runKeys) {
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
            lines: r.lines || null,
          });
        }
        emit({ type: 'site-done', uuid, siteKey: w.key });
        continue;
      }

      const site = SITES[w.key];
      if (site?.scrape && site?.apply) {
        const res = await site.scrape({
          openData: lane.ctx.openData,
          checkKeys: runKeys,
          signal,
          log: step,
          profileOs,
        });
        lane.assertOwns(uuid);
        site.apply(lane, runKeys, res, emit, uuid);
        emit({
          type: 'detail-rows',
          uuid,
          profileName: opened.data.profile_name || name,
          rows: lane.ctx.rows,
          checkKeys,
        });
        if (!res.ok) {
          step(t(site.failKey || `check.${w.key}Fail`, { error: res.error || '' }), 'err');
        }
        continue;
      }

      for (const key of runKeys) {
        const r = { state: 'skipped', value: '-', pass: false };
        lane.ctx.rows[key].sites[w.key] = r;
        emit({
          type: 'site-result',
          uuid,
          checkKey: key,
          siteKey: w.key,
          value: r.value,
          pass: false,
          state: 'skipped',
        });
      }
      emit({ type: 'site-done', uuid, siteKey: w.key, state: 'skipped' });
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

module.exports = { runProfileCheck, SITES, SITE_RUNNERS };
