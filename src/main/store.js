/**
 * Store: luu cau hinh ra file JSON trong thu muc userData cua app.
 * Windows: C:\Users\<user>\AppData\Roaming\auto-test-core-hidemium\config.json
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { CHECK_KEYS } = require('../shared/checkItems');

const DEFAULTS = {
  sourceMode: 'cloud',    // tab dang chon: 'cloud' (is_local=false) | 'local' (is_local=true)
  threads: 5,             // so luong chay song song
  checks: CHECK_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {}),
  selectedUuids: [],      // cac uuid da tick lan truoc
  apiBase: 'http://127.0.0.1:2222',  // Local API cua Hidemium
  autoClose: false,       // tu goi /closeProfile sau khi check xong
  testWaitMs: 10000,      // che do Test luong: giu profile mo bao lau truoc khi dong
  locale: 'vi',           // 'vi' | 'en'
  targetOs: 'windows',    // OS can test: windows | macos | ios | android
};

let cachePath = null;
let cache = null;

function configFile() {
  if (!cachePath) cachePath = path.join(app.getPath('userData'), 'config.json');
  return cachePath;
}

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(configFile(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = {
      ...DEFAULTS,
      ...parsed,
      checks: { ...DEFAULTS.checks, ...(parsed.checks || {}) },
    };
  } catch {
    cache = { ...DEFAULTS, checks: { ...DEFAULTS.checks } };
  }
  return cache;
}

function save(patch) {
  const next = { ...load(), ...patch };
  if (patch && patch.checks) next.checks = { ...load().checks, ...patch.checks };
  cache = next;
  try {
    fs.mkdirSync(path.dirname(configFile()), { recursive: true });
    fs.writeFileSync(configFile(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('[store] khong ghi duoc config:', err.message);
  }
  return cache;
}

function get(key) {
  return load()[key];
}

function set(key, value) {
  return save({ [key]: value });
}

module.exports = { load, save, get, set, DEFAULTS, configFile };
