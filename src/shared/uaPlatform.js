/**
 * Platform + browser version cat tu chuoi User-Agent.
 *
 * Platform: token dau trong ngoac — (iPhone; …) → iPhone (khop config.hidemium).
 * Version: Chrome/CriOS uu tien; Safari/iOS dung Version/ — khong lay AppleWebKit.
 */

function normalizeUaPlatform(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  // Apple: giu iPhone/iPad nhu config (khong gom thanh iOS)
  if (/iPhone/i.test(s)) return 'iPhone';
  if (/iPad/i.test(s)) return 'iPad';
  // Android truoc Linux
  if (/Android/i.test(s)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(s)) return 'macOS';
  if (/Windows/i.test(s)) return 'Windows';
  if (/CrOS/i.test(s)) return 'Chrome OS';
  if (/Linux/i.test(s)) return 'Linux';
  const known = s.match(/^(macOS|Windows|Linux|Android|Chrome OS|iPhone|iPad|iOS|iPadOS)\b/i);
  if (known) return known[1];
  return s.split(/[;\s]+/)[0] || null;
}

/** Lay platform tu UA day du (Mozilla/5.0 (...)). */
function platformFromUserAgent(ua) {
  if (!ua) return null;
  const text = String(ua).trim();
  if (!text) return null;
  const m = text.match(/\(([^)]+)\)/);
  if (m) {
    const inside = m[1].trim();
    const first = inside.split(';')[0].trim();
    if (/^iPhone$/i.test(first)) return 'iPhone';
    if (/^iPad$/i.test(first)) return 'iPad';
    return normalizeUaPlatform(inside);
  }
  return normalizeUaPlatform(text);
}

/**
 * Version trinh duyet tu UA / chuoi version.
 * - Chrome/Edge/CriOS: Chrome/x.x.x
 * - Safari / iOS spoof: Version/x.x.x (khong dung AppleWebKit/605…)
 */
function parseUaBrowserVersion(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (/^\d+(\.\d+){1,3}$/.test(s)) return s;

  const chrome = s.match(/(?:Chrome|CriOS|EdgA?|EdgiOS|Chromium)\/([\d.]+)/i);
  if (chrome) return chrome[1];

  const firefox = s.match(/Firefox\/([\d.]+)/i);
  if (firefox) return firefox[1];

  // Safari / iOS — Version/ dung truoc AppleWebKit
  const safari = s.match(/Version\/([\d.]+)/i);
  if (safari) return safari[1];

  return '';
}

/** @deprecated alias — dung parseUaBrowserVersion */
function parseChromeVersion(value) {
  return parseUaBrowserVersion(value);
}

module.exports = {
  normalizeUaPlatform,
  platformFromUserAgent,
  parseUaBrowserVersion,
  parseChromeVersion,
};
