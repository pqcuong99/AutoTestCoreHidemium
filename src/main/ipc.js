/**
 * Dang ky toan bo IPC handler. Them kenh moi thi them o day.
 */
const { ipcMain, shell } = require('electron');
const store = require('./store');
const { listBrowsers } = require('./hidemiumApi');
const runner = require('./runner');
const { readProfileConfig } = require('./configReader');
const { CHECK_ITEMS } = require('../shared/checkItems');
const { WEBSITES } = require('../shared/websites');

function register(getWindow) {
  /** Detail Log gio la overlay trong cua so chinh -> chi can ban toi day. */
  const broadcast = (channel, payload) => {
    const w = getWindow();
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
  };

  // ---- Config ----
  ipcMain.handle('config:get', () => store.load());
  ipcMain.handle('config:set', (_e, patch) => {
    const next = store.save(patch || {});
    if (patch && patch.locale) {
      const { setLocale } = require('../shared/i18n');
      setLocale(patch.locale === 'en' ? 'en' : 'vi');
    }
    return next;
  });

  ipcMain.handle('meta:all', () => ({ checkItems: CHECK_ITEMS, websites: WEBSITES }));

  // ---- Danh sach profile (Local API cua Hidemium) ----
  ipcMain.handle('profiles:list', async (_e, payload) => {
    const { source, page } = payload || {};
    const cfg = store.load();
    const mode = source === 'local' ? 'local' : 'cloud';

    // Nho tab nguoi dung chon (ke ca khi API loi) -> mo app lan sau vao dung tab do.
    store.set('sourceMode', mode);

    const res = await listBrowsers({
      isLocal: mode === 'local',
      page: page || 1,
      baseUrl: cfg.apiBase,
    });
    return { ...res, source: mode };
  });

  /** Xem config da decode cua 1 profile bat ky (khong can chay). */
  ipcMain.handle('profile:read-config', (_e, profilePath) => readProfileConfig(profilePath));

  ipcMain.handle('shell:open-external', (_e, url) => {
    shell.openExternal(url);
    return { ok: true };
  });

  // ---- Run ----
  ipcMain.handle('run:start', async (_e, payload) => {
    const { profiles, checkKeys, threads, mode } = payload || {};
    const cfg = store.load();

    try {
      const summary = await runner.start(
        {
          profiles: profiles || [],
          checkKeys: checkKeys || [],
          threads: threads || 1,
          options: {
            apiBase: cfg.apiBase,
            autoClose: cfg.autoClose,
            mode: mode || 'check',
            testWaitMs: cfg.testWaitMs,
          },
        },
        (evt) => broadcast('run:event', evt)
      );
      return { ok: true, summary };
    } catch (err) {
      broadcast('run:event', { type: 'finish', summary: null, error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('run:stop', async () => {
    const res = await runner.stop();
    const openCount = runner.hasOpenProfiles() ? 1 : 0; // hasOpen sau stop
    broadcast('run:event', {
      type: 'stop-done',
      ...res,
      leftoverOpenCount: openCount,
      hasOpen: openCount > 0,
    });
    return { ok: true, ...res, hasOpen: openCount > 0 };
  });
  ipcMain.handle('run:status', () => ({
    running: runner.isRunning(),
    lanes: runner.lanes(),
    hasOpen: runner.hasOpenProfiles(),
  }));
}

module.exports = { register };
