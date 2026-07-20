/**
 * Client goi Local API cua Hidemium (mac dinh http://127.0.0.1:2222).
 */
const http = require('http');

const DEFAULT_BASE = 'http://127.0.0.1:2222';
const DEFAULT_TIMEOUT = 120000;

function attachAbort(req, signal) {
  if (!signal) return;
  if (signal.aborted) {
    req.destroy(new Error('aborted'));
    return;
  }
  signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
}

function parseHttpJsonResponse(res) {
  return new Promise((resolve) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
      } catch {
        resolve({ status: res.statusCode, body: null, raw: data });
      }
    });
  });
}

function httpGetJson(url, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout }, (res) => {
      parseHttpJsonResponse(res).then(resolve);
    });

    req.on('timeout', () => req.destroy(new Error('Timeout sau ' + timeout + 'ms')));
    req.on('error', reject);
    attachAbort(req, signal);
  });
}

function httpPostJson(url, body, { timeout = DEFAULT_TIMEOUT, signal } = {}) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body == null ? {} : body), 'utf8');
    const u = new URL(url);
    const req = http.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
        timeout,
      },
      (res) => {
        parseHttpJsonResponse(res).then(resolve);
      }
    );

    req.on('timeout', () => req.destroy(new Error('Timeout sau ' + timeout + 'ms')));
    req.on('error', reject);
    attachAbort(req, signal);
    req.write(payload);
    req.end();
  });
}

/**
 * POST /v1/browser/list?is_local={bool}
 * Body: { page, limit, search }
 *
 * Local bat buoc POST — GET ?is_local=true tra { type:'error', title:'Get browser failed!' }.
 * Cloud chap nhan ca GET lan POST; dung POST de dong bo 1 luong.
 *
 * Response thanh cong: { data: { content: [...] }, links: {...}, meta: {...} }
 * Response loi:        { type: 'error', title: 'Get browser failed!' }
 *
 * @returns {{ ok:boolean, rows?:Array, meta?:object, error?:string }}
 */
async function listBrowsers({
  isLocal = false,
  page = 1,
  limit,
  search = '',
  baseUrl = DEFAULT_BASE,
  signal,
  timeout = 60000,
} = {}) {
  const p = Math.max(1, Number(page) || 1);
  // Local API khoa per_page=10; gui limit khac (vd 15) lam page>1 tra content rong.
  const lim = Math.max(1, Number(limit) || (isLocal ? 10 : 15));
  const url = `${baseUrl}/v1/browser/list?is_local=${isLocal ? 'true' : 'false'}`;

  try {
    const res = await httpPostJson(
      url,
      { page: p, limit: lim, search: search == null ? '' : String(search) },
      { signal, timeout }
    );
    const body = res.body;

    if (!body) return { ok: false, error: 'Response khong phai JSON: ' + String(res.raw).slice(0, 200) };
    if (body.type === 'error') return { ok: false, error: body.title || 'Get browser failed!' };

    const content = body.data && Array.isArray(body.data.content) ? body.data.content : null;
    if (!content) return { ok: false, error: 'Response thieu data.content' };

    // Chi giu lai truong can dung cho bang + runner.
    const rows = content
      .map((b) => ({ uuid: String(b.uuid || '').trim(), name: String(b.name || '').trim() }))
      .filter((r) => r.uuid !== '');

    const m = body.meta || {};
    // Local API thuong giu meta.current_page=1 ke ca khi request page>1 -> tin page da gui.
    return {
      ok: true,
      rows,
      meta: {
        currentPage: p,
        lastPage: Number(m.last_page) || 1,
        perPage: Number(m.per_page) || lim,
        total: Number(m.total) || rows.length,
      },
    };
  } catch (err) {
    return { ok: false, error: 'Khong goi duoc API: ' + err.message };
  }
}

/**
 * GET /openProfile?uuid={uuid}
 * @returns {{ ok:boolean, data?:object, error?:string, raw?:any }}
 */
async function openProfile(uuid, { baseUrl = DEFAULT_BASE, signal, timeout } = {}) {
  const url = `${baseUrl}/openProfile?uuid=${encodeURIComponent(uuid)}`;
  try {
    const res = await httpGetJson(url, { signal, timeout });
    const body = res.body;

    if (!body) return { ok: false, error: 'Response khong phai JSON: ' + String(res.raw).slice(0, 200) };
    if (body.status !== 'successfully') {
      return { ok: false, error: body.message || body.status || 'error open profile', raw: body };
    }
    if (!body.data || !body.data.profile_path) {
      return { ok: false, error: 'Response thieu data.profile_path', raw: body };
    }
    return { ok: true, data: body.data, raw: body };
  } catch (err) {
    return { ok: false, error: 'Khong goi duoc API: ' + err.message };
  }
}

/**
 * GET /closeProfile?uuid={uuid}
 *
 * Hidemium doi format response giua cac ban, nen chap nhan ca 3 dang:
 *   { "result": true }
 *   { "uuid": "...", "message": "Profile closed" }
 *   { "status": "successfully" }
 */
function isCloseSuccess(body) {
  if (!body || typeof body !== 'object') return false;
  if (body.result === true) return true;
  if (body.status === 'successfully') return true;
  if (typeof body.message === 'string' && /clos/i.test(body.message)) return true;
  return false;
}

async function closeProfile(uuid, { baseUrl = DEFAULT_BASE, timeout = 60000, signal } = {}) {
  const url = `${baseUrl}/closeProfile?uuid=${encodeURIComponent(uuid)}`;
  try {
    const res = await httpGetJson(url, { timeout, signal });
    if (!res.body) return { ok: false, error: 'Response khong phai JSON: ' + String(res.raw).slice(0, 200) };
    if (!isCloseSuccess(res.body)) {
      return { ok: false, error: 'closeProfile that bai: ' + JSON.stringify(res.body).slice(0, 200), raw: res.body };
    }
    return { ok: true, message: res.body.message || '', raw: res.body };
  } catch (err) {
    return { ok: false, error: 'Khong goi duoc API: ' + err.message };
  }
}

module.exports = {
  listBrowsers,
  openProfile,
  closeProfile,
  isCloseSuccess,
  httpGetJson,
  httpPostJson,
  DEFAULT_BASE,
};
