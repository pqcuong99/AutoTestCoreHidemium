/**
 * Chuan hoa gia tri iphey DOM -> fields dung TEN LABEL nhu cot Config.
 * Moi checkKey chi in dung cac field Config co the suy ra tu web.
 */

const { platformFromUserAgent, parseUaBrowserVersion } = require('../../../shared/uaPlatform');

function parseResolution(value) {
  const m = String(value || '').match(/(\d+)\s*[x×X]\s*(\d+)/);
  if (!m) return null;
  return { width: m[1], height: m[2] };
}

function parseChromeVersion(value) {
  return parseUaBrowserVersion(value);
}

function lab(m) {
  return String(m?.label || '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .toLowerCase()
    .trim();
}

function val(m) {
  return String(m?.value ?? '').trim();
}

function sec(m) {
  return String(m?.section || '').toUpperCase();
}

function pushUnique(fields, label, value) {
  const v = String(value ?? '').trim();
  if (v === '') return;
  if (fields.some((f) => f.label === label)) return;
  fields.push({ label, value: v });
}

function findAll(list, pred) {
  return list.filter(pred);
}

function findOne(list, pred) {
  return list.find(pred) || null;
}

/**
 * @param {string} checkKey
 * @param {Array<{label:string,value:string,section?:string}>} matched  (raw pairs da match)
 * @param {Array} allPairs  toan bo pair detail (de lay them field lien quan)
 */
function normalizeToConfigFields(checkKey, matched, allPairs) {
  const list = Array.isArray(matched) && matched.length ? matched : [];
  const all = Array.isArray(allPairs) && allPairs.length ? allPairs : list;
  const fields = [];

  // ---------- screen ----------
  if (checkKey === 'screen') {
    const hw = all.filter((m) => !sec(m) || sec(m) === 'HARDWARE');
    for (const m of hw) {
      const l = lab(m);
      if (/timing/.test(l)) continue;
      if (l === 'resolution' || l === 'screen resolution' || l === 'screen size') {
        const wh = parseResolution(val(m));
        if (wh) {
          pushUnique(fields, 'width', wh.width);
          pushUnique(fields, 'height', wh.height);
        }
      } else if (l === 'color depth') pushUnique(fields, 'colorDepth', val(m));
      else if (l === 'pixel depth') pushUnique(fields, 'pixelDepth', val(m));
      else if (l === 'device pixel ratio' || l === 'pixel ratio') pushUnique(fields, 'devicePixelRatio', val(m));
      else if (l === 'avail width' || l === 'availwidth') pushUnique(fields, 'availWidth', val(m));
      else if (l === 'avail height' || l === 'availheight') pushUnique(fields, 'availHeight', val(m));
      else if (l === 'inner width' || l === 'innerwidth') pushUnique(fields, 'innerWidth', val(m));
      else if (l === 'inner height' || l === 'innerheight') pushUnique(fields, 'innerHeight', val(m));
      else if (l === 'outer width' || l === 'outerwidth') pushUnique(fields, 'outerWidth', val(m));
      else if (l === 'outer height' || l === 'outerheight') pushUnique(fields, 'outerHeight', val(m));
    }
    return fields;
  }

  // ---------- platform_navigator ----------
  if (checkKey === 'platform_navigator') {
    const osLike = findAll(
      all,
      (m) => ['os', 'platform', 'operating system'].includes(lab(m)) && sec(m) !== 'NETWORK'
    );
    const nav = osLike.find((m) => /^(win32|macintel|linux|iphone|ipad)/i.test(val(m)));
    const pick = nav || osLike[0] || findOne(all, (m) => lab(m) === 'os');
    if (pick) pushUnique(fields, 'navigator.platform', val(pick));
    return fields;
  }

  // ---------- hardware ----------
  if (checkKey === 'hardware') {
    const m = findOne(
      all,
      (x) => lab(x) === 'hardware concurrency' || lab(x) === 'cpu cores'
    );
    if (m) pushUnique(fields, 'hardwareConcurrency', val(m));
    return fields;
  }

  // ---------- device_memory ----------
  if (checkKey === 'device_memory') {
    const dm = findOne(all, (x) => lab(x) === 'device memory');
    const pm = findOne(all, (x) => lab(x) === 'physical memory');
    if (dm) pushUnique(fields, 'deviceMemory', val(dm));
    if (pm) pushUnique(fields, 'physicalMemory', val(pm));
    return fields;
  }

  // ---------- max_touch_points ----------
  if (checkKey === 'max_touch_points') {
    const m = findOne(all, (x) => lab(x) === 'max touch points' || lab(x) === 'touch points');
    if (m) pushUnique(fields, 'maxTouchPoints', val(m));
    return fields;
  }

  // ---------- brands → chi chromeVersion + uaVersion ----------
  if (checkKey === 'brands') {
    const browser = all.filter((m) => !sec(m) || sec(m) === 'BROWSER');
    let version = '';
    let fromUa = '';
    for (const m of browser) {
      const l = lab(m);
      const v = val(m);
      if (/detected|anti-detect/i.test(v)) continue;
      if (l === 'version' || l === 'browser version' || l === 'chrome version') {
        version = parseChromeVersion(v) || version;
      } else if (l === 'user agent' || l === 'user-agent') {
        fromUa = parseChromeVersion(v) || fromUa;
      }
    }
    const chromeVersion = version || fromUa;
    const uaVersion = fromUa || version;
    if (chromeVersion) pushUnique(fields, 'chromeVersion', chromeVersion);
    if (uaVersion) pushUnique(fields, 'uaVersion', uaVersion);
    return fields;
  }

  // ---------- platform_ua → platform (cat tu UA, khong lay OS/platform tren web) ----------
  if (checkKey === 'platform_ua') {
    const ua =
      findOne(all, (x) => lab(x) === 'user agent' || lab(x) === 'user-agent') ||
      findOne(all, (x) => lab(x) === 'ua');
    if (ua) {
      const platform = platformFromUserAgent(val(ua));
      if (platform) pushUnique(fields, 'platform', platform);
    }
    return fields;
  }

  // ---------- platform_version ----------
  if (checkKey === 'platform_version') {
    const m =
      findOne(all, (x) => lab(x) === 'platform version' || lab(x) === 'os version') ||
      findOne(all, (x) => lab(x) === 'version' && sec(x) === 'SOFTWARE');
    if (m) pushUnique(fields, 'platformVersion', val(m));
    return fields;
  }

  // ---------- ua_full_version → uaFullVersion + userAgent ----------
  if (checkKey === 'ua_full_version') {
    const browser = all.filter((m) => !sec(m) || sec(m) === 'BROWSER');
    const ua = findOne(browser, (x) => lab(x) === 'user agent' || lab(x) === 'user-agent');
    const ver = findOne(
      browser,
      (x) => lab(x) === 'version' || lab(x) === 'full version' || lab(x) === 'browser version'
    );
    // Uu tien version tren trang; khong co thi cat tu UA (Version/ / Chrome/)
    const fromPage = ver ? parseChromeVersion(val(ver)) || val(ver) : '';
    const fromUa = ua ? parseChromeVersion(val(ua)) : '';
    const uaFullVersion = fromPage || fromUa;
    if (uaFullVersion) pushUnique(fields, 'uaFullVersion', uaFullVersion);
    if (ua) pushUnique(fields, 'userAgent', val(ua));
    return fields;
  }

  // ---------- model ----------
  if (checkKey === 'model') {
    const model = findOne(all, (x) => lab(x) === 'model' || lab(x) === 'device model');
    // Khong lay WebGL vendor lam manufacturer
    const man = findOne(
      all,
      (x) => {
        const l = lab(x);
        if (l.includes('webgl')) return false;
        return l === 'manufacturer' || l === 'device manufacturer';
      }
    );
    if (model) pushUnique(fields, 'model', val(model));
    if (man) pushUnique(fields, 'manufacturer', val(man));
    return fields;
  }

  // ---------- full_version_list → fullVersion + chromeVersion ----------
  if (checkKey === 'full_version_list') {
    const browser = all.filter((m) => !sec(m) || sec(m) === 'BROWSER');
    const ver = findOne(
      browser,
      (x) => lab(x) === 'version' || lab(x) === 'full version' || lab(x) === 'browser version'
    );
    const ua = findOne(browser, (x) => lab(x) === 'user agent' || lab(x) === 'user-agent');
    const v = (ver && (parseChromeVersion(val(ver)) || val(ver))) || (ua && parseChromeVersion(val(ua)));
    if (v) {
      pushUnique(fields, 'fullVersion', v);
      pushUnique(fields, 'chromeVersion', v);
    }
    return fields;
  }

  // ---------- form_factors ----------
  if (checkKey === 'form_factors') {
    const m = findOne(all, (x) => lab(x) === 'form factor' || lab(x) === 'form factors' || lab(x) === 'mobile');
    if (m) {
      if (lab(m) === 'mobile') pushUnique(fields, 'isMobile', val(m));
      else pushUnique(fields, 'formFactors', val(m));
    }
    return fields;
  }

  // ---------- battery ----------
  if (checkKey === 'battery') {
    for (const m of all) {
      const l = lab(m);
      if (l === 'battery' || l.startsWith('battery ') || l === 'charging' || l === 'level') {
        pushUnique(fields, l === 'battery' ? 'battery' : l, val(m));
      }
    }
    return fields;
  }

  // ---------- network ----------
  if (checkKey === 'network') {
    for (const m of all) {
      const l = lab(m);
      if (['effective type', 'downlink', 'rtt', 'save data', 'connection type', 'connection'].includes(l)) {
        const label =
          l === 'effective type'
            ? 'effectiveType'
            : l === 'save data'
              ? 'saveData'
              : l === 'connection type' || l === 'connection'
                ? 'type'
                : l;
        pushUnique(fields, label, val(m));
      }
    }
    return fields;
  }

  // ---------- font ----------
  if (checkKey === 'font') {
    const m = findOne(all, (x) => lab(x) === 'fonts' || lab(x) === 'font');
    if (m) pushUnique(fields, 'fonts', val(m));
    return fields;
  }

  // ---------- webgl → webgl_hash (tren renderer) / vendor / renderer ----------
  if (checkKey === 'webgl') {
    const isHexHash = (v) => /^[a-f0-9]{8,64}$/i.test(String(v).trim());
    // Chi chuoi GPU/renderer that — khong coi "Google Inc. (NVIDIA)" la renderer
    const isRendererText = (v) =>
      /ANGLE|GeForce|Radeon|SwiftShader|Direct3D|OpenGL|Metal|Adreno|Mali|Iris|UHD Graphics|vs_\d|ps_\d/i.test(
        String(v)
      );
    const isVendorText = (v) => {
      const s = String(v);
      if (isRendererText(s)) return false;
      return /Google Inc|Apple|Mesa|Qualcomm|ARM|NVIDIA|Intel|AMD/i.test(s) && s.length < 80;
    };

    // 0) Hash WebGL — day len hang WebGL, nam tren renderer
    for (const m of all) {
      const l = lab(m);
      const v = val(m);
      if (!v || !isHexHash(v)) continue;
      if (l === 'webgl' || l.includes('webgl hash') || l === 'hash') {
        pushUnique(fields, 'webgl_hash', v);
      }
    }

    // 1) Label ro rang
    for (const m of all) {
      const l = lab(m);
      const v = val(m);
      if (!v || isHexHash(v)) continue;

      if (
        l === 'webgl vendor' ||
        l === 'unmasked vendor' ||
        l === 'unmasked vendor webgl' ||
        (l === 'vendor' && !l.includes('webgpu') && (sec(m) === 'HARDWARE' || isVendorText(v)))
      ) {
        pushUnique(fields, 'vendor', v);
      } else if (
        l === 'webgl renderer' ||
        l === 'unmasked renderer' ||
        l === 'unmasked renderer webgl' ||
        (l === 'renderer' && !l.includes('webgpu'))
      ) {
        pushUnique(fields, 'renderer', v);
      }
    }

    // 2) GPU co chuoi ANGLE... → renderer (neu chua co)
    if (!fields.some((f) => f.label === 'renderer')) {
      for (const m of all) {
        const l = lab(m);
        const v = val(m);
        if (!v || isHexHash(v)) continue;
        if ((l === 'gpu' || l === 'webgl' || l === 'gpu model') && isRendererText(v)) {
          pushUnique(fields, 'renderer', v);
        }
      }
    }

    // 3) Vendor neu chua co
    if (!fields.some((f) => f.label === 'vendor')) {
      for (const m of all) {
        const l = lab(m);
        const v = val(m);
        if (!v || isHexHash(v)) continue;
        if ((l === 'webgl vendor' || l === 'vendor' || l === 'unmasked vendor') && isVendorText(v)) {
          pushUnique(fields, 'vendor', v);
        }
      }
    }

    // 4) mode: chi gia tri ngan (noise/off) — khong lay ANGLE / hash
    for (const m of all) {
      const l = lab(m);
      const v = val(m);
      if (l !== 'webgl mode' && l !== 'mode') continue;
      if (!v || isHexHash(v) || isRendererText(v) || v.length > 32) continue;
      pushUnique(fields, 'mode', v);
    }

    return fields;
  }

  // ---------- webgl_param (hash da map sang webgl; chi lay param/extension) ----------
  if (checkKey === 'webgl_param') {
    for (const m of all) {
      const l = lab(m);
      const v = val(m);
      if (!v) continue;
      // Hash hex thuoc hang WebGL — bo qua o day
      if (l === 'webgl' && /^[a-f0-9]{8,64}$/i.test(v)) continue;
      if (l.includes('webgl') && (l.includes('param') || l.includes('extension'))) {
        pushUnique(fields, l.replace(/\s+/g, '_'), v);
      }
    }
    return fields;
  }

  // ---------- webgpu: chi field webgpu, khong nham webgl vendor/renderer ----------
  if (checkKey === 'webgpu') {
    for (const m of all) {
      const l = lab(m);
      const v = val(m);
      if (!l.includes('webgpu') && l !== 'gpu architecture') continue;
      if (/^[a-f0-9]{8,64}$/i.test(v)) continue; // bo hash
      if (l.includes('vendor')) pushUnique(fields, 'vendor', v);
      else if (l.includes('architecture')) pushUnique(fields, 'architecture', v);
      else if (l.includes('feature')) pushUnique(fields, 'features', v);
      else if (l === 'webgpu' || l === 'webgpu status') pushUnique(fields, 'webgpu', v);
    }
    return fields;
  }

  // ---------- mac / desktop: thuong khong co tren web ----------
  if (checkKey === 'mac_address' || checkKey === 'desktop_name') {
    return fields;
  }

  // fallback
  for (const m of list) {
    const l = lab(m);
    if (!l || /timing|everything is fine|detected|anti-detect/i.test(l + val(m))) continue;
    pushUnique(fields, l, val(m));
  }
  return fields;
}

module.exports = {
  parseResolution,
  parseChromeVersion,
  normalizeToConfigFields,
};
