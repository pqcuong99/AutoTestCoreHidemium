/**
 * BrowserScan — Brands / Platform UA / PlatformVersion / UaFullVersion.
 */
const { evaluateInPage } = require('./runtime');

const CFG = {
  chromeVersion: 'hidemium.chrome.version',
  uaVersion: 'hidemium.navigator.useragent.version_useragent',
  platform: 'hidemium.navigator.os.platform_os',
  platformVersion: 'hidemium.navigator.os.platforms_version',
  uaFullVersion: 'hidemium.navigator.useragent.fullversion',
  userAgent: 'hidemium.navigator.useragent.useragent',
};

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function equalText(actual, expected) {
  if (actual == null || expected == null) return null;
  return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

async function scrapeUserAgentDataInPage() {
  const normalize = (value) =>
    String(value || '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toLowerCase();

  function findValue(labels, marker) {
    const wanted = new Set(labels.map(normalize));
    let label = null;
    let shortest = Infinity;
    for (const element of document.querySelectorAll('body *')) {
      const text = normalize(element.textContent);
      if (!wanted.has(text)) continue;
      if ((element.textContent || '').length < shortest) {
        label = element;
        shortest = (element.textContent || '').length;
      }
    }
    if (!label) return '';

    const candidates = [];
    if (label.nextElementSibling) candidates.push(label.nextElementSibling);
    let parent = label.parentElement;
    for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
      for (const child of parent.children) {
        if (child !== label) candidates.push(child);
      }
    }

    let target = null;
    let value = '';
    for (const candidate of candidates) {
      const text = (candidate.innerText || candidate.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text || wanted.has(normalize(text)) || text.length > 500) continue;
      if (!target || text.length < value.length) {
        target = candidate;
        value = text;
      }
    }
    const selected = target || label.parentElement || label;
    selected.setAttribute(`data-autotest-bs-ua-${marker}`, '1');
    return value;
  }

  function normalizePlatform(value) {
    const text = String(value || '');
    if (/mac|macintosh/i.test(text)) return 'macOS';
    if (/windows/i.test(text)) return 'Windows';
    if (/android/i.test(text)) return 'Android';
    if (/iphone|ios/i.test(text)) return 'iOS';
    if (/ipad/i.test(text)) return 'iPadOS';
    if (/cros|chrome os/i.test(text)) return 'Chrome OS';
    if (/linux/i.test(text)) return 'Linux';
    return text.trim() || null;
  }

  const browserText = findValue(['Browser'], 'browser');
  const versionText = findValue(
    ['Browser Version', 'Version', 'Browser version (JavaScript)'],
    'version'
  );
  const osText = findValue(['OS', 'Operating System', 'Platform'], 'os');
  const javascriptText = findValue(
    ['JavaScript', 'Javascript', 'User Agent', 'UserAgent'],
    'useragent'
  );

  const userAgentFromDom = /Mozilla\/5\.0/i.test(javascriptText)
    ? javascriptText.match(/Mozilla\/5\.0[\s\S]*/i)?.[0]
    : null;
  const userAgent = userAgentFromDom || navigator.userAgent || null;

  let high = {};
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      high = await navigator.userAgentData.getHighEntropyValues([
        'uaFullVersion',
        'fullVersionList',
        'platform',
        'platformVersion',
        'model',
      ]);
    }
  } catch { /* ignore */ }

  const fullVersionList =
    high.fullVersionList ||
    navigator.userAgentData?.brands ||
    [];
  const chromeBrand = fullVersionList.find(
    (brand) => /google chrome|chrome/i.test(brand.brand) && !/chromium/i.test(brand.brand)
  );
  const browserVersion =
    String(versionText || browserText).match(/\d+(?:\.\d+)+/)?.[0] || null;
  const uaChromeVersion = userAgent?.match(/(?:Chrome|CriOS)\/([\d.]+)/i)?.[1] || null;
  const uaSafariVersion = userAgent?.match(/Version\/([\d.]+)/i)?.[1] || null;
  const uaFullVersion =
    high.uaFullVersion ||
    chromeBrand?.version ||
    browserVersion ||
    uaChromeVersion ||
    uaSafariVersion;

  const macVersion = userAgent
    ?.match(/Mac OS X\s+([\d_]+)/i)?.[1]
    ?.replace(/_/g, '.');
  const platformVersion =
    high.platformVersion ||
    String(osText).match(/\d+(?:[._]\d+)+/)?.[0]?.replace(/_/g, '.') ||
    macVersion ||
    null;

  return {
    chromeVersion: chromeBrand?.version || uaFullVersion || null,
    uaVersion: uaFullVersion || null,
    platform: normalizePlatform(high.platform || osText || userAgent),
    platformVersion,
    uaFullVersion: uaFullVersion || null,
    userAgent,
  };
}

function makeLines(definitions, scraped, configMap) {
  return definitions.map(({ label, field, config }) => {
    const actual = scraped[field];
    const expected = cfgStr(configMap, config);
    const pass = isDefault(expected)
      ? null
      : actual == null || actual === ''
        ? false
        : equalText(actual, expected);
    return {
      label,
      value: actual == null ? '' : String(actual),
      expected: isDefault(expected) ? 'default' : expected,
      pass,
    };
  });
}

function summarize(lines) {
  const judged = lines.filter((line) => line.pass === true || line.pass === false);
  const anyFail = judged.some((line) => line.pass === false);
  const allPass = judged.length > 0 && judged.every((line) => line.pass === true);
  return {
    lines,
    state: anyFail ? 'fail' : allPass ? 'pass' : 'skipped',
    pass: anyFail ? false : allPass ? true : null,
    value: lines.map((line) => `${line.label}\n${line.value}`).join('\n'),
  };
}

function paintUserAgentDataInPage(marks) {
  const styleId = 'autotest-browserscan-ua-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-bs-ua-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-ua-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-ua-na { background: rgba(148,163,184,.2) !important; }
    `;
    document.head.appendChild(style);
  }

  let count = 0;
  for (const mark of marks) {
    const element = document.querySelector(`[data-autotest-bs-ua-${mark.key}="1"]`);
    if (!element) continue;
    element.classList.remove('at-bs-ua-pass', 'at-bs-ua-fail', 'at-bs-ua-na');
    element.classList.add(
      mark.pass === true
        ? 'at-bs-ua-pass'
        : mark.pass === false
          ? 'at-bs-ua-fail'
          : 'at-bs-ua-na'
    );
    count++;
  }
  return count;
}

async function runUserAgentDataChecks(page, keys, configMap, ctx) {
  ctx.step('BrowserScan: select User-Agent Data elements...');
  const scraped = await evaluateInPage(page, scrapeUserAgentDataInPage);
  const definitions = {
    brands: [
      { label: 'chromeVersion', field: 'chromeVersion', config: CFG.chromeVersion },
      { label: 'uaVersion', field: 'uaVersion', config: CFG.uaVersion },
    ],
    platform_ua: [
      { label: 'platform', field: 'platform', config: CFG.platform },
    ],
    platform_version: [
      {
        label: 'platformVersion',
        field: 'platformVersion',
        config: CFG.platformVersion,
      },
    ],
    ua_full_version: [
      {
        label: 'uaFullVersion',
        field: 'uaFullVersion',
        config: CFG.uaFullVersion,
      },
      { label: 'userAgent', field: 'userAgent', config: CFG.userAgent },
    ],
  };
  const markerByKey = {
    brands: 'version',
    platform_ua: 'os',
    platform_version: 'os',
    ua_full_version: 'useragent',
  };

  const results = {};
  const marks = [];
  for (const key of keys) {
    const lines = makeLines(definitions[key], scraped, configMap);
    const result = summarize(lines);
    results[key] = result;
    marks.push({ key: markerByKey[key], pass: result.pass });
    ctx.step(
      `BrowserScan ${key}: ${result.state}`,
      result.pass === false ? 'err' : 'ok'
    );
  }
  const painted = await evaluateInPage(page, paintUserAgentDataInPage, marks);
  ctx.step(`BrowserScan User-Agent Data: highlight ${painted} element`);
  return results;
}

module.exports = {
  runUserAgentDataChecks,
  scrapeUserAgentDataInPage,
  CFG,
};
