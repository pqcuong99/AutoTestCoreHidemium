/**
 * Localhost server cho recipes-config.html
 * Chay: npm run recipes:config
 * Mo:  http://127.0.0.1:5179/recipes-config.html
 *
 * GET  /api/config      — doc config tu recipes.js
 * POST /api/save-config — ghi de khoi // === BEGIN/END EDITABLE CONFIG ===
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const RECIPES_PATH = path.join(ROOT, 'recipes.js');
const PORT = 5179;
const BEGIN = '// === BEGIN EDITABLE CONFIG ===';
const END = '// === END EDITABLE CONFIG ===';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function setToArr(v) {
  if (!v) return [];
  if (v instanceof Set) return [...v];
  if (Array.isArray(v)) return v;
  return Object.keys(v);
}

function getConfig() {
  delete require.cache[require.resolve(RECIPES_PATH)];
  const mod = require(RECIPES_PATH);
  return {
    PAGES: mod.PAGES || {},
    PAGE_OF: mod.PAGE_OF || {},
    SECTION_OF: mod.SECTION_OF || {},
    FIELD_OVERRIDE: mod.FIELD_OVERRIDE || {},
    SKIP_CHECKS: setToArr(mod.SKIP_CHECKS),
    WEBGL_PAGE_IDS: setToArr(mod.WEBGL_PAGE_IDS),
    WEBGPU_PAGE_LIMITS: setToArr(mod.WEBGPU_PAGE_LIMITS),
    WEBGPU_PAGE_INFO: setToArr(mod.WEBGPU_PAGE_INFO),
    WEBGL_PARAM_ID: mod.WEBGL_PARAM_ID || {},
    JS_BATTERY_IDS: setToArr(mod.JS_BATTERY_IDS),
    JS_NETWORK_IDS: setToArr(mod.JS_NETWORK_IDS),
  };
}

function jsString(s) {
  return JSON.stringify(s);
}

function toJsLiteral(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return jsString(value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return '[\n' + value.map((v) => padIn + toJsLiteral(v, indent + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length) return '{}';
    const body = keys
      .map((k) => {
        const keyCode = /^[A-Za-z_$][\w$]*$/.test(k) ? k : jsString(k);
        return padIn + keyCode + ': ' + toJsLiteral(value[k], indent + 1);
      })
      .join(',\n');
    return '{\n' + body + '\n' + pad + '}';
  }
  return jsString(String(value));
}

function toJsSet(arr) {
  const list = Array.isArray(arr) ? arr : [];
  if (!list.length) return 'new Set([])';
  return 'new Set(' + toJsLiteral(list, 0) + ')';
}

function buildEditableBlock(cfg) {
  return `${BEGIN}
// =============================================================================
// 1) PAGE URL — them page moi o day
// =============================================================================
const PAGES = ${toJsLiteral(cfg.PAGES || {}, 0)};

/** Check khong chay tren BrowserLeaks (font kho scrape; mac/desktop khong co tren web). */
const SKIP_CHECKS = ${toJsSet(cfg.SKIP_CHECKS)};

// =============================================================================
// 2) checkKey -> page (chi doi chuoi page)
// =============================================================================
const PAGE_OF = ${toJsLiteral(cfg.PAGE_OF || {}, 0)};

// =============================================================================
// 3) Section mac dinh (h3) cho by:'tableCell' — doi neu dung section khac tren web
// =============================================================================
const SECTION_OF = ${toJsLiteral(cfg.SECTION_OF || {}, 0)};

// =============================================================================
// 4) OVERRIDE theo configKey — xpath / css / sel / selMode / js / skip / match
//    Key = dung config key trong config.hidemium
// =============================================================================
const FIELD_OVERRIDE = ${toJsLiteral(cfg.FIELD_OVERRIDE || {}, 0)};

/** Config snake_case / typo -> id tren /webgl (null = khong co tren page) */
const WEBGL_PARAM_ID = ${toJsLiteral(cfg.WEBGL_PARAM_ID || {}, 0)};

/** Chi cac id that su co tren https://browserleaks.com/webgl (doi chieu view-source) */
const WEBGL_PAGE_IDS = ${toJsSet(cfg.WEBGL_PAGE_IDS)};

/** title= tren #gpu-limits (BrowserLeaks /webgpu) — doi chieu view-source */
const WEBGPU_PAGE_LIMITS = ${toJsSet(cfg.WEBGPU_PAGE_LIMITS)};

/** title= tren #gpu-info (Adapter Info) — doi chieu view-source */
const WEBGPU_PAGE_INFO = ${toJsSet(cfg.WEBGPU_PAGE_INFO)};

/** #js-* co tren /javascript cho battery + network */
const JS_BATTERY_IDS = ${toJsSet(cfg.JS_BATTERY_IDS)};
const JS_NETWORK_IDS = ${toJsSet(cfg.JS_NETWORK_IDS)};
${END}`;
}

function saveConfig(cfg) {
  const src = fs.readFileSync(RECIPES_PATH, 'utf8');
  const i0 = src.indexOf(BEGIN);
  const i1 = src.indexOf(END);
  if (i0 < 0 || i1 < 0 || i1 <= i0) {
    throw new Error('Khong tim thay marker BEGIN/END EDITABLE CONFIG trong recipes.js');
  }
  const before = src.slice(0, i0);
  const after = src.slice(i1 + END.length);
  const next = before + buildEditableBlock(cfg) + after;
  fs.writeFileSync(RECIPES_PATH, next, 'utf8');
  delete require.cache[require.resolve(RECIPES_PATH)];
  return getConfig();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  if (url.pathname === '/api/config' && req.method === 'GET') {
    try {
      return send(res, 200, JSON.stringify(getConfig(), null, 2), MIME['.json']);
    } catch (err) {
      return send(res, 500, JSON.stringify({ error: String(err.message || err) }), MIME['.json']);
    }
  }

  if (url.pathname === '/api/save-config' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const saved = saveConfig(body);
      return send(res, 200, JSON.stringify({ ok: true, config: saved }), MIME['.json']);
    } catch (err) {
      return send(res, 500, JSON.stringify({ error: String(err.message || err) }), MIME['.json']);
    }
  }

  if (url.pathname === '/api/preview-block' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      return send(res, 200, buildEditableBlock(body), 'text/plain; charset=utf-8');
    } catch (err) {
      return send(res, 500, String(err.message || err));
    }
  }

  let filePath = url.pathname === '/' ? '/recipes-config.html' : url.pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(ROOT, filePath);

  if (!abs.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.readFile(abs, (err, data) => {
    if (err) return send(res, 404, 'Not found: ' + filePath);
    const ext = path.extname(abs);
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[browserleaks-config] Port ${PORT} dang bi dung. Tat process cu hoac doi PORT.`);
  } else {
    console.error('[browserleaks-config]', err);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[browserleaks-config] Mo dung link nay:`);
  console.log(`  http://127.0.0.1:${PORT}/recipes-config.html`);
});
