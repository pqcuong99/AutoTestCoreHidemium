/**
 * Policy test fingerprint macOS (Chromium spoof tren Hidemium).
 *
 * `browsers`: skip / alias them theo browser (gom voi skip OS).
 * Vi du: mac + safari → skip webgpu / client hints.
 */
module.exports = {
  id: 'macos',
  label: 'macOS',
  supported: true,
  skipChecks: ['mac_address', 'desktop_name'],
  skipConfigKeys: [],
  matchAliases: {},

  /**
   * Key: safari | chrome | edge | brave | opera | opera_gx | yandex | firefox
   * Moi entry co the co skipChecks / skipConfigKeys / matchAliases.
   */
  browsers: {
    safari: {
      skipChecks: [
        'webgpu',
        'brands',
        'platform_version',
        'ua_full_version',
        'model',
        'full_version_list',
        'form_factors',
      ],
      skipConfigKeys: ['hidemium.navigator.device_memory'],
    },
    // opera_gx: { skipChecks: [] },
  },
};
