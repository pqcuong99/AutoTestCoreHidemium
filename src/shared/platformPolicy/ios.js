/**
 * Policy test fingerprint iOS (Chromium spoof tren Hidemium).
 */
module.exports = {
  id: 'ios',
  label: 'iOS',
  supported: true,
  skipChecks: [
    'mac_address',
    'desktop_name',
    'device_memory',
    'platform_version',
    'full_version_list',
    'form_factors',
    'battery',
    'network',
    'brands',
    'model',
    'webgpu',
  ],
  skipConfigKeys: [
    'hidemium.webgl.mode',
    'hidemium.navigator.useragent.fullversion'
  ],
  matchAliases: {},
};
