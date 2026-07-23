/**
 * bot.sannysoft.com — scrape DOM qua CDP (reuse iphey/cdp).
 *
 *   const { scrapeSannysoft, applySannysoftToRows } = require('./bot_sannysoft');
 */

const { SANNYSOFT_URL, READY, IOS_SKIP_CHECK_KEYS } = require('./selectors');
const { openPage } = require('../iphey/cdp');
const { sleep } = require('./sleep');
const { SCRAPE_DOM_EXPRESSION, mapPairsToChecks } = require('./parse');
const { normalizeProfileOs } = require('../../../shared/profileOs');

async function waitReady(page, { signal, log, requireFpCollect = true } = {}) {
  const deadline = Date.now() + (READY.timeoutMs || 60000);
  const poll = READY.pollMs || 500;
  const expr = requireFpCollect ? READY.expression : READY.expressionUaOnly;
  log?.(
    requireFpCollect
      ? 'sannysoft: cho trang do ket qua (UA + fp-collect)...'
      : 'sannysoft: cho UA (iOS — bo qua fp-collect)...'
  );

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted');
    const ok = await page.evaluate(expr);
    if (ok) {
      log?.('sannysoft: DOM san sang', 'ok');
      return true;
    }
    await sleep(poll, signal);
  }
  throw new Error(
    requireFpCollect
      ? 'Timeout: sannysoft chua do User-Agent/WebGL'
      : 'Timeout: sannysoft chua co User-Agent'
  );
}

/**
 * @param {object} opts
 * @param {{ remote_port?: number|string, web_socket?: string }} opts.openData
 * @param {string[]} [opts.checkKeys]
 * @param {AbortSignal} [opts.signal]
 * @param {(msg:string, kind?:string)=>void} [opts.log]
 * @param {string} [opts.url]
 * @param {string} [opts.profileOs]  OS profile (ios|android|windows|macos)
 */
async function scrapeSannysoft({
  openData,
  checkKeys = [],
  signal,
  log,
  url = SANNYSOFT_URL,
  profileOs = '',
} = {}) {
  if (!openData?.remote_port && !openData?.web_socket) {
    return {
      ok: false,
      siteKey: 'sannysoft',
      url,
      pairs: [],
      values: {},
      meta: {},
      error: 'Thieu remote_port/web_socket — can openProfile truoc',
    };
  }

  const osId = normalizeProfileOs(profileOs);
  const isIos = osId === 'ios';
  const iosSkip = new Set(isIos ? IOS_SKIP_CHECK_KEYS : []);

  let page;
  try {
    if (signal?.aborted) throw new Error('aborted');
    log?.(`sannysoft: mo tab ${url}${isIos ? ' (profile iOS)' : ''}`);
    page = await openPage(openData, url, { signal });
    await waitReady(page, { signal, log, requireFpCollect: !isIos });

    log?.('sannysoft: doc bang Test / details tren trang...');
    const scraped = (await page.evaluate(SCRAPE_DOM_EXPRESSION)) || {};
    const pairs = scraped.pairs || [];
    log?.(`sannysoft: DOM ${pairs.length} cap`, 'ok');

    if (!pairs.length) {
      throw new Error('Khong doc duoc cap label/value nao tu DOM sannysoft');
    }

    const values = mapPairsToChecks(pairs, checkKeys);

    // iOS: skip key phu thuoc fp-collect (vd screen) — khong fail
    if (iosSkip.size) {
      const skipped = [];
      for (const key of iosSkip) {
        if (!checkKeys.length || checkKeys.includes(key)) {
          values[key] = {
            value: '',
            fields: [],
            state: 'skipped',
            reason: 'ios-no-fp-collect',
          };
          skipped.push(key);
        }
      }
      if (skipped.length) {
        log?.(`sannysoft iOS: skip ${skipped.join(', ')} (khong co fp-collect)`, 'warn');
      }
    }

    // iOS: key khong map duoc tu DOM → skipped (khong doi fail ca site)
    if (isIos) {
      for (const key of Object.keys(values)) {
        if (values[key].state === 'skipped' && !values[key].reason) {
          values[key].reason = 'not-on-page';
        }
      }
    }

    const okCount = Object.values(values).filter((v) => v.state === 'ok').length;
    const skipCount = Object.values(values).filter((v) => v.state === 'skipped').length;
    log?.(`sannysoft: map checkKeys ok=${okCount} skipped=${skipCount}`, 'ok');

    return {
      ok: true,
      siteKey: 'sannysoft',
      url,
      pairs,
      values,
      meta: {
        entryCount: pairs.length,
        ua: scraped.ua || '',
        webglVendor: scraped.webglVendor || '',
        webglRenderer: scraped.webglRenderer || '',
        method: 'dom',
        uiReady: true,
        profileOs: osId || '',
        fpCollect: !isIos,
        iosSkipped: [...iosSkip],
      },
    };
  } catch (err) {
    log?.(`sannysoft: loi — ${err.message}`, 'err');
    return {
      ok: false,
      siteKey: 'sannysoft',
      url,
      pairs: [],
      values: {},
      meta: { profileOs: osId || '' },
      error: err.message,
    };
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        /* ignore */
      }
    }
  }
}

function applySannysoftToRows(lane, checkKeys, scrapeResult, emit, uuid) {
  const siteKey = 'sannysoft';
  const keys = checkKeys?.length ? checkKeys : Object.keys(lane.ctx?.rows || {});

  for (const key of keys) {
    if (!lane.ctx.rows[key]) continue;
    if (!lane.ctx.rows[key].sites) lane.ctx.rows[key].sites = {};

    const cell = scrapeResult.values?.[key];
    if (!scrapeResult.ok) {
      lane.ctx.rows[key].sites[siteKey] = {
        state: 'fail',
        value: scrapeResult.error || 'error',
        fields: [],
      };
    } else if (!cell || cell.state === 'skipped' || !cell.value) {
      const reason =
        cell?.reason === 'ios-no-fp-collect'
          ? 'skipped (iOS: khong co fp-collect)'
          : '-';
      lane.ctx.rows[key].sites[siteKey] = {
        state: 'skipped',
        value: reason,
        fields: [],
      };
    } else {
      const fields = Array.isArray(cell.fields) ? cell.fields : [];
      lane.ctx.rows[key].sites[siteKey] = {
        state: 'pass',
        value: fields.map((f) => `${f.label}: ${f.value}`).join('\n') || cell.value,
        fields,
      };
    }

    const site = lane.ctx.rows[key].sites[siteKey];
    emit?.({
      type: 'site-result',
      uuid,
      checkKey: key,
      siteKey,
      value: site.value,
      state: site.state,
      fields: site.fields || [],
    });
  }

  emit?.({
    type: 'site-done',
    uuid,
    siteKey,
    state: scrapeResult.ok ? 'done' : 'fail',
    meta: scrapeResult.meta,
  });
}

module.exports = {
  // --- khai bao cho sites.js (index chung) ---
  key: 'sannysoft',
  scrape: scrapeSannysoft,
  apply: applySannysoftToRows,
  failKey: 'check.sannysoftFail',
  // --- ten cu (giu de require truc tiep) ---
  scrapeSannysoft,
  applySannysoftToRows,
  SANNYSOFT_URL,
  IOS_SKIP_CHECK_KEYS,
};
