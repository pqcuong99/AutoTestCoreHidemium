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

/**
 * Lay context dau tien (profile dang mo) va tao tab moi.
 * @returns {Promise<{ browser: import('playwright-core').Browser, page: import('playwright-core').Page }>}
 */
async function openPage(openData) {
  const browser = await connectBrowser(openData);
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();
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
