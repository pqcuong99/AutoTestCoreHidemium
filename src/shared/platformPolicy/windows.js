/**
 * Policy test theo OS target (windows | macos | ios | android).
 * Recipes DOM dung chung; chi khac skipChecks / skipConfigKeys / matchAliases.
 */
module.exports = {
  id: 'windows',
  label: 'Windows',
  supported: true,
  /** checkKey bo qua tren BrowserLeaks (va site khac neu runner doc policy). */
  skipChecks: ['font', 'mac_address', 'desktop_name'],
  /** configKey skip so sanh (khong co tren web / che do spoof). */
  skipConfigKeys: [
    'hidemium.navigator.physical_memory',
    'hidemium.navigator.useragent.manufacturer',
    'hidemium.webgl.mode',
  ],
  /** Alias soft-match platform string (mo rong sau). */
  matchAliases: {},
};
