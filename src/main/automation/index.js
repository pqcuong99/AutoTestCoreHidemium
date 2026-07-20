/**
 * IPC cua man Automation.
 *
 * Man Automation chay LONG trong cua so chinh (lop phu React), khong con
 * mo BrowserWindow rieng nua -> file nay chi con lo phan du lieu:
 * doc/ghi kich ban va chay executor, roi ban su kien ve cua so chinh.
 */
const { ipcMain } = require('electron');
const store = require('../store');
const scripts = require('./store');
const executor = require('./executor');

/**
 * @param {() => Electron.BrowserWindow|null} getWindow  cua so chinh, de ban su kien chay
 */
function register(getWindow) {
  const emit = (evt) => {
    const w = getWindow && getWindow();
    if (w && !w.isDestroyed()) w.webContents.send('automation:event', evt);
  };

  ipcMain.handle('automation:list', () => scripts.list());
  ipcMain.handle('automation:get', (_e, id) => scripts.get(id));
  ipcMain.handle('automation:save', (_e, script) => scripts.save(script || {}));
  ipcMain.handle('automation:remove', (_e, id) => scripts.remove(id));

  ipcMain.handle('automation:run', async (_e, flow) => {
    const cfg = store.load();
    try {
      // Chay nen: tra ve ngay de UI khong bi treo, tien do bao qua 'automation:event'.
      executor
        .run(flow || {}, { apiBase: cfg.apiBase, uuid: flow?.uuid || null }, emit)
        .catch((err) => emit({ type: 'finish', error: err.message }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('automation:stop', () => ({ ok: true, wasRunning: executor.stop() }));
  ipcMain.handle('automation:status', () => ({ running: executor.isRunning() }));
}

module.exports = { register };
