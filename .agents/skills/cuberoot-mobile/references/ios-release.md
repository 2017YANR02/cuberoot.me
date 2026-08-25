# iOS 首次接入与发布

仅在 iOS 首次接入、签名、TestFlight 或 App Store 任务中读取本文件。

## 首次接入

1. 核对 `node --version`、`pnpm --version`、`xcodebuild -version`、`xcode-select -p` 和 Xcode 中可用的付费 Team。
2. 从 `core/` 安装 workspace 依赖并先跑 mobile test、typecheck、build。
3. 检查 `@capacitor/ios` 和 `core/apps/mobile/ios/`；缺少时使用与 `@capacitor/core` 兼容的版本并只运行一次 `cap add ios`，已有时不重复生成。
4. 增加平台明确的 Android/iOS sync 与 iOS open scripts，保留现有入口兼容性。
5. build + `cap sync ios` 后打开 Xcode。提交可复现的 iOS project/workspace，让其他 Mac/CI 不必重新 `cap add`。
6. 使用 Automatic Signing，保持 Capacitor 配置中的 Bundle ID，选择付费 Team；`Personal Team` 不能替代商店发布资格。
7. 先跑 Simulator，再连接用户自己的 iPhone。第一轮验证启动、计时、持久化、语言/主题、安全区、触摸、旋转/后台恢复和外链，不同时扩展 BLE、登录或发布自动化。

## TestFlight 证据链

按顺序分别取证，不把后一步或付款倒推为前一步完成：

1. Apple Developer Program 显示 Active，协议已处理，Xcode 能选择付费 Team。
2. mobile tests/typecheck/build 与 iOS sync 通过。
3. Simulator 运行通过。
4. iPhone 自动签名、安装和核心回归通过。
5. Archive 与 Validate App 通过。
6. App Store Connect 上传并处理完成。
7. TestFlight internal build 在 iPhone 实际安装、启动。

没有对应证据就保持路线图未勾选。Core Bluetooth、Keychain、Universal Links、VoiceOver 和 App Store 审核也必须独立验证。

## 签名材料

提交前检查 ignore、tracked files 和 staged diff。绝不提交 `.p12`、`.mobileprovision`、`AuthKey_*.p8`、证书私钥、密码、2FA 恢复码、DerivedData 或 xcuserdata。

可提交 Xcode project/workspace、entitlements、Info.plist、privacy manifest 和可复现 build settings。跨 Mac 优先登录同一 Apple Team 使用 Automatic Signing；确需迁移私钥时使用密码管理器或离线加密介质，不走 Git。
