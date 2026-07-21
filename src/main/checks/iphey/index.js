/**
 * IPHEY: lay thong so HIEN TREN WEB (DOM).
 *
 *   const { scrapeIphey } = require('./iphey');
 */

const { IPHEY_URL, READY, CHECK_KEYS } = require('./selectors');
const { openPage } = require('./cdp');
const { sleep } = require('./sleep');
const { SCRAPE_DOM_EXPRESSION, mapPairsToChecks } = require('./parse');

async function waitIpheyReady(page, { signal, log } = {}) {
  const deadline = Date.now() + (READY.timeoutMs || 90000);
  const poll = READY.pollMs || 800;
  log?.('iphey: cho trang hien ket qua...');

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted');
    const ok = await page.evaluate(READY.expression);
    if (ok) {
      log?.('iphey: DOM detail san sang', 'ok');
      return true;
    }
    await sleep(poll, signal);
  }
  throw new Error('Timeout: iphey chua render .detail-entry');
}

/**
 * @param {object} opts
 * @param {{ remote_port?: number|string, web_socket?: string }} opts.openData
 * @param {string[]} [opts.checkKeys]
 * @param {AbortSignal} [opts.signal]
 * @param {(msg:string, kind?:string)=>void} [opts.log]
 * @param {string} [opts.url]
 */
async function scrapeIphey({ openData, checkKeys = [], signal, log, url = IPHEY_URL } = {}) {
  if (!openData?.remote_port && !openData?.web_socket) {
    return {
      ok: false,
      siteKey: 'iphey',
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
    log?.(`iphey: mo tab ${url}`);
    page = await openPage(openData, url, { signal });
    await waitIpheyReady(page, { signal, log });

    log?.('iphey: doc .detail-name / .detail-value tren trang...');
    const scraped = (await page.evaluate(SCRAPE_DOM_EXPRESSION)) || {};
    const pairs = scraped.pairs || [];
    log?.(
      `iphey: DOM ${scraped.entryCount || 0} entry, ${pairs.length} cap` +
        (scraped.trustStatus ? ` | trust: ${scraped.trustStatus}` : ''),
      'ok'
    );

    if (!pairs.length) {
      throw new Error('Khong doc duoc cap label/value nao tu DOM iphey');
    }

    const keys = Array.isArray(checkKeys) ? checkKeys : [];
    const values = mapPairsToChecks(pairs, keys);
    const okCount = Object.values(values).filter((v) => v.state === 'ok').length;
    const skipCount = Object.values(values).filter((v) => v.state === 'skipped').length;
    log?.(`iphey: map checkKeys ok=${okCount} skipped(khong co tren web)=${skipCount}`, 'ok');

    return {
      ok: true,
      siteKey: 'iphey',
      url,
      pairs,
      values,
      meta: {
        trustStatus: scraped.trustStatus || '',
        sections: scraped.sections || {},
        entryCount: scraped.entryCount || 0,
        method: 'dom',
        uiReady: true,
      },
    };
  } catch (err) {
    log?.(`iphey: loi — ${err.message}`, 'err');
    return {
      ok: false,
      siteKey: 'iphey',
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

function applyIpheyToRows(lane, checkKeys, scrapeResult, emit, uuid) {
  const siteKey = 'iphey';
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
      const fields = (Array.isArray(cell.fields) ? cell.fields : cell.matched || [])
        .map((f) => ({
          label: String(f.label || '')
            .replace(/^\[[^\]]+\]\s*/g, '')
            .trim(),
          value: String(f.value ?? '').trim(),
        }))
        .filter((f) => f.value);
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
  key: 'iphey',
  scrape: scrapeIphey,
  apply: applyIpheyToRows,
  failKey: 'check.ipheyFail',
  // --- ten cu (giu de require truc tiep) ---
  scrapeIphey,
  applyIpheyToRows,
  IPHEY_URL,
  CHECK_KEYS,
};
