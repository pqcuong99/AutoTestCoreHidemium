/**
 * bot.sannysoft.com — scrape DOM qua CDP (reuse iphey/cdp).
 *
 *   const { scrapeSannysoft, applySannysoftToRows } = require('./bot_sannysoft');
 */

const { SANNYSOFT_URL, READY } = require('./selectors');
const { openPage } = require('../iphey/cdp');
const { sleep } = require('./sleep');
const { SCRAPE_DOM_EXPRESSION, mapPairsToChecks } = require('./parse');

async function waitReady(page, { signal, log } = {}) {
  const deadline = Date.now() + (READY.timeoutMs || 60000);
  const poll = READY.pollMs || 500;
  log?.('sannysoft: cho trang do ket qua...');

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted');
    const ok = await page.evaluate(READY.expression);
    if (ok) {
      log?.('sannysoft: DOM san sang', 'ok');
      return true;
    }
    await sleep(poll, signal);
  }
  throw new Error('Timeout: sannysoft chua do User-Agent/WebGL');
}

/**
 * @param {object} opts
 * @param {{ remote_port?: number|string, web_socket?: string }} opts.openData
 * @param {string[]} [opts.checkKeys]
 * @param {AbortSignal} [opts.signal]
 * @param {(msg:string, kind?:string)=>void} [opts.log]
 * @param {string} [opts.url]
 */
async function scrapeSannysoft({
  openData,
  checkKeys = [],
  signal,
  log,
  url = SANNYSOFT_URL,
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

  let page;
  try {
    if (signal?.aborted) throw new Error('aborted');
    log?.(`sannysoft: mo tab ${url}`);
    page = await openPage(openData, url, { signal });
    await waitReady(page, { signal, log });

    log?.('sannysoft: doc bang Test / details tren trang...');
    const scraped = (await page.evaluate(SCRAPE_DOM_EXPRESSION)) || {};
    const pairs = scraped.pairs || [];
    log?.(`sannysoft: DOM ${pairs.length} cap`, 'ok');

    if (!pairs.length) {
      throw new Error('Khong doc duoc cap label/value nao tu DOM sannysoft');
    }

    const values = mapPairsToChecks(pairs, checkKeys);
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
      meta: {},
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
      lane.ctx.rows[key].sites[siteKey] = {
        state: 'skipped',
        value: '-',
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
};
