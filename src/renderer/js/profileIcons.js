/**
 * Logo profile theo browser / platform (icon tu Hidemium-Tools/dist/icons).
 * Stack: OS nen + browser goc + core version — giong Hidemium-Tools.
 */
window.ProfileIcons = (() => {
  const BROWSER_ICON_MAP = {
    chrome: 'icons/browser/icon_chrome.svg',
    chromium: 'icons/browser/icon_chromium.svg',
    firefox: 'icons/browser/icon_firefox.svg',
    opera: 'icons/browser/icon_Opera_.svg',
    operagx: 'icons/browser/icon_operagx.svg',
    safari: 'icons/browser/icon_Safari_.svg',
    brave: 'icons/browser/icon_Brave_.svg',
    edge: 'icons/browser/icon_Edge_.svg',
    yandex: 'icons/browser/icon_Yandex_.svg',
  };

  const OS_ICON_MAP = {
    win: 'icons/platform/win.svg',
    windows: 'icons/platform/win.svg',
    mac: 'icons/platform/macos.svg',
    macos: 'icons/platform/macos.svg',
    darwin: 'icons/platform/macos.svg',
    linux: 'icons/platform/linux.svg',
    android: 'icons/platform/android.svg',
    ios: 'icons/platform/ios.svg',
  };

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function iconUrl(relPath) {
    try {
      return new URL(relPath, window.location.href).href;
    } catch {
      return relPath;
    }
  }

  function getBrowserIconUrl(browser) {
    const key = normalizeKey(browser);
    // Chromium khac Chrome — check rieng, khong dung includes("chrome")
    if (key === 'chromium' || (key && key.includes('chromium'))) {
      return iconUrl(BROWSER_ICON_MAP.chromium);
    }
    if (!key) return iconUrl(BROWSER_ICON_MAP.chrome);
    if (BROWSER_ICON_MAP[key]) return iconUrl(BROWSER_ICON_MAP[key]);

    // Uu tien ten dai hon: operagx truoc opera
    const names = Object.keys(BROWSER_ICON_MAP)
      .filter((n) => n !== 'chrome' && n !== 'chromium')
      .sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (key.includes(name)) return iconUrl(BROWSER_ICON_MAP[name]);
    }
    if (key.includes('chrome')) return iconUrl(BROWSER_ICON_MAP.chrome);
    return iconUrl(BROWSER_ICON_MAP.chrome);
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  function getOsIconUrl(os) {
    const key = normalizeKey(os);
    const dark = isDarkTheme();
    let rel = OS_ICON_MAP.windows;

    if (key && OS_ICON_MAP[key]) rel = OS_ICON_MAP[key];
    else if (key.includes('win')) rel = OS_ICON_MAP.win;
    else if (key.includes('mac') || key.includes('darwin') || key.includes('osx')) {
      rel = OS_ICON_MAP.macos;
    } else if (key === 'lin' || key.includes('linux')) {
      rel = OS_ICON_MAP.linux;
    } else if (key.includes('android')) rel = OS_ICON_MAP.android;
    else if (key.includes('ios')) rel = OS_ICON_MAP.ios;

    // Dark theme: logo tao / linux dung ban fill trang (khong invert ca anh)
    if (dark) {
      if (rel.endsWith('ios.svg')) rel = 'icons/platform/ios-white.svg';
      if (rel.endsWith('linux.svg')) rel = 'icons/platform/linux-white.svg';
    }

    return iconUrl(rel);
  }

  function formatVersionLabel(version) {
    const raw = String(version || '').trim();
    if (!raw) return '';
    const major = raw.split('.')[0];
    if (/^\d{2,3}$/.test(major)) return major;
    const match = raw.match(/\b(\d{2,3})\b/);
    return match ? match[1] : '';
  }

  function buildTooltip({ os = '', browser = '', coreVersion = '' } = {}) {
    const lines = [];
    if (os) lines.push(`OS: ${os}`);
    if (browser) lines.push(`Browser: ${browser}`);
    const core = String(coreVersion || '').trim();
    if (core) lines.push(`Core: ${core}`);
    return lines.join('\n');
  }

  function platformKind(os) {
    const key = normalizeKey(os);
    if (!key) return 'windows';
    if (key.includes('win')) return 'windows';
    if (key.includes('mac') || key.includes('darwin') || key.includes('osx')) return 'macos';
    if (key === 'lin' || key.includes('linux')) return 'linux';
    if (key.includes('android')) return 'android';
    if (key.includes('ios')) return 'ios';
    return key;
  }

  function buildStackHtml({ browser = '', os = '', coreVersion = '' } = {}) {
    const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s);
    const browserIcon = getBrowserIconUrl(browser);
    const osIcon = getOsIconUrl(os);
    const osKind = platformKind(os);
    const versionLabel = formatVersionLabel(coreVersion);
    const title = buildTooltip({ os, browser, coreVersion });

    return `
      <div class="profile-icon-stack" title="${esc(title)}" data-browser="${esc(browser || '')}" data-os="${esc(os || '')}">
        <img class="profile-icon-platform" data-platform="${esc(osKind)}" src="${esc(osIcon)}" alt="${esc(os || 'OS')}" loading="lazy" />
        <img class="profile-icon-browser" src="${esc(browserIcon)}" alt="${esc(browser || 'Browser')}" loading="lazy" />
        ${versionLabel ? `<span class="profile-icon-version">${esc(versionLabel)}</span>` : ''}
      </div>
    `;
  }

  return {
    getBrowserIconUrl,
    getOsIconUrl,
    formatVersionLabel,
    buildStackHtml,
  };
})();
