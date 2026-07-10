import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import started from 'electron-squirrel-startup';

import { openDatabase } from './main/db/database';
import { runMigrations } from './main/db/migrate';
import { DollRepository } from './main/dolls/repository';
import { registerIpcHandlers } from './main/ipc/register-ipc';
import { SettingsRepository } from './main/settings/repository';
import { CollectorClient } from './main/collector/client';
import { PriceRepository } from './main/prices/repository';
import { PriceService } from './main/prices/service';
import { secureWebPreferences } from './main/window-options';
import { channels } from './shared/channels';

let database: DatabaseSync | undefined;
let collector: CollectorClient | undefined;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

export const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      ...secureWebPreferences,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  database = openDatabase(path.join(app.getPath('userData'), 'vetka.sqlite'));
  runMigrations(database);
  const dolls = new DollRepository(database);
  const settings = new SettingsRepository(database);
  const prices = new PriceRepository(database);
  collector = new CollectorClient({ workerPath: path.join(__dirname, 'worker.cjs') });
  collector.onProgress((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channels.collectorProgress, event);
    }
  });
  const priceService = new PriceService({
    db: database,
    prices,
    collector,
    dataDir: app.getPath('userData'),
    getRate: (currency) => {
      const rates = settings.get<Record<string, { rateMicros: number }>>('exchangeRates');
      const rate = rates?.[currency]?.rateMicros;
      if (!rate || rate <= 0) throw new Error(`Укажите курс ${currency} к тенге в настройках`);
      return rate;
    },
  });
  registerIpcHandlers(ipcMain, {
    dolls,
    settings,
    prices,
    priceService,
    version: () => app.getVersion(),
  });
  createWindow();
});

app.on('before-quit', () => {
  collector?.dispose();
  collector = undefined;
  database?.close();
  database = undefined;
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
