/**
 * CDP session: ket noi browser Hidemium qua remote_port / web_socket.
 * Khong dung puppeteer — chi Node http + WebSocket toi thieu.
 */
const http = require('http');
const { connectWs } = require('./wsClient');

function httpGetJson(url, { signal, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Khong parse duoc JSON tu ' + url + ': ' + raw.slice(0, 120)));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout CDP HTTP: ' + url)));
    req.on('error', reject);
    if (signal) {
      if (signal.aborted) return reject(new Error('aborted'));
      signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    }
  });
}

/**
 * Lay webSocketDebuggerUrl cua browser tu remote_port.
 * @param {{ remote_port?: number|string, web_socket?: string }} openData
 */
async function resolveBrowserWsUrl(openData, { signal } = {}) {
  if (openData?.web_socket && /^ws/.test(openData.web_socket)) {
    return openData.web_socket;
  }
  const port = openData?.remote_port;
  if (!port) throw new Error('openData thieu remote_port / web_socket');

  const version = await httpGetJson(`http://127.0.0.1:${port}/json/version`, { signal });
  if (!version?.webSocketDebuggerUrl) {
    throw new Error('CDP /json/version khong co webSocketDebuggerUrl');
  }
  return version.webSocketDebuggerUrl;
}

class CdpSession {
  /**
   * @param {import('./wsClient').WsClient} ws
   */
  constructor(ws) {
    this.ws = ws;
    this._id = 0;
    this._pending = new Map();
    ws.on('message', (text) => this._onMessage(text));
    ws.on('error', (err) => {
      for (const [, p] of this._pending) p.reject(err);
      this._pending.clear();
    });
    ws.on('close', () => {
      for (const [, p] of this._pending) p.reject(new Error('CDP WS closed'));
      this._pending.clear();
    });
  }

  _onMessage(text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (msg.id != null && this._pending.has(msg.id)) {
      const p = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
      return;
    }
    // events: msg.method — co the mo rong sau
  }

  /**
   * @param {string} method
   * @param {object} [params]
   * @param {string} [sessionId]
   */
  send(method, params = {}, sessionId) {
    const id = ++this._id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        this._pending.delete(id);
        reject(err);
      }
    });
  }

  close() {
    this.ws.close();
  }
}

/**
 * Mo tab moi, dieu huong URL, tra ve { cdp, sessionId, targetId, close }.
 * @param {{ remote_port?: number|string, web_socket?: string }} openData
 */
async function openPage(openData, url, { signal } = {}) {
  if (signal?.aborted) throw new Error('aborted');

  const browserWs = await resolveBrowserWsUrl(openData, { signal });
  const ws = await connectWs(browserWs);
  const cdp = new CdpSession(ws);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  const nav = await cdp.send(
    'Page.navigate',
    { url },
    sessionId
  );
  if (nav.errorText) throw new Error('Page.navigate: ' + nav.errorText);

  // Cho loadEventFired (timeout 60s)
  await waitLoad(cdp, sessionId, signal, 60000);

  return {
    cdp,
    sessionId,
    targetId,
    async evaluate(expression) {
      const res = await cdp.send(
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId
      );
      if (res.exceptionDetails) {
        const t = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
        throw new Error('evaluate: ' + t);
      }
      return res.result?.value;
    },
    async close() {
      try {
        await cdp.send('Target.closeTarget', { targetId });
      } catch {
        /* ignore */
      }
      cdp.close();
    },
  };
}

function waitLoad(cdp, sessionId, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout cho Page.loadEventFired'));
    }, timeoutMs);

    const onMsg = (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.method === 'Page.loadEventFired' && (!msg.sessionId || msg.sessionId === sessionId)) {
        cleanup();
        resolve();
      }
    };

    function onAbort() {
      cleanup();
      reject(new Error('aborted'));
    }

    function cleanup() {
      clearTimeout(timer);
      cdp.ws.removeListener('message', onMsg);
      signal?.removeEventListener('abort', onAbort);
    }

    cdp.ws.on('message', onMsg);
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    // Fallback: neu load da xong truoc khi listen
    cdp
      .send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sessionId)
      .then((r) => {
        if (r?.result?.value === 'complete') {
          cleanup();
          resolve();
        }
      })
      .catch(() => {});
  });
}

module.exports = {
  openPage,
  resolveBrowserWsUrl,
  CdpSession,
};
