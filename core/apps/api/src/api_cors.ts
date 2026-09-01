import { cors } from 'hono/cors';

export const apiCors = cors({
  origin: (origin) => {
    const allowed = new Set([
      'http://localhost:3000',              // Next dev server
      'http://127.0.0.1:3000',              // Next dev server (binds 127.0.0.1; SSE bypasses the dev proxy → direct CORS call)
      'https://www.cuberoot.me',            // 主域
      'https://cuberoot.me',                // 裸域
      'https://next.cuberoot.me',           // Next 子域并行验证
      'capacitor://localhost',              // Capacitor iOS app webview origin
      'https://localhost',                  // Capacitor Android app webview origin (androidScheme: https)
      'tauri://localhost',                  // Tauri macOS app webview origin
      'https://tauri.localhost',            // Tauri Windows app webview origin (useHttpsScheme)
      'http://127.0.0.1:1420',              // Tauri desktop dev server
    ]);
    if (!origin) return '';                 // server-side / curl
    if (allowed.has(origin)) return origin;
    // Vercel preview / production deploy URL — *.vercel.app
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin;
    return null;
  },
  credentials: true,                      // 兼容浏览器 sendBeacon / 默认 include 的请求;server 用 Bearer 鉴权,不读 cookie
  allowHeaders: ['Content-Type', 'Authorization', 'X-Battle-Token'],
  exposeHeaders: ['Upload-Offset', 'Upload-Length', 'Upload-Expires'],
  maxAge: 86400,
});
