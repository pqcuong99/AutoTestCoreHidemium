/**
 * Map tung muc check (checkItems.js) -> cac key trong config.hidemium
 * va format ra chuoi de hien thi o COT B cua bang Detail Log.
 *
 * Muon doi cach lay/hien thi cot B -> chi sua file nay.
 */
const { t } = require('../shared/i18n');

/**
 * MAPPING: key cua check item -> danh sach { key, label } cua config.
 * Dat 'expand' de gom tat ca key co cung tien to.
 */
const MAPPING = {
  screen: {
    fields: [
      { key: 'hidemium.navigator.screen.width', label: 'width' },
      { key: 'hidemium.navigator.screen.height', label: 'height' },
      { key: 'hidemium.navigator.screen.avail_width', label: 'availWidth' },
      { key: 'hidemium.navigator.screen.avail_height', label: 'availHeight' },
      { key: 'hidemium.navigator.screen.color_depth', label: 'colorDepth' },
      { key: 'hidemium.navigator.screen.pixcel_depth', label: 'pixelDepth' },
      { key: 'hidemium.navigator.screen.inner_width', label: 'innerWidth' },
      { key: 'hidemium.navigator.screen.inner_height', label: 'innerHeight' },
      { key: 'hidemium.navigator.screen.outer_width', label: 'outerWidth' },
      { key: 'hidemium.navigator.screen.outer_height', label: 'outerHeight' },
      { key: 'hidemium.navigator.pixel_ratio', label: 'devicePixelRatio' },
    ],
  },
  platform_navigator: {
    fields: [{ key: 'hidemium.navigator.useragent.platforms', label: 'navigator.platform' }],
  },
  hardware: {
    fields: [{ key: 'hidemium.navigator.hardware_concurrency', label: 'hardwareConcurrency' }],
  },
  device_memory: {
    fields: [
      { key: 'hidemium.navigator.device_memory', label: 'deviceMemory' },
      { key: 'hidemium.navigator.physical_memory', label: 'physicalMemory' },
    ],
  },
  max_touch_points: {
    fields: [{ key: 'hidemium.navigator.max_touch_point', label: 'maxTouchPoints' }],
  },
  brands: {
    fields: [
      { key: 'hidemium.chrome.version', label: 'chromeVersion' },
      { key: 'hidemium.navigator.useragent.version_useragent', label: 'uaVersion' },
    ],
  },
  platform_ua: {
    fields: [{ key: 'hidemium.navigator.os.platform_os', label: 'platform' }],
  },
  platform_version: {
    fields: [{ key: 'hidemium.navigator.os.platforms_version', label: 'platformVersion' }],
  },
  ua_full_version: {
    fields: [
      { key: 'hidemium.navigator.useragent.fullversion', label: 'uaFullVersion' },
      { key: 'hidemium.navigator.useragent.useragent', label: 'userAgent' },
    ],
  },
  model: {
    fields: [
      { key: 'hidemium.navigator.useragent.model', label: 'model' },
      { key: 'hidemium.navigator.useragent.manufacturer', label: 'manufacturer' },
    ],
  },
  full_version_list: {
    fields: [
      { key: 'hidemium.navigator.useragent.fullversion', label: 'fullVersion' },
      { key: 'hidemium.chrome.version', label: 'chromeVersion' },
    ],
  },
  form_factors: {
    fields: [
      { key: 'hidemium.navigator.is_mobile', label: 'isMobile' },
      { key: 'hidemium.navigator.is_tablet', label: 'isTablet' },
    ],
  },
  battery: { expand: 'hidemium.value.battery.' },
  network: { expand: 'hidemium.network.' },
  font: {
    fields: [
      { key: 'hidemium.fonts', label: 'fonts' },
      { key: 'hidemium.fontface', label: 'fontFace' },
      { key: 'hidemium.fontsfaceset', label: 'fontFaceSet' },
      { key: 'hidemium.fonts_value', label: 'fontsValue' },
    ],
  },
  webgl: {
    fields: [
      { key: 'hidemium.webgl.mode', label: 'mode' },
      { key: 'hidemium.webgl.vendor', label: 'vendor' },
      { key: 'hidemium.webgl.renderer', label: 'renderer', base64: true },
    ],
  },
  webgl_param: { expand: 'hidemium.webgl.webgl_param.' },
  webgpu: {
    fields: [
      { key: 'hidemium.webgpu.vendor', label: 'vendor' },
      { key: 'hidemium.webgpu.architecture', label: 'architecture' },
      { key: 'hidemium.webgpu.features', label: 'features' },
    ],
    expand: 'hidemium.webgpu.param.',
  },
  mac_address: {
    fields: [
      { key: 'hidemium.app.mac_address', label: 'app.macAddress' },
      { key: 'hidemium.registry.mac_address', label: 'registry.macAddress' },
    ],
  },
  desktop_name: {
    fields: [
      { key: 'hidemium.app.computer_name', label: 'app.computerName' },
      { key: 'hidemium.registry.computer_name', label: 'registry.computerName' },
    ],
  },
};

/** Mot so gia tri bi base64 (vd webgl.renderer) -> giai ma cho de doc */
function maybeBase64(value) {
  if (!value || value === 'default') return value;
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    // chi nhan neu ra chuoi in duoc, tranh giai ma nham
    if (/^[\x20-\x7E]+$/.test(decoded) && decoded.length > 3) return decoded;
  } catch { /* bo qua */ }
  return value;
}

/**
 * Lay gia tri cot B cho 1 muc check.
 * @returns {{ value:string, fields: Array<{label:string, value:string}>, found:boolean }}
 */
function resolveCheck(checkKey, configMap) {
  const rule = MAPPING[checkKey];
  if (!rule) return { value: '(chua map)', fields: [], found: false };

  const fields = [];

  (rule.fields || []).forEach((f) => {
    if (!(f.key in configMap)) return;
    let v = configMap[f.key];
    if (f.base64) v = maybeBase64(v);
    fields.push({ label: f.label, value: v, key: f.key });
  });

  if (rule.expand) {
    Object.keys(configMap)
      .filter((k) => k.startsWith(rule.expand))
      .sort()
      .forEach((k) => {
        fields.push({ label: k.slice(rule.expand.length), value: configMap[k], key: k });
      });
  }

  const found = fields.length > 0;
  const value = found ? fields.map((f) => `${f.label}: ${f.value}`).join('\n') : t('err.notInConfig');
  return { value, fields, found };
}

/**
 * Build toan bo cot B cho danh sach check da tick.
 * @returns {Record<string, {value:string, fields:Array, found:boolean}>}
 */
function buildConfigColumn(checkKeys, configMap) {
  const out = {};
  for (const key of checkKeys) out[key] = resolveCheck(key, configMap);
  return out;
}

module.exports = { MAPPING, resolveCheck, buildConfigColumn, maybeBase64 };
