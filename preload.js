const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('lumina', {
  initialItems: () => ipcRenderer.invoke('init:items'),
  openFiles: () => ipcRenderer.invoke('dialog:open'),
  saveShot: (d) => ipcRenderer.invoke('save:shot', d),
  openSubtitle: () => ipcRenderer.invoke('dialog:subtitle'),
  resolveDropped: (files) =>
    ipcRenderer.invoke('files:resolve', files.map((f) => webUtils.getPathForFile(f))),
  onOpenItems: (cb) => ipcRenderer.on('open-items', (_e, items) => cb(items))
});
