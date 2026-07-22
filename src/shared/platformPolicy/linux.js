/**
 * Policy test fingerprint Linux (Chromium spoof tren Hidemium).
 */
module.exports = {
  id: 'linux',
  label: 'Linux',
  supported: true,
  skipChecks: ['mac_address', 'desktop_name'],
  skipConfigKeys: [
    'hidemium.navigator.physical_memory',
    'hidemium.webgl.mode',
  ],
  matchAliases: {},
};
