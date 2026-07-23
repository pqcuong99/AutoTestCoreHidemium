/**
 * Scrape DOM bot.sannysoft.com:
 * - bang test / details
 * - #fp2: JSON fpCollect (screen: sWidth, sHeight, wInnerHeight, …)
 */

const { CHECK_KEYS } = require('./selectors');
const {
  platformFromUserAgent,
  parseUaBrowserVersion,
} = require('../../../shared/uaPlatform');

const SCRAPE_DOM_EXPRESSION = `(() => {
  const pairs = [];
  const push = (label, value, source, id) => {
    const l = String(label || '').replace(/\\s+/g, ' ').trim()
      .replace(/\\(Old\\)|\\(New\\)/gi, '').trim();
    let v = value;
    if (v != null && typeof v !== 'string') v = String(v);
    v = String(v || '').replace(/\\s+/g, ' ').trim();
    if (!l || v === '') return;
    if (/^undefined$/i.test(v)) return;
    pairs.push({ label: l, value: v, source: source || 'table', id: id || '', section: '' });
  };

  const byId = [
    ['user-agent-result', 'User Agent'],
    ['webgl-vendor', 'WebGL Vendor'],
    ['webgl-renderer', 'WebGL Renderer'],
    ['broken-image-dimensions', 'Broken Image Dimensions'],
    ['plugins-length-result', 'Plugins Length'],
    ['languages-result', 'Languages'],
    ['webdriver-result', 'WebDriver'],
    ['chrome-result', 'Chrome'],
    ['permissions-result', 'Permissions'],
    ['battery1', 'Battery'],
  ];
  for (const [id, fallbackLabel] of byId) {
    const el = document.getElementById(id);
    if (!el) continue;
    // Battery: tach tung dong "Charging: true" / "Level: 0.65" (tranh 1 khoi text lech cot)
    if (id === 'battery1') {
      const lines = (el.innerText || el.textContent || '')
        .split(/\\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      lines.forEach((line) => {
        const m = line.match(/^([^:]+):\\s*(.+)$/);
        if (m) push(m[1].trim(), m[2].trim(), 'battery', id);
        else push('Battery', line, 'battery', id);
      });
      continue;
    }
    const text = (el.innerText || el.textContent || '').trim();
    if (!text) continue;
    push(fallbackLabel, text, 'id', id);
  }

  // Bang details + test (bo #fp2 — xu ly rieng)
  document.querySelectorAll('table:not(#fp2) tr').forEach((tr) => {
    const tds = [...tr.querySelectorAll('td')];
    if (tds.length < 2) return;
    const label = (tds[0].innerText || tds[0].textContent || '').trim();
    const valueEl = tds.find((td) => td.classList.contains('result')) || tds[1];
    const value = (valueEl.innerText || valueEl.textContent || '').trim();
    if (!label || !value) return;
    const id = valueEl.id || '';
    if (id && byId.some(([i]) => i === id)) return;
    push(label, value, 'table', id);
  });

  // #fp2: name | ok | <pre>JSON</pre>  — fpCollect screen object nam o day
  let fpScreen = null;
  document.querySelectorAll('#fp2 tr').forEach((tr) => {
    const tds = [...tr.querySelectorAll('td')];
    if (tds.length < 3) return;
    const name = (tds[0].innerText || tds[0].textContent || '').trim();
    const status = (tds[1].innerText || tds[1].textContent || '').trim();
    if (name) push('fp2.' + name, status, 'fp2-status');

    const pre = tds[2].querySelector('pre') || tds[2];
    const raw = (pre.textContent || '').trim();
    if (!raw || raw[0] !== '{' && raw[0] !== '[') return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }

    const upper = name.toUpperCase();
    // SCREEN test: data = { sWidth, sHeight, wInnerHeight, ... }
    if (
      upper.includes('SCREEN') ||
      (data && typeof data === 'object' && !Array.isArray(data) && data.sWidth != null)
    ) {
      fpScreen = data;
      Object.keys(data).forEach((k) => {
        if (data[k] == null || typeof data[k] === 'object') return;
        push('fp.screen.' + k, data[k], 'fp2-screen');
      });
      return;
    }

    // VIDEO_CARD / webgl: ["vendor","renderer"]
    if (Array.isArray(data) && data.length >= 2 && (upper.includes('VIDEO') || upper.includes('WEBGL'))) {
      push('WebGL Vendor', data[0], 'fp2');
      push('WebGL Renderer', data[1], 'fp2');
    }
  });

  return {
    pairs,
    entryCount: pairs.length,
    fpScreen,
    ua: (document.querySelector('#user-agent-result')?.textContent || '').trim(),
    webglVendor: (document.querySelector('#webgl-vendor')?.textContent || '').trim(),
    webglRenderer: (document.querySelector('#webgl-renderer')?.textContent || '').trim(),
  };
})()`;

function lab(m) {
  return String(m?.label || '')
    .toLowerCase()
    .replace(/\(old\)|\(new\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function val(m) {
  return String(m?.value ?? '').trim();
}

function parseChromeVersion(value) {
  return parseUaBrowserVersion(value);
}

function pushUnique(fields, label, value) {
  const v = String(value ?? '').trim();
  if (!v) return;
  if (fields.some((f) => f.label === label)) return;
  fields.push({ label, value: v });
}

function find(list, pred) {
  return list.find(pred) || null;
}

/** fpCollect screen key -> config field label */
const FP_SCREEN_MAP = {
  sWidth: 'width',
  sHeight: 'height',
  sAvailWidth: 'availWidth',
  sAvailHeight: 'availHeight',
  sColorDepth: 'colorDepth',
  sPixelDepth: 'pixelDepth',
  wInnerWidth: 'innerWidth',
  wInnerHeight: 'innerHeight',
  wOuterWidth: 'outerWidth',
  wOuterHeight: 'outerHeight',
  wDevicePixelRatio: 'devicePixelRatio',
};

/**
 * Map pair DOM -> fields giong cot Config (chi field co tren trang).
 */
function normalizeToConfigFields(checkKey, pairs) {
  const all = Array.isArray(pairs) ? pairs : [];
  const fields = [];

  if (checkKey === 'screen') {
    // 1) Uu tien fpCollect SCREEN object (sWidth, wInnerHeight, …)
    let fromFp = false;
    for (const [fpKey, cfgLabel] of Object.entries(FP_SCREEN_MAP)) {
      const m = find(all, (x) => lab(x) === 'fp.screen.' + fpKey.toLowerCase());
      if (m) {
        pushUnique(fields, cfgLabel, val(m));
        fromFp = true;
      }
    }
    if (fromFp) return fields;

    // 2) Fallback bang details: screen.width / height / colorDepth
    const w = find(all, (m) => lab(m) === 'screen.width' || lab(m) === 'screen width');
    const h = find(all, (m) => lab(m) === 'screen.height' || lab(m) === 'screen height');
    const cd = find(
      all,
      (m) =>
        lab(m) === 'screen.colordepth' ||
        lab(m) === 'screen.color depth' ||
        lab(m) === 'screen colordepth'
    );
    if (w) pushUnique(fields, 'width', val(w));
    if (h) pushUnique(fields, 'height', val(h));
    if (cd) pushUnique(fields, 'colorDepth', val(cd));
    return fields;
  }

  if (checkKey === 'platform_navigator') {
    const m = find(all, (x) => lab(x) === 'navigator.platform' || lab(x) === 'platform');
    if (m) pushUnique(fields, 'navigator.platform', val(m));
    return fields;
  }

  if (checkKey === 'platform_ua') {
    // Cat platform tu User-Agent (khong dung navigator.platform / Linux armv8l tren web)
    const ua =
      find(all, (x) => lab(x) === 'user agent') ||
      find(all, (x) => lab(x) === 'navigator.useragent');
    if (ua) {
      const platform = platformFromUserAgent(val(ua));
      if (platform) pushUnique(fields, 'platform', platform);
    }
    return fields;
  }

  if (checkKey === 'brands') {
    const ua =
      find(all, (x) => lab(x) === 'user agent') ||
      find(all, (x) => lab(x) === 'navigator.useragent');
    const ver = ua ? parseChromeVersion(val(ua)) : '';
    if (ver) {
      pushUnique(fields, 'chromeVersion', ver);
      pushUnique(fields, 'uaVersion', ver);
    }
    return fields;
  }

  if (checkKey === 'ua_full_version') {
    const ua =
      find(all, (x) => lab(x) === 'user agent') ||
      find(all, (x) => lab(x) === 'navigator.useragent');
    if (ua) {
      const ver = parseChromeVersion(val(ua));
      if (ver) pushUnique(fields, 'uaFullVersion', ver);
      pushUnique(fields, 'userAgent', val(ua));
    }
    return fields;
  }

  if (checkKey === 'full_version_list') {
    const ua =
      find(all, (x) => lab(x) === 'user agent') ||
      find(all, (x) => lab(x) === 'navigator.useragent');
    const ver = ua ? parseChromeVersion(val(ua)) : '';
    if (ver) {
      pushUnique(fields, 'fullVersion', ver);
      pushUnique(fields, 'chromeVersion', ver);
    }
    return fields;
  }

  if (checkKey === 'webgl') {
    const vendor = find(all, (x) => lab(x) === 'webgl vendor');
    const renderer = find(all, (x) => lab(x) === 'webgl renderer');
    if (vendor) pushUnique(fields, 'vendor', val(vendor));
    if (renderer) pushUnique(fields, 'renderer', val(renderer));
    return fields;
  }

  if (checkKey === 'battery') {
    // Config: charging, charging_time, discharging_time, level
    const parseBool01 = (s) => {
      const t = String(s).trim().toLowerCase();
      if (t === 'true' || t === '1') return '1';
      if (t === 'false' || t === '0') return '0';
      return String(s).trim();
    };

    for (const m of all) {
      const l = lab(m);
      const v = val(m);
      if (l === 'charging') pushUnique(fields, 'charging', parseBool01(v));
      else if (l === 'level') pushUnique(fields, 'level', v);
      else if (l === 'charging time' || l === 'chargingtime' || l === 'charging_time') {
        pushUnique(fields, 'charging_time', v);
      } else if (l === 'discharging time' || l === 'dischargingtime' || l === 'discharging_time') {
        pushUnique(fields, 'discharging_time', v);
      }
    }

    // Fallback: 1 o "Charging: true Level: 0.65" hoac nhieu dong
    if (!fields.length) {
      const blob =
        find(all, (x) => lab(x) === 'battery' || lab(x).includes('getbattery')) ||
        find(all, (x) => /charging|level/i.test(val(x)));
      if (blob) {
        const text = val(blob);
        const charging = text.match(/charging\s*:\s*(\w+)/i);
        const level = text.match(/level\s*:\s*([\d.]+)/i);
        if (charging) pushUnique(fields, 'charging', parseBool01(charging[1]));
        if (level) pushUnique(fields, 'level', level[1]);
      }
    }
    return fields;
  }

  return fields;
}

function mapPairsToChecks(pairs, checkKeys) {
  const keys = checkKeys?.length ? checkKeys : CHECK_KEYS;
  const out = {};
  for (const key of keys) {
    const fields = normalizeToConfigFields(key, pairs);
    if (!fields.length) {
      out[key] = { value: '', fields: [], state: 'skipped', reason: 'not-on-page' };
      continue;
    }
    out[key] = {
      value: fields.map((f) => `${f.label}: ${f.value}`).join('\n'),
      fields,
      state: 'ok',
      source: 'dom',
    };
  }
  return out;
}

module.exports = {
  SCRAPE_DOM_EXPRESSION,
  mapPairsToChecks,
  normalizeToConfigFields,
  parseChromeVersion,
  FP_SCREEN_MAP,
};
