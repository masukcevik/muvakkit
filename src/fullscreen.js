// SPDX-License-Identifier: GPL-3.0-or-later
// Namaz Vakti — Copyright (C) 2026 Maşuk
// Tam ekran uygulama algılama (oyun, tam ekran video, sunum).
// Windows'ta sistemin kendi bilgisini ve öndeki pencerenin ekranı kaplayıp kaplamadığını okur.
// Diğer sistemlerde her zaman false döner.
let check = () => false;

if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const shell32 = koffi.load('shell32.dll');

    const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const MONITORINFO = koffi.struct('MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
    const HANDLE = koffi.pointer('HANDLE', koffi.opaque());

    const GetForegroundWindow = user32.func('HANDLE __stdcall GetForegroundWindow()');
    const GetWindowRect = user32.func('bool __stdcall GetWindowRect(HANDLE hWnd, _Out_ RECT *lpRect)');
    const GetWindowLongW = user32.func('int32 __stdcall GetWindowLongW(HANDLE hWnd, int nIndex)');
    const MonitorFromWindow = user32.func('HANDLE __stdcall MonitorFromWindow(HANDLE hwnd, uint32 dwFlags)');
    const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(HANDLE hMonitor, _Inout_ MONITORINFO *lpmi)');
    const GetClassNameW = user32.func('int __stdcall GetClassNameW(HANDLE hWnd, uint16_t *lpClassName, int nMaxCount)');
    const SHQueryUserNotificationState = shell32.func('long __stdcall SHQueryUserNotificationState(_Out_ int *pquns)');

    const QUNS_BUSY = 2, QUNS_RUNNING_D3D_FULL_SCREEN = 3, QUNS_PRESENTATION_MODE = 4;
    const MONITOR_DEFAULTTONEAREST = 2, GWL_STYLE = -16, WS_CAPTION = 0x00C00000;
    const DESKTOP_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);
    const classBuf = Buffer.alloc(512);

    check = () => {
      // 1) Windows'un kendi "tam ekran uygulama çalışıyor" bilgisi
      const q = [0];
      if (SHQueryUserNotificationState(q) === 0 &&
          [QUNS_BUSY, QUNS_RUNNING_D3D_FULL_SCREEN, QUNS_PRESENTATION_MODE].includes(q[0])) return true;

      // 2) Öndeki pencere, başlık çubuğu olmadan bütün ekranı kaplıyor mu? (çerçevesiz oyunlar, tarayıcıda tam ekran video)
      const h = GetForegroundWindow();
      if (!h) return false;
      const n = GetClassNameW(h, classBuf, 256);
      if (DESKTOP_CLASSES.has(classBuf.toString('utf16le', 0, n * 2))) return false;
      if ((GetWindowLongW(h, GWL_STYLE) & WS_CAPTION) === WS_CAPTION) return false; // normal (büyütülmüş) pencere
      const r = {};
      if (!GetWindowRect(h, r)) return false;
      const mi = { cbSize: koffi.sizeof(MONITORINFO) };
      if (!GetMonitorInfoW(MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST), mi)) return false;
      const m = mi.rcMonitor;
      return r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom;
    };
  } catch (e) {
    console.error('Tam ekran algılama kullanılamıyor:', e && e.message);
    check = () => false;
  }
}

module.exports = {
  isFullscreenActive() { try { return !!check(); } catch { return false; } }
};
