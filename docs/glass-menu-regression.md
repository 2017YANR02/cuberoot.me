# 毛玻璃菜单回归检查

菜单自身的 `backdrop-filter: blur(...)` 不代表它能模糊后面的页面。父工具栏的 `backdrop-filter` 会建立 backdrop root，菜单伸到工具栏以外时，背景采样会被截断。父级 `filter`、透明度、mask 等也可能产生同类边界。另一个常见问题是后方图表建立 stacking context，反而盖住菜单。

工具栏的玻璃画在独立 `::before` 层上，菜单与装饰层平行；工具栏本体不加模糊。保留菜单自己的玻璃和必要的层级。比赛日历、列表、成绩汇总参考 `components/site-surfaces.css`，选手分布图参考 `components/distribution-viz/viz.css`，空间页参考 `app/[lang]/space/space.css`。不能把全屏遮罩或菜单完全处于其内的对话框一概当成缺陷。

## 三层检查

1. 现有 `hook-detect-site-material.mjs` 写入守卫重建修改后的 CSS，包括只改一条声明的补丁，拒绝已登记菜单容器重新加模糊。沿用既有 hook 注册，无需新增启动项。真实 `apply_patch` 已验证整块违规新增和单行回归均被拒绝，合法写入放行。
2. `tests/site-material-guard.test.ts` 在现有 CI 中遍历 client 的全部 app/components CSS，并验证分组选择器、前缀属性、伪元素及局部修改。静态规则认识 `.toolbar`、`.shell-topbar`、`.sor-race-bar` 和空间工具栏容器；它不是完整的 CSS/DOM 推理器，动态样式、新类名和表面属性仍需浏览器检查。
3. `scripts/audit-glass-menus.mts` 实际打开外观、比赛国家/筛选菜单、成绩汇总国家菜单、选手分布搜索、空间项目菜单，遍历全部 8 个 fixture × 6 种环境：系统浅/深色、显式浅/深色、390px、图片底图。检查计算样式、越过父级背景采样边界、菜单被遮挡和横向溢出；失败返回非零。该浏览器检查按需运行，不依赖 CI 启动完整网站或线上数据。

```bash
cd core
pnpm --filter @cuberoot/client exec vitest run tests/site-material-guard.test.ts
pnpm --filter @cuberoot/client exec node scripts/audit-glass-menus.mts
```

浏览器脚本默认复用 `http://127.0.0.1:3000` 和已安装 Chrome。可用 `AUDIT_BASE_URL`、`AUDIT_BROWSER_CHANNEL`、`AUDIT_OUTPUT_DIR` 指定预览环境、浏览器通道与输出位置；默认报告和截图位于系统临时目录的 `cuberoot-glass-audit`。脚本不启动、重启或构建服务。选手搜索使用真实公开数据，接口异常按失败记录，不能算通过。

## 本轮排查范围

除全量 CSS 守卫外，做了主要公开页面的菜单巡检（首页、比赛、成绩、复盘、模拟器、公式、打乱、工具、文档与设置等），再根据 JSX 中共享选择器的祖先定位隐藏面板。修复比赛工具栏、成绩汇总工具栏、选手分布工具栏、空间工具栏；手机分布搜索的固定宽度溢出一起修复。

广泛巡检不是所有 URL、登录角色和动态状态的穷举：初轮自动点击在计时器和世界最好成绩页遇到状态变化/元素失效，不能把自动点击次数当作全部验收证据。发布或新增菜单时仍需打开对应真实页面，补充 fixture，检查滚动后的吸顶与菜单，以及无场景背景、系统减少透明效果和浏览器不支持滤镜时的实底回退。不要用只检查 CSS 含有 `blur` 的断言代替视觉检查。
