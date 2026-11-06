// SPDX-License-Identifier: GPL-3.0-or-later
// Muvakkit (eski adıyla Namaz Vakti) — Copyright (C) 2026 Maşuk
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, screen, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { buildState } = require('./vakit');
const { isFullscreenActive, sampleAround, isLeftButtonDown } = require('./fullscreen');

const AUMID = 'com.namazvakti.app';
const PANEL_W = 380, PANEL_H = 680;
const EDGE = 8; // gösterge ile ekran kenarı arasında bırakılan en az boşluk
// Microsoft Store (MSIX) sürümünde başlangıçta açılma ve kısayollar Windows tarafından yönetilir
const IS_STORE = !!process.windowsStore;

// ---------- Bellek tasarrufu ----------
// Küçük bir gösterge için ekran kartı hızlandırmasına gerek yok: ayrı GPU süreci açılmaz
// Uygulamanın adı "Muvakkit" oldu; ayarlar eski "Namaz Vakti" klasöründe kalmaya devam etsin
app.setPath('userData', path.join(app.getPath('appData'), 'Namaz Vakti'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess,HardwareMediaKeyHandling,MediaSessionService,Translate');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

let tray = null, widget = null, panel = null;
let settings = null;
let dismissedKey = null;
let notifiedKey = null;
let lastState = null;
let panelPinned = false;

// ---------- Ayarlar ----------
const settingsPath = () => path.join(app.getPath('userData'), 'ayarlar.json');

const WIDGET_DEFAULTS = {
  bg: '#1A1111', text: '#F8F1ED', accent: '#F3E6D0', entered: '#4C000F',
  opacity: 80, size: 'normal', radius: 12, icon: true,
  line1: 'vakit-saat', line2: 'kalan',
  approachMin: 10, enteredMin: 5,
  clickThrough: true, hoverFade: true,
  fullscreenMode: 'soluk', fullscreenShowEntered: true,
  textOpacity: 100, autoContrast: false
};
const DEFAULTS = { city: 'İstanbul', notify: true, sound: false, showWidget: true, autoStart: true, widgetPos: null, widget: WIDGET_DEFAULTS };

const LINE_OPTIONS = ['vakit-saat', 'vakit', 'saat', 'kalan', 'kalan-vakit', 'hicri', 'miladi', 'sehir', 'yok'];
const SIZES = ['kucuk', 'normal', 'buyuk', 'cokbuyuk'];

// Gösterge ayarlarını doğrula: bozuk ya da beklenmeyen değerler varsayılana döner
function cleanWidget(w) {
  const out = { ...WIDGET_DEFAULTS };
  if (!w || typeof w !== 'object') return out;
  for (const k of ['bg', 'text', 'accent', 'entered']) if (/^#[0-9a-fA-F]{6}$/.test(w[k])) out[k] = w[k];
  const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, Math.round(v))) : null;
  if (num(w.opacity, 20, 100) !== null) out.opacity = num(w.opacity, 20, 100);
  if (num(w.radius, 0, 30) !== null) out.radius = num(w.radius, 0, 30);
  if (num(w.approachMin, 0, 60) !== null) out.approachMin = num(w.approachMin, 0, 60);
  if (num(w.enteredMin, 0, 60) !== null) out.enteredMin = num(w.enteredMin, 0, 60);
  if (num(w.textOpacity, 20, 100) !== null) out.textOpacity = num(w.textOpacity, 20, 100);
  if (SIZES.includes(w.size)) out.size = w.size;
  if (LINE_OPTIONS.includes(w.line1)) out.line1 = w.line1;
  if (LINE_OPTIONS.includes(w.line2)) out.line2 = w.line2;
  for (const k of ['icon', 'clickThrough', 'hoverFade', 'fullscreenShowEntered', 'autoContrast']) if (typeof w[k] === 'boolean') out[k] = w[k];
  if (['soluk', 'gizle', 'normal'].includes(w.fullscreenMode)) out.fullscreenMode = w.fullscreenMode;
  if (out.line1 === 'yok' && out.line2 === 'yok') out.line1 = 'vakit-saat';
  return out;
}

function loadSettings() {
  try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; }
  catch { settings = { ...DEFAULTS }; }
  settings.widget = cleanWidget(settings.widget);
  // Eski varsayılan yeşil renkleri hiç değiştirmemiş kullanıcıları yeni kızıl temaya geçir
  const w = settings.widget;
  if (w.bg.toUpperCase() === '#14181C' && w.text.toUpperCase() === '#F2F4F5' && w.accent.toUpperCase() === '#8FD1B9' && w.entered.toUpperCase() === '#1F4D41') {
    Object.assign(w, { bg: '#1A1111', text: '#F8F1ED', accent: '#F3E6D0', entered: '#4C000F' });
  }
}
function saveSettings() {
  try { fs.mkdirSync(path.dirname(settingsPath()), { recursive: true }); fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2)); } catch {}
}

function applyAutoStart() {
  if (IS_STORE) return; // Store sürümünde: Windows Ayarlar > Uygulamalar > Başlangıç
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: !!settings.autoStart, path: process.execPath });
  }
}

// Windows bildirimleri için Başlat menüsü kısayolu
// Windows bildirimlerinde "Electron" yerine uygulamanın adı ve simgesi görünsün
function registerNotificationIdentity() {
  if (process.platform !== 'win32' || IS_STORE) return;
  try {
    const icon = path.join(app.getPath('userData'), 'bildirim-simgesi.png');
    if (!fs.existsSync(icon)) fs.writeFileSync(icon, fs.readFileSync(path.join(__dirname, 'icons', 'icon.png')));
    const key = `HKCU\\Software\\Classes\\AppUserModelId\\${AUMID}`;
    const { execFile } = require('child_process');
    execFile('reg', ['add', key, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', 'Muvakkit', '/f'], { windowsHide: true }, () => {});
    execFile('reg', ['add', key, '/v', 'IconUri', '/t', 'REG_SZ', '/d', icon, '/f'], { windowsHide: true }, () => {});
  } catch {}
}

function ensureStartMenuShortcut() {
  if (process.platform !== 'win32' || IS_STORE) return;
  try {
    const dir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    removeOldShortcut(dir);
    const lnk = path.join(dir, 'Muvakkit.lnk');
    shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create', {
      target: process.execPath, appUserModelId: AUMID, description: 'Muvakkit'
    });
  } catch {}
}

// Masaüstüne kısayol (zip sürümünü kullananlar ya da simgeyi silenler için)
function desktopShortcutPath() { return path.join(app.getPath('desktop'), 'Muvakkit.lnk'); }
// Eski isimle (Namaz Vakti) kalmış kısayollar
// Eski kısayol bu uygulamayı gösteriyorsa siler; silindiyse true döner
function removeOldShortcut(dir) {
  const old = path.join(dir, 'Namaz Vakti.lnk');
  try {
    if (!fs.existsSync(old)) return false;
    const t = shell.readShortcutLink(old).target || '';
    if (t === process.execPath || /Namaz Vakti\.exe$/i.test(t)) { fs.unlinkSync(old); return true; }
  } catch {}
  return false;
}
// Masaüstündeki eski isimli kısayolu yenisiyle değiştir
function migrateDesktopShortcut() {
  if (process.platform !== 'win32' || IS_STORE) return;
  if (removeOldShortcut(app.getPath('desktop'))) createDesktopShortcut();
}
function createDesktopShortcut() {
  if (process.platform !== 'win32' || IS_STORE) return false;
  try {
    return shell.writeShortcutLink(desktopShortcutPath(), fs.existsSync(desktopShortcutPath()) ? 'replace' : 'create', {
      target: process.execPath, appUserModelId: AUMID, description: 'Muvakkit'
    });
  } catch { return false; }
}

// ---------- Gösterge konumu ----------
// Pencereyi, merkezine en yakın ekranın çalışma alanının (görev çubuğu hariç) içine sınırlar
function clampToWorkArea(b) {
  const center = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  const wa = screen.getDisplayNearestPoint(center).workArea;
  const x = Math.min(Math.max(b.x, wa.x + EDGE), wa.x + wa.width - b.width - EDGE);
  const y = Math.min(Math.max(b.y, wa.y + EDGE), wa.y + wa.height - b.height - EDGE);
  return { x: Math.round(x), y: Math.round(y), width: b.width, height: b.height };
}

function defaultWidgetBounds(w, h) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - w - 16, y: wa.y + wa.height - h - 16, width: w, height: h };
}

function resetWidgetPosition() {
  if (!widget) return;
  const b = widget.getBounds();
  const nb = defaultWidgetBounds(b.width, b.height);
  widget.setBounds(nb);
  settings.widgetPos = { x: nb.x, y: nb.y }; saveSettings();
  applyWidgetVisibility();
}

function keepWidgetOnScreen() {
  if (!widget) return;
  const b = widget.getBounds();
  const c = clampToWorkArea(b);
  if (c.x !== b.x || c.y !== b.y) { widget.setBounds(c); settings.widgetPos = { x: c.x, y: c.y }; saveSettings(); }
}

// ---------- Tıklama geçirgenliği ve taşıma modu ----------
let moveMode = false, moveModeTimer = null;
function setWidgetInteractive(v) {
  if (!widget || widget.isDestroyed()) return;
  if (v) widget.setIgnoreMouseEvents(false);
  else widget.setIgnoreMouseEvents(true, { forward: true }); // fare hareketi yine de göstergeye bildirilir
}
function startMoveMode() {
  if (!widget) return;
  if (!settings.showWidget) setSetting('showWidget', true);
  moveMode = true;
  applyWidgetVisibility();
  setWidgetInteractive(true);
  widget.webContents.send('move-mode', true);
  clearTimeout(moveModeTimer);
  moveModeTimer = setTimeout(endMoveMode, 20000);
}
function endMoveMode() {
  if (!moveMode) return;
  moveMode = false;
  clearTimeout(moveModeTimer);
  if (widget) widget.webContents.send('move-mode', false);
  if (fullscreen) setWidgetInteractive(false);
  applyWidgetVisibility();
}

// ---------- Tam ekran (oyun / video) ----------
let fullscreen = false;
function widgetShouldBeVisible() {
  if (!settings.showWidget) return false;
  if (moveMode) return true;
  const w = settings.widget;
  if (fullscreen && w.fullscreenMode === 'gizle') {
    const entered = lastState && lastState.mode === 'girdi';
    return !!(w.fullscreenShowEntered && entered);
  }
  return true;
}
function applyWidgetVisibility() {
  if (!widget || widget.isDestroyed()) return;
  const v = widgetShouldBeVisible();
  if (v && !widget.isVisible()) widget.showInactive();
  else if (!v && widget.isVisible()) widget.hide();
}
function checkFullscreen() {
  const fs = isFullscreenActive();
  if (fs === fullscreen) return;
  fullscreen = fs;
  if (widget && !widget.isDestroyed()) widget.webContents.send('fullscreen', fs);
  if (fs) setWidgetInteractive(false); // tam ekranda tıklamalar her zaman oyuna/videoya gitsin
  else setWidgetInteractive(!settings.widget.clickThrough);
  applyWidgetVisibility();
}

// ---------- Otomatik zıt renk ----------
// Göstergenin arkasındaki rengi okuyup göstergeye bildirir; gösterge yazı rengini buna göre seçer
let lastSample = null;
function checkBackground() {
  if (!widget || widget.isDestroyed() || !widget.isVisible()) return;
  if (!settings.widget.autoContrast || fullscreen || moveMode || process.platform !== 'win32') return;
  const b = widget.getBounds();
  const phys = screen.dipToScreenRect(widget, b); // Windows ekran ölçeklendirmesi (%125, %150 vb.) için
  const c = sampleAround(phys);
  if (!c) return;
  if (lastSample && Math.abs(c.r - lastSample.r) + Math.abs(c.g - lastSample.g) + Math.abs(c.b - lastSample.b) < 24) return;
  lastSample = c;
  widget.webContents.send('bg-sample', c);
}

// ---------- Pencereler ----------
const commonPrefs = {
  preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
  spellcheck: false, enableWebSQL: false, v8CacheOptions: 'bypassHeatCheck'
};
const PANEL_FREE_AFTER = 60 * 1000; // kapandıktan 1 dk sonra pencereyi bellekten tamamen sil
let panelFreeTimer = null;

function createWidget() {
  const w = 250, h = 62;
  let b = settings.widgetPos ? { x: settings.widgetPos.x, y: settings.widgetPos.y, width: w, height: h } : defaultWidgetBounds(w, h);
  b = clampToWorkArea(b);
  widget = new BrowserWindow({
    ...b, frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false,
    show: false, title: 'Muvakkit', webPreferences: commonPrefs
  });
  widget.setAlwaysOnTop(true, 'screen-saver');
  widget.setVisibleOnAllWorkspaces(true);
  widget.loadFile(path.join(__dirname, 'widget.html'));
  setWidgetInteractive(!settings.widget.clickThrough);
  widget.once('ready-to-show', () => { applyWidgetVisibility(); pushState(); });
}

function createPanel() {
  panel = new BrowserWindow({
    width: PANEL_W, height: PANEL_H, frame: false, resizable: false,
    skipTaskbar: true, show: false, alwaysOnTop: true, transparent: true, backgroundColor: '#00000000', hasShadow: false,
    title: 'Muvakkit', webPreferences: commonPrefs
  });
  panel.loadFile(path.join(__dirname, 'panel.html'));
  panel.on('blur', () => { if (panel && panel.isVisible() && !panelPinned) panel.hide(); });
  panel.on('hide', () => {
    panelPinned = false;
    clearTimeout(panelFreeTimer);
    panelFreeTimer = setTimeout(() => { if (panel && !panel.isVisible()) panel.destroy(); }, PANEL_FREE_AFTER);
  });
  panel.on('closed', () => { panel = null; });
}

function placePanel() {
  const wa = screen.getPrimaryDisplay().workArea;
  let x = wa.x + wa.width - PANEL_W - 16, y = wa.y + wa.height - PANEL_H - 16;
  if (widget && widget.isVisible()) {
    const b = widget.getBounds();
    const d = screen.getDisplayMatching(b).workArea;
    x = b.x + b.width - PANEL_W;
    y = b.y - PANEL_H - 10;
    if (y < d.y + EDGE) y = b.y + b.height + 10;
    x = Math.min(Math.max(x, d.x + EDGE), d.x + d.width - PANEL_W - EDGE);
    y = Math.min(Math.max(y, d.y + EDGE), d.y + d.height - PANEL_H - EDGE);
  }
  panel.setBounds({ x: Math.round(x), y: Math.round(y), width: PANEL_W, height: PANEL_H });
}

function showPanel(view) {
  clearTimeout(panelFreeTimer);
  const reveal = () => {
    if (!panel) return;
    placePanel();
    pushState();
    panel.webContents.send('show-view', view || 'main');
    panel.show();
    panel.focus();
  };
  if (!panel) { createPanel(); panel.once('ready-to-show', reveal); }
  else reveal();
}

function togglePanel() { if (panel && panel.isVisible()) panel.hide(); else showPanel('main'); }

// ---------- Tepsi simgesi ----------
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Vakitleri göster', click: () => showPanel('main') },
    { label: 'Göstergeyi özelleştir', click: () => showPanel('custom') },
    { type: 'separator' },
    { label: 'Köşe göstergesi', type: 'checkbox', checked: settings.showWidget, click: (i) => setSetting('showWidget', i.checked) },
    { label: 'Göstergeyi taşı', click: startMoveMode },
    { label: 'Göstergeyi sağ alt köşeye al', click: resetWidgetPosition },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
}

function createTray() {
  // macOS menü çubuğunda sistem rengine uyan "template" simge kullanılır
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icons', file));
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Muvakkit');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', togglePanel);
}

// ---------- Durum ----------
function setSetting(key, value) {
  if (key === 'widget') settings.widget = cleanWidget(value);
  else settings[key] = value;
  saveSettings();
  if (key === 'autoStart') applyAutoStart();
  if (key === 'showWidget' || key === 'widget') applyWidgetVisibility();
  if (key === 'widget') { lastSample = null; setTimeout(checkBackground, 50); }
  if (key === 'city') { dismissedKey = null; }
  if (tray) tray.setContextMenu(buildTrayMenu());
  pushState();
}

function pushState() {
  const now = new Date();
  const w = settings.widget;
  const st = buildState(now, settings.city, dismissedKey, { approachMin: w.approachMin, enteredMin: w.enteredMin });
  st.settings = { notify: settings.notify, sound: settings.sound, showWidget: settings.showWidget, autoStart: settings.autoStart, widget: w, store: IS_STORE };
  st.widgetDefaults = WIDGET_DEFAULTS;
  st.version = app.getVersion();
  st.canDesktopShortcut = process.platform === 'win32' && !IS_STORE;
  st.hasDesktopShortcut = st.canDesktopShortcut && fs.existsSync(desktopShortcutPath());
  lastState = st;

  // Bildirim: bir vakit yeni girdiyse (Güneş hariç) bir kez göster
  const le = st.lastEntered;
  if (le && now - le.at < 2 * 60000 && notifiedKey !== le.id) {
    notifiedKey = le.id;
    if (settings.notify && Notification.isSupported()) {
      new Notification({
        title: `${le.name} vakti girdi`,
        body: st.next.toward,
        silent: !settings.sound,
        icon: path.join(__dirname, 'icons', 'icon.png')
      }).show();
    }
  }

  if (tray) tray.setToolTip(`Muvakkit — ${st.tooltip}`);
  applyWidgetVisibility();
  for (const win of [widget, panel]) if (win && !win.isDestroyed()) win.webContents.send('state', st);
}

// ---------- IPC ----------
ipcMain.handle('get-state', () => { pushState(); return lastState; });
ipcMain.on('set-setting', (_e, key, value) => {
  if (key in DEFAULTS && key !== 'widgetPos') setSetting(key, value);
});
ipcMain.on('dismiss', () => { if (lastState && lastState.entered) { dismissedKey = lastState.entered.id; pushState(); } });
ipcMain.on('open-panel', () => togglePanel());
ipcMain.on('close-panel', () => { if (panel) panel.hide(); });
ipcMain.on('pin-panel', (_e, v) => { panelPinned = !!v; });
ipcMain.on('reset-widget-pos', () => resetWidgetPosition());
ipcMain.on('widget-interactive', (_e, v) => { if (!moveMode) setWidgetInteractive(!!v); });
ipcMain.on('start-move-mode', () => { if (panel) panel.hide(); startMoveMode(); });
ipcMain.on('end-move-mode', () => endMoveMode());
ipcMain.on('desktop-shortcut', () => { createDesktopShortcut(); pushState(); });
ipcMain.on('quit', () => { app.isQuitting = true; app.quit(); });

// Gösterge içeriğine göre pencere boyutu: sağ alt köşe sabit kalır
ipcMain.on('widget-size', (_e, w, h) => {
  if (!widget || drag || !(w > 20 && h > 20 && w < 1200 && h < 400)) return;
  w = Math.ceil(w); h = Math.ceil(h);
  const b = widget.getBounds();
  // Ekran ölçeklendirmesinde (%125, %150) yuvarlama yüzünden 1 px fark olabilir: bunu yok say, yoksa gösterge kayar
  if (Math.abs(b.width - w) <= 1 && Math.abs(b.height - h) <= 1) return;
  const nb = clampToWorkArea({ x: b.x + b.width - w, y: b.y + b.height - h, width: w, height: h });
  widget.setBounds(nb);
  settings.widgetPos = { x: nb.x, y: nb.y }; saveSettings();
});

// ---------- Sürükleme ----------
// Konum, farenin ekrandaki gerçek yerinden hesaplanır (göstergenin fare olaylarına bağlı değildir).
// Windows'ta sol tuş bırakıldığı an sürükleme kesin olarak biter; gösterge fareyi "kovalamaz".
let drag = null; // { bounds, cursor, timer, moved, started }
function finishDrag() {
  if (!drag) return;
  clearInterval(drag.timer);
  const wasMoved = drag.moved;
  drag = null;
  if (widget && !widget.isDestroyed()) {
    keepWidgetOnScreen();
    const [x, y] = widget.getPosition(); settings.widgetPos = { x, y }; saveSettings();
    widget.webContents.send('drag-ended', wasMoved);
  }
  lastSample = null; setTimeout(checkBackground, 150);
}
// Göstergeyi farenin gerçek konumuna taşı. Fare her kıpırdadığında (göstergeden gelen
// olayla) hemen çağrılır; böylece ekranın yenilenme hızında, akıcı bir taşıma olur.
function dragStep() {
  if (!drag || !widget || widget.isDestroyed()) return;
  const c = screen.getCursorScreenPoint();
  const dx = c.x - drag.cursor.x, dy = c.y - drag.cursor.y;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  if (!drag.moved) return;
  const nb = clampToWorkArea({ ...drag.bounds, x: drag.bounds.x + dx, y: drag.bounds.y + dy });
  if (nb.x === drag.lastX && nb.y === drag.lastY) return;
  drag.lastX = nb.x; drag.lastY = nb.y;
  widget.setPosition(nb.x, nb.y);
  // Farklı ölçekli bir ekrana geçerken boyut değişirse eski boyuta geri al
  const [w, h] = widget.getSize();
  if (w !== drag.bounds.width || h !== drag.bounds.height) {
    widget.setBounds({ x: nb.x, y: nb.y, width: drag.bounds.width, height: drag.bounds.height });
  }
}
ipcMain.on('drag-start', () => {
  if (!widget) return;
  if (drag) clearInterval(drag.timer);
  drag = { bounds: widget.getBounds(), cursor: screen.getCursorScreenPoint(), moved: false, started: Date.now(), lastX: null, lastY: null };
  // Yedek döngü: tuşun bırakıldığını yakalar, olay gelmezse de konumu günceller
  drag.timer = setInterval(() => {
    if (!drag || !widget || widget.isDestroyed()) return finishDrag();
    const btn = isLeftButtonDown();
    if (btn === false || Date.now() - drag.started > 120000) return finishDrag();
    dragStep();
  }, 16);
});
ipcMain.on('drag-move', () => {
  if (!drag) return;
  if (isLeftButtonDown() === false) return finishDrag();
  dragStep();
});
ipcMain.on('drag-end', () => finishDrag());

// ---------- Başlat ----------
app.on('second-instance', () => showPanel('main'));

app.whenReady().then(() => {
  if (!gotLock) return;
  if (process.platform === 'win32' && !IS_STORE) app.setAppUserModelId(AUMID);
  if (process.platform === 'darwin' && app.dock) app.dock.hide(); // Dock'ta değil, menü çubuğunda dursun
  loadSettings();
  ensureStartMenuShortcut();
  registerNotificationIdentity();
  migrateDesktopShortcut();
  applyAutoStart();
  createTray();
  createWidget();
  setTimeout(() => { if (!settings.seenIntro) { settings.seenIntro = true; saveSettings(); showPanel('main'); } }, 800);
  setInterval(pushState, 5000);
  setInterval(checkFullscreen, 1500);
  setInterval(checkBackground, 2000);
  // Ekran çözünürlüğü değişir ya da ikinci ekran çıkarılırsa gösterge görünür alana döner
  for (const ev of ['display-removed', 'display-metrics-changed', 'display-added']) screen.on(ev, () => setTimeout(keepWidgetOnScreen, 300));
});

app.on('window-all-closed', () => { /* tepside çalışmaya devam et */ });
