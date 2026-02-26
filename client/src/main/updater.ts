import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { is } from '@electron-toolkit/utils';

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  if (is.dev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Event listeners — forward to renderer via IPC
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    mainWindow.webContents.send('updater:error', { message: err.message });
  });

  // IPC handlers — renderer invokes these
  ipcMain.handle('updater:check', () => {
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:download', () => {
    autoUpdater.downloadUpdate();
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall();
  });

  // Check for updates 5 seconds after startup
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}
