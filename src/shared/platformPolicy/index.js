/**
 * Platform policy theo OS can test.
 *
 * Dung: resolve(store.targetOs) → policy { id, supported, skipChecks, skipConfigKeys, matchAliases }
 * Them OS: tao file <os>.js + dang ky trong POLICIES.
 */
const windows = require('./windows');
const macos = require('./macos');
const ios = require('./ios');
const android = require('./android');

/** @type {Record<string, object>} */
const POLICIES = {
  windows,
  win: windows,
  win32: windows,
  macos,
  mac: macos,
  darwin: macos,
  ios,
  iphone: ios,
  ipad: ios,
  android,
};

const OS_OPTIONS = [
  { id: 'windows', labelKey: 'os.windows', supported: true },
  { id: 'macos', labelKey: 'os.macos', supported: false },
  { id: 'ios', labelKey: 'os.ios', supported: false },
  { id: 'android', labelKey: 'os.android', supported: false },
];

const DEFAULT_OS = 'windows';

function normalizeOs(id) {
  const raw = String(id || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!raw) return DEFAULT_OS;
  if (POLICIES[raw]) {
    return POLICIES[raw].id;
  }
  return DEFAULT_OS;
}

/**
 * @param {string} [os]
 * @returns {{
 *   id: string,
 *   label: string,
 *   supported: boolean,
 *   reason?: string,
 *   skipChecks: Set<string>,
 *   skipConfigKeys: Set<string>,
 *   matchAliases: Record<string, string[]>,
 * }}
 */
function resolve(os) {
  const id = normalizeOs(os);
  const base = POLICIES[id] || windows;
  return {
    id: base.id,
    label: base.label || base.id,
    supported: !!base.supported,
    reason: base.reason || '',
    skipChecks: new Set(base.skipChecks || []),
    skipConfigKeys: new Set(base.skipConfigKeys || []),
    matchAliases: { ...(base.matchAliases || {}) },
  };
}

function isSupported(os) {
  return resolve(os).supported;
}

module.exports = {
  DEFAULT_OS,
  OS_OPTIONS,
  POLICIES,
  normalizeOs,
  resolve,
  isSupported,
};
