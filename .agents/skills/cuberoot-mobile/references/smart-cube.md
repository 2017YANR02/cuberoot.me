## 原生智能魔方

- 当前首个真机矩阵是 OPPO Reno7 Pro 5G `PFDM00`（Android 13 / ColorOS 13.1）+ GAN 16 UI；不要再次询问是否有 Android 手机或首测魔方型号，先用 `adb devices -l` 核对它是否在线。
- GAN 16 UI 按现有网站 registry 归入 GAN v4；服务、特征、加解密、历史补帧和转动解析复用 `@cuberoot/shared/smart-cube/gan-v4`，禁止在 Mobile 复制协议常量或算法。
- 设备时间映射统一使用 `@cuberoot/shared/smart-cube/move-clock` 的 `MoveClock`；状态帧采纳、转动推进和复原判断统一使用 `@cuberoot/shared/smart-cube/cubie` 的 `SmartCubeStateTracker`。网站旧 `move_clock.ts` / `state_track.ts` 只是兼容 adapter，Mobile 不得复制它们或另建第二套状态模型。
- 打乱逐步提示、匹配判定、走偏修正和异步重试统一使用 `@cuberoot/shared/smart-cube/scramble-hint`，Solo 生命周期统一使用 `@cuberoot/shared/smart-cube/scramble-guidance`；Kociemba cubie 运算只从 `@cuberoot/puzzle-solvers/kociemba/cube` 取。Web 与五端必须共用 `TimerScrambleStrip` 和 `@cuberoot/shared/timer` 的 Solo/Local/Net capability helpers；宿主只可提供 facelets、solver Worker、预备回调和原生 transport，不得复制提示算法、生命周期状态机或模式名单。pending solver 必须以当前 facelets 重验，同 target 请求 coalesce，新 target 排在旧请求完成后重试；切题、运行、断线或协议错误时 fail closed。
- 自动计时顺序固定复用 shared timer machine：状态跟踪先应用转动；若此前已预备则该第一手 `start-from-cube` 起表；若应用后状态匹配当前打乱则为下一手预备；只有未复原→复原边沿触发 `stop-from-cube`。不要用 BLE 到达时间代替 `MoveClock` 校准时间，也不要只凭最后一手文字猜复原。
- GAN 连接逻辑统一由 `@cuberoot/app-ui` 的 `useInstalledSmartCube` 消费 shared 协议；Mobile 用 `@capacitor-community/bluetooth-le` 薄 transport，Desktop 用 `@mnlphlp/plugin-blec` 薄 transport，Harmony 用 ArkTS ConnectivityKit bridge。不要从 client app deep import driver，也不要在每个平台或品牌 driver 里复制 GAN 协议。
- Android 12+ 使用 `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` 和运行时“附近设备”授权；扫描不用于定位。BLE feature 必须 `required=false`，无 BLE 设备仍可使用本地计时。
- 新型号先过真机 spike：扫描结果、广播/MAC、连接、服务发现、读写、通知、至少一条可解析转动。只有这些证据齐全才在路线图标记支持；模拟器、仅搜到名称或仅连上 GATT 都不算完成。
- 当前 OPPO + GAN 16 UI 已完成上述 spike，并实测打乱匹配后自动预备、第一手起表、复原停表和本地保存，首条硬件计时证据为 `5.20`。以后不要再询问该组合是否能连接；继续测试时从权限拒绝、后台、蓝牙关闭、距离中断和反复重连等尚未完成门槛推进。
- Android 的扫描 `deviceId` 通常是 MAC；iOS 是随机标识，GAN 密钥所需 MAC 必须从 manufacturer data 或受验证的名称规则取得。不得把 Android 假设写进共享协议层。

