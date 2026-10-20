// 预加载脚本：通过 contextBridge 安全地暴露 IPC 给渲染进程。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onStatus: (cb) => ipcRenderer.on('status', (e, d) => cb(d)),
  onChampSelect: (cb) => ipcRenderer.on('champ-select', (e, d) => cb(d)),
  onLive: (cb) => ipcRenderer.on('live', (e, d) => cb(d)),
  onHistory: (cb) => ipcRenderer.on('history', (e, d) => cb(d)),
  onOverlayLive: (cb) => ipcRenderer.on('overlay-live', (e, d) => cb(d)),
  getAdapters: () => ipcRenderer.invoke('get-adapters'),
  setOverlayEnabled: (v) => ipcRenderer.invoke('set-overlay-enabled', v),
});
