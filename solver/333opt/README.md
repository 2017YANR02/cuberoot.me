# 333 整解最优步数统计管道

为 `/scramble/stats` 难度 tab 的 **「333」方法**生成「整个三阶魔方最优解 HTM 步数分布」。
方法/阶段/数据形态见前端 `core/packages/client-next/app/[lang]/scramble/stats/` + memory `project_333_optimal_difficulty`。

> 这是**手动本地管道**(非 CI):求解极慢,且依赖本机的 WCA dump + WASM + 剪枝表。
> 跑完产出注入仓库根 `stats/scramble/*.json`,再手动发布 CDN。

## 依赖(本机)

1. **本地 WCA MySQL dump** —— `pull.mjs` 读 `scrambles` 表(见全局 CLAUDE 的本地 WCA DB);连接信息取自 `core/packages/stats-build/database.yml`。
2. **cubeopt WASM** —— `core/packages/client-next/public/cubeopt/cube48optN.mjs` + `.wasm`(Tronto h48 最优解,前端 `/scramble/solver` 同款)。
3. **剪枝表** —— `solver/tables/h48/`(gitignored)。表与模块一一对应:
   - `cube48opt5.mjs` ↔ `h48prun31h5.dat`(**972M**,现有,**仅抽样**)。
   - `cube48opt9.mjs` ↔ 15G 表(**生产用,需先生成,目前没有**)。

## 步骤

```bash
# CWD = 本目录 solver/333opt/
node pull.mjs 240          # ① 拉 N 条真实 WCA 333 打乱 → scrambles.txt
node solve.mjs 7           # ② 7 进程并行解 → out.<c>.csv + counts.json(可续跑)
node inject.mjs            # ③ 注入 stats/scramble/{distribution,examples}.json(variant '333')
```

- `solve.mjs` 默认 `cube48opt5` + 972M 表。换 15G 表:
  ```bash
  MODULE=../../core/packages/client-next/public/cubeopt/cube48opt9.mjs \
  TABLE=../tables/h48/<15G>.dat node solve.mjs 7
  ```
- `solve.mjs` 可续跑:`out.<c>.csv` 已写的行重启会跳过。
- **限核**:K ≤ 7(本机 8C16T,留 1 核)。Node 下 emscripten pthreads 不 spawn,只能进程级并行;表必须 64M 分块灌进 heap(否则 7 进程同时 OOM)。

## 发布(手动,用户在场)

`inject.mjs` 只写**本地** `stats/scramble/*.json`。上线要:

1. `scp stats/scramble/{distribution,examples}.json` 到 static origin(CDN);
2. 若改了 JSON 形态,bump `stats/page.tsx` fetch 的 `?v=` 参数;
3. 前端代码改动需 commit+push(Vercel + systemd 部署)才在生产显示。

## 成本(为什么现在只能抽样)

- **全量语料 ≈ 1,297,444 条**(合并 WCA 三阶池)。
- **972M 表**:均值 ~43s/解(单线程弱表)→ 7 核全量 **≈ 93 天 / ~15,600 CPU 小时**,不可行,**只能抽样**(雏形 240 条:16:4 / 17:60 / 18:165 / 19:11,峰 18)。
- **15G 表(cube48opt9)**:剪枝强 16×,秒级 → 全量约几天可跑完。**这才是生产路径**;表生成后用上面的 env 切换即可,管道其余不变。

## TODO

- **QTM**:`inject.mjs` 写的 `counts_qtm` 暂为空(前端 QTM 钮占位「即将加入」)。要做需在 solve 阶段额外按 QTM 口径统计,或对 HTM 解二次计步。
