/**
 * Platform policy theo OS (+ browser) can test.
 *
 * Dung: resolve(store.targetOs, browserId) → policy gom skip OS + skip browser
 * Them OS: tao file <os>.js + dang ky trong POLICIES.
 * Them browser: khai bao `browsers: { safari: { skipChecks: [...] } }` trong file OS.
 *
 * targetOs=all → khong loc list profile; luc run resolve policy theo OS that cua profile.
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
  normalizeBrowserId,
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

function mergeUnique(a, b) {
  return [...new Set([...(a || []), ...(b || [])])];
}

/**
 * @param {string} [os]
 * @param {string} [browser] — ten/id: Safari, chrome, "Chrome 136", …
 * @returns {{
 *   id: string,
 *   label: string,
 *   supported: boolean,
 *   reason?: string,
 *   browser: string,
 *   skipChecks: Set<string>,
 *   skipConfigKeys: Set<string>,
 *   matchAliases: Record<string, string[]>,
 * }}
 */
function resolve(os, browser) {
  const id = normalizeOs(os);
  const base = POLICIES[id] || windows;
  const browserId = normalizeBrowserId(browser);
  // chromium (Default Hidemium) dung chung policy chrome neu co.
  const policyBrowserId = browserId === 'chromium' ? 'chrome' : browserId;
  const browserPolicy =
    (policyBrowserId &&
      base.browsers &&
      typeof base.browsers === 'object' &&
      base.browsers[policyBrowserId]) ||
    {};

  return {
    id: base.id,
    label: base.label || base.id,
    supported: !!base.supported,
    reason: base.reason || '',
    browser: browserId || '',
    skipChecks: new Set(mergeUnique(base.skipChecks, browserPolicy.skipChecks)),
    skipConfigKeys: new Set(mergeUnique(base.skipConfigKeys, browserPolicy.skipConfigKeys)),
    matchAliases: {
      ...(base.matchAliases || {}),
      ...(browserPolicy.matchAliases || {}),
    },
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
  normalizeBrowserId,
  resolve,
  isSupported,
};
