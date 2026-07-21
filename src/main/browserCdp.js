/**
 * Ket noi Playwright toi browser Hidemium dang mo (qua CDP).
 * Chi attach — khong launch browser moi, khong dong Chromium khi xong.
 */
const { chromium } = require('playwright-core');

function cdpEndpoint(openData) {
  const ws = openData?.web_socket || openData?.webSocket;
  if (ws && typeof ws === 'string' && /^wss?:\/\//i.test(ws)) return ws;

  const port = Number(openData?.remote_port || openData?.remotePort);
  if (!port) throw new Error('Thieu remote_port / web_socket de ket noi CDP');
  return `http://127.0.0.1:${port}`;
}

/**
 * @param {{ remote_port?: number|string, web_socket?: string }} openData
 * @returns {Promise<import('playwright-core').Browser>}
 */
async function connectBrowser(openData, { retries = 8, delayMs = 400 } = {}) {
  const endpoint = cdpEndpoint(openData);
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await chromium.connectOverCDP(endpoint);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Khong ket noi CDP (' + endpoint + '): ' + (lastErr && lastErr.message));
}

function normalizeUrl(input) {
  if (!input) return '';
  return String(input).trim().replace(/\/+$/, '').toLowerCase();
}

function isSameUrl(pageUrl, targetUrl) {
  if (!pageUrl || !targetUrl) return false;
  return normalizeUrl(pageUrl).startsWith(normalizeUrl(targetUrl));
}

/**
 * Lay context dau tien (profile dang mo) va tao tab moi, hoac tai su dung tab da mo.
 * @returns {Promise<{ browser: import('playwright-core').Browser, page: import('playwright-core').Page }>}
 */
async function openPage(openData, options = {}) {
  const browser = await connectBrowser(openData);
  const context = browser.contexts()[0] || (await browser.newContext());
  const {
    reuseUrl = null,
    pruneExtraMatchingPages = false,
    keepMatchingPages = 1,
  } = options;

  let page = null;
  if (reuseUrl) {
    const candidates = context.pages().filter((p) => {
      if (!p || p.isClosed()) return false;
      return isSameUrl(p.url(), reuseUrl);
    });

    if (candidates.length) {
      page = candidates[candidates.length - 1];
      if (pruneExtraMatchingPages && candidates.length > keepMatchingPages) {
        const toClose = candidates.slice(0, Math.max(0, candidates.length - keepMatchingPages));
        for (const p of toClose) {
          try {
            if (p !== page && !p.isClosed()) await p.close({ runBeforeUnload: false });
          } catch { /* ignore */ }
        }
      }
      try {
        await page.bringToFront();
      } catch { /* ignore */ }
    }
  }

  if (!page) page = await context.newPage();
  return { browser, page };
}

/**
 * Ngat CDP. Mac dinh GIU tab dang mo (de nhin highlight tren CreepJS).
 * Chromium Hidemium khong bi dong.
 */
async function release({ browser, page } = {}, { keepPage = true } = {}) {
  if (!keepPage) {
    try {
      if (page && !page.isClosed()) await page.close({ runBeforeUnload: false });
    } catch { /* ignore */ }
  }
  try {
    if (browser) await browser.close(); // CDP: chi disconnect
  } catch { /* ignore */ }
}

module.exports = { connectBrowser, openPage, release, cdpEndpoint };
