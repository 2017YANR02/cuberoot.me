# 本地开发环境

## WCA 统计用 MySQL

统计 job 使用 `wca_developer_database`。连接信息由 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASS`、`MYSQL_DB` 环境变量或本机 `core/jobs/stats-build/database.yml` 提供；必需表清单以 [`database.ts`](../core/jobs/stats-build/src/core/database.ts) 的 `REQUIRED_TABLES` 为准。MySQL 服务名和 dump 所在目录随开发电脑而异，不使用旧 Windows 绝对路径。

### 导入数据库

从 `core/` 运行：

```sh
pnpm --filter @cuberoot/stats-build exec tsx src/bin/update_database.ts
```

此入口会重建配置指定的数据库；运行前核对目标是专用的本地开发实例。MySQL 服务启停按本机安装方式操作，不把旧 Windows 的 `MySQL80` 服务名当作跨平台命令。

### 维护者 Mac 的按需服务

本机使用 Homebrew `mysql@8.4`，仅监听 `127.0.0.1:3306`：

```sh
brew services run mysql@8.4
brew services stop mysql@8.4
```

`run` 不注册登录自启动。客户端目录 `/opt/homebrew/opt/mysql@8.4/bin` 已加入本机登录 shell PATH；连接配置在上述 gitignored `database.yml`，CLI 配置在本机 `~/.my.cnf`，两者权限均为 `0600`。换电脑须重新核对这些本机配置。

导入完成后，在 `core/` 运行 `pnpm --filter @cuberoot/stats-build run validate-queries` 检查 SQL。只生成某项用 `pnpm --filter @cuberoot/stats-build compute <stat_id>`，不必重算全部统计。

## 登录配置

WCA OAuth 与其他登录流程以 `core/packages/client/app/[lang]/dev/auth/page.tsx`、现役 API 路由和环境配置为准；退役 Vite 开发端口 `5173` 与旧 Implicit Grant 说明不再作为配置依据。

## 前端开发服务器

从仓库的 `core/` 目录运行：

```sh
pnpm --filter @cuberoot/client dev
# → http://127.0.0.1:3000/
```

本地 Web 的 `/v1/*` 通过 Next rewrites 代理线上 API；`/tools/`、`/stats/` 使用现役 Next route handler，静态资源的发布边界见 `.github/workflows/sync_toolkit.yml`。

## 智能魔方复盘验证

CFOP 步骤文本保留冗余动作并用括号标记：`U' U' U'` 显示为 `(U' U' U')`，`U U'` 显示为 `(U U')`，普通半转 `U U` 仍合并为 `U2`。括号与回放动作索引分离，复制文本保留括号；净效果非零的冗余段只增加展示标记，不把整段时间计入原有净零废步评分。末层执行前 EO 已完成、执行后只剩 EPLL 时标注 `COLL`，执行前 EO 未完成则标注 `OLL(CP)`。对应回归为 `tests/recon-waste-coll.test.ts`。

`/timer` 在打乱匹配完成时锁定陀螺仪参照，在第一手起表时记录实际握持。观察阶段展示两者净朝向对应的最短 `x/y/z` 组合；后续面转按当前握持命名，转体持续更新坐标。专项默认朝向也计入起手握持。

姿态仍存于 `Solve.gyro` 字符串。v2 沿用原有二进制布局，保存打乱参照下、已折算品牌基的魔方姿态；v1 历史录像保留原有读取逻辑，不能补回未记录的打乱结束参照。没有可用参照的录制仍走 v1。离散播放包括中层带动的核心运动，连续播放直接使用 v2 姿态，避免二次换基。

v2 双层转动按陀螺仪落格与编码器面转相差不超过 120ms 匹配，允许两种上报顺序。例如 `L + x → r`、`D + y → u`、`B + z → f`，六个面均覆盖正转、逆转与有向半转。方向和转量必须匹配，中间不能夹着其他面转；一手编码器动作只匹配一次，已确认中层优先。合并只影响复盘显示，原始动作与姿态保留。对应回归为 `tests/recon-wide-timing.test.ts`。

v2 转体与观察转体调试按角度立即换格，不要求保持时间。新朝向须进入 35° 容差：单轴前进约 55° 时换格，回摆至约 35° 才退回，边界之间保留已确认朝向。调试仍为 20ms 轮询；未采到的姿态无法补回。连续同向四分之一转在没有面转穿插时合并显示为半转；双层半转同时匹配编码器与核心的两次四分之一转，原始姿态保留供回放。稀疏采样跨过复合朝向时以最短转体组合保持终态，不推断未采到的实际路径。旧 v1 录像沿用 120ms 保持与仅在无常规事件时启用的 45° / 500ms 宽松补识别。双层动作的 120ms 配对窗口独立于朝向判定。

相关改动从 `core/` 执行 `pnpm --filter @cuberoot/shared build`、`pnpm --filter @cuberoot/client exec vitest run tests/recon-inspection-frame.test.ts tests/gyro_track.test.ts tests/smart-cube-attempt-producer.test.ts`，并执行强制门禁 `pnpm --filter @cuberoot/client test:recon-ground-truth`。真机复验覆盖普通计时、`z2` 专项、观察中往返转体、起手后连续不同轴转体，以及连续/离散播放切换。

## 上游同步脚本

### Solver（or18/RubiksSolverDemo）

在 `core/` 运行：

```sh
pnpm upstream:sync --only solver
```

同步 `src/` 运行时、根目录依赖、13 个 HTML 页面。模板文件在 `.sync/` 目录。

### Alg-Trainers（mihlefeld/Alg-Trainers）

```sh
pnpm upstream:sync --only algtrainers
```

同步 30 个训练器目录 + `src/` + `style/`，为每个训练器注入 `i18n.js`。

> 训练器的 `main.js` 用 `body.outerHTML` 替换 body，MutationObserver 失效。解决方案：注入 `setInterval` 轮询。
