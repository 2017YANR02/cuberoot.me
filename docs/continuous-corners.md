# CubeRoot 连续圆角接入跟踪

更新：2026-10-19。本批只作本地提交，不 Push、不发布 npm、不部署。

## 共用标准

独立仓库 [continuous-corners](https://github.com/2017YANR02/continuous-corners)，初始研究基线 `5d96cef` 已在此前推送，后续实现尚未推送。产品固定 `@2017yanr02/continuous-corners@0.3.0`，几何版本 `swiftui-27-uniform-v1` / `swiftui-27-independent-v1`。安装包随本仓库跟踪，使用相对 `file:` 引用；不跨仓库 import 或依赖开发者路径、业务数据。

核心以苹果公开 SwiftUI `.continuous` 的原始路径为基准：每角三段三次贝塞尔，按尺寸限制半径和过渡段。578 组 macOS/iOS 模拟器原始样本相同；TypeScript 重建最大坐标误差约 0.0000283 个逻辑单位。不是苹果官方源码，也不宣称逐位或逐像素等同。公开算法研究与来源见共享包 `docs/geometry.md`。

## 实现

Web 根布局与 `core/packages/app-ui/src/App.tsx` 挂载 `SiteCorners`，同一文档多个挂载共用订阅。纯色和普通单层线性渐变、统一实线边框使用独立构造样式表中的 SVG border-image；不改变 React 的属性或子节点。图片按路径单独裁切。尺寸、主题与新增节点更新后重算。保留输入语义、布局和弹层溢出，不向 React 子树插入装饰节点。旧 CSS squircle 不作为 Apple 路径的另一个实现。

圆形继续使用圆形。椭圆/百分比半径、虚线/不统一边框、多层/径向背景、含背景箭头的原生控件、伪元素及原生阴影/outline/backdrop-filter 保持原 CSS，不能算已全部迁移。特殊组件可设置 `data-corner-shape="native"` 排除，或用显式 Surface 分层接入。SSR 和无 JS 保留后备圆角；未宣称所有平台控件均完成。

## 验证与边界

共享库类型、8 项原生几何/规则检查与构建通过。macOS Safari 27.0.1 专项页 36 项通过，覆盖动态尺寸、输入、卸载、渐变、观察器收敛、延迟 hydration、同心位置变化、角组和固定覆盖。物理 iPhone 此前 0.2.2 的 31 项已通过；0.3.0 真机重验因 USB 断开待恢复，不能将旧版结果改写为新版通过。未进行业务表单提交或全流程测试；不代表所有页面、旧浏览器和其他平台已验收。

首次 CubeRoot Safari 检查暴露装饰节点干扰延迟 hydration，0.3.0 已移除该策略并加入回归；不掩盖为单纯网络错误。独立 WKWebView 探针本轮出现超时，不能将旧报告记作新版本通过，实际 Safari 结果单独记录。

CubeRoot 排除 `.site-glass-engine` 和 `.maplibregl-map`；共享 app-ui 安装入口面向各薄宿主，运行时依赖已登记为 react-dom。组件目录登记 `ContinuousCorners`，不改第三方 iframe/画布的内部内容。

## 后续

复杂视觉效果需按真实组件继续迁移；Android/Harmony/桌面原生安装包与小程序原生控件未完成设备验收。公开发布、Push 与产品部署需当批授权。升级时统一更换共享包和锁文件，不在产品中复制分叉几何算法。

## Apple 27 完整体系补查

已核对 iOS 27 发布说明、GeometryProxy.concentricCornerRadii、ConcentricRectangle、UIKit/AppKit 配置以及 WWDC25/26。0.3.0 增加独立四角、fixed/concentric/minimum、角组统一、左右方向映射与显式容器解析，详细来源和公式随安装包的 docs/apple-system-2026.md 提供。

360 组矩形容器查询与苹果公开 API 数值完全一致；262 组独立四角路径最大坐标差约 0.0000708 个逻辑单位。macOS 27.0.1 与 iOS 27.0 模拟器的 262 条路径和 450 条查询相同。该证据不扩展为 UIKit 所有原生控件或硬件屏幕边缘的证明。网页不以 safe-area 或机型猜测屏幕曲率。

Web 与共享 app-ui 使用同一组 `.cg-card, .rc-card, .recon-card, .sortable-card, .timer-workspace-panel` 容器。没有实际半径或不适配的节点不作容器推断；第三方玻璃与地图边界继续排除。

0.3.0接入后，client与app-ui类型检查均通过；Mac Safari已观察组件页正常载入。原有ClockDial的SVG浮点文本hydration提示仍存在，不属于本库改写属性；不把页面可用写成整页无警告。
