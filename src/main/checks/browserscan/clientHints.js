/**
 * BrowserScan Client Hints — Model / FullVersionList / FormFactors.
 */
const { BROWSERSCAN_CLIENT_HINTS_URL } = require('./urls');
const { evaluateInPage } = require('./runtime');

const CFG = {
  model: 'hidemium.navigator.useragent.model',
  fullVersion: 'hidemium.navigator.useragent.fullversion',
  chromeVersion: 'hidemium.chrome.version',
  isMobile: 'hidemium.navigator.is_mobile',
  isTablet: 'hidemium.navigator.is_tablet',
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

async function scrapeClientHintsInPage() {
  const normalize = (value) =>
    String(value || '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toLowerCase();

  function selectValue(labels, marker) {
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
      if (!text || wanted.has(normalize(text)) || text.length > 1000) continue;
      if (!target || text.length < value.length) {
        target = candidate;
        value = text;
      }
    }
    const selected = target || label.parentElement || label;
    selected.setAttribute(`data-autotest-bs-ch-${marker}`, '1');
    return value;
  }

  function cleanHint(value) {
    const text = String(value || '').trim();
    if (!text || /not received|unsupported|undefined|null/i.test(text)) return null;
    return text.replace(/^["']|["']$/g, '').trim() || null;
  }

  const modelText = selectValue(['sec-ch-ua-model'], 'model');
  const fullListText = selectValue(
    ['sec-ch-ua-full-version-list', 'sec-ch-ua-full-version'],
    'fullversion'
  );
  const mobileText = selectValue(['sec-ch-ua-mobile'], 'mobile');
  const formFactorsText = selectValue(
    ['sec-ch-ua-form-factors'],
    'formfactors'
  );

  let high = {};
  let formFactors = [];
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      high = await navigator.userAgentData.getHighEntropyValues([
        'model',
        'uaFullVersion',
        'fullVersionList',
      ]);
      try {
        const factors = await navigator.userAgentData.getHighEntropyValues([
          'formFactors',
        ]);
        formFactors = Array.isArray(factors.formFactors)
          ? factors.formFactors
          : [];
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  const fullList = high.fullVersionList || [];
  const chromeBrand = fullList.find(
    (brand) =>
      /google chrome|chrome/i.test(brand.brand) &&
      !/chromium/i.test(brand.brand)
  );
  const fullListChrome = String(fullListText).match(
    /(?:Google Chrome|Chrome)["']?\s*;\s*v\s*=\s*["']([\d.]+)/i
  )?.[1];
  const anyFullVersion = String(fullListText).match(/\d+(?:\.\d+)+/)?.[0];
  const chromeVersion =
    fullListChrome ||
    chromeBrand?.version ||
    high.uaFullVersion ||
    anyFullVersion ||
    null;

  const model = cleanHint(modelText) || cleanHint(high.model);
  const factorText = [
    ...formFactors,
    cleanHint(formFactorsText),
  ].filter(Boolean).join(' ');
  const mobileRaw = cleanHint(mobileText);
  const isMobile =
    mobileRaw != null
      ? /\?1|\btrue\b|\bmobile\b/i.test(mobileRaw)
      : navigator.userAgentData?.mobile ?? /Mobile|Android|iPhone/i.test(navigator.userAgent);
  const isTablet =
    /\btablet\b|\bipad\b/i.test(factorText) ||
    /iPad/i.test(navigator.userAgent);

  return {
    model,
    fullVersion: chromeVersion,
    chromeVersion,
    isMobile: !!isMobile,
    isTablet: !!isTablet,
  };
}

function makeLine(label, actual, expected) {
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

function paintClientHintsInPage(marks) {
  const styleId = 'autotest-browserscan-ch-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-bs-ch-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-ch-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-ch-na { background: rgba(148,163,184,.2) !important; }
    `;
    document.head.appendChild(style);
  }

  let count = 0;
  for (const mark of marks) {
    for (const key of mark.keys) {
      const element = document.querySelector(`[data-autotest-bs-ch-${key}="1"]`);
      if (!element) continue;
      element.classList.remove('at-bs-ch-pass', 'at-bs-ch-fail', 'at-bs-ch-na');
      element.classList.add(
        mark.pass === true
          ? 'at-bs-ch-pass'
          : mark.pass === false
            ? 'at-bs-ch-fail'
            : 'at-bs-ch-na'
      );
      count++;
    }
  }
  return count;
}

async function getClientHintsPage(mainPage, ctx) {
  const context = mainPage.context();
  const matches = context.pages().filter(
    (candidate) =>
      !candidate.isClosed() &&
      (candidate.url() || '').toLowerCase().startsWith(
        BROWSERSCAN_CLIENT_HINTS_URL.toLowerCase()
      )
  );
  const page = matches[matches.length - 1] || await context.newPage();
  for (const extra of matches.slice(0, -1)) {
    await extra.close({ runBeforeUnload: false }).catch(() => {});
  }
  if (!(page.url() || '').toLowerCase().startsWith(
    BROWSERSCAN_CLIENT_HINTS_URL.toLowerCase()
  )) {
    ctx.step(`BrowserScan Client Hints: goto ${BROWSERSCAN_CLIENT_HINTS_URL}`);
    await page.goto(BROWSERSCAN_CLIENT_HINTS_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
  } else {
    ctx.step('BrowserScan Client Hints: dung lai tab da mo');
  }
  return page;
}

async function runClientHintsChecks(mainPage, keys, configMap, ctx) {
  const page = await getClientHintsPage(mainPage, ctx);
  ctx.step('BrowserScan Client Hints: select elements...');
  const scraped = await evaluateInPage(page, scrapeClientHintsInPage);
  const results = {};
  const marks = [];

  for (const key of keys) {
    let lines;
    let markerKeys;
    if (key === 'model') {
      lines = [
        makeLine('model', scraped.model, cfgStr(configMap, CFG.model)),
      ];
      markerKeys = ['model'];
    } else if (key === 'full_version_list') {
      lines = [
        makeLine(
          'fullVersion',
          scraped.fullVersion,
          cfgStr(configMap, CFG.fullVersion)
        ),
        makeLine(
          'chromeVersion',
          scraped.chromeVersion,
          cfgStr(configMap, CFG.chromeVersion)
        ),
      ];
      markerKeys = ['fullversion'];
    } else {
      lines = [
        makeLine(
          'isMobile',
          scraped.isMobile,
          cfgStr(configMap, CFG.isMobile)
        ),
        makeLine(
          'isTablet',
          scraped.isTablet,
          cfgStr(configMap, CFG.isTablet)
        ),
      ];
      markerKeys = ['mobile', 'formfactors'];
    }
    const result = summarize(lines);
    results[key] = result;
    marks.push({ keys: markerKeys, pass: result.pass });
    ctx.step(
      `BrowserScan Client Hints ${key}: ${result.state}`,
      result.pass === false ? 'err' : 'ok'
    );
  }

  const painted = await evaluateInPage(page, paintClientHintsInPage, marks);
  ctx.step(`BrowserScan Client Hints: highlight ${painted} element`);
  return results;
}

module.exports = {
  runClientHintsChecks,
  scrapeClientHintsInPage,
  CFG,
};
