import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { renderFromSimpleQuery } from '@cuberoot/visualcube'
import { renderSq1ScrambleSvg, DEFAULT_SQ1_COLORS, invertSq1Alg as invertSq1AlgDev } from './src/pages/gen/sq1_svg'
import { renderMegaScrambleSvg, DEFAULT_MEGA_COLORS } from './src/pages/gen/mega_svg'
// (touch to force vite restart after visualcube bundle rebuild)

// ── 静态文件 MIME 映射 ────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
  '.gz':  'application/octet-stream',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

/**
 * Vite 插件：从仓库根目录直接 serve /legacy/ 和 /stats/ 路径的静态文件。
 *
 * NOTE: 生产环境中这些文件由 deploy_mirror.yml rsync 到云服务器。
 */
function serveRepoRoot(): Plugin {
  const repoRoot = path.resolve(__dirname, '../../..');

  return {
    name: 'serve-repo-root',
    configureServer(server) {
      // NOTE: 必须用 return 让中间件在 Vite 内部中间件之前执行，
      // 否则 Vite 的 SPA fallback 会把 /stats/index.json 当成 HTML 路由处理
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];

        // 只处理 /tools/ 和 /stats/ 前缀
        if (!url.startsWith('/tools/') && !url.startsWith('/stats/') && url !== '/stats') {
          return next();
        }

        // 候选文件路径：精确路径 → 目录下的 index.html
        const candidates = [
          path.join(repoRoot, url),
          path.join(repoRoot, url, 'index.html'),
        ];

        for (const filePath of candidates) {
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const contentType = MIME[ext] || 'application/octet-stream';
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'no-cache');
              // NOTE: 同步父文档的 COEP/COOP，否则 IframePage 的 sandbox iframe 会崩成 chrome-error
              res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch {
            // 文件不存在，继续下一个候选
          }
        }

        // 所有候选都不存在，交给下一个中间件
        next();
      });
    },
  };
}

/**
 * 本地 dev 渲染 /api/visualcube.svg —— 不走 prod 代理，避开"prod 还没部署新参数"的 dev/prod 错位。
 * Server cube.ts + 这个 plugin 共享同一个 renderFromSimpleQuery，永远同步。
 */
function visualcubeDev(): Plugin {
  return {
    name: 'visualcube-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/v1/visualcube.svg')) return next();
        try {
          const qs = new URL(url, 'http://localhost').searchParams;
          const puzzle = (qs.get('puzzle') ?? 'cube').toLowerCase();
          let svg: string;
          if (puzzle === 'sq1' || puzzle === 'megaminx') {
            const setupRaw = qs.get('setup');
            const caseRaw = qs.get('case');
            const algRaw = qs.get('alg');
            const forward = setupRaw ?? algRaw ?? (caseRaw != null
              ? (puzzle === 'sq1' ? invertSq1AlgDev(caseRaw) : caseRaw)
              : '');
            svg = puzzle === 'sq1'
              ? renderSq1ScrambleSvg(forward, DEFAULT_SQ1_COLORS)
              : renderMegaScrambleSvg(forward, DEFAULT_MEGA_COLORS);
          } else {
            svg = renderFromSimpleQuery({
              alg: qs.get('alg') ?? undefined,
              case: qs.get('case') ?? undefined,
              setup: qs.get('setup') ?? undefined,
              view: qs.get('view') ?? undefined,
              mask: qs.get('mask') ?? undefined,
              size: qs.get('size') ?? undefined,
              cubeSize: qs.get('cubeSize') ?? undefined,
              pzl: qs.get('pzl') ?? undefined,
              bg: qs.get('bg') ?? undefined,
              cc: qs.get('cc') ?? undefined,
              co: qs.get('co') ?? undefined,
            });
          }
          res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(svg);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(`visualcube render error: ${(err as Error).message}`);
        }
      });
    },
  };
}

/**
 * Dev 模式下用一个自注销的空 sw 覆盖 public/sw.js — 否则手机端老 sw 会继续拦截
 * vite 的动态 module 请求(Safari 上 wrap stream 后 ES module import 直接挂 → 白屏)。
 * Browser 看到 sw.js 内容变了会自动 install 新版 → activate 时 unregister + 让客户端 reload。
 */
function devUnregisterSw(): Plugin {
  return {
    name: 'dev-unregister-sw',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] !== '/sw.js') return next();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(`// dev-mode self-unregister sw
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.navigate(c.url));
  })());
});
`);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serveRepoRoot(), visualcubeDev(), devUnregisterSw()],
  // NOTE: 部署到根路径 /（React SPA 作为站点主入口）
  base: '/',
  build: {
    // NOTE: 使用 _assets 避免与根目录 assets/（stats CSS 等）冲突
    assetsDir: '_assets',
    // NOTE: 关掉 __vitePreload helper —— Vite 会把它注进 cubing.js 的 search worker chunk,
    // 而 worker 里没有 `document`,prod 一调 randomScrambleForEvent 就 ReferenceError 死。
    // 关掉对主 bundle 只是微小的预加载收益损失,但救活了所有 module-worker 库。
    modulePreload: false,
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core-mt'],
  },
  resolve: {
    // NOTE: dedupe three so cubing/twisty + our cube3d/ share one instance,
    // avoiding "THREE.WARNING: Multiple instances of Three.js being imported".
    dedupe: ['three'],
    alias: {
      // HACK: sr-puzzlegen-pll 的 package.json main 指向 dist/lib/index.js（只有 .d.ts 没有 .js）
      // 实际运行代码在 dist/bundle/puzzleGen.min.js（UMD 格式）
      'sr-puzzlegen-pll': path.resolve(
        __dirname,
        'node_modules/sr-puzzlegen-pll/dist/bundle/puzzleGen.min.js'
      ),
    },
  },
  server: {
    // host: true → 同时绑 127.0.0.1 + 局域网 IP,手机连同 WiFi 可用 http://<PC-IP>:5173 访问。
    // 之前固定 '127.0.0.1' 是因为 Windows Chrome 解析 ::1 不稳定;true 在 Vite 里会展开成所有
    // IPv4 网卡(含 127.0.0.1),不会回退到 IPv6,所以也安全。
    host: true,
    port: 5173,
    strictPort: true,
    // 经 cloudflared tunnel 进来的请求 Host: dev.cuberoot.me,Vite 6+ 默认 allowedHosts
    // 只放 localhost / 127.0.0.1 / 显式 IP,要把开发隧道域名加进来。`.cuberoot.me` 写成
    // 子域通配,以后再开 staging.cuberoot.me 之类不用回来改。
    allowedHosts: ['.cuberoot.me', '.ts.net'],
    headers: {
      // NOTE: @ffmpeg/ffmpeg 多线程需要 SharedArrayBuffer。
      // 用 credentialless 而不是 require-corp —— 前者允许跨源图片（flagcdn / WCA 头像）
      // 在不带 credentials 的情况下直接加载，免得 WcaPersonPicker 的国旗/头像被 COEP 拦成破图。
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      // 调本地 Hono 开发 server 端 (改 /v1/nemesizer/* 等路由时):
      //   1. 把下面这段 uncomment;
      //   2. cd core/packages/server && NEMESIZER_DATA_DIR=<repo>/stats/nemesizer PORT=3002 pnpm dev
      //   3. 顺序重要 —— 长前缀必须先于 '/v1' 注册才会被取窄匹配
      // '/v1/nemesizer': { target: 'http://127.0.0.1:3002', changeOrigin: true, secure: false },

      // 调本地 cube555 daemon (Java 子进程 by Hono) 时:
      //   1. cd core/packages/server && pnpm build:bundle
      //   2. PORT=3002 CUBE555_HOME='D:/cube/cube555' node dist/server.bundle.js
      //   3. 把下面这行 uncomment;窄前缀必须在 '/v1' 之前以让 vite 取窄匹配
      // '/v1/scramble/555-rs': { target: 'http://127.0.0.1:3002', changeOrigin: true, secure: false },

      // NOTE: Hono API 代理到线上后端（本地无 cuberoot_db，无法运行 Hono 后端）
      '/v1': {
        target: 'https://api.cuberoot.me',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
