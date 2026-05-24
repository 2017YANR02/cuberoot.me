import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'me.cuberoot.app',
  appName: 'cuberoot',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // CapacitorHttp 拦截 fetch() / XHR,走 native HTTP 绕过 webview CORS。
    // app 里 origin 是 capacitor://localhost (iOS) / https://localhost (Android),
    // 没有它就要服务器 CORS 白名单同步维护。开了之后 fetch 走原生通道,无 preflight。
    CapacitorHttp: { enabled: true },
  },
};

export default config;
