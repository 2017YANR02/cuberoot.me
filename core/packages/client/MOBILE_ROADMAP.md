# Mobile Roadmap

App 当前是 cuberoot.me SPA 的 Capacitor webview 套壳。装机/build 流程见 `MOBILE.md`,这里专门记**哪些功能在 app 里挂了 + 后续怎么走**。

## 阉割清单

| 模块 | 路由 | 阉割原因 | 严重性 |
|---|---|---|---|
| **csTimer** | `/cstimer` | iframe 嵌仓库根 `/cstimer/` 静态站,dist 不包,app 里 404 | 高 |
| **or18 Solver** | `/solver` | 同上,iframe 嵌仓库根 fork | 中 |
| **mihlefeld Trainer** | `/alg-trainers` | 同上 | 中 |
| **真随机 Scramble Solver** | `/scramble/solver` | SharedArrayBuffer 要 COOP/COEP 头,Capacitor webview 不发 | 低 |
| **真随机 Scramble Analyzer** | `/scramble/analyzer` | 同上 | 低 |
| **Frame Count** | `/frame-count` | WebCodecs API,iOS<17.4 / 老 Android 不支持 | 中 |
| **LandingPage 入口** | `/` | 挂的模块的卡片还显示,点进去 404/白屏 | 中 |

可用的:`/recon` `/wca/*` `/trainer` `/calendar` `/calc` `/battle` `/algdb` `/wiki` `/sim` `/scramble` + 主页搜索 + WCA OAuth(deep link 已修)。

## 短期(下周可做)

### 1. LandingPage 在 app 里隐藏挂的卡片

10 行代码:`isCapacitorNative()` 时,卡片列表过滤掉 `cstimer / solver / alg-trainers / scramble/solver / scramble/analyzer`。
用户在 app 里看不到 → 不会点 → 不会困惑。Web 端不变。

### 2. 真机测 `/frame-count`

`/frame-count` 应该是 **app 的杀手级功能** —— 手机端拍解魔方视频比 PC 自然得多。iOS WKWebView 17.4+ / Android Chrome 94+ 理论上支持 WebCodecs。
**值得在真 iPhone 测一次**:上传 30s 视频,看 WebCodecs 是否解码出帧。能用的话,这页就值整个 app 存在。

## 中期(下个月)

### csTimer / solver / alg-trainers 二选一

**A. 引导用户跳浏览器**(简单)
点这些卡片时弹"此功能需在浏览器中使用,点击打开",`window.open('https://cuberoot.me/cstimer/')` 走系统浏览器。

**B. 真打包进 APK**(完整)
把 `/cstimer/` `/solver/` `/alg-trainers/` 当 public 资源拷进 `client/public/`。APK 从 40MB 涨到 60-80MB,但能完全离线用。

选 A 简单,选 B 大工程。看 app 定位是"在线壳"还是"离线工具"。

## 战略:native app vs PWA

诚实评估:**当前 app = cuberoot.me 网页的 webview 壳**。除了"主屏图标 + 没浏览器边框",没用上任何 native 能力(相机 / 通知 / 文件系统 / 蓝牙 / Touch ID)。

### PWA 替代方案(零维护成本)

- iPhone Safari 开 cuberoot.me → 分享 → "添加到主屏幕"
- Android Chrome 同
- 几乎一样的体验,**永远跟着 web 最新版**
- 不用 7 天重签,不用 build,不用 Sideloadly

### Native app 真正值得的场景

| 场景 | PWA 能做? | 备注 |
|---|---|---|
| 蓝牙智能魔方(GAN/MoYu) | ❌ iOS 完全不行,Android 受限 | **唯一能解释 native 存在的强需求** |
| 推送通知(WCA 比赛提醒) | ⚠️ iOS PWA 26+ 才支持,Android 行 | 中等强度 |
| 后台 timer | ❌ webview 杀进程就停 | 中等 |
| Camera 直接录视频(配 frame-count) | ⚠️ web 只能选已有视频,不能即拍 | 中等 |

**如果不打算做以上,PWA 更划算**。

### 建议路径

1. **下周**:做"短期 #1"(隐藏挂的卡片),"短期 #2"(真机测 frame-count)
2. **下个月**:定方向
   - 真想要 native → 走**蓝牙智能魔方接入**(/sim 集成实体魔方,这是真没人做过的产品)
   - 不想搞 native 能力 → 回 PWA,把 Capacitor 工程留作 archive,SPA 加 manifest.json + service worker
3. **永远**:不上 App Store / Play Store(那要 $99/yr + 备案 + 审核),侧载够用
