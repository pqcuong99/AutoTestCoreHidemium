/**
 * Luu kich ban automation ra file JSON.
 * Windows: C:\Users\<user>\AppData\Roaming\auto-test-core-hidemium\scripts\<id>.json
 *
 * Moi kich ban mot file -> sua / xoa mot cai khong dung toi cai khac.
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let dirCache = null;

function scriptsDir() {
  if (!dirCache) {
    dirCache = path.join(app.getPath('userData'), 'scripts');
    fs.mkdirSync(dirCache, { recursive: true });
  }
  return dirCache;
}

const fileOf = (id) => path.join(scriptsDir(), `${id}.json`);

/** Id chi chua chu/so/gach -> khong the tro ra ngoai thu muc scripts. */
const safeId = (id) => (typeof id === 'string' && /^[a-z0-9-]+$/i.test(id) ? id : null);

function newId() {
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Danh sach rut gon de ve dashboard (khong doc ca do thi cho nhe). */
function list() {
  try {
    const files = fs.readdirSync(scriptsDir()).filter((f) => f.endsWith('.json'));
    const scripts = files
      .map((f) => {
        try {
          const s = JSON.parse(fs.readFileSync(path.join(scriptsDir(), f), 'utf8'));
          return {
            id: s.id,
            name: s.name || '(khong ten)',
            nodeCount: (s.nodes || []).length,
            updatedAt: s.updatedAt || 0,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { ok: true, scripts };
  } catch (err) {
    return { ok: false, error: err.message, scripts: [] };
  }
}

function get(id) {
  const safe = safeId(id);
  if (!safe) return { ok: false, error: 'Id khong hop le.' };
  try {
    return { ok: true, script: JSON.parse(fs.readFileSync(fileOf(safe), 'utf8')) };
  } catch (err) {
    return { ok: false, error: 'Khong doc duoc kich ban: ' + err.message };
  }
}

/** Khong co id -> tao moi. Co id -> ghi de. */
function save(script) {
  const id = safeId(script.id) || newId();
  const data = {
    id,
    name: script.name || 'Kich ban moi',
    nodes: script.nodes || [],
    edges: script.edges || [],
    updatedAt: Date.now(),
  };
  try {
    fs.writeFileSync(fileOf(id), JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, id, script: data };
  } catch (err) {
    return { ok: false, error: 'Khong ghi duoc kich ban: ' + err.message };
  }
}

function remove(id) {
  const safe = safeId(id);
  if (!safe) return { ok: false, error: 'Id khong hop le.' };
  try {
    fs.unlinkSync(fileOf(safe));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { list, get, save, remove, scriptsDir };
