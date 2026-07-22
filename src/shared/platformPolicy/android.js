/**
 * Policy test fingerprint Android (Chromium spoof tren Hidemium).
 */
module.exports = {
  id: 'android',
  label: 'Android',
  supported: true,
  skipChecks: ['mac_address', 'desktop_name', 'font'],
  skipConfigKeys: [
    'hidemium.navigator.physical_memory',
    'hidemium.webgl.mode',
  ],
  matchAliases: {},
};
