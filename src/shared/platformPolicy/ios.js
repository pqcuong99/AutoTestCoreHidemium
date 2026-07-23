/**
 * Policy test fingerprint iOS (Chromium spoof tren Hidemium).
 *
 * Ap dung BrowserLeaks / CreepJS / BrowserScan qua platform.skipChecks.
 * iOS ~ Safari: skip device_memory, webgpu, client hints, network, battery.
 */
module.exports = {
  id: 'ios',
  label: 'iOS',
  supported: true,
  skipChecks: [
    'mac_address',
    'desktop_name',
    'device_memory',
    'webgpu',
    'brands',
    'platform_version',
    'ua_full_version',
    'model',
    'full_version_list',
    'form_factors',
    'network',
    'battery',
  ],
  skipConfigKeys: [
    'hidemium.navigator.physical_memory',
    'hidemium.webgl.mode',
    'hidemium.navigator.device_memory',
    'hidemium.navigator.useragent.fullversion',
  ],
  matchAliases: {},
};
