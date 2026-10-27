# @cuberoot/client

cuberoot.me 的现役且唯一 Web 前端，包含 `/platform/*` 产品入口及其复用的 `/org/*`、`/learn/*` 深链，基于 React 19、Next.js 16 App Router 和 Turbopack。旧 Vite SPA、`client-vite` 与 `packages/platform` 前端都已退役；开发、构建和生产启动均由本 package 提供。

## 运行

在 `core/` 下执行：

```bash
pnpm install
pnpm --filter @cuberoot/client dev
```

本地地址为 `http://127.0.0.1:3000/`。开发环境的 `/v1/*` 请求由 `next.config.ts` rewrites 代理；需要只让某个 API 域走本地 Hono 时，按 `apps/api/scripts/README.md` 使用 `LOCAL_DOMAINS`。

## 验证

```bash
pnpm --filter @cuberoot/client typecheck
pnpm --filter @cuberoot/client exec vitest run <tests/file.test.ts>
pnpm --filter @cuberoot/client build
```

dev server 运行时不要同时执行 `next build`，两者共用 `.next/`。Vitest 只负责单元测试，不参与网站的开发、构建或生产运行。

## 目录

- `app/[lang]/`：App Router 页面与布局
- `components/`：跨页共享组件
- `hooks/`：共享 React hooks
- `lib/`：Web 浏览器端与 Next 服务端共用的 Web 私有逻辑
- `public/`：由 Next 直接提供的静态资源
- `tests/`：Vitest 测试与架构守卫

`app/not-found.tsx` 统一承接未匹配 URL 与页面调用 `notFound()` 的兜底，沿用根布局的主题和背景。404 不重定向首页；页面提供品牌首页链接、计时器及公式库入口。根兜底不依赖 `[lang]` provider，通过现有 `LANG_BOOTSTRAP` 设置的 HTML 语言选择中英文内容，链接显式保留对应语言。

`tests/next-only-frontend.test.ts` 会阻止旧网站包、Vite 配置、Vite 运行时依赖和 `import.meta.env` 回流到现役网站代码。

`/site` 的列表/网格共用条目 DOM 和图片状态，切换只改变列表容器的布局类。切换按钮在悬停、获得焦点和按下时预备当前可见元素的坐标；滚动、尺寸、字体、图片加载或筛选变化会使预备状态失效，未预备时直接读取当前坐标。按 CSS 中目标布局的最小行高、列宽和窗口大小预备一段有界的屏外条目，让目标视图新增可见的条目也保留真实起点；实际动画仍只覆盖视口前后可见范围。批量读取目标坐标后通过 Web Animations 执行 FLIP 位移，只移动图标和名称，详细文字淡入；不拟合尺寸、不拉伸文字，也不等待额外动画帧。屏外条目使用 `content-visibility: auto` 跳过内容布局，参与动画的条目临时恢复可见绘制。动画仅由指针切换触发，遵循 `prefers-reduced-motion`；筛选、窗口尺寸变化或离开页面时取消并清理动画，URL 的 `view` 参数仍由 nuqs 管理。

Web GAN v4 电量按通知更新：连接握手后的 `0xEF` 回复通过驱动 `onBattery` 回调刷新状态，首次请求 1 秒未收到有效回复时重试一次（对齐 DCTimer-BLE）。连接和重连保留握手期间已收到的电量，异步读取不能覆盖较新的通知；断开后清理重试并忽略旧会话回调。回归测试见 `tests/bluetooth_cube_reconnect.test.ts`。

公式库通用列表 `AlgCategoryView` 的图／公式及其他公式开关使用原生 FLIP，只移动切换前后可见的图片、名称和首条文字。按 CSS 列数保守预备目标条目，最多测量 60 张卡片；深滚动或大窗口超出预算时直接切换，保留图片懒加载。点击列表进入 case 详情时，仅配对当前 case 的 2D 图、名称及显示内容一致的打乱／解法；不缩放文字、不动画 3D 播放器，保留原有路由地址与后台刷新机制。坐标快照只保留一次导航，超时或窗口变化时放弃过渡。直接打开链接、嵌入详情和减少动态效果模式不触发进入动画。

列表链接在悬停、聚焦和点击时只预备当前目标的路由与详情模块；普通点击时，将已对齐的数据在内存中交给目标详情，不为了进入详情先清空已有内容。数据只保留一个已点击的目标，30 秒后或编辑失效时弃用，后台仍按原缓存订阅刷新。管理员名称输入框按同一 case 配对，兼容 `Aa/A+` 等原名和展示名的区别，不缩放字体。

`VisualCube` 与 `ScramblePreview2D` 的放大预览共用 `DiagramPreview`，只动画当前图片的平移、等比缩放与透明度。关闭动画结束后再卸载共享弹窗，保留遮罩关闭、Esc、焦点恢复和拖动旋转；快速关闭从当前动画位置返回，窗口变化、卸载或减少动态效果设置变化时清理动画。

`/recon` 与计时器复盘共用执行每行前的本地魔方状态图，普通 Cross 与拓展十字都显示缩略图并保留观察转体。计时器成绩详情在桌面完整展开时动画在左、解法在右；窄屏全屏和桌面侧栏保持解法在上、动画在下。原始／化简与复制操作紧随复盘反馈，动作序列由表头统一标注时间和间隔单位。

公式库分类标题复用计时器的两级内容菜单，切换保留当前语言；管理员需开启顶部编辑图标才能拖动集合、case 或列表内公式排序。PLL 的 Adj Swap 等细分组仅作文字分区；ZBLL 等大集合保留一级分类，详情返回该分类并定位原 case，上一条／下一条也沿用同一列表范围。详情中的关联 case 图位于播放器下方，元信息与管理员高级字段通过标签页切换，支持方向键与横向触摸滑动，切换时保留编辑草稿。

稳定的跨端契约和纯逻辑进 `@cuberoot/shared` 的显式 subpath；不从 server、mobile、miniprogram 或已退役 `packages/platform` 导入应用源码。

智能复盘的 CFOP 配对标注沿用整次解法确定的十字颜色；带转体的输入先按十字完成时的中心色解析，不逐行切换到偶然形成的其他十字。配对完成后的观察时间包含前置 U 调整，后续插入暂时拆开旧配对时不移动已确定的结束点。闭合宽层公式可按逐步等价的外层动作匹配，保留记录的动作、时间与实际 AUF；公式库中的可选前置 U 不补入回放。对应分享记录回归见 `tests/recon-f2l-share-recognition.test.ts`。
