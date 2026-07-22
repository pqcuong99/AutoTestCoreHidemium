const path = require('path');
const { app, BrowserWindow, shell, nativeImage } = require('electron');
const ipc = require('./ipc');
const store = require('./store');
const { setLocale } = require('../shared/i18n');

let mainWindow = null;
const isDev = process.argv.includes('--dev');

// Windows: tach taskbar khoi "Electron" chung + dung icon cua cua so.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.hidemium.autotestcore');
}

const ROOT = path.join(__dirname, '..', '..');
const ICON_DIRS = [
  path.join(ROOT, 'build', 'icons'),
  path.join(ROOT, 'src', 'renderer', 'assets'),
];

/**
 * Tim icon app. Win: uu tien .ico (taskbar/title bar).
 * Fallback: PNG trong build/icons hoac renderer/assets/app-logo.png.
 */
function loadAppIcon() {
  const names =
    process.platform === 'darwin'
      ? ['dock-icon.png', 'icon.png', 'icon-512.png', 'icon-256.png', 'app-logo.png']
      : process.platform === 'win32'
        ? ['icon.ico', 'icon.png', 'icon-256.png', 'icon-512.png', 'app-logo.png']
        : ['icon.png', 'icon-512.png', 'app-logo.png'];

  for (const dir of ICON_DIRS) {
    for (const name of names) {
      const full = path.join(dir, name);
      try {
        const img = nativeImage.createFromPath(full);
        if (!img.isEmpty()) {
          if (isDev) console.log('[icon]', full, img.getSize());
          return { img, full };
        }
      } catch {
        /* skip */
      }
    }
  }
  console.warn('[icon] Khong tim thay logo — taskbar se hien icon Electron mac dinh');
  return { img: null, full: null };
}

function createWindow(appIcon, iconPath) {
  // Win: truyen path (.ico) tot hon NativeImage cho taskbar.
  const iconOpt =
    process.platform === 'win32' && iconPath
      ? iconPath
      : appIcon || undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 600,
    backgroundColor: '#111827',
    autoHideMenuBar: true,
    icon: iconOpt,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (appIcon && !appIcon.isEmpty()) {
    try {
      mainWindow.setIcon(appIcon);
    } catch {
      /* ignore */
    }
  }

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
      const again = nativeImage.createFromPath(path.join(ICON_DIRS[0], 'dock-icon.png'));
      if (!again.isEmpty() && app.dock) {
        app.dock.setIcon(again.resize({ width: 512, height: 512, quality: 'best' }));
      }
    }, 300);
  }

  createWindow(appIcon, iconPath);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(appIcon, iconPath);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
