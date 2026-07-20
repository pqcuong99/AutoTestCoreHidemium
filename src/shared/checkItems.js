/**
 * Danh sach cac muc can check.
 * File nay dung chung cho ca main process (require) va renderer (<script src>).
 * Muon them / bot muc check -> chi sua o day.
 */
const CHECK_ITEMS = [
  { key: 'screen', label: 'Screen', group: 'Screen' },
  { key: 'platform_navigator', label: 'Platform (navigator)', group: 'Navigator' },
  { key: 'hardware', label: 'Hardware Concurrency', group: 'Navigator' },
  { key: 'device_memory', label: 'Device Memory', group: 'Navigator' },
  { key: 'max_touch_points', label: 'MaxTouchPoints', group: 'Navigator' },
  { key: 'brands', label: 'Brands', group: 'User-Agent Data' },
  { key: 'platform_ua', label: 'Platform (UA)', group: 'User-Agent Data' },
  { key: 'platform_version', label: 'PlatformVersion', group: 'User-Agent Data' },
  { key: 'ua_full_version', label: 'UaFullVersion', group: 'User-Agent Data' },
  { key: 'model', label: 'Model', group: 'User-Agent Data' },
  { key: 'full_version_list', label: 'FullVersionList', group: 'User-Agent Data' },
  { key: 'form_factors', label: 'FormFactors', group: 'User-Agent Data' },
  { key: 'battery', label: 'Battery', group: 'System' },
  { key: 'network', label: 'Network', group: 'System' },
  { key: 'font', label: 'Font', group: 'System' },
  { key: 'webgl', label: 'WebGL', group: 'Graphics' },
  { key: 'webgl_param', label: 'WebGL Param', group: 'Graphics' },
  { key: 'webgpu', label: 'WebGPU', group: 'Graphics' },
  { key: 'mac_address', label: 'MAC Address', group: 'System' },
  { key: 'desktop_name', label: 'Desktop Name', group: 'System' },
];

const CHECK_KEYS = CHECK_ITEMS.map((i) => i.key);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHECK_ITEMS, CHECK_KEYS };
}
