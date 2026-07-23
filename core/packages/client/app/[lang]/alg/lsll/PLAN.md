# LSLL 公式集 — 任务跟踪

> LSLL = Last Slot and Last Layer。FR 槽 + 顶层一步解。
> 不计首尾 AUF 共 **583,284** case = 288×7776/4 + (3916+3888)×3
> (= 非全槽 8,957,952/16 自由作用 + 全槽 6 构型 Burnside:e=0 三类各 3,916、e=1 三类各 3,888)。
> 已由暴力枚举脚本独立验证(9,331,200 原始态 canonical 化,42 大类分布全对上)。

## 分类学(已定)

- 42 大类 = 槽对构型,命名沿用站内 zbls 公式集字母(A+…X-,F/S/T 自镜像,Solved Pair)。
- 字母 ↔ 构型映射由 zbls 集 289 条 setup 逆向实证(cubing.js 提取状态 + y 共轭归 FR 框架),
  已硬编码进 `lib/lsll/model.ts` 的 `CATEGORIES`。
- 大类粒度 = 构型(c=槽角扭、e=槽棱翻、TT 的 d=角棱顶位相对差);
  二级 = 顶层翻棱数(ZBLS 真 case 粒度);三级待加:CO/CP 筛选。

## zbls 集数据修复(2026-07-23,已完成 ✅,权威源 = `.tmp/docx/ZBLS.docx`)

- 理论 ZBLS = 306 含全解(Burnside (1200+12+6+6)/4),去掉全解 = **305** ✓。
- docx 解析出 305 案(全独立、恰=理论全集);用站点 `@cuberoot/shared/alg-notation`
  同款记号层(连写=顺序 move、`[..]`/`↓↑`/`=`/`*` 剥离)——早前"14 条坏 setup"
  多数是我 diff4 自造 normalize 的误报,真坏只 2 行(`E± D`,坏公式的逆)。
- 已走 alg admin API 落库:38 行改名归位(镜像案挂 + 组/公式当名字 → `X T'` 式)、
  4 行重建(`E± IV` 去重、`E± D` 修 setup)、16 案新建(E VF、U Lb/VZb、V Tb–Td/Ib–Id 及镜像)、
  全 set 按 docx 顺序 reorder。docx 内 5 条坏公式已剔(EIV/EIV'/ED/ED' 首条、ULb 第 5 条)。
- 终态:**305 行 | 305 唯一 case | 0 解析失败**,每组 8+8(C 2+2、D 4+4、F 2、S 8、T 8、SP 3)。
  逐条公式已验 setup+alg → F2L+EO 目标(含 AUF 对齐)。脚本:`.tmp/zbls_docx_audit.mjs`
  (审计/计划)、`.tmp/zbls_docx_apply.mjs`(写库+复审)、`.tmp/zbls_reorder.mjs`。

## 已完成(UI 先行,2026-07-23)

- [x] `lib/lsll/cube333.ts` cubie 模型(kociemba 序;与 cubing.js、visualcube fd 双探针校准)。
- [x] `lib/lsll/model.ts` canonical key(40bit,Z4×Z4 最小像)、42 大类、类内枚举
      (客户端组合生成,无后端)、打乱定位、公式自测验证。
- [x] `lib/lsll/setup.ts` case → 打乱(cubing.js 两阶段取逆 + 本地回放失安全)。
- [x] `components/FaceletsCube.tsx` fd 串本地渲染(已登记 /code catalog)。
- [x] 页面:`/alg/lsll`(42 大类 + 定位)、`/alg/lsll/[group]`(EO 筛选 + 分页)、
      `/alg/lsll/case?k=`(状态图/打乱/自测/占位区)。`/alg/3x3` 入口卡。
- [x] `tests/lsll_model.test.ts`(计数锁定 + cubing.js 交叉校验 + facelets 字节比对)。
- [x] **MVP:ZBLS 交叉链接**(2026-07-23)。305 个 zbls 案例 → LSLL canonicalKey 映射
      (`scripts/gen-lsll-zbls-overlay.mts` 用真实 model 算 key 零漂移,产 `lib/lsll/zbls_algs.json`,
      305/305 无碰撞);case 页"人类公式"区对覆盖 case 一键直达 zbls 库(精选公式 + 训练器,
      单一数据源不复制)。`lib/lsll/zbls_overlay.ts` + `tests/lsll_zbls_overlay.test.ts`(canonical 往返)。
      HTM 最优 / 全量 MCC 仍诚实占位,待下方批处理。

## 待办

- [ ] **批量求解管道**(本地,solver/ 大表,≤14 线程):
      每 case 全部 HTM 最优解 + 加深到 ≥100 条候选(自适应 opt+n,上限 opt+4;
      13.34^n 增长,一般 opt+2 即 ≥100)。先 PoC 实测 100 case 单例耗时再外推,
      决定分批节奏。需确认现有引擎的"同深度全部解枚举"输出口,没有就给 IDA* 加。
- [ ] **MCC 排序**:复用 `@/lib/mcc` algSpeed(忽略首尾 U),候选取 top-3 入库。
- [ ] **存储**:PG 新表 `lsll_cases`(canonical_key PK, category, eo/co 元数据,
      setup, htm_optimal, optimal_algs jsonb, mcc_best jsonb, stm_optimal 预留)。
      API `/v1/alg/lsll/case/:key`(缓存头照 CI 契约);未回填 case 返回"计算中"。
- [ ] **用户提交**(用户已确认要):登录 + 提交前端 + 服务端验证(复用 verify 逻辑移植)
      + MCC 评分入库;复用 recon 的 auth 通道。
- [ ] case 页接 API 显示最优解 / MCC 推荐;大类页步数分布直方图(数据齐后)。
- [ ] 大类页 CO/CP 三级筛选;ZBLS case 粒度的中间层(映射 `lib/lsll/zbls_algs.json` 已有,
      可在大类/分组页给已收录 case 标个 "ZBLS" 徽标 + 直达)。
- [ ] TwistyPlayer 动画(cubing-anim-alg 模式)。
- [ ] alg_sets 注册 LSLL 条目(入口卡目前硬编码在 AlgPuzzleClient)。
- [x] zbls 集修数据(305/305,详见上节)。
- [ ] STM 最优:搁置(项目暂无 STM 求解器),schema 预留列。

## 耗时评估(候选 ≥100 条/case,待 PoC 实证)

- 候选池 = 全部最优解 + 逐层加深;HTM 分支数 ≈ 13.34,一般 opt+2 深度即 ≥100 条。
- 枚举 ≤ opt+2 全解 ≈ 单次最优搜索的 ~180 倍;LSLL 态浅(估峰值 12–14 HTM),
  单 case 估 0.1–2s(大剪枝表),583,284 case ÷ 14 线程 ≈ **1–24 小时量级**。
- 先跑 100 随机 case PoC 实测均值,再外推总时长与分批计划;浅 case(opt ≤ 5)加深
  上限 opt+4 防候选不足,深 case 若爆炸按 500 条截断。
