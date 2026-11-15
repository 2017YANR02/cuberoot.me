# 六阶 L2C / L2E 收录

## 范围与来源

- 仅六阶；七阶不变。延续四、五阶的 AlgFile / AlgCase、编号、来源字段和共享页面。
- [SpeedCubeDB L2C](https://speedcubedb.com/a/6x6/6x6L2C)：33 条来源记录去除一条同状态、同公式重复项后为 32 种情况、33 条公式。
- [SpeedCubeDB L2E](https://speedcubedb.com/a/6x6/6x6L2E)：3 种情况、7 条公式。
- 公式逐条保留 altId 和 speedcubedb 来源；原站图片不打包，情况图由 CaseThumb → VisualCube 本地生成。来源的彩色贴纸数据仅作为独立校验基准。
- 这是该来源的实用精选，不声称穷举六阶所有 L2C/L2E 状态；未使用 CubeSkills 的图文或视频。未取得额外的整站素材转载许可。

## 校验

1. 每条首选公式反推显式 setup，使用 VisualCube 状态引擎逐贴纸匹配来源图全部非灰贴纸（每面 36 格）。
2. 全部备选式从同一 setup 执行；L2C 校验六面四类中心的颜色还原，L2E 校验全部贴纸颜色还原。
3. 使用独立 cubing.js KPuzzle 与网站 validateStoredAlgCase 再验全部 40 条，禁止隐式 AUF 或转体补偿。六阶中心块的同色置换视为还原，两个棱轨道和角块仍严格检查。
4. 全部 35 种情况沿用与五阶相同的缩略图参数，只改变阶数；共享播放器、打乱与方向控件支持六阶。五、六阶 L2C 共用现有 center 遮罩，修正原 LL 遮罩把交换中心灰掉的问题。
5. 回归包含错误公式拒绝、内外层中心破坏拒绝与 L2C/L2E 目标区分。

## 重现

在 core/ 执行现有 scraper（仅抓取，不运行打乱统计）：

```sh
pnpm --filter @cuberoot/scramble-stats-build exec tsx bin/scrape_speedcubedb.ts --puzzle 6x6 --output-dir /tmp/cuberoot-six-raw
pnpm --filter @cuberoot/client exec node --import tsx scripts/prepare-six-algs.mts /tmp/cuberoot-six-raw /tmp/cuberoot-six-reviewed
pnpm --filter @cuberoot/client exec vitest run tests/alg_6x6.test.ts
```

审阅后的固定数据位于 core/packages/client/tests/fixtures/alg-6x6.json；数据库真源仍为 alg_sets / alg_cases。0316_alg_6x6.sql 是仅插入迁移，不覆盖已有同名情况或管理员编辑。初次交付时仅准备本地代码与迁移；后续补封面任务已将此文件中的纯内容 INSERT 在生产库事务执行。未改变 schema，未推送代码，也未手工修改迁移 runner 账本；未来正式部署再次应用此迁移不会重复插入。

## 原始名称映射与去重

| 站内编号 | 来源名称 | 公式 ID / 处理 |
| --- | --- | --- |
| L2E 1 | Wing Parity | 2476, 3886 |
| L2E 2 | Middle Parity | 2477, 3885 |
| L2E 3 | Swap single piece | 2478, 25903, 26011 |
| — | Inner Center | Redundant finishing U alternative (2473) |
| L2C 1 | Inner Center | 2474 |
| L2C 2 | Outer center | 4212, 2475 |
| L2C 3 | Front 3 Bar | 3685 |
| L2C 4 | Back 3 Bar | 3687 |
| L2C 5 | Pair and Split | 3686 |
| L2C 6 | Pair And Split | 3688 |
| L2C 7 | Two Splits | 3689 |
| L2C 8 | Two Pairs | 3690 |
| L2C 9 | Split and a Pair | 3691 |
| L2C 10 | Split and a bar | 3692 |
| L2C 11 | Split and a bar | 3693 |
| L2C 12 | Pair and a Bar | 3694 |
| L2C 13 | Pair and a Bar | 3695 |
| L2C 14 | Split and a bad Bar | 3696 |
| L2C 15 | Split and a bad Bar | 3697 |
| L2C 16 | Pair and a bad Bar | 3698 |
| L2C 17 | Pair and a bad Bar | 3699 |
| L2C 18 | Stray Obliques | 3865 |
| L2C 19 | Pair and a Nice 3 Ba | 4317 |
| L2C 19 | L and a Bar | Identical case state and algorithm |
| L2C 20 | L and a Bar | 3869 |
| L2C 21 | Pair and a bad Bar | 3870 |
| L2C 22 | Pair and a bad Bar | 3871 |
| L2C 23 | Bar and Scatter | 3872 |
| L2C 24 | Bar and Scatter | 3873 |
| L2C 25 | Front 3 Bar | 3874 |
| L2C 26 | Right 3 Bar | 3875 |
| L2C 27 | Two Pairs | 3876 |
| L2C 28 | Kite | 3877 |
| L2C 29 | Triangle | 3878 |
| L2C 30 | Triangle | 3879 |
| L2C 31 | Pair and Shape | 3880 |
| L2C 32 | Pair and Shape | 3881 |

## 本地验收记录

- shared 构建、client typecheck 及 7 个相关测试文件（110 项）通过；遮罩修正后的 2 个受影响测试文件（66 项）复验通过。
- 隔离 PostgreSQL 16 按真实 alg_sets/alg_cases 表定义连续执行迁移两次，仍为 32/3 种情况、33/7 条公式。
- 本地 dev 通过浏览器拦截仅注入本次已验证的六阶 API 数据，完整加载两组情况图；该预览不代表线上数据库已更新。
- Playwright 浏览器逐页打开 35 个六阶详情页并操作末尾控件，无 pageerror；L2C/L2E 各检查一次复位、单步及末态截图，390px 手机宽度没有横向溢出。

## 封面补齐

六阶目录接口原为 sets=[]，导致与五阶共用的 AlgCard / CaseThumb 没有首条情况可绘制。现已将 35 种情况、40 条公式实际入库，API 逐字段读回与审阅夹具一致；catalog 返回 L2C 1 / L2E 1。无需新图片文件或六阶专用封面逻辑。本地 dev 使用真实 API（无拦截）对照五阶与六阶目录截图，两个六阶封面均正常，尺寸、间距和组件复用现有实现，无浏览器 pageerror。代码仍未提交或推送。
