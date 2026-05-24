# Mobile builds (iOS + Android)

Capacitor 8 套壳,把 `cuberoot.me` SPA 打包成 iOS .ipa + Android .apk,装到自己手机。
**不上架** App Store / Play Store(那要 $99/年 + 备案 + 审核)。

## Trigger CI build

Workflow: `.github/workflows/mobile_build.yml`(ubuntu + macos 两 runner 并行)。

**自动**:push 到 `main` 改了 `core/packages/{client,shared,visualcube}/**` 或 workflow 自身,自动跑。Artifact 在 Actions run 页面挂 14 天,直接下最新一次重装即可。

```bash
# 手动触发(临时想 build 一份):
gh workflow run mobile_build.yml

# 或 GitHub UI: Actions → Build Mobile Apps → Run workflow
```

跑完(Android ~5min / iOS ~15min)到 Actions run 页面下 artifact:

- `cuberoot-android-apk` → `app-debug.apk`
- `cuberoot-ios-ipa` → `cuberoot-unsigned.ipa`

## Install Android

1. 传 APK 到手机(USB / cloud drive / 邮件)。
2. 文件管理器点开 APK,系统提示"允许此来源安装" → 同意。
3. 装完桌面出 `cuberoot` 图标。

debug APK 已带 debuggable 标记,可以 `adb logcat | grep chromium` 看 webview console。

## Install iOS(无 Apple Developer Program)

iOS 上 .ipa 不能直接点开装,必须签名。免费方案:**Sideloadly + 免费 Apple ID**(7 天证书,到期重签)。

1. PC 下 [Sideloadly](https://sideloadly.io/)(Win/Mac 都有)。
2. iPhone USB 连 PC,信任此电脑。
3. Sideloadly 选 `cuberoot-unsigned.ipa`,填免费 Apple ID + 密码(App-Specific Password 更安全,在 appleid.apple.com 生成)。
4. 点 Start,Sideloadly 自动签名 + 推到 iPhone。
5. iPhone 上 `设置 → 通用 → VPN与设备管理 → 开发者 App` → 信任自己的 Apple ID。
6. 桌面出 `cuberoot` 图标。

**7 天后** app 启动闪退 = 证书过期,Sideloadly 重跑一遍即可(可设自动)。

付 $99/年后,Sideloadly 同样用法但证书有效期延长到 1 年,且数量上限更高。

## 已知局限(webview vs 浏览器)

SPA 用了不少 modern web APIs。webview 兼容性参差:

| 功能 | iOS WKWebView | Android WebView | 备注 |
|------|---|---|---|
| WebCodecs (`/frame-count`) | ✅ iOS 17.4+ | ✅ Chrome 94+ | 老系统挂 |
| SharedArrayBuffer (`/scramble/solver`) | ⚠️ 需 COOP/COEP | ⚠️ 需 COOP/COEP | Capacitor 默认不发,可能要插件 |
| WebGPU (maplibre 等) | ❌ | ❌ | 回 WebGL2 |
| `/cstimer/` iframe | ❌ | ❌ | 走仓库根静态,prod build 没拷进 dist |
| `/tools/*` iframe | ❌ | ❌ | 同上 |
| WCA OAuth | ✅ | ✅ | deep link `me.cuberoot.app://auth-callback` 回 app(WCA 后台须额外注册) |

### API 跨域

app 里 webview origin = `capacitor://localhost` (iOS) / `https://localhost` (Android),
直接 fetch `api.cuberoot.me/v1/*` 会被 webview CORS 拦死。两路兜底:

1. **server CORS 白名单**(`core/packages/server/src/index.ts`)放了这俩 origin。
2. **`CapacitorHttp` 插件**(在 `capacitor.config.ts` 已 enable)拦截 fetch 走原生 HTTP,
   彻底绕开 webview CORS,无 preflight,无 `Access-Control-*` 要求。

第 2 条是主防线,第 1 条是 fallback(某些 XHR / fetch 边界 case 可能仍走 webview)。
新增 API endpoint 不需要再维护 CORS。

打开 app 后**能用的**: 公式库 / 计时器 / 公式训练 / 比赛日历 / 统计图表 / recon / mosaic / calc 等纯前端页面。

**不能用的**: 内嵌 cstimer / iframe tools / 录像帧数(老设备)/ 真随机 5x5(SAB)/ 登录依赖功能。

后续优化路径:
- 把 `/tools/*` `/cstimer/` `/stats/*` 也打进 client/public,让它们随 dist 进 APK/IPA
- 在 Capacitor 配 `server.androidScheme=https` + 自定义 headers 让 SAB 启用
- WCA OAuth 走 in-app browser 而不是 system browser

## 改 app 配置

`packages/client/capacitor.config.ts` —— appId / appName / webDir / 平台 server config。
改了之后 `pnpm exec cap sync` 才同步到原生工程。

更新图标 / 启动画面: `npx @capacitor/assets generate --iconBackgroundColor '#fff' --splashBackgroundColor '#fff'` (需准备 `resources/icon.png` 1024x1024 和 `resources/splash.png` 2732x2732)。

## 本地编(可选)

CI 是主路径。要本地 iterate:

**Android (Win/Mac/Linux)**: 装 Android Studio 或仅 cmdline-tools + JDK 17/21,设 `ANDROID_HOME`,`cd packages/client/android && ./gradlew assembleDebug`。

本机如果 Java TLS 到 `dl.google.com` 被掐(handshake 拒接),Gradle 下不了 AGP/AndroidX 依赖 → 推荐直接走 CI。

**iOS**: 只能 macOS + Xcode。打开 `packages/client/ios/App/App.xcodeproj`,Xcode 里 Run 即可。
