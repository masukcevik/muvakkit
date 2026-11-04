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

function applyLook(w) {
  root.setProperty('--s', SCALE[w.size] || 1);
  root.setProperty('--bg', rgba(w.bg, w.opacity / 100));
  root.setProperty('--text', w.text);
  root.setProperty('--sub', rgba(w.text, 0.72));
  root.setProperty('--line', rgba(w.text, 0.12));
  root.setProperty('--accent', w.accent);
  root.setProperty('--entered', rgba(w.entered, Math.max(w.opacity, 90) / 100));
  root.setProperty('--radius', w.radius + 'px');
}

function render(st) {
  if (!st) return;
  const w = st.settings.widget;
  const ctChanged = !lastW || lastW.clickThrough !== w.clickThrough;
  lastW = w; lastState = st;
  applyLook(w);
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
    ? `${st.tooltip}\nCtrl + tık: vakitler · Ctrl + sürükle: taşı`
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

pill.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (clickThrough() && !mod(e)) return;
  down = { x: e.screenX, y: e.screenY }; moved = false; dragging = true;
  pill.setPointerCapture(e.pointerId);
  window.api.dragStart();
});
pill.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.screenX - down.x, dy = e.screenY - down.y;
  if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
  if (moved) window.api.dragMove(dx, dy);
});
pill.addEventListener('pointerup', (e) => {
  if (!down) return;
  pill.releasePointerCapture(e.pointerId);
  const wasMove = moveMode;
  if (moved) window.api.dragEnd();
  else if (!wasMove && lastW && lastW.clickThrough) window.api.openPanel(); // Ctrl + tık
  if (wasMove) window.api.endMoveMode();
  down = null; dragging = false;
  refreshHover(e);
});
pill.addEventListener('dblclick', () => {
  if (lastW && !lastW.clickThrough && !moveMode) window.api.openPanel();
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
