# iPhone 真机 UI 自动化

本机开发工具使用 Appium 3.7.0 + XCUITest driver 12.12.1，复用上游 WebDriverAgent，通过 XCTest 读取真实界面、截图和执行操作。它不属于 CubeRoot 生产依赖，不在 App 中增加业务逻辑或远程控制入口。

## 当前 Mac 的入口

工具目录：`/Users/eula/.local/share/cuberoot-ios-automation`。

- `package.json` / `package-lock.json`：独立工具依赖和锁定版本。
- `device.json`：本机 Xcode 路径、设备 UDID、签名 Team 和 Appium capabilities。设备与 Team 必须现场读取，不从本说明推导。
- `ios.mjs`：薄 WebDriver HTTP 命令入口，不实现截图或点击引擎。
- `session.json`：可复用的本机会话；闲置 15 分钟可能失效，重新 `connect` 即可。
- `captures/`、`appium.log`、`DerivedData/`：仅本机调试产物。

目录权限为 `0700`，截图与会话文件新建权限为 `0600`。上述工具目录不随 Git 同步；换 Mac 需重新安装和配对，不能复制证书/私钥进仓库。

从工具目录运行（这些是仓库外工具命令，不是 core pnpm 命令）：

```bash
cd /Users/eula/.local/share/cuberoot-ios-automation
node ios.mjs server
```

服务保持运行，在另一个终端或 agent 工具调用中运行：

```bash
node /Users/eula/.local/share/cuberoot-ios-automation/ios.mjs connect
node /Users/eula/.local/share/cuberoot-ios-automation/ios.mjs screenshot
node /Users/eula/.local/share/cuberoot-ios-automation/ios.mjs source
node /Users/eula/.local/share/cuberoot-ios-automation/ios.mjs find 工具
```

`connect` 复用存活会话；失效会话才重新创建。`screenshot` 返回本机 PNG 路径，agent 应使用图像查看工具实际检查。`source` 返回 XCTest 界面树，可带输出文件路径。`find` 返回匹配的元素 ID，随后 `click <element-id>`；同名元素必须先消歧。也可根据刚读取的界面树使用 `tap <x> <y>`，坐标是屏幕 points，不是 PNG 像素。`swipe up/down/left/right` 只在已确认的 App 页面使用。

结束本次操作使用 `disconnect`，它释放自动化会话且不清空或主动关闭 CubeRoot；要完全关闭测试助手和监听端口，结束本次启动的 Appium 服务及其 WebDriverAgent 测试进程。不要用广泛的 `killall xcodebuild` 停止其他人的构建。

## 使用边界

- 手机须已与 Mac 信任配对、开启 Developer Mode，并保持可连接、可解锁；首次系统授权必须由所有者确认。当前实测是数据线连接，无线通道尚未验收。
- 自动化目标固定为 `me.cuberoot.app`；只操作用户授权的 CubeRoot 范围，不浏览短信、相册或其他私人 App。
- `noReset=true`、`fullReset=false`，不提供 App 安装包参数；复用现有安装，不删除记录、重装或清缓存。`forceAppLaunch=false`、`shouldTerminateApp=false`。
- 不自动接受或拒绝系统权限弹窗；看到需要手动授权的提示时停下给准确路径。
- Appium 绑定 `127.0.0.1:4723`；`wdaBindingIP=127.0.0.1` 限制手机端 WDA，Mac 上 WDA/图像流转发端口为 `8100`/`9100`，本次均实测只监听 localhost。切换设备或传输方式后检查监听地址，不把服务暴露到公网，不启用 relaxed security。
- XCTest 截图和界面树可用于普通 UI 验证；它们不等于 WebView 的 DOM/JS 调试。后者可能另需 Safari Web Inspector/Remote Automation，本次不宣称已完成。
- 蓝牙、触觉、背景恢复和商店发布有各自的验收要求；自动截图成功不替代它们。

## 本次验收记录（2026-09-11）

在 iPhone 15 Pro Max / iOS 26.6.1 上，已完成 WebDriverAgent 开发签名、构建和启动；Appium 会话读取到应用 Bundle ID `me.cuberoot.app`、430×932 points 界面树。自动截图显示工具页；随后按界面树坐标切换计时页，截图可见已有 `0.583` 成绩、比赛出处和魔方展开图，再通过 accessibility element 点击工具按钮返回。没有创建或删除成绩。重复 `connect` 已返回同一会话 ID。

已结束首个会话并重启测试助手验证重连；新会话截图成功，再次 `connect` 仍复用同一 ID。截图留在本机 `captures/`：`timer.png`、`tools-restored.png`、`reconnected.png`；本条只证明已安装版本的截图、读树与切页链路，不声称当前 HEAD 的全部 iOS 回归通过。

官方资料：[真机配置](https://appium.github.io/appium-xcuitest-driver/latest/getting-started/provisioning-profile/auto-config/)、[设备准备](https://appium.github.io/appium-xcuitest-driver/latest/getting-started/device-setup/)、[Capabilities](https://appium.github.io/appium-xcuitest-driver/latest/reference/capabilities/)。

同日后续已按所有者要求切换到 iPhone 12 Pro Max / iOS 26.6.1，读取到 428×926 points 界面树，并在不卸载/清空数据的情况下覆盖安装新版 `me.cuberoot.app`。旧版未自动结束的计时已通过正常停表操作保存为 `48:13.98`，升级后截图确认该记录仍在；这条人为结束的异常记录绝不是自动还原停表成功证据。已实际打开原生扫描选择器，但当次没有发现魔方，随后取消，没有重置魔方。设备型号、会话和签名必须现场读取；本说明不记录私钥、profile 或可复用认证 token。

最终覆盖安装后，`iphone12-final.png/.xml` 证实连接按钮有独立 44px 行且不被底部导航遮住，旧记录仍保留。`iphone12-existing-record.png/.xml` 与 `iphone12-replay-playing.xml` 证实该真实旧记录能打开共享 3D 回放并从 0.00 播放到 0.86 秒；不以异常记录的时长/分析结果作为新版本采集准确性的证据。以上截图/界面树仅在本机工具目录，不提交含个人成绩的调试产物。
