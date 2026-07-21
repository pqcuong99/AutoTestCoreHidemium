/**
 * Doc Navigator tu Fingerprint + DOM + navigator API.
 * Self-contained — dung trong page.evaluate (khong import helper ngoai).
 */
function scrapeNavigatorDataInPage() {
  function parseChromeVersionFromBrands(brands) {
    for (const b of brands || []) {
      const s = String(b);
      if (!/chrome/i.test(s) || /chromium/i.test(s)) continue;
      const m = s.match(/Chrome\s+([\d.]+)/i) || s.match(/Chrome[;\s]+([\d.]+)/i);
      if (m) return m[1];
    }
    return null;
  }

  function normalizeUaPlatform(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    const known = s.match(/^(macOS|Windows|Linux|Android|Chrome OS|iOS|iPadOS)\b/i);
    if (known) return known[1];
    if (/Macintosh|Mac OS X/i.test(s)) return 'macOS';
    if (/Windows/i.test(s)) return 'Windows';
    if (/Android/i.test(s)) return 'Android';
    if (/iPhone|iPad/i.test(s)) return /iPad/i.test(s) ? 'iPadOS' : 'iOS';
    if (/CrOS/i.test(s)) return 'Chrome OS';
    if (/Linux/i.test(s)) return 'Linux';
    return s.split(/\s+/)[0] || null;
  }

  /** Platform (UA) tu chuoi User-Agent — vd (Macintosh; Intel Mac OS X 10_15_7). */
  function parsePlatformFromUserAgent(ua) {
    if (!ua) return { platform: null, needle: null };
    const m = ua.match(/\(([^)]+)\)/);
    if (!m) {
      const platform = normalizeUaPlatform(ua);
      return { platform, needle: platform };
    }
    const raw = m[1].trim();
    const platform = normalizeUaPlatform(raw);
    const needle = raw.split(';')[0].trim() || platform;
    return { platform, needle };
  }

  function extractUserAgentFromDom(text) {
    const block = text.match(/userAgent:(?:[\s\S]*?ua reduction[\s\S]*?)?\n\s*(Mozilla\/[^\n]+)/i);
    return block ? block[1].trim() : null;
  }

  function applyUaPlatform(raw, needle) {
    if (raw == null || raw === '') return false;
    uaPlatformRaw = String(raw);
    uaPlatform = normalizeUaPlatform(uaPlatformRaw);
    uaPlatformNeedle = needle || uaPlatformRaw.split(';')[0].trim() || uaPlatform;
    return !!uaPlatform;
  }

  const nav = window.Fingerprint && window.Fingerprint.navigator;
  const ws = window.Fingerprint && window.Fingerprint.workerScope;
  const root = document.getElementById('fingerprint-data') || document.body;
  const text = root ? root.innerText || '' : '';

  const pickNum = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  let hardwareConcurrency = pickNum(nav && nav.hardwareConcurrency);
  let deviceMemory = pickNum(nav && nav.deviceMemory);
  let maxTouchPoints = pickNum(nav && nav.maxTouchPoints);
  let navigatorPlatform = nav && nav.platform != null ? String(nav.platform) : null;

  const uad = (nav && nav.userAgentData) || {};
  let uaPlatformRaw = null;
  let uaPlatform = null;
  let uaPlatformNeedle = null;
  let platformVersion = uad.platformVersion != null ? String(uad.platformVersion) : null;
  let uaFullVersion = uad.uaFullVersion != null ? String(uad.uaFullVersion) : null;
  let model = uad.model != null && String(uad.model).trim() !== '' ? String(uad.model).trim() : null;
  let uaVersion = uaFullVersion;
  let chromeVersion = parseChromeVersionFromBrands(uad.brandsVersion || uad.brands);
  let userAgent = (nav && nav.userAgent) || null;

  // 1) userAgentData.platform
  if (uad.platform != null) {
    applyUaPlatform(uad.platform, String(uad.platform));
  }

  try {
    if (hardwareConcurrency == null) hardwareConcurrency = pickNum(navigator.hardwareConcurrency);
    if (deviceMemory == null) deviceMemory = pickNum(navigator.deviceMemory);
    if (maxTouchPoints == null) maxTouchPoints = pickNum(navigator.maxTouchPoints);
    if (!navigatorPlatform && navigator.platform) navigatorPlatform = navigator.platform;
    if (!uaPlatform && navigator.userAgentData && navigator.userAgentData.platform) {
      applyUaPlatform(navigator.userAgentData.platform, navigator.userAgentData.platform);
    }
    if (!chromeVersion && navigator.userAgentData && navigator.userAgentData.brands) {
      chromeVersion = parseChromeVersionFromBrands(
        navigator.userAgentData.brands.map((b) => `${b.brand} ${b.version}`)
      );
    }
    if (!platformVersion && navigator.userAgentData && navigator.userAgentData.platformVersion) {
      platformVersion = String(navigator.userAgentData.platformVersion);
    }
    if (!uaFullVersion && navigator.userAgentData && navigator.userAgentData.uaFullVersion) {
      uaFullVersion = String(navigator.userAgentData.uaFullVersion);
    }
    if (!model && navigator.userAgentData && navigator.userAgentData.model) {
      const m = String(navigator.userAgentData.model).trim();
      if (m) model = m;
    }
    if (!userAgent) userAgent = navigator.userAgent || null;
  } catch { /* ignore */ }

  if (hardwareConcurrency == null && ws) hardwareConcurrency = pickNum(ws.hardwareConcurrency);
  if (deviceMemory == null && ws) deviceMemory = pickNum(ws.deviceMemory);

  if (!navigatorPlatform) {
    const m = text.match(/\((MacIntel|Win32|Linux[^)]*|iPhone|iPad|Android[^)]*)\)/i);
    if (m) navigatorPlatform = m[1].trim();
  }

  const coresM = text.match(/cores:\s*([\d.]+)/i);
  const ramM = text.match(/ram:\s*([\d.]+)/i);
  const touchM = text.match(/touch:\s*([\d.]+)/i);
  if (coresM) hardwareConcurrency = hardwareConcurrency ?? Number(coresM[1]);
  if (ramM) deviceMemory = deviceMemory ?? Number(ramM[1]);
  if (touchM) maxTouchPoints = maxTouchPoints ?? Number(touchM[1]);

  const uadBlock = text.match(/userAgentData:\s*([\s\S]{0,600}?)(?:\n\s*\n|device:|ua parsed:)/i);
  if (uadBlock) {
    const block = uadBlock[1].replace(/\s+/g, ' ').trim();
    if (!/unsupported/i.test(block)) {
      if (!chromeVersion) {
        chromeVersion = parseChromeVersionFromBrands(block.split(','));
        if (!chromeVersion) {
          const m = block.match(/Chrome\s+([\d.]+)/i);
          if (m) chromeVersion = m[1];
        }
      }
      if (!uaFullVersion) {
        const full = block.match(/\(([\d.]+)\)/);
        if (full) uaFullVersion = full[1];
      }
      if (!platformVersion) {
        const pv = block.match(
          /\b(?:macOS|Windows|Linux|Android|Chrome OS|iOS|iPadOS)\s+([\d._]+)/i
        );
        if (pv) platformVersion = pv[1];
      }
      if (!uaPlatform) {
        const pm = block.match(/\b(macOS|Windows|Linux|Android|Chrome OS|iOS|iPadOS)(?:\s+[\d._]+)?/i);
        if (pm) applyUaPlatform(pm[0].trim(), pm[0].trim());
      }
      if (!model) {
        const afterArch = block.match(
          /\b(?:macOS|Windows|Linux|Android|Chrome OS|iOS|iPadOS)\s+[\d._]+\s+(?:arm|x86)[_\d]*\s+(\S+)/i
        );
        if (afterArch) model = afterArch[1];
      }
    }
  }

  const uaCandidates = [
    userAgent,
    nav && nav.userAgent,
    (() => {
      try {
        return navigator.userAgent;
      } catch {
        return null;
      }
    })(),
    extractUserAgentFromDom(text),
  ].filter(Boolean);
  userAgent = uaCandidates[0] || null;

  if (!uaPlatform) {
    for (const ua of uaCandidates) {
      const parsed = parsePlatformFromUserAgent(ua);
      if (parsed.platform) {
        uaPlatform = parsed.platform;
        uaPlatformNeedle = parsed.needle;
        uaPlatformRaw = parsed.needle;
        break;
      }
    }
  }

  const uaText = userAgent || '';
  if (!uaFullVersion && uaText) {
    const safariV = uaText.match(/Version\/([\d.]+)/i);
    const chromeV = uaText.match(/Chrome\/([\d.]+)/i);
    if (safariV) uaFullVersion = safariV[1];
    else if (chromeV) uaFullVersion = chromeV[1];
  }
  if (!uaVersion) uaVersion = uaFullVersion;
  const chromeUa = uaText.match(/Chrome\/([\d.]+)/i);
  if (chromeUa) {
    if (!uaVersion) uaVersion = chromeUa[1];
    if (!chromeVersion) chromeVersion = chromeUa[1];
  }
  if (!chromeVersion && uaVersion) chromeVersion = uaVersion;
  if (!uaVersion && chromeVersion) uaVersion = chromeVersion;
  if (!uaFullVersion && uaVersion) uaFullVersion = uaVersion;

  let isMobile = uad.mobile != null ? !!uad.mobile : null;
  let isTablet = null;
  try {
    if (isMobile == null && navigator.userAgentData) {
      isMobile = !!navigator.userAgentData.mobile;
    }
  } catch { /* ignore */ }
  if (uadBlock && isMobile == null && !/unsupported/i.test(uadBlock[1])) {
    isMobile = /\bmobile\b/i.test(uadBlock[1].replace(/\s+/g, ' '));
  }
  if (isMobile == null) isMobile = false;

  if (/iPad/i.test(uaText) || uaPlatform === 'iPadOS') {
    isTablet = true;
  } else {
    isTablet = false;
  }

  return {
    hardwareConcurrency,
    deviceMemory,
    maxTouchPoints,
    navigatorPlatform,
    uaPlatform,
    uaPlatformNeedle,
    platformVersion,
    uaFullVersion,
    userAgent,
    model,
    isMobile,
    isTablet,
    chromeVersion,
    uaVersion,
  };
}

module.exports = { scrapeNavigatorDataInPage };
