// SPDX-License-Identifier: GPL-3.0-or-later
// Namaz Vakti — Copyright (C) 2026 Maşuk
const $ = (id) => document.getElementById(id);
let citiesFilled = false;
let st = null;
let w = null;          // göstergenin güncel ayarları
let defaults = null;

// ---------- Görünüm geçişi ----------
function showView(v) {
  $('main').classList.toggle('hidden', v !== 'main');
  $('custom').classList.toggle('hidden', v !== 'custom');
  // Özelleştirirken renk seçici açılınca pencere kapanmasın
  window.api.pinPanel(v === 'custom');
}
window.api.onShowView(showView);
window.api.onPanelHidden(() => showView('main'));

// ---------- Ana görünüm ----------
function renderMain() {
  if (!citiesFilled) {
    for (const c of st.cities) {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      $('city').appendChild(o);
    }
    citiesFilled = true;
  }
  if (document.activeElement !== $('city')) $('city').value = st.city;
  $('date').textContent = st.dateText;
  $('day').textContent = st.dayText;
  $('hijri').textContent = st.hijriText;
  $('version').textContent = st.version ? 'v' + st.version : '';

  if (st.mode === 'girdi' && st.entered) {
    $('cardLabel').textContent = 'Şu an';
    $('cardTitle').textContent = `${st.entered.name} vakti girdi`;
    $('cardSub').textContent = st.next.toward;
  } else {
    $('cardLabel').textContent = st.next.isSunrise ? 'Sabah vakti' : 'Sıradaki vakit';
    $('cardTitle').textContent = `${st.next.name} · ${st.next.time}`;
    $('cardSub').textContent = st.next.sub;
  }

  const list = $('list');
  list.textContent = '';
  for (const t of st.times) {
    const row = document.createElement('div');
    row.className = 'row ' + t.status;
    const a = document.createElement('span'); a.textContent = t.name;
    const b = document.createElement('span'); b.textContent = t.time;
    row.append(a, b);
    list.appendChild(row);
  }

  for (const k of ['notify', 'sound', 'showWidget', 'autoStart']) $(k).checked = !!st.settings[k];
  $('sound').disabled = !st.settings.notify;
  // Store sürümünde başlangıç ayarı Windows'tan yönetilir
  $('autoStartRow').style.display = st.settings.store ? 'none' : '';
}

// ---------- Özelleştir görünümü ----------
const PRESETS = [
  { name: 'Koyu', bg: '#14181C', text: '#F2F4F5', accent: '#8FD1B9', entered: '#1F4D41', opacity: 80 },
  { name: 'Açık', bg: '#FFFFFF', text: '#1C2226', accent: '#2F8F70', entered: '#CFEDE2', opacity: 92 },
  { name: 'Gece mavisi', bg: '#13213A', text: '#EAF0FA', accent: '#7DB4FF', entered: '#1F4E8C', opacity: 88 },
  { name: 'Toprak', bg: '#2B2420', text: '#F4EDE4', accent: '#E3A86B', entered: '#6B4A2B', opacity: 90 },
  { name: 'Mor', bg: '#221A33', text: '#F1ECFA', accent: '#C3A6FF', entered: '#4B3380', opacity: 88 },
  { name: 'Sade', bg: '#000000', text: '#FFFFFF', accent: '#FFFFFF', entered: '#1F4D41', opacity: 35 }
];
const SWATCHES = {
  bg: ['#14181C', '#FFFFFF', '#13213A', '#2B2420', '#221A33', '#1F4D41', '#000000', '#F4EFE6'],
  text: ['#F2F4F5', '#1C2226', '#FFFFFF', '#000000', '#EAF0FA', '#F4EDE4', '#8FD1B9', '#FFD166'],
  accent: ['#8FD1B9', '#2F8F70', '#7DB4FF', '#E3A86B', '#C3A6FF', '#FFD166', '#F28B82', '#FFFFFF'],
  entered: ['#1F4D41', '#CFEDE2', '#1F4E8C', '#6B4A2B', '#4B3380', '#8A2E2E', '#2E6B5E', '#000000']
};
const LINES = [
  ['vakit-saat', 'Vakit · saat (İkindi · 15:37)'],
  ['vakit', 'Vakit adı (İkindi)'],
  ['saat', 'Vakit saati (15:37)'],
  ['kalan', 'Kalan süre (42 dk kaldı)'],
  ['kalan-vakit', "Vakte kalan (İkindi'ye 42 dk)"],
  ['hicri', 'Hicri tarih'],
  ['miladi', 'Tarih ve gün'],
  ['sehir', 'Şehir'],
  ['yok', 'Gösterme']
];

function save() { window.api.setSetting('widget', w); }
function setW(patch) { w = { ...w, ...patch }; renderCustom(); save(); }
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

function buildCustom() {
  // Hazır temalar
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'chip';
    const d = document.createElement('span'); d.className = 'dot';
    d.style.background = p.bg; d.style.boxShadow = `inset 0 0 0 3px ${p.accent}`;
    b.append(d, document.createTextNode(p.name));
    b.addEventListener('click', () => { const { name, ...rest } = p; setW(rest); });
    b.dataset.preset = p.name;
    $('presets').appendChild(b);
  }
  // Renk örnekleri
  document.querySelectorAll('.sw').forEach((box) => {
    const key = box.dataset.color;
    for (const c of SWATCHES[key]) {
      const s = document.createElement('button');
      s.className = 'swatch'; s.style.background = c; s.dataset.c = c;
      s.setAttribute('aria-label', c);
      s.addEventListener('click', () => setW({ [key]: c }));
      box.appendChild(s);
    }
    const pick = document.createElement('input');
    pick.type = 'color'; pick.title = 'Başka bir renk seç'; pick.setAttribute('aria-label', 'Özel renk');
    pick.addEventListener('input', (e) => setW({ [key]: e.target.value.toUpperCase() }));
    box.appendChild(pick);
  });
  // Satırlar
  for (const id of ['line1', 'line2']) {
    for (const [v, label] of LINES) {
      const o = document.createElement('option'); o.value = v; o.textContent = label; $(id).appendChild(o);
    }
    $(id).addEventListener('change', (e) => setW({ [id]: e.target.value }));
  }
  $('opacity').addEventListener('input', (e) => setW({ opacity: Number(e.target.value) }));
  $('textOpacity').addEventListener('input', (e) => setW({ textOpacity: Number(e.target.value) }));
  $('autoContrast').addEventListener('change', (e) => setW({ autoContrast: e.target.checked }));
  $('radius').addEventListener('input', (e) => setW({ radius: Number(e.target.value) }));
  $('icon').addEventListener('change', (e) => setW({ icon: e.target.checked }));
  $('clickThrough').addEventListener('change', (e) => setW({ clickThrough: e.target.checked }));
  $('hoverFade').addEventListener('change', (e) => setW({ hoverFade: e.target.checked }));
  $('moveWidget').addEventListener('click', () => window.api.startMoveMode());
  $('fullscreenMode').addEventListener('change', (e) => setW({ fullscreenMode: e.target.value }));
  $('fullscreenShowEntered').addEventListener('change', (e) => setW({ fullscreenShowEntered: e.target.checked }));
  for (const id of ['approachMin', 'enteredMin']) $(id).addEventListener('change', (e) => setW({ [id]: Number(e.target.value) }));
  $('size').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setW({ size: b.dataset.v })));
  $('resetPos').addEventListener('click', () => window.api.resetWidgetPos());
  $('resetAll').addEventListener('click', () => setW({ ...defaults }));
}

function renderCustom() {
  if (!w) return;
  document.querySelectorAll('#presets .chip').forEach((b) => {
    const p = PRESETS.find(x => x.name === b.dataset.preset);
    b.classList.toggle('on', same(p.bg, w.bg) && same(p.text, w.text) && same(p.accent, w.accent) && same(p.entered, w.entered) && p.opacity === w.opacity);
  });
  document.querySelectorAll('.sw').forEach((box) => {
    const key = box.dataset.color;
    box.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', same(s.dataset.c, w[key])));
    const pick = box.querySelector('input[type=color]');
    if (document.activeElement !== pick) pick.value = w[key].toLowerCase();
  });
  if (document.activeElement !== $('opacity')) $('opacity').value = w.opacity;
  $('opacityVal').textContent = '%' + w.opacity;
  if (document.activeElement !== $('textOpacity')) $('textOpacity').value = w.textOpacity;
  $('textOpacityVal').textContent = '%' + w.textOpacity;
  $('autoContrast').checked = w.autoContrast;
  if (document.activeElement !== $('radius')) $('radius').value = w.radius;
  $('radiusVal').textContent = w.radius + ' px';
  $('size').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === w.size));
  $('icon').checked = w.icon;
  $('clickThrough').checked = w.clickThrough;
  $('hoverFade').checked = w.hoverFade;
  $('hoverFade').disabled = !w.clickThrough;
  $('fullscreenMode').value = w.fullscreenMode;
  $('fullscreenShowEntered').checked = w.fullscreenShowEntered;
  $('fullscreenShowEntered').disabled = w.fullscreenMode === 'normal';
  $('ctHint').textContent = w.clickThrough
    ? 'Göstergeyle işlem yapmak için Ctrl tuşunu basılı tut: Ctrl + tık vakitleri açar, Ctrl + sürükle taşır.'
    : 'Gösterge tıklamaları yakalar: çift tık vakitleri açar, sürükle taşır.';
  $('line1').value = w.line1; $('line2').value = w.line2;
  $('approachMin').value = String(w.approachMin);
  $('enteredMin').value = String(w.enteredMin);
}

// ---------- Durum ----------
let built = false;
function render(s) {
  if (!s) return;
  st = s;
  defaults = s.widgetDefaults;
  if (!built) { buildCustom(); built = true; }
  // Kullanıcı bir değeri sürüklerken gelen periyodik güncelleme onu ezmesin
  const busy = ['opacity', 'textOpacity', 'radius'].includes(document.activeElement && document.activeElement.id);
  if (!busy) w = { ...s.settings.widget };
  renderMain();
  renderCustom();
}

window.api.onState(render);
window.api.getState().then(render);

$('city').addEventListener('change', (e) => window.api.setSetting('city', e.target.value));
for (const k of ['notify', 'sound', 'showWidget', 'autoStart']) {
  $(k).addEventListener('change', (e) => window.api.setSetting(k, e.target.checked));
}
$('openCustom2').addEventListener('click', () => showView('custom'));
$('back').addEventListener('click', () => showView('main'));
$('close').addEventListener('click', () => window.api.closePanel());
$('close2').addEventListener('click', () => window.api.closePanel());
$('quit').addEventListener('click', () => window.api.quit());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('custom').classList.contains('hidden')) showView('main'); else window.api.closePanel(); }
});
