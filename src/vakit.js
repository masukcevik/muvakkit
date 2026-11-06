// SPDX-License-Identifier: GPL-3.0-or-later
// Muvakkit — Copyright (C) 2026 Maşuk
// Namaz vakti hesaplama ve gösterge durumu (Electron'dan bağımsız, test edilebilir)
const adhan = require('adhan');
const CITIES = require('./cities');

const NAMES = [
  ['fajr', 'İmsak'], ['sunrise', 'Güneş'], ['dhuhr', 'Öğle'],
  ['asr', 'İkindi'], ['maghrib', 'Akşam'], ['isha', 'Yatsı']
];

const APPROACH_MIN = 10; // vakte bu kadar dakika kala "yaklaşıyor"
const ENTERED_MIN = 5;   // vakit girdikten sonra bu kadar dakika "girdi" durumu

function findCity(name) {
  return CITIES.find(c => c.name === name) || CITIES.find(c => c.name === 'İstanbul');
}

function timesFor(date, cityName) {
  const c = findCity(cityName);
  const params = adhan.CalculationMethod.Turkey();
  params.madhab = adhan.Madhab.Shafi;
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(c.lat, c.lng), date, params);
  return NAMES.map(([key, name]) => ({ key, name, time: pt[key] }));
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function hhmm(d) {
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function remaining(ms) {
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin <= 1) return "1 dk'dan az";
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

// "İkindi'ye", "Akşam'a" gibi Türkçe yönelme eki
function yonelme(name) {
  const map = { 'İmsak': "İmsak'a", 'Güneş': "Güneş'e", 'Öğle': "Öğle'ye", 'İkindi': "İkindi'ye", 'Akşam': "Akşam'a", 'Yatsı': "Yatsı'ya" };
  return map[name] || name;
}

// ---------- Hicri takvim ----------
// Temel hesap: Ümmü'l-Kurâ takvimi (Diyanet'in ay başlarıyla büyük ölçüde örtüşür).
// Diyanet'in farklı başlattığı aylar aşağıda düzeltilir: 'yıl-ay' -> Diyanet'e göre ayın 1. günü
const HICRI_DUZELTME = {
  '1447-9': '2026-02-19' // Ramazan 1447 (Ümmü'l-Kurâ: 18 Şubat)
};
const HICRI_AYLAR = ['Muharrem', 'Safer', 'Rebiülevvel', 'Rebiülahir', 'Cemaziyelevvel', 'Cemaziyelahir',
  'Recep', 'Şaban', 'Ramazan', 'Şevval', 'Zilkade', 'Zilhicce'];

let hicriFmt = null;
function uq(date) {
  if (!hicriFmt) hicriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const p = Object.fromEntries(hicriFmt.formatToParts(date).map(x => [x.type, x.value]));
  return { y: parseInt(p.year, 10), m: parseInt(p.month, 10), d: parseInt(p.day, 10) };
}
function gunFarki(a, b) { // a - b, gün olarak (yerel tarih)
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / 86400000);
}
function yerelTarih(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); }

function hicri(date) {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  let { y, m, d } = uq(noon);
  // Bu ayın ya da bir sonraki ayın başı Diyanet'te farklıysa düzelt
  const sonrakiY = m === 12 ? y + 1 : y, sonrakiM = m === 12 ? 1 : m + 1;
  const buAyDz = HICRI_DUZELTME[`${y}-${m}`];
  const sonrakiDz = HICRI_DUZELTME[`${sonrakiY}-${sonrakiM}`];
  if (sonrakiDz && gunFarki(noon, yerelTarih(sonrakiDz)) >= 0) {
    y = sonrakiY; m = sonrakiM; d = gunFarki(noon, yerelTarih(sonrakiDz)) + 1;
  } else if (buAyDz) {
    const fark = gunFarki(noon, yerelTarih(buAyDz));
    if (fark >= 0) { d = fark + 1; }
    else { // Diyanet'e göre hâlâ önceki ayın son günü
      const once = uq(new Date(noon.getTime() - 86400000));
      y = once.y; m = once.m; d = once.d + 1;
    }
  }
  return { y, m, d, text: `${d} ${HICRI_AYLAR[m - 1]} ${y}` };
}

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function buildState(now, cityName, dismissedKey, opts = {}) {
  const approachMin = opts.approachMin ?? APPROACH_MIN;
  const enteredMin = opts.enteredMin ?? ENTERED_MIN;
  const today = timesFor(now, cityName);
  const tomorrow = timesFor(addDays(now, 1), cityName);
  const yesterday = timesFor(addDays(now, -1), cityName);

  // sıradaki vakit
  let nextIdx = today.findIndex(t => t.time > now);
  const next = nextIdx === -1 ? tomorrow[0] : today[nextIdx];

  // en son giren vakit
  const all = [...yesterday, ...today].filter(t => t.time <= now);
  const last = all[all.length - 1];

  const msToNext = next.time - now;
  let mode = 'normal';
  let entered = null;
  const lastId = last ? `${last.key}-${last.time.toDateString()}` : null;

  if (last && last.key !== 'sunrise' && now - last.time < enteredMin * 60000 && dismissedKey !== lastId) {
    mode = 'girdi';
    entered = { id: lastId, name: last.name, nextText: `${yonelme(next.name)} ${remaining(msToNext)}` };
  } else if (approachMin > 0 && msToNext <= approachMin * 60000) {
    mode = 'yaklasiyor';
  }

  const nextSub = next.key === 'sunrise'
    ? `Vaktin çıkmasına ${remaining(msToNext)}`
    : `${remaining(msToNext)} kaldı`;

  return {
    city: findCity(cityName).name,
    cities: CITIES.map(c => c.name),
    dateText: `${now.getDate()} ${AYLAR[now.getMonth()]} ${now.getFullYear()}`,
    dayText: GUNLER[now.getDay()],
    hijriText: hicri(now).text,
    times: today.map((t, i) => ({
      name: t.name,
      time: hhmm(t.time),
      status: nextIdx === -1 ? 'gecti' : (i < nextIdx ? 'gecti' : (i === nextIdx ? 'sirada' : 'gelecek'))
    })),
    next: { name: next.name, time: hhmm(next.time), sub: nextSub, isSunrise: next.key === 'sunrise',
      remaining: remaining(msToNext), toward: `${yonelme(next.name)} ${remaining(msToNext)}` },
    clock: hhmm(now),
    dateShort: `${now.getDate()} ${AYLAR[now.getMonth()]} ${GUNLER[now.getDay()]}`,
    tooltip: `${yonelme(next.name)} ${remaining(msToNext)} (${hhmm(next.time)})`,
    mode,
    entered,
    lastEntered: last && last.key !== 'sunrise' ? { id: lastId, name: last.name, at: last.time.getTime() } : null
  };
}

module.exports = { buildState, timesFor, hhmm, hicri, CITIES };
