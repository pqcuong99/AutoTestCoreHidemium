/**
 * Platform policy theo OS can test.
 *
 * Dung: resolve(store.targetOs) → policy { id, supported, skipChecks, skipConfigKeys, matchAliases }
 * Them OS: tao file <os>.js + dang ky trong POLICIES.
 *
 * targetOs=all → khong loc list profile; policy skip rong.
 */
const all = require('./all');
const windows = require('./windows');
const macos = require('./macos');
const linux = require('./linux');
const ios = require('./ios');
const android = require('./android');
const {
  normalizeOsId,
  normalizeProfileOs,
  profileMatchesTargetOs,
  osFromConfigMap,
  pickOsFromBrowser,
} = require('../profileOs');

/** @type {Record<string, object>} */
const POLICIES = {
  all,
  windows,
  win: windows,
  win32: windows,
  macos,
  mac: macos,
  darwin: macos,
  linux,
  lin: linux,
  ubuntu: linux,
  ios,
  iphone: ios,
  ipad: ios,
  android,
};

/** supported lay tu file policy (<os>.js). */
const OS_OPTIONS = [
  { id: 'all', labelKey: 'os.all' },
  { id: 'windows', labelKey: 'os.windows' },
  { id: 'macos', labelKey: 'os.macos' },
  { id: 'linux', labelKey: 'os.linux' },
  { id: 'ios', labelKey: 'os.ios' },
  { id: 'android', labelKey: 'os.android' },
].map((o) => ({
  ...o,
  supported: !!(POLICIES[o.id] && POLICIES[o.id].supported),
}));

const DEFAULT_OS = 'windows';

function normalizeOs(id) {
  const raw = normalizeOsId(id);
  if (!raw) return DEFAULT_OS;
  if (POLICIES[raw]) return POLICIES[raw].id;
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
  normalizeProfileOs,
  profileMatchesTargetOs,
  osFromConfigMap,
  pickOsFromBrowser,
  resolve,
  isSupported,
};
