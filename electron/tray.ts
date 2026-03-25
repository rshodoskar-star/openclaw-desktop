import { Tray, Menu, nativeImage, BrowserWindow, App } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { t } from './i18n';

export function buildTrayMenu(mainWindow: BrowserWindow, app: App): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: t('tray.open'),
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: t('tray.close'),
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
}

export function createTray(mainWindow: BrowserWindow, app: App): Tray {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  let trayIcon: Electron.NativeImage;

  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    trayIcon = nativeImage.createEmpty();
  }

  const tray = new Tray(trayIcon);

  tray.setToolTip('AEGIS Desktop');
  tray.setContextMenu(buildTrayMenu(mainWindow, app));
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

/** Rebuild tray labels after main-process language change (renderer → IPC). */
export function refreshTrayMenu(tray: Tray | null, mainWindow: BrowserWindow, app: App): void {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu(mainWindow, app));
}
