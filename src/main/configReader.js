/**
 * Doc file config.hidemium trong profile_path -> decode -> parse thanh Map key/value.
 */
const fs = require('fs');
const path = require('path');
const { decodeContent } = require('./decode');
const { t } = require('../shared/i18n');

const CONFIG_FILE_NAME = 'config.hidemium';
const SO_KY_TU = 7;

/**
 * Parse noi dung plain text "key:value" (value co the chua dau ':').
 * @returns {Record<string,string>}
 */
function parseConfigText(text) {
  const map = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) {
      map[trimmed] = '';
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    map[key] = value;
  }
  return map;
}

/**
 * @param {string} profilePath duong dan tra ve tu openProfile
 * @returns {{ ok:boolean, file?:string, map?:object, text?:string, error?:string }}
 */
function readProfileConfig(profilePath) {
  if (!profilePath) return { ok: false, error: t('err.emptyPath') };

  const file = path.join(profilePath, CONFIG_FILE_NAME);
  if (!fs.existsSync(file)) {
    return { ok: false, error: t('err.noConfigFile') + ': ' + profilePath };
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const text = decodeContent(raw, SO_KY_TU);
    const map = parseConfigText(text);
    if (!Object.keys(map).length) {
      return { ok: false, error: t('err.decodeEmpty') + ' (' + SO_KY_TU + ')' };
    }
    return { ok: true, file, map, text };
  } catch (err) {
    return { ok: false, error: t('log.error', { error: err.message }) };
  }
}

module.exports = { readProfileConfig, parseConfigText, CONFIG_FILE_NAME, SO_KY_TU };
