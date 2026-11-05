// SPDX-License-Identifier: GPL-3.0-or-later
// Namaz Vakti — Copyright (C) 2026 Maşuk
const pill = document.getElementById('pill');
const titleEl = document.getElementById('title');
const subEl = document.getElementById('sub');
const closeBtn = document.getElementById('close');
const root = document.documentElement.style;

let lastW = null, lastState = null, moveMode = false, fsActive = false;
const SCALE = { kucuk: 0.85, normal: 1, buyuk: 1.2, cokbuyuk: 1.45 };

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function lineText(key, st) {
  const n = st.next;
  switch (key) {
    case 'vakit-saat': return `${n.name} · ${n.time}`;
    case 'vakit': return n.name;
    case 'saat': return n.time;
    case 'kalan': return n.sub;
    case 'kalan-vakit': return n.toward;
    case 'hicri': return st.hijriText;
    case 'miladi': return st.dateShort;
    case 'sehir': return st.city;
    default: return '';
  }
}

// ---------- Renk yardımcıları ----------
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function lum({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function mix(top, bottom, a) { return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a) }; }
const LIGHT = '#F5F7F8', DARK = '#14181C';
let bgSample = null; // göstergenin arkasındaki renk (Windows'ta ana süreçten gelir)

// Otomatik zıt renk: seçilen yazı rengi arkadaki renkle okunaklıysa korunur, değilse açık/koyu olana geçilir
function pickColors(w, mode) {
  const base = { text: w.text, accent: w.accent, shadow: 'none' };
  if (!w.autoContrast || !bgSample) return base;
  const pill = mode === 'girdi' ? hexRgb(w.entered) : hexRgb(w.bg);
  const alpha = mode === 'girdi' ? Math.max(w.opacity, 90) / 100 : w.opacity / 100;
  const eff = mix(pill, bgSample, alpha);
  let text = w.text;
  if (contrast(hexRgb(text), eff) < 4.5) text = contrast(hexRgb(LIGHT), eff) >= contrast(hexRgb(DARK), eff) ? LIGHT : DARK;
  const accent = contrast(hexRgb(w.accent), eff) < 2.2 ? text : w.accent;
  // Arka plan çok saydamsa yazının etrafına hafif bir gölge: karışık arka planlarda da okunsun
  const shadowCol = lum(hexRgb(text)) > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
  return { text, accent, shadow: alpha < 0.6 ? `0 0 3px ${shadowCol}` : 'none' };
}

function applyLook(w, mode) {
  const c = pickColors(w, mode);
  const to = (w.textOpacity ?? 100) / 100;
  root.setProperty('--s', SCALE[w.size] || 1);
  root.setProperty('--bg', rgba(w.bg, w.opacity / 100));
  root.setProperty('--text', rgba(c.text, to));
  root.setProperty('--sub', rgba(c.text, 0.72 * to));
  root.setProperty('--line', rgba(c.text, 0.12));
  root.setProperty('--accent', c.accent);
  root.setProperty('--entered', rgba(w.entered, Math.max(w.opacity, 90) / 100));
  root.setProperty('--radius', w.radius + 'px');
  root.setProperty('--shadow', c.shadow);
}

function render(st) {
  if (!st) return;
  const w = st.settings.widget;
  const ctChanged = !lastW || lastW.clickThrough !== w.clickThrough;
  lastW = w; lastState = st;
  applyLook(w, st.mode);
  if (ctChanged) { interactive = null; setInteractive(!clickThrough()); }
  const keep = ['ghost', 'active'].filter(c => pill.classList.contains(c));
  // Tam ekranda soluk: vakit girdiyse (ayar açıksa) normal görünür
  const fsDim = fsActive && w.fullscreenMode === 'soluk' && !(w.fullscreenShowEntered && st.mode === 'girdi') && !moveMode;
  pill.className = ['pill', st.mode, w.icon ? '' : 'noicon', moveMode ? 'moving' : '', fsDim ? 'fs' : '', ...keep].filter(Boolean).join(' ');
  if (st.mode === 'girdi' && st.entered) {
    titleEl.textContent = `${st.entered.name} vakti girdi`;
    subEl.textContent = st.next.toward;
    titleEl.classList.remove('hidden'); subEl.classList.remove('hidden');
  } else {
    const t1 = lineText(w.line1, st), t2 = lineText(w.line2, st);
    titleEl.textContent = t1 || t2;
    subEl.textContent = t1 ? t2 : '';
    subEl.classList.toggle('hidden', !subEl.textContent);
  }
  if (moveMode) { titleEl.textContent = 'Sürükleyip bırak'; subEl.textContent = 'Yeni yerine taşı'; subEl.classList.remove('hidden'); }
  pill.title = w.clickThrough
    ? `${st.tooltip}\n${KEY} + tık: vakitler · ${KEY} + sürükle: taşı`
    : `${st.tooltip}\nÇift tık: vakitler · Sürükle: taşı`;
}

// Pencereyi göstergenin boyutuna uydur (şeffaf boşluk tıklamaları engellemesin)
new ResizeObserver(() => {
  const r = pill.getBoundingClientRect();
  window.api.widgetSize(r.width + 8, r.height + 8);
}).observe(pill);

window.api.onState(render);
window.api.getState().then(render);

closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
closeBtn.addEventListener('click', (e) => { e.stopPropagation(); window.api.dismiss(); });

// ---------- Etkileşim ----------
// Varsayılan: tıklamalar göstergenin arkasındaki pencereye geçer.
// Ctrl basılıyken: Ctrl + tık = vakitler penceresi, Ctrl + sürükle = taşı.
// "Arkaya geçsin" kapalıysa: sürükle = taşı, çift tık = vakitler penceresi.
const IS_MAC = /Mac/.test(navigator.userAgent);
const KEY = IS_MAC ? '⌘' : 'Ctrl';
let interactive = null, dragging = false, down = null, moved = false;
const mod = (e) => e.ctrlKey || e.metaKey;
const clickThrough = () => (!!(lastW && lastW.clickThrough) || fsActive) && !moveMode;

function setInteractive(v) {
  if (v === interactive) return;
  interactive = v;
  window.api.setInteractive(v);
}
function refreshHover(e) {
  if (dragging) return;
  if (!clickThrough()) { setInteractive(true); pill.classList.remove('ghost', 'active'); return; }
  if (mod(e)) { setInteractive(true); pill.classList.add('active'); pill.classList.remove('ghost'); }
  else { setInteractive(false); pill.classList.remove('active'); pill.classList.toggle('ghost', !!lastW.hoverFade); }
}
document.addEventListener('mousemove', refreshHover);
document.addEventListener('mouseleave', () => {
  if (dragging) return;
  pill.classList.remove('ghost', 'active');
  if (clickThrough()) setInteractive(false);
});

// Mac'te Ctrl + tık sağ tık menüsü açmak ister; engelle
document.addEventListener('contextmenu', (e) => e.preventDefault());

pill.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (clickThrough() && !mod(e)) return;
  down = { x: e.screenX, y: e.screenY }; moved = false; dragging = true;
  try { pill.setPointerCapture(e.pointerId); } catch {}
  window.api.dragStart(); // taşıma ana süreçte, farenin gerçek konumuna göre yapılır
});
pill.addEventListener('pointermove', (e) => {
  if (!down) return;
  if (!moved && Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) > 4) moved = true;
  window.api.dragMove(); // ana süreç konumu hemen günceller (akıcı taşıma)
});
function endPointer(e, canceled) {
  if (!down) return;
  try { pill.releasePointerCapture(e.pointerId); } catch {}
  const wasMove = moveMode;
  window.api.dragEnd();
  if (!canceled && !moved && !wasMove && lastW && lastW.clickThrough) window.api.openPanel(); // Ctrl + tık
  if (wasMove) window.api.endMoveMode();
  down = null; dragging = false;
  refreshHover(e);
}
pill.addEventListener('pointerup', (e) => endPointer(e, false));
pill.addEventListener('pointercancel', (e) => endPointer(e, true));
pill.addEventListener('lostpointercapture', (e) => { if (down) endPointer(e, true); });
// Ana süreç sürüklemeyi bitirdiyse (tuş bırakıldı) burada da sıfırla
window.api.onDragEnded((wasMoved) => {
  if (wasMoved) moved = true;
  if (down) { const wasMove = moveMode; down = null; dragging = false; if (wasMove) window.api.endMoveMode(); }
});
pill.addEventListener('dblclick', () => {
  if (lastW && !lastW.clickThrough && !moveMode) window.api.openPanel();
});

window.api.onBgSample((c) => {
  bgSample = c;
  if (lastState) render(lastState);
});

window.api.onFullscreen((v) => {
  fsActive = v;
  interactive = null;
  if (lastState) render(lastState);
});

window.api.onMoveMode((v) => {
  moveMode = v;
  pill.classList.toggle('moving', v);
  if (lastState) render(lastState);
  setInteractive(v || !clickThrough());
});
