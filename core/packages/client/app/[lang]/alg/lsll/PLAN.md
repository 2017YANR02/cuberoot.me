# LSLL 公式集 — 任务跟踪

> LSLL = Last Slot and Last Layer。FR 槽 + 顶层一步解。
> 不计首尾 AUF 共 **583,284** case = 288×7776/4 + (3916+3888)×3
> (= 非全槽 8,957,952/16 自由作用 + 全槽 6 构型 Burnside:e=0 三类各 3,916、e=1 三类各 3,888)。
> 已由暴力枚举脚本独立验证(9,331,200 原始态 canonical 化,42 大类分布全对上)。

## 分类学(已定)

- 42 大类 = 槽对构型,命名沿用站内 zbls 公式集字母(A+…X-,F/S/T 自镜像,O = 对子已归位)。
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
- 终态:**305 行 | 305 唯一 case | 0 解析失败**,每组 8+8(C 2+2、D 4+4、F 2、S 8、T 8、O 3)。
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
- [x] **一步 / 两步开关**(2026-07-25,`?cls=2|3`)。两步 = 三类 = 两步路线 (ZBLS case, ZBLL case),
      306 × 494 = **151,164**,与公式表无关(口径见 `/math/lsll` §3 与 `scripts/lsll-class3.mts`)。
      `lib/lsll/class3.ts` 前端枚举两半 + 出图;`[group]?cls=3` 先挑 ZBLS case 再看 494 个 ZBLL 后继;
      `/alg/lsll/route?z=&l=` 单条路线。后半段接库靠 `lib/lsll/zbll_algs.json`
      (`scripts/gen-lsll-zbll-overlay.mts`,zbll 472 + pll 21 = 493/494,差的是跳过)。
      回归 `tests/lsll_class3_model.test.ts`。**没有「代表元」这回事** —— 三类不是二类的商。
- [x] **镜像 case**(2026-07-26,issue #40 T5 的 LSLL 那半)。`lib/lsll/mirror.ts`:σ = 过 FR/BL
      两棱的对角镜面(**不是**左右镜 —— 那会把槽送出 FR),`co' = -co`、
      `eo' = eo + [位置在 E 层] + [块是 E 层块]`(EO 记法在 F↔R 下不对称,`R` 的镜像 `F'` 翻四棱)。
      case 页出镜像缩略卡 + 链接;自镜像 case 直接说明。公式自测过关时给出镜像公式,
      `mirrorAlgForCase()` 会补前置 AUF(两边页面各显示各自的 canonical 代表元,裸镜像解不开)。
      不动点 F = **432**(S 96 / O 192 / F 144 / T 0),镜像对 291,858 —— T6 求解量的减半依据。
      `tests/lsll_mirror.test.ts` 14 条,判据是整方层面的独立实现 + 500 条随机公式对撞。
- [x] **训练并入公用训练器**(2026-07-27)。原 `/alg/lsll/train`(自造的「抽一个 → 揭示」小页)
      删掉,改走 `/alg/3x3/lsll/run` —— 与 `/alg/3x3/zbll/run` **同一个组件**,训练 / 复习 / 记忆
      三模式、计时、轮盘、标记、间隔重复、房间全部照旧。
      机制:`lib/alg-virtual-sets.ts` 定义「虚拟集」(case 不在 PG、前端现算的集),
      `lib/lsll/trainer-set.ts` 供 LSLL 那份 —— 范围(`?scope=zbls` 已收录 305 / `ap` 大类 /
      `ap-eo2` 大类+翻棱数)、case 生成、打乱现算(`setup` 进来是空的,store 抽到哪条解哪条,
      解出来原地写回 case,顺带把逆当作该 case 的公式喂给记忆模式的「揭示」)。
      `trainer-store` 加 `caseResolver` / `resolveCase`;`trainer-case-key` 的 `findCaseByKey`
      改 WeakMap 索引(一场 15,552 个 case,线性 find 顶不住)。
      **不支持「全部 583,284」**:42 个大类全枚举 ≈ 2.6M 次 canonical 化 + 58 万个对象,
      浏览器扛不住 —— 一场只练一个范围。回归 `tests/lsll_trainer_set.test.ts`
      (含训练器随机首尾 AUF 的 16 种接法逐个回放,证明不会换成别的 case)。
- [x] **展示相位 + 打乱图 + 组名排序**(2026-07-27)。三件全站口径,各只留一份实现:
      1. `model.pairDisplayTurn` / `displayState` —— 最后一槽的对子摆在哪一格:角块在顶层就转到
         槽的正上方(URF);只有棱块在顶层,棱侧面那枚贴纸要对上该侧中心色(朝向 0 落 UR、
         朝向 1 落 UF);对子都在槽里则无约束。判据是站内 zbls 库 305 条 setup 里能纯面转回放的
         208 条,42 个子组各自的对子位置 / 朝向完全一致(`tests/lsll_display_phase.test.ts`
         把那张实测表钉死)。大类卡、case 图、大类页现算公式、镜像图、两步的 ZBLS 卡、
         训练器现算打乱全部走它;`setup.ts` 的失安全同步收紧成**逐位相等**(原来只比 canonical key,
         差一个 AUF 也放行)。顺带修好三张一直摆错的大类卡(E- / J- / L-,棱本该在 UF)。
         训练器那边再把打乱**尾部**的随机 AUF 关掉(`trainer-scramble.pairPhaseLocked`)——
         尾部 AUF 会把对子转跑;头部 AUF 不动对子(U 碰不到 DFR / FR),照常随机,
         变的是收尾 AUF。齿轮面板同步不再显示 post-AUF 这个死开关。
      2. **打乱图全彩**:`CaseThumb` 原来把 lsll 与 zbls 归成一类,都套 `vh` 遮罩 ——
         而 `vh` 压灰的正是顶层四角与四周顶排,那是 LSLL 要认的一半信息(zbls 只管末槽 + 翻棱,
         顶层角块本就不看,遮罩没错)。lsll 拆出来不加遮罩,与 `/alg/lsll` 库里那批本地渲染的图
         (`caseFacelets`,一向全彩)一致。训练 / 复习 / 记忆 / 进度总览的图都走 `CaseThumb`,一改全改。
      3. `lib/alg_group_order.compareAlgGroupLabel` —— 组名排序:同字母 `+` 在 `-` 前
         (`localeCompare` 默认反着来,LSLL 首页 42 大类原先就排成了 A- A+)。口径取自 zbls 库
         的入库顺序;`/alg` 下凡是在代码里排组名的都用它。训练器里 LSLL 的组名也从 slug(`ap`)
         换成库里那套字母(`A+`),已收录那批按组名序 + case 编号排。
- [x] **O 类下架**(2026-07-27)。O = 对子已在槽里且朝向正确 → 最后一槽无事可做,剩的纯是顶层:
      它那 **3,916** 个局面就是 **1LLL** 的 3,916 个,一个不多一个不少。所以 LSLL 不收:
      首页只列 **41** 类 / **579,368** 个(583,284 − 3,916),两步只列 **302 × 494 = 149,188**
      (306 个 ZBLS 构型里 O 占 4 个:1 个全解 + 3 个只差翻棱),训练器已收录范围
      **305 → 302**(zbls 库 O 组那 3 条),`?scope=o` 与直链 `/alg/lsll/o` 都给说明 + 送去
      `/alg/3x3/1lll`。判据挂在 `model.LsllCategory.pureLL` 一个字段上,页面/训练器/枚举都读它。
      两个入口页的开头都写清了扣掉的是什么、为什么。
- [x] **训练器分 494 轮**(2026-07-27)。已收录范围从「302 条一场」摊成
      **302 条 × 494 轮 = 149,188 条两步路线**:第 n 轮把同样 302 条 ZBLS case 各自接上
      第 n 个 ZBLL 收尾。合成律 `model.composeState`(与 `cube333.move` 同一条),
      ZBLL 局面槽对已归位、顶层棱全正 → 合成只动顶层角/棱的置换与朝向,**第一眼那张 ZBLS 图
      逐条不变**(φ、大类、翻棱数全等);第 1 轮的收尾是全解顶层,合出来就是公式库那批本身。
      轮次进 `?scope=`(`zbls` / `zbls-r7`),所以换轮 = 换一场(sessionId 带 scope,进度分开);
      「本轮复习结束」弹窗多一颗**真链接**「进入下一轮」(中键能新开),旁边留「再刷一遍本轮」;
      复习进度徽章前面出「第 n / 494 轮」。虚拟集接口加 `roundLabel` / `nextRoundScope` 两个可选口子。
      **149,188 条路线只落在 148,384 张图上** —— 6 条 ZBLS 构型自带 pre-AUF 对称(稳定子 2 的 2 条、
      稳定子 4 的 4 条),那个 U 把顶层也转了,不同 ZBLL 收尾会合出同一张图;这正是
      /math/lsll §3「路线不是局面的商」。数字锁在 `tests/lsll_rounds.test.ts`。
- [x] **MVP:ZBLS 交叉链接**(2026-07-23)。305 个 zbls 案例 → LSLL canonicalKey 映射
      (`scripts/gen-lsll-zbls-overlay.mts` 用真实 model 算 key 零漂移,产 `lib/lsll/zbls_algs.json`,
      305/305 无碰撞);case 页"人类公式"区对覆盖 case 一键直达 zbls 库(精选公式 + 训练器,
      单一数据源不复制)。`lib/lsll/zbls_overlay.ts` + `tests/lsll_zbls_overlay.test.ts`(canonical 往返)。
      HTM 最优 / 全量 MCC 仍诚实占位,待下方批处理。

## 待办

- [ ] **批量求解管道**(本地,≤14 线程)。**引擎 = cubeopt/h48 `cube48opt9` + 15.6G 表**
      (用户 2026-07-27 定)。自己写的那套 Rust `lsll_solver`(22.8MB 投影 PDB + IDA*)**已退役**
      (git `b2e21a52b9`),原因见「耗时评估」的实测对照:比 h48 慢 1–2 个数量级。
      runbook 走 `solver/333opt/README.md` + skill `update-scramble-stats` §C,别再造轮。

      **范围**:302 × 494 = 149,188 条路线,去重后 **148,384 个 canonical key**(804 条重复见上节),
      占全量 583,284 的 25.4%;其余 434,900 个不算,case 页照旧诚实占位。

      **要的解 = HTM 最优前提下 QTM 也最优,并列全留**(用户 2026-07-27 定):
      - QTM = 步数 + 半转(180°)个数。HTM 最优解长度都是同一个 L ⇒ 「QTM 最小」等价于
        **半转最少**。存打乱 = 解的逆序(同 333opt 的口径)。
      - 这是**字典序 (HTM, QTM)**,**不是 QTM 最优** —— 可能存在更长但 QTM 更小的解,按此口径不取。
        别把这个数当 QTM 最优填进 `/scramble/stats` 的 333 `counts_qtm`(那个还是空占位,
        要的是真 QTM 最优,两码事)。
      - **不再需要「≥100 候选 / opt+2 加深」** —— 只要最优深度那一层。光这一条就省两个数量级
        (旧引擎实测:T-perm opt+0 1.68s vs opt+2 233s)。
      - 并列全留 ⇒ **必须拿到全部 HTM 最优解**。少一条,QTM 筛选就可能挑错 —— 这正是刚修的
        截断 bug 的管道版:**截断的解集不能当全集用**。

      **⛔ 开工前必须先验(阻塞项)**:h48 WASM 能不能吐「全部最优解」?
      - 现有证据:wasm 符号表只有 `solve_scramble(std::string,int,int,int)` 和
        `solve_optimal(search_context&, cubie&, sol_t&, int,int,int)` —— `sol_t&` **单数**,
        像是只回一条。调用点 `solver/333opt/solve.mjs:77` 是 `m.solve_scramble(scr, nt, 1, true)`,
        第三个 int **疑似解数上限**(假设,未验)。
      - 验法(等放行):`solve_scramble(scr, K, 8, true)`,数 debug 输出里 `Solution found!:`
        出现几行、是否互不相同。>1 且不同 ⇒ 有枚举口,把 8 换成足够大即可。
      - 若没有,三条备选:①取上游 h48 源重编 WASM 开枚举口;②拿 15.6G h48 表当剪枝表自写
        「定深枚举」(要吃透表格式/坐标);③退化口径:只存一条最优解 + 明确标注「QTM 并列未穷尽」。

      **进度显示**(用户要求:可密集,别刷屏):`solve.mjs` 已有
      `[n/total] id -> htm (Xms) · 4.00/s · ETA 3.2h` 的形状,照它扩(加 QTM、并列条数、
      截断计数),**单行 `\r` 原地刷新**(~200ms 一次);里程碑(每 1% / 每批)才打换行的持久行;
      禁每 case 一行。非 TTY(重定向进日志)判掉 `\r` 退化成周期性单行。多 worker 走单一 reporter,
      别各印各的交错。
      **必须复用 333opt 的长跑机制**:每解 `appendFileSync` 落盘、按 id 续跑、
      opt9 in-proc ~5000 解后必抛 emscripten `unwind` ⇒ 照 `solve_loop.mjs` 做自动重启 wrapper,
      别裸跑(崩了零损失,但没 wrapper 就停在半路)。
- [ ] **MCC 排序**:并列解**全留**,MCC(`@/lib/mcc` algSpeed,忽略首尾 U)只做**展示排序**,
      不再做 top-3 筛选(口径变了:并列都要)。
- [ ] **存储**:PG 新表 `lsll_cases`(canonical_key PK, category, eo/co 元数据, setup,
      `htm_optimal`, `qtm_optimal`, `optimal_algs jsonb` = 全部 (HTM,QTM) 并列解,
      `exhaustive bool` = 是否已穷尽并列(枚举口没到位时为 false), mcc_order 预留, stm_optimal 预留)。
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

## 耗时评估

**两轮旧估都作废**:①「0.1–2s/case、全量 1–24 小时」是纯外推,差 3–5 个数量级;
②按自写引擎算出的「年级别」也不作数 —— 引擎换了。

### 现在的口径:opt9,实测锚在 333opt

`solver/333opt/README.md` 实测(cube48opt9 + 15.6G 表,in-proc 12 线程):

| 表 | 每解 | 全量 1,297,444 |
|---|---|---|
| opt5 972M | ~43s | ~93 天,不可行 |
| **opt9 15.6G** | **~250ms**(~4 解/s) | ~3.5 天 |

那 250ms 的对象是**18 步随机态**(均值 17.7),最难的一档;LSLL 只有 12–14 步,更浅。
所以 148,384 个按最保守的 4 解/s 算 = **10.3 小时**,实际预期更短。
**这类问题的成败在表大小,不在代码**(opt5→opt9,170 倍)。

### 自写引擎的实测对照(留作教训,代码已退役)

2026-07-27 实测(release 单线程,4 张投影 PDB 共 22.8MB):

| case | 最优 | opt+0 | opt+1 | opt+2 |
|---|---|---|---|---|
| Sune `R U R' U R U2 R'` | 7 | 1 解 / 630 节点 / 0ms | 1 解 / 6,014 节点 | **8 解** / 66,794 节点 / 12ms |
| T-perm | 11 | 20 解 / 8.7M 节点 / **1.7s** | 40 解 / 80.7M 节点 / 27s | **204 解** / 826M 节点 / **233s** |

- 11 步 1.7s vs h48 的 18 步 250ms —— 慢 1–2 个数量级,就是表小(22.8MB vs 15.6GB)的代价。
- 三个具体病灶(供以后写求解器时避坑):**①对 LSLL 输入,4 张表里有 2 张恒为 0** ——
  `OTHER_CORNERS`/`OTHER_EDGES` 在任何 LSLL 局面里都已归位,根节点的界只由两张小投影给出;
  ②启发式实际只值约 5 层(8.7M ≈ 13.35^6.2,等于盲搜 6.2 层);
  ③每节点 193ns(整方拷贝 + 每次重建逆位置数组 + 4 次 base-24 编码),表驱动的该是 10–20ns。
- 有用的副产品:**候选数远比预想少** —— opt+2 只有 8 / 204 条,4096 的 cap 根本碰不到。
  这也是新口径(只要最优深度那一层)成立的依据之一。
- 先跑 100 随机 case PoC 实测均值,再外推总时长与分批计划;浅 case(opt ≤ 5)加深
  上限 opt+4 防候选不足,深 case 若爆炸按 500 条截断。
