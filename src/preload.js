// SPDX-License-Identifier: GPL-3.0-or-later
// Muvakkit — Copyright (C) 2026 Maşuk
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  onState: (cb) => ipcRenderer.on('state', (_e, st) => cb(st)),
  onShowView: (cb) => ipcRenderer.on('show-view', (_e, v) => cb(v)),
  onPanelHidden: (cb) => ipcRenderer.on('panel-hidden', () => cb()),
  setSetting: (key, value) => ipcRenderer.send('set-setting', key, value),
  dismiss: () => ipcRenderer.send('dismiss'),
  openPanel: () => ipcRenderer.send('open-panel'),
  closePanel: () => ipcRenderer.send('close-panel'),
  pinPanel: (v) => ipcRenderer.send('pin-panel', v),
  resetWidgetPos: () => ipcRenderer.send('reset-widget-pos'),
  desktopShortcut: () => ipcRenderer.send('desktop-shortcut'),
  quit: () => ipcRenderer.send('quit'),
  setInteractive: (v) => ipcRenderer.send('widget-interactive', v),
  onBgSample: (cb) => ipcRenderer.on('bg-sample', (_e, c) => cb(c)),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (_e, v) => cb(v)),
  onMoveMode: (cb) => ipcRenderer.on('move-mode', (_e, v) => cb(v)),
  endMoveMode: () => ipcRenderer.send('end-move-mode'),
  startMoveMode: () => ipcRenderer.send('start-move-mode'),
  widgetSize: (w, h) => ipcRenderer.send('widget-size', w, h),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: () => ipcRenderer.send('drag-move'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  onDragEnded: (cb) => ipcRenderer.on('drag-ended', (_e, m) => cb(m))
});
