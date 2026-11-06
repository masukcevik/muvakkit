// SPDX-License-Identifier: GPL-3.0-or-later
// Muvakkit — Copyright (C) 2026 Maşuk
// Tam ekran uygulama algılama (oyun, tam ekran video, sunum).
// Windows'ta sistemin kendi bilgisini ve öndeki pencerenin ekranı kaplayıp kaplamadığını okur.
// Diğer sistemlerde her zaman false döner.
let check = () => false;
let sample = () => null;
let leftDown = () => null;
let round = () => false;

if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const shell32 = koffi.load('shell32.dll');

    const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const MONITORINFO = koffi.struct('MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
    const HANDLE = koffi.pointer('HANDLE', koffi.opaque());

    // Windows 11: pencereye sistemin kendi yuvarlak köşelerini ve gölgesini ver
    try {
      const dwmapi = koffi.load('dwmapi.dll');
      const DwmSetWindowAttribute = dwmapi.func('long __stdcall DwmSetWindowAttribute(HANDLE hwnd, uint32 attr, _In_ int *pv, uint32 cb)');
      const DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_ROUND = 2;
      round = (handleBuf) => {
        try { return DwmSetWindowAttribute(koffi.decode(handleBuf, HANDLE), DWMWA_WINDOW_CORNER_PREFERENCE, [DWMWCP_ROUND], 4) === 0; }
        catch { return false; }
      };
    } catch {}

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

    // Göstergenin hemen etrafındaki birkaç pikselin rengini okur (otomatik zıt renk için).
    // Ekran görüntüsü almaz; sadece 8 noktayı okur, bu yüzden bellek ve işlemci yükü yok denecek kadar azdır.
    const GetDC = user32.func('HANDLE __stdcall GetDC(HANDLE hWnd)');
    const ReleaseDC = user32.func('int __stdcall ReleaseDC(HANDLE hWnd, HANDLE hDC)');
    const gdi32 = koffi.load('gdi32.dll');
    const GetPixel = gdi32.func('uint32 __stdcall GetPixel(HANDLE hdc, int x, int y)');
    const CLR_INVALID = 0xFFFFFFFF;
    sample = (r) => {
      const d = 4; // göstergenin kenarından bu kadar piksel dışarısı
      const xs = [r.x - d, r.x + Math.round(r.width / 2), r.x + r.width + d];
      const ys = [r.y - d, r.y + Math.round(r.height / 2), r.y + r.height + d];
      const pts = [];
      for (const x of xs) for (const y of ys) if (!(x === xs[1] && y === ys[1])) pts.push([x, y]);
      const dc = GetDC(null);
      if (!dc) return null;
      let R = 0, G = 0, B = 0, n = 0;
      try {
        for (const [x, y] of pts) {
          const c = GetPixel(dc, x, y);
          if (c === CLR_INVALID) continue;
          R += c & 0xFF; G += (c >> 8) & 0xFF; B += (c >> 16) & 0xFF; n++;
        }
      } finally { ReleaseDC(null, dc); }
      return n ? { r: Math.round(R / n), g: Math.round(G / n), b: Math.round(B / n) } : null;
    };

    // Farenin sol tuşu şu an basılı mı? (sürüklemenin bırakıldığı anı kaçırmamak için)
    const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int vKey)');
    const VK_LBUTTON = 0x01;
    leftDown = () => (GetAsyncKeyState(VK_LBUTTON) & 0x8000) !== 0;
  } catch (e) {
    console.error('Tam ekran algılama kullanılamıyor:', e && e.message);
    check = () => false;
    sample = () => null;
    leftDown = () => null;
  }
}

module.exports = { roundCorners: (b) => round(b),
  isFullscreenActive() { try { return !!check(); } catch { return false; } },
  // rect: fiziksel piksel cinsinden {x, y, width, height}; Windows dışında null döner
  sampleAround(rect) { try { return sample(rect); } catch { return null; } },
  // true/false: sol tuş durumu (Windows); null: bilinmiyor (diğer sistemler)
  isLeftButtonDown() { try { return leftDown(); } catch { return null; } }
};
