const path = require('path');
const { app, BrowserWindow, shell, nativeImage } = require('electron');
const ipc = require('./ipc');
const store = require('./store');
const { setLocale } = require('../shared/i18n');

let mainWindow = null;
const isDev = process.argv.includes('--dev');

const ICONS_DIR = path.join(__dirname, '..', '..', 'build', 'icons');

function loadAppIcon() {
  // Prefer PNG for dock.setIcon — loading .icns via nativeImage can ghost/double on macOS Dock.
  // dock-icon.png first on darwin for cache-bust vs stale icon.png.
  const candidates =
    process.platform === 'darwin'
      ? ['dock-icon.png', 'icon.png', 'icon-512.png', 'icon-256.png']
      : process.platform === 'win32'
        ? ['icon.png', 'icon-256.png', 'icon-512.png']
        : ['icon.png', 'icon-512.png'];

  for (const name of candidates) {
    const full = path.join(ICONS_DIR, name);
    const img = nativeImage.createFromPath(full);
    if (!img.isEmpty()) {
      if (process.platform === 'darwin') {
        console.log('[icon] dock path', full, 'size', img.getSize());
      }
      return { img, full };
    }
  }
  return { img: null, full: null };
}

function createWindow(appIcon) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 600,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    icon: appIcon || undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setLocale(store.load().locale === 'en' ? 'en' : 'vi');
  ipc.register(() => mainWindow);

  const { img: appIcon, full: iconPath } = loadAppIcon();
  if (appIcon && process.platform === 'darwin' && app.dock) {
    // Resize to avoid Dock painting oversized bitmaps from 1024px source.
    const dockIcon = appIcon.resize({ width: 512, height: 512, quality: 'best' });
    app.dock.setIcon(dockIcon.isEmpty() ? appIcon : dockIcon);

    setTimeout(() => {
      const again = nativeImage.createFromPath(path.join(ICONS_DIR, 'dock-icon.png'));
      if (!again.isEmpty() && app.dock) {
        app.dock.setIcon(again.resize({ width: 512, height: 512, quality: 'best' }));
      }
    }, 300);
  }

  createWindow(appIcon);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(appIcon);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
