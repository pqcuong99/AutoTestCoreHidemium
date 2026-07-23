/**
 * BrowserScan — Navigator/Hardware checks.
 * Select element theo label, parse value, so sanh config va highlight.
 */
const { evaluateInPage } = require('./runtime');

const CFG = {
  platform: 'hidemium.navigator.useragent.platforms',
  hardwareConcurrency: 'hidemium.navigator.hardware_concurrency',
  deviceMemory: 'hidemium.navigator.device_memory',
  maxTouchPoints: 'hidemium.navigator.max_touch_point',
};

function cfgStr(map, key) {
  if (!(key in map) || map[key] == null || map[key] === '') return null;
  return String(map[key]).trim();
}

function isDefault(value) {
  return value == null || value === '' || /^default$/i.test(String(value).trim());
}

function equalValue(actual, expected, numeric) {
  if (actual == null || expected == null) return null;
  if (numeric) {
    const a = Number(actual);
    const e = Number(expected);
    if (Number.isFinite(a) && Number.isFinite(e)) return a === e;
  }
  return String(actual).trim().toLowerCase() === String(expected).trim().toLowerCase();
}

function scrapeNavigatorInPage() {
  const normalize = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/:$/, '')
      .trim()
      .toLowerCase();

  const aliases = {
    // Uu tien navigator.platform — tranh nham label "Platform" (UA/OS card).
    platform: ['navigator.platform'],
    hardwareConcurrency: [
      'hardware concurrency',
      'hardwareconcurrency',
      'cpu concurrency',
      'cpu cores',
      'logical processors',
    ],
    deviceMemory: ['device memory', 'devicememory', 'memory'],
    maxTouchPoints: [
      'max touch points',
      'maxtouchpoints',
      'touch points',
      'touch support',
    ],
  };

  function findLabel(names) {
    const wanted = new Set(names.map(normalize));
    let best = null;
    let bestLength = Infinity;
    for (const element of document.querySelectorAll('body *')) {
      const text = normalize(element.textContent);
      if (!wanted.has(text)) continue;
      const length = (element.textContent || '').length;
      if (length < bestLength) {
        best = element;
        bestLength = length;
      }
    }
    return best;
  }

  function valueNear(label) {
    if (!label) return { text: '', target: null };
    const labelText = normalize(label.textContent);
    const candidates = [];

    if (label.nextElementSibling) candidates.push(label.nextElementSibling);
    let parent = label.parentElement;
    for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
      for (const child of parent.children) {
        if (child !== label) candidates.push(child);
      }
      const whole = (parent.innerText || '').replace(/\s+/g, ' ').trim();
      const cleaned = whole
        .replace(new RegExp(`^${labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?`, 'i'), '')
        .trim();
      if (cleaned && normalize(cleaned) !== labelText) {
        candidates.push(parent);
      }
    }

    let best = null;
    let bestText = '';
    for (const candidate of candidates) {
      const text = (candidate.innerText || candidate.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text || normalize(text) === labelText || text.length > 250) continue;
      if (!best || text.length < bestText.length) {
        best = candidate;
        bestText = text;
      }
    }
    return { text: bestText, target: best || label.parentElement || label };
  }

  function numberFrom(text) {
    const match = String(text || '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  const native = {
    platform: navigator.platform || null,
    hardwareConcurrency:
      Number.isFinite(Number(navigator.hardwareConcurrency))
        ? Number(navigator.hardwareConcurrency)
        : null,
    deviceMemory:
      Number.isFinite(Number(navigator.deviceMemory))
        ? Number(navigator.deviceMemory)
        : null,
    maxTouchPoints:
      Number.isFinite(Number(navigator.maxTouchPoints))
        ? Number(navigator.maxTouchPoints)
        : null,
  };

  const output = {};
  for (const [key, names] of Object.entries(aliases)) {
    const label = findLabel(names);
    const nearby = valueNear(label);
    let value = null;

    if (key === 'platform') {
      const match = nearby.text.match(
        /\b(MacIntel|Win32|Win64|Linux(?:\s+\S+)?|iPhone|iPad|Android)\b/i
      );
      value = match ? match[1] : native[key];
      // Neu native/DOM khong hop le, suy tu UA (iOS spoof).
      if (!value || !/\b(MacIntel|Win32|Win64|Linux|iPhone|iPad|Android)\b/i.test(String(value))) {
        const ua = navigator.userAgent || '';
        if (/iPhone/i.test(ua)) value = 'iPhone';
        else if (/iPad/i.test(ua)) value = 'iPad';
        else if (/Android/i.test(ua)) value = 'Linux armv81';
      }
    } else {
      value = numberFrom(nearby.text);
      if (value == null && key === 'maxTouchPoints' && /\b(no|false|unsupported)\b/i.test(nearby.text)) {
        value = 0;
      }
      if (value == null) value = native[key];
    }

    const target = nearby.target || label;
    if (target) target.setAttribute('data-autotest-browserscan', key);
    output[key] = {
      value,
      sourceText: nearby.text,
      selected: !!target,
    };
  }

  return output;
}

function paintResultsInPage(marks) {
  const styleId = 'autotest-browserscan-highlight';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .at-bs-pass { background: rgba(34,197,94,.35) !important; outline: 2px solid #22c55e !important; }
      .at-bs-fail { background: rgba(239,68,68,.35) !important; outline: 2px solid #ef4444 !important; }
      .at-bs-na { background: rgba(148,163,184,.2) !important; }
    `;
    document.head.appendChild(style);
  }

  let count = 0;
  for (const mark of marks || []) {
    const element = document.querySelector(
      `[data-autotest-browserscan="${mark.key}"]`
    );
    if (!element) continue;
    element.classList.remove('at-bs-pass', 'at-bs-fail', 'at-bs-na');
    element.classList.add(
      mark.pass === true ? 'at-bs-pass' : mark.pass === false ? 'at-bs-fail' : 'at-bs-na'
    );
    count++;
  }
  return count;
}

function makeResult(label, actual, expected, numeric) {
  const pass = isDefault(expected)
    ? null
    : actual == null
      ? false
      : equalValue(actual, expected, numeric);
  const line = {
    label,
    value: actual == null ? '' : String(actual),
    expected: isDefault(expected) ? 'default' : expected,
    pass,
  };
  return {
    state: pass === false ? 'fail' : pass === true ? 'pass' : 'skipped',
    pass,
    value: `${label}\n${line.value}`,
    lines: [line],
  };
}

async function runNavigatorChecks(page, keys, configMap, ctx) {
  ctx.step('BrowserScan: select Navigator/Hardware elements...');
  const scraped = await evaluateInPage(page, scrapeNavigatorInPage);
  const definitions = {
    platform_navigator: {
      field: 'platform',
      label: 'navigator.platform',
      config: CFG.platform,
      numeric: false,
    },
    hardware: {
      field: 'hardwareConcurrency',
      label: 'hardwareConcurrency',
      config: CFG.hardwareConcurrency,
      numeric: true,
    },
    device_memory: {
      field: 'deviceMemory',
      label: 'deviceMemory',
      config: CFG.deviceMemory,
      numeric: true,
    },
    max_touch_points: {
      field: 'maxTouchPoints',
      label: 'maxTouchPoints',
      config: CFG.maxTouchPoints,
      numeric: true,
    },
  };

  const results = {};
  const marks = [];
  for (const key of keys) {
    const definition = definitions[key];
    if (!definition) continue;
    const item = scraped[definition.field] || {};
    const result = makeResult(
      definition.label,
      item.value,
      cfgStr(configMap, definition.config),
      definition.numeric
    );
    results[key] = result;
    marks.push({ key: definition.field, pass: result.pass });
    ctx.step(
      `BrowserScan ${definition.label}: ${item.value ?? 'null'} ` +
      `(element=${item.selected ? 'yes' : 'fallback'})`,
      result.pass === false ? 'err' : 'ok'
    );
  }

  const painted = await evaluateInPage(page, paintResultsInPage, marks);
  ctx.step(`BrowserScan: highlight ${painted} element`);
  return results;
}

module.exports = { runNavigatorChecks, scrapeNavigatorInPage, CFG };
