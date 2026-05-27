import type { CapacitorConfig } from '@capacitor/cli';

// mobile webview 直接加载远程 Next 站点 (Phase 4 之后 www 已切 Next standalone)。
// webDir 'dist' 仍是 Vite SPA 产出 — server.url 在线时被忽略,离线时作为兜底。
// 注意:Capacitor 官方文档 `server.url` 标注 "not intended for production",
// 上下文针对 dev live-reload http URL,生产用自家 https CDN 是 hybrid 套壳社区
// 标准做法。trade-off:离线白屏 / 启动需联网拉首屏 / app 版本与 web 解耦。
const config: CapacitorConfig = {
  appId: 'me.cuberoot.app',
  appName: 'cuberoot',
  webDir: 'dist',
  server: {
    url: 'https://www.cuberoot.me',
    androidScheme: 'https',
    // webview 内部跳页默认弹外部浏览器,白名单的才在 webview 内打开。
    // WCA OAuth 需要 worldcubeassociation.org 在白名单内,否则 Browser plugin
    // 接管而非内嵌 webview 完成。Next 版直接在 webview 内跑标准 OAuth 流程,
    // 不再依赖 deep-link callback (Vite 版的 capacitor_oauth.ts 那套)。
    allowNavigation: [
      'www.cuberoot.me',
      'next.cuberoot.me',
      'static.cuberoot.me',
      'api.cuberoot.me',
      'blog.cuberoot.me',
      'www.worldcubeassociation.org',
      'staging.worldcubeassociation.org',
    ],
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // 同源 (https://www.cuberoot.me) fetch 不再需要 CapacitorHttp 拦截,
    // 但保留以兼容离线 fallback (本地 dist 加载时 origin 异常需绕 CORS)。
    CapacitorHttp: { enabled: true },
  },
};

export default config;
