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
    if (/^(linux|lin|ubuntu|debian|fedora|centos|x11)$/.test(raw)) return 'linux';
    if (/^(ios|iphone|ipad)$/.test(raw)) return 'ios';
    if (/^android$/.test(raw)) return 'android';
    return raw;
  }

  /** OS tu Hidemium list/openProfile/config → windows|macos|linux|ios|android|'' */
  function normalizeProfileOs(raw) {
    const s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    if (!s) return '';
    if (/win|windows|win32|win64/.test(s)) return 'windows';
    if (/mac|macos|macintosh|macintel|darwin|osx/.test(s)) return 'macos';
    // Hidemium list thuong tra "lin" (khong phai "linux").
    if (s === 'lin' || /linux|ubuntu|debian|fedora|centos|x11/.test(s)) return 'linux';
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
    // Dong bo voi osDisplayLabel: profileOs truoc, fallback normalizeOsId (vd "lin").
    const profile = normalizeProfileOs(profileOs) || normalizeOsId(profileOs);
    if (!profile || profile === 'all') return !(opts && opts.requireKnown);
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
    const nested = [b.fingerprint, b.config, b.info, b.data];
    if (b.browser && typeof b.browser === 'object') nested.push(b.browser);
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

  /**
   * Id browser cho policy: safari | chrome | edge | opera_gx | …
   * Dung ghep platformPolicy.browsers[id].
   */
  function normalizeBrowserId(raw) {
    const s = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ');
    if (!s) return '';
    if (/safari/.test(s)) return 'safari';
    if (/edg(e)?/.test(s)) return 'edge';
    if (/brave/.test(s)) return 'brave';
    // Opera GX truoc Opera thuong (opera gx / operagx / opera_gx).
    if (/opera\s*gx|operagx/.test(s)) return 'opera_gx';
    if (/opera|opr/.test(s)) return 'opera';
    if (/yandex/.test(s)) return 'yandex';
    if (/firefox|fx/.test(s)) return 'firefox';
    // Default (Hidemium) = Chromium engine — id rieng, khong map thanh chrome.
    if (/^default$/.test(s) || /chromium/.test(s)) return 'chromium';
    if (/chrome|hidemium/.test(s)) return 'chrome';
    if (
      /^(chrome|chromium|safari|edge|brave|opera|opera_gx|yandex|firefox)$/.test(
        s.replace(/\s+/g, '_')
      )
    ) {
      return s.replace(/\s+/g, '_');
    }
    return '';
  }

  /** Chuan hoa ten browser: chrome -> Chrome, default/chromium -> Chromium. */
  function normalizeBrowserName(raw) {
    const id = normalizeBrowserId(raw);
    if (id === 'chromium') return 'Chromium';
    if (id === 'chrome') return 'Chrome';
    if (id === 'edge') return 'Edge';
    if (id === 'brave') return 'Brave';
    if (id === 'opera_gx') return 'Opera GX';
    if (id === 'opera') return 'Opera';
    if (id === 'yandex') return 'Yandex';
    if (id === 'firefox') return 'Firefox';
    if (id === 'safari') return 'Safari';
    const s = String(raw || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Trich browser tu object list/openProfile. */
  function pickBrowserFromBrowser(b) {
    if (!b || typeof b !== 'object') return '';
    const nested = [b.fingerprint, b.config, b.info, b.data];
    if (b.browser && typeof b.browser === 'object') nested.push(b.browser);
    const candidates = [
      typeof b.browser === 'string' ? b.browser : '',
      b.browser_type,
      b.browserType,
      b.browser_name,
      b.browserName,
      b.browser_soft,
      b.soft,
    ];
    for (const n of nested) {
      if (!n || typeof n !== 'object') continue;
      candidates.push(
        typeof n.browser === 'string' ? n.browser : '',
        n.browser_type,
        n.browserType,
        n.browser_name,
        n.browserName
      );
    }
    for (const c of candidates) {
      const name = normalizeBrowserName(c);
      if (name) return name;
    }
    return '';
  }

  /** Version browser tu list/open (neu co). */
  function pickBrowserVersion(b) {
    if (!b || typeof b !== 'object') return '';
    const nested = [b.fingerprint, b.config, b.info, b.data];
    if (b.browser && typeof b.browser === 'object') nested.push(b.browser);
    const candidates = [
      b.version,
      b.browser_version,
      b.browserVersion,
      b.chrome_version,
      b.chromeVersion,
    ];
    for (const n of nested) {
      if (!n || typeof n !== 'object') continue;
      candidates.push(n.version, n.browser_version, n.browserVersion, n.chrome_version);
    }
    for (const c of candidates) {
      const s = String(c == null ? '' : c).trim();
      if (s && /^\d/.test(s)) return s;
    }
    return '';
  }

  /** Label hien thi: "Chrome 136" / "Chrome" / "". */
  function formatBrowserLabel(name, version) {
    const n = normalizeBrowserName(name) || (version ? 'Chrome' : '');
    const v = String(version || '').trim();
    if (!n) return '';
    if (v && !n.includes(v)) return n + ' ' + v;
    return n;
  }

  /** Browser + version tu config.hidemium (sau open). */
  function browserFromConfigMap(map) {
    if (!map || typeof map !== 'object') return '';
    const version =
      String(map['hidemium.chrome.version'] || map['hidemium.navigator.useragent.version_useragent'] || '')
        .trim() || '';
    // Nguon chinh: product_name (Chrome / Safari / Opera GX / …).
    const productName = String(map['hidemium.navigator.product_name'] || '').trim();
    const brands = String(map['hidemium.navigator.useragent.brands'] || '').toLowerCase();
    const ua = String(map['hidemium.navigator.useragent.useragent'] || '').toLowerCase();
    const soft = String(
      map['hidemium.browser'] ||
        map['hidemium.browser_type'] ||
        map['hidemium.browserType'] ||
        map['hidemium.soft'] ||
        ''
    ).toLowerCase();

    let name = normalizeBrowserName(productName);

    // Fallback khi thieu product_name: UA → soft/brands → chrome.version.
    if (!name && ua) {
      if (/edg\//.test(ua)) name = 'Edge';
      else if (/opr\/|opera/.test(ua) && /gx/.test(ua + soft)) name = 'Opera GX';
      else if (/opr\/|opera/.test(ua)) name = 'Opera';
      else if (/firefox\//.test(ua)) name = 'Firefox';
      else if (/brave/.test(ua)) name = 'Brave';
      else if (/chromium/.test(ua) && !/chrome\//.test(ua)) name = 'Chromium';
      else if (/chrome\/|crios\//.test(ua)) name = 'Chrome';
      else if (/safari\//.test(ua) && !/chrome|chromium|crios/.test(ua)) name = 'Safari';
    }
    if (!name) {
      if (/safari/.test(soft) || (/safari/.test(brands) && !/chrom/.test(brands))) name = 'Safari';
      else if (/edge/.test(soft) || /edge/.test(brands)) name = 'Edge';
      else if (/brave/.test(soft) || /brave/.test(brands)) name = 'Brave';
      else if (/opera\s*gx|operagx/.test(soft) || /opera\s*gx|operagx/.test(brands))
        name = 'Opera GX';
      else if (/opera/.test(soft) || /opera/.test(brands)) name = 'Opera';
      else if (/firefox/.test(soft) || /firefox/.test(brands)) name = 'Firefox';
      else if (/chromium|hidemium|^default$/.test(soft) || /chromium/.test(brands))
        name = 'Chromium';
      else if (/chrome/.test(soft) || /chrome/.test(brands)) name = 'Chrome';
    }
    if (!name && version) name = 'Chrome';

    return formatBrowserLabel(name, version);
  }

  /** Label OS ngan cho UI. */
  function osDisplayLabel(raw) {
    const id = normalizeProfileOs(raw) || normalizeOsId(raw);
    const labels = {
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux',
      ios: 'iOS',
      android: 'Android',
    };
    if (labels[id]) return labels[id];
    const s = String(raw || '').trim();
    return s;
  }

  const api = {
    normalizeOsId,
    normalizeProfileOs,
    profileMatchesTargetOs,
    osFromConfigMap,
    pickOsFromBrowser,
    normalizeBrowserId,
    normalizeBrowserName,
    pickBrowserFromBrowser,
    pickBrowserVersion,
    formatBrowserLabel,
    browserFromConfigMap,
    osDisplayLabel,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.ProfileOs = api;
})(typeof window !== 'undefined' ? window : globalThis);
