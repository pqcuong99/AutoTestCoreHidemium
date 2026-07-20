/**
 * Ket noi Playwright vao browser Hidemium qua CDP (remote_port / web_socket).
 *
 * LUU Y:
 * - Khong dung browser.newContext() / context.newPage() khi da co tab —
 *   Playwright CDP thuong mo cua so Chrome MOI (khong dung profile Hidemium).
 * - Uu tien web_socket tu openProfile (unique) thay vi chi http://127.0.0.1:port
 *   (port de trung voi Chrome that dang bat remote debugging).
 */
const http = require('http');
const { chromium } = require('playwright-core');

/**
 * @param {object} openData  data tu openProfile
 * @returns {string} CDP endpoint
 */
function resolveCdpEndpoint(openData) {
  if (!openData) throw new Error('openData rong — chua mo profile');

  const ws = openData.web_socket || openData.ws || openData.webSocketDebuggerUrl;
  // Uu tien ws://.../devtools/browser/<id> — dinh danh dung instance Hidemium
  if (ws && typeof ws === 'string' && (ws.startsWith('ws://') || ws.startsWith('wss://'))) {
    return ws;
  }
  if (ws && typeof ws === 'string' && (ws.startsWith('http://') || ws.startsWith('https://'))) {
    return ws;
  }

  const port = openData.remote_port || openData.port;
  if (!port) throw new Error('Thieu remote_port / web_socket trong openProfile');
  return `http://127.0.0.1:${port}`;
}

/**
 * Doc /json/version de xac nhan dang attach dung browser (debug).
 * @param {string} endpoint
 */
async function probeCdpBrowser(endpoint) {
  try {
    let httpBase = endpoint;
    if (endpoint.startsWith('ws://')) {
      httpBase = endpoint.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');
    } else if (endpoint.startsWith('wss://')) {
      httpBase = endpoint.replace(/^wss:/, 'https:').replace(/\/devtools\/browser\/.*$/, '');
    }
    const url = httpBase.replace(/\/$/, '') + '/json/version';
    const body = await new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('CDP probe timeout')));
    });
    return {
      browser: body.Browser || body.browser || '',
      ws: body.webSocketDebuggerUrl || '',
      userAgent: body['User-Agent'] || body.userAgent || '',
    };
  } catch {
    return null;
  }
}

/**
 * Lay page trong default context — TAI SU DUNG tab co san, khong newPage.
 * @param {import('playwright-core').Browser} browser
 */
function pickExistingPage(browser) {
  const contexts = browser.contexts();
  if (!contexts.length) {
    throw new Error(
      'CDP khong co browser context — co the dang connect nham Chrome that / sai endpoint'
    );
  }
  const context = contexts[0];
  const pages = context.pages().filter((p) => {
    const u = p.url();
    return !u.startsWith('devtools://') && !u.startsWith('chrome-extension://');
  });
  const page = pages[0] || context.pages()[0] || null;
  return { context, page, reused: !!page };
}

/**
 * Tao tab moi BANG CDP Target.createTarget (newWindow:false) — tab trong cung cua so.
 * Fallback newPage chi khi khong con cach nao.
 * @param {import('playwright-core').BrowserContext} context
 * @param {import('playwright-core').Page | null} existingPage
 */
async function openTabInSameWindow(context, existingPage) {
  if (existingPage) {
    try {
      const session = await context.newCDPSession(existingPage);
      const before = new Set(context.pages());
      await session.send('Target.createTarget', {
        url: 'about:blank',
        newWindow: false,
      });
      await session.detach().catch(() => {});

      // Cho tab moi xuat hien
      for (let i = 0; i < 20; i++) {
        const created = context.pages().find((p) => !before.has(p));
        if (created) return { page: created, created: true };
        await existingPage.waitForTimeout(50);
      }
    } catch {
      // Fallback: tai su dung tab hien tai (goto se thay URL)
    }
    return { page: existingPage, created: false };
  }

  // Khong co tab nao — bat buoc newPage (hiếm; co the mo window moi)
  const page = await context.newPage();
  return { page, created: true };
}

/**
 * Attach CDP, mo URL tren profile Hidemium, tra ve { browser, context, page, close }.
 * @param {object} openData
 * @param {string} url
 * @param {{ signal?: AbortSignal, timeout?: number, step?: Function }} opts
 */
async function openPage(openData, url, opts = {}) {
  const { signal, timeout = 60000, step } = opts;
  if (signal?.aborted) throw new Error('aborted');

  const endpoint = resolveCdpEndpoint(openData);
  const probe = await probeCdpBrowser(
    openData.remote_port ? `http://127.0.0.1:${openData.remote_port}` : endpoint
  );
  if (step && probe) {
    step(`CDP attach: ${probe.browser || 'unknown'} @ ${endpoint.slice(0, 80)}...`);
  }

  const browser = await chromium.connectOverCDP(endpoint, { timeout });

  // KHONG newContext() — se mo cua so/Chrome moi
  const { context, page: existing } = pickExistingPage(browser);
  const { page, created } = await openTabInSameWindow(context, existing);

  const onAbort = () => {
    if (created) page.close().catch(() => {});
  };
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  try {
    if (signal?.aborted) throw new Error('aborted');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    // cho bang render (BrowserLeaks fill bang bang JS)
    await page.waitForTimeout(1500);

    // WebGPU: doi limits co so (tbody hoac table#gpu-limits)
    if (/browserleaks\.com\/webgpu/i.test(url)) {
      await page
        .waitForFunction(
          () => {
            const td =
              document.querySelector('#gpu-limits > tr:nth-child(1) > td:nth-child(2)') ||
              document.querySelector('#gpu-limits > tbody > tr:nth-child(1) > td:nth-child(2)') ||
              document.querySelector('#gpu-limits tr:nth-child(1) > td:nth-child(2)') ||
              document.querySelector(
                '#gpu-limits tr[title="maxTextureDimension1D"] td:nth-child(2)'
              );
            const t = ((td && td.innerText) || '').replace(/\s+/g, ' ').trim();
            return t && t !== 'maxTextureDimension1D' && /\d/.test(t);
          },
          { timeout: 25000 }
        )
        .catch(() => {});
      await page.waitForTimeout(800);
    }
  } catch (err) {
    if (signal) signal.removeEventListener('abort', onAbort);
    if (created) await page.close().catch(() => {});
    // KHONG browser.close() truoc khi throw theo cach destroy — disconnect o duoi
    try {
      browser.close();
    } catch {
      /* ignore */
    }
    throw err;
  }

  return {
    browser,
    context,
    page,
    endpoint,
    created,
    async close() {
      if (signal) signal.removeEventListener('abort', onAbort);
      // Chi dong tab neu ta tao moi; tab goc cua user giu nguyen
      if (created) await page.close().catch(() => {});
      // connectOverCDP: close = disconnect, khong tat browser Hidemium
      try {
        browser.close();
      } catch {
        /* ignore */
      }
    },
  };
}

const { textBySelector } = require('./selector');

/** @deprecated dung textBySelector — giu de tuong thich */
async function textByXPath(page, xpath) {
  return textBySelector(page, { xpath });
}

module.exports = {
  resolveCdpEndpoint,
  openPage,
  textByXPath,
  textBySelector,
  probeCdpBrowser,
};
