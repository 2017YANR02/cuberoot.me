# client (POC)

**目的**:验证把现有 Vite SPA 迁到 Next.js 16 的技术可行性,以 `/frame-count`(WebCodecs + mp4box.js)作为最危险案例先踩一遍雷。

**状态**:`poc/nextjs-frame-count` branch 独立运行,main 不受影响。

## 运行

```bash
pnpm install                          # 根目录,自动 link 进 workspace
pnpm --filter @cuberoot/client dev   # http://127.0.0.1:3000/frame-count
```

打开 `/frame-count`,选一个 mp4,看 status 是否走到 `Done.` 并显示 totalSamples / decodedFrames / 最后一帧 canvas。

## 回退(任意时刻)

```bash
git checkout main                         # 立刻回到 Vite 现状
rm -rf packages/client               # 物理删除 POC workspace
pnpm install                              # 清 lockfile 引用
# 或者直接:git branch -D poc/nextjs-frame-count
```

main 上的 `packages/client` 没动一行代码。

## POC 验证结果

**框架级集成全部通过**(2026-05-25 测):

| 检查项 | 结果 | 备注 |
|---|---|---|
| Next.js 16.2.6 + Turbopack scaffold | ✅ | dev ready 715ms |
| pnpm 11 workspace 集成 | ✅ | 删 nested `pnpm-workspace.yaml`,根 `allowBuilds.sharp: false` |
| mp4box.js import + Turbopack build | ✅ | 加进 `transpilePackages` 兜底,实际不加也跑得通 |
| `'use client'` page render | ✅ | 0 console errors |
| WebCodecs `VideoDecoder` 全局可用 | ✅ | 浏览器原生,无 framework 介入 |
| COOP/COEP headers via `next.config.ts` | ✅ | `headers()` 返回 `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` |
| TypeScript strict typecheck | ✅ | `pnpm --filter @cuberoot/client typecheck` clean |
| HMR + config 热重载 | ✅ | 改 `next.config.ts` 自动重启 server |
| 二次访问编译速度 | ✅ | 冷 5.1s,热 36-87ms |

**runtime 解码已验**(2026-05-25 用户实测 4K H.265 hvc1.2.4.L183.b0,3840×2160,4040 samples 全解,canvas 渲染最后一帧正常,33.7s 视频解码 10.9s)。

## 踩到的坑

| 坑 | 解 | 主仓库迁移要注意 |
|---|---|---|
| `pnpm install` 因 sharp build script 报 `ERR_PNPM_IGNORED_BUILDS` exit 1 | 根 `pnpm-workspace.yaml` `allowBuilds: { sharp: false }` | 全站迁移时同样要处理 |
| create-next-app 在子目录生成 `pnpm-workspace.yaml` | 删掉,让它继承根 workspace | 一次性 |
| `pnpm dev \| head -N` 把 dev server 杀了(SIGPIPE) | 用 `run_in_background` + grep file | 工具方法,不是 framework 问题 |
| mp4box 真实导出类型是 `ISOFile / Movie / Sample` 不是 `MP4File / MP4Info / MP4Sample` | 改 import 名字 | 主仓库已经用对的名字了 |
| 手写 fake DataStream 序列化 codec description,H.265 第一帧 decode 报 "key frame required" | 用 mp4box 自带 `DataStream` + `Endianness.BIG_ENDIAN`,`new Uint8Array(stream.buffer, 8)` 跳 box header | 主仓库 `useFrameBuffer.ts:279-285` 就是这样做的,迁移时直接照搬 |

## 还没测的

- **`@ffmpeg/ffmpeg` WASM 加载**(`toBlobURL` + `coreURL` pattern)— 这是 frame-count 的导出功能,POC 没搬,需独立验
- **`mediainfo.js`** — 信息展示,WASM 加载方式类似 ffmpeg
- **`import.meta.glob({ eager: true })`** — Vite 特性,Next 用 `require.context` 或 dynamic `import()`
- **Worker(`new Worker(new URL(...))`)Next 路径解析** — frame-count 本身不直接用 Worker,但 `/scramble/analyzer`、`/scramble/solver`、`scramble-stats` 等用,迁那些时再验
- **Service Worker**(主仓库 `src/sw.ts` 拦 visualcube)— Next 自带 PWA mode 或手注册

## 主仓库正式迁移评估(基于此 POC)

**绿灯**:
- WebCodecs + mp4box 这套"最危险页"实际只用 standard 'use client' + 一行 `transpilePackages` 就跑
- Turbopack dev 体验接近 Vite(HMR 快)
- TypeScript / pnpm workspace 兼容

**黄灯**(需要单独 POC):
- FFmpeg WASM 加载
- 12 个工具页里其它用 WASM / Worker / SharedArrayBuffer 的(`/scramble/solver` 走 cubeopt-wasm + SAB,`/nemesizer` 走 server-side 不算)

**红灯**:暂未发现致命阻塞。

**预估全站迁移**:6-8 周(此前估算不变),POC 验证后置信度上升,但 FFmpeg / Worker 黄灯页要在阶段 1 优先验掉。

## 下一步建议

1. POC 维持现状,留 branch 备查
2. 决定全站迁移前再做 1 个 FFmpeg POC(0.5-1 周)
3. 或先压住 Next.js,把 `?only=auto` partial + localStorage cache(2 周内可做完)挤出 LCP 收益,**ROI 不需要换框架**
