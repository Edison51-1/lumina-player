const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const MEDIA_EXT = ['mp4', 'm4v', 'webm', 'mkv', 'ogv', 'ogg', 'mov', 'mp3', 'wav', 'flac', 'm4a'];
let win;

function isMedia(p) {
  try {
    return fs.statSync(p).isFile() && MEDIA_EXT.includes(path.extname(p).slice(1).toLowerCase());
  } catch { return false; }
}
const toItem = (p) => ({ name: path.basename(p), url: pathToFileURL(p).href });
const fromArgs = (argv) => argv.slice(app.isPackaged ? 1 : 2).filter(isMedia).map(toItem);

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 680, minWidth: 560, minHeight: 360,
    backgroundColor: '#161c27',
    title: 'Lumina Player',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      win.webContents.send('open-items', fromArgs(argv));
    }
  });

  app.whenReady().then(() => {
    ipcMain.handle('init:items', () => fromArgs(process.argv));
    ipcMain.handle('dialog:open', async () => {
      const r = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Vidéos et audio', extensions: MEDIA_EXT }]
      });
      return r.canceled ? [] : r.filePaths.filter(isMedia).map(toItem);
    });
    ipcMain.handle('dialog:subtitle', async () => {
      const r = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Sous-titres', extensions: ['srt', 'vtt'] }]
      });
      if (r.canceled) return null;
      const p = r.filePaths[0];
      return { name: path.basename(p), ext: path.extname(p).slice(1).toLowerCase(), text: fs.readFileSync(p, 'utf8') };
    });
    ipcMain.handle('save:shot', (_e, dataUrl) => {
      const dir = app.getPath('pictures');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'Lumina-' + Date.now() + '.png');
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      return file;
    });
    ipcMain.handle('files:resolve', (_e, paths) => paths.filter(isMedia).map(toItem));
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
