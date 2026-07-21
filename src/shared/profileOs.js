/**
 * Chuan hoa / loc OS profile (dung chung main + renderer).
 * Khong depend platformPolicy — de load bang <script> o renderer.
 */
(function (root) {
  function normalizeOsId(id) {
    const raw = String(id || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (!raw) return '';
    if (raw === 'all') return 'all';
    if (/^(win|windows|win32|win64)$/.test(raw)) return 'windows';
    if (/^(mac|macos|macintosh|macintel|darwin|osx)$/.test(raw)) return 'macos';
    if (/^(ios|iphone|ipad)$/.test(raw)) return 'ios';
    if (/^android$/.test(raw)) return 'android';
    return raw;
  }

  /** OS tu Hidemium list/openProfile/config → windows|macos|ios|android|'' */
  function normalizeProfileOs(raw) {
    const s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (!s) return '';
    if (/win|windows|win32|win64/.test(s)) return 'windows';
    if (/mac|macos|macintosh|macintel|darwin|osx/.test(s)) return 'macos';
    if (/ios|iphone|ipad/.test(s)) return 'ios';
    if (/android/.test(s)) return 'android';
    return '';
  }

  /**
   * @param {string} [profileOs]
   * @param {string} [targetOs]
   * @param {{ requireKnown?: boolean }} [opts]
   *   requireKnown=true (runner sau khi biet OS): unknown → khong khop.
   *   requireKnown=false (UI list): unknown → van hien (API list thuong khong co os).
   */
  function profileMatchesTargetOs(profileOs, targetOs, opts) {
    const target = normalizeOsId(targetOs);
    if (!target || target === 'all') return true;
    const profile = normalizeProfileOs(profileOs);
    if (!profile) return !(opts && opts.requireKnown);
    return profile === target;
  }

  /** Lay OS tu config.hidemium map (sau open). */
  function osFromConfigMap(map) {
    if (!map || typeof map !== 'object') return '';
    const keys = [
      'hidemium.navigator.os.platform_os',
      'hidemium.navigator.useragent.platforms',
      'hidemium.navigator.userAgent',
      'hidemium.navigator.user_agent',
    ];
    for (const k of keys) {
      const n = normalizeProfileOs(map[k]);
      if (n) return n;
    }
    return '';
  }

  /** Trich os tu 1 object browser list (nhieu ten field). */
  function pickOsFromBrowser(b) {
    if (!b || typeof b !== 'object') return '';
    const nested = [b.fingerprint, b.browser, b.config, b.info, b.data];
    const candidates = [
      b.os,
      b.OS,
      b.os_name,
      b.osName,
      b.os_type,
      b.osType,
      b.platform,
      b.system,
      b.operating_system,
      b.operatingSystem,
    ];
    for (const n of nested) {
      if (!n || typeof n !== 'object') continue;
      candidates.push(n.os, n.OS, n.platform, n.system, n.os_name, n.osName);
    }
    for (const c of candidates) {
      const s = String(c == null ? '' : c).trim();
      if (s) return s;
    }
    return '';
  }

  const api = {
    normalizeOsId,
    normalizeProfileOs,
    profileMatchesTargetOs,
    osFromConfigMap,
    pickOsFromBrowser,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.ProfileOs = api;
})(typeof window !== 'undefined' ? window : globalThis);
