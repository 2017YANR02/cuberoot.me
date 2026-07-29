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
      **302 条 × 494 轮 = 149,188 条两步路线**:每轮都是同样 302 条 ZBLS case,各自接一个
      ZBLL 收尾。合成律 `model.composeState`(与 `cube333.move` 同一条),
      ZBLL 局面槽对已归位、顶层棱全正 → 合成只动顶层角/棱的置换与朝向,**第一眼那张 ZBLS 图
      逐条不变**(φ、大类、翻棱数全等)。收尾按**错位对角** `(轮 - 1 + 名次) mod 494` 分配
      (2026-07-28 改;原为「第 n 轮全体接第 n 个」)—— 那样第 1 轮全体接的是全解顶层,整轮
      退化成纯 ZBLS:实测最优均值 9.28 步,而其余 493 轮全在 13.0~14.4,第 1 轮是唯一异类,
      一轮里还翻来覆去只有一个顶层。错位后 494 轮均值收进 13.78~14.20,轮内 302 个收尾互不相同;
      因为是笛卡尔积上的重排,并集仍是同一批 148,384 张图,**求解语料不受影响**
      (`tests/lsll_rounds.test.ts` 两头都锁)。那 302 个纯 ZBLS 局面没丢:它们本来就是
      zbls 公式集,`/alg/3x3/zbls/run` 有自己的入口。
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

      **范围 = 579,368 个可训练 case**(583,284 − O 类 3,916;用户 2026-07-28 定)。一个语料
      `corpus.txt`,路线那批(148,384)排在前面先出结果,其余 430,984 在后。

      **口径 = case 的最优,不是代表元的最优**(用户 2026-07-28 定,推翻 07-27 的做法)。
      case 是双陪集 ⟨U⟩·S·⟨U⟩ —— 首尾两个 AUF 都是解法里自由选的,所以 `U^a 打乱 U^b` 这
      16 个局面是同一个 case,最优长度互差 0~2 步。每行展开 16 个像各解一次取最短:
      **579,368 × ≤16 = 9,268,992 次求解**(不是 ×16 = 9,269,888:D+ / D− 两类有非平凡稳定子,
      全空间 896 个像重复,按局面去重)。
      - **等价判据**:取到最短后,解的首末招一定都不是 U 系 —— 是的话剥掉就更短,矛盾。
        `solve.mjs` 逐条断言 + `export_cases.mjs` 灌库前整表复核 + `tests/lsll_optimal.test.ts`
        钉判据本身,三处同源。
      - **旧口径的 148,389 行整个作废**:实测 59% 的解首/末是 U 系,均值虚高 ≥0.71 步
        (14.01 → ≤13.30)。`solve.mjs` 启动时扫出来就拒绝续跑,不会静默混用。
      - 成本:h6 21.8 解/s ⇒ 估 118h;opt9 未实测,先 `LIMIT=200` 量。镜像 σ + 求逆最多再 4×
        (→ ~30h),没做,理由见 solver README。

      **149,188 条两步路线的最优打乱是纯查表**:路线 (φ, ζ) 插 mid-AUF 得到的 4 个变体
      `compose(zbll·Uⁿ, zbls)` 全都是 LSLL case,普查实测这 4 个变体的并集**恰好 = 579,368**,
      一个不多一个不少。所以这张表跑完,路线的最优 = 它 ≤4 个变体里最短的那个,零额外求解。
      变体数只由 ZBLL 决定:480 个满 4、10 个塌成 2、4 个塌成 1(各 ×302)。

      **已接进训练器**(2026-07-28,用户「会改变训练的是哪个 case 没关系,现在还没什么人在练」):
      - `lib/lsll/trainer-set.ts` 的 `routeVariants` 摊开 ≤4 个变体,`shortestVariant` 取 htm 最小的;
        并列 / 一个都没回填时取「不插 AUF」那个 ⇒ 后端不在时这一层是**恒等变换**,老口径原样跑。
      - 步数走新端点 `GET /v1/alg/lsll/htm?keys=`(只回 `{key: htm}`,客户端按 256 切并发)。
        一轮 302 条路线 ≈ 1,150 个变体 key ⇒ 5 个请求;逐个打 `/case/:key` 要 1,150 个往返。
      - **旧进度直接删**(用户「旧的直接删,现在还没什么人练」):同一条路线换了 canonical key,
        旧标记 / 记忆指向不再出题的 case,迁不过去。云端那半走 migration `0097_reset_lsll_progress`,
        本机那半在 `lib/trainer-marks.ts` 模块初始化里删(必须先于任何一次云端合并,否则本地那份
        会在 LWW 里飞回云端),旗标 `trainer:reset:lsll-midauf` 只删一次。
        「过遍」进度(`alg_set_progress` / `sweep:`)不删:按 scope 计数,302 条路线本身没变。
      - 只影响「已收录」范围(那才有路线);大类范围是直接枚举 case,与 mid-AUF 无关。
      - 回归 `tests/lsll_trainer_set.test.ts`:变体数直方图 4/10/480 普查、变体第一眼一致、
        并列定序、后端不在照常开场、以及第 1 轮 302 条里 298 条会挪窝(4 条只有一个变体)。

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

      **阶段 1 已落地**(2026-07-27,口径 07-28 重做):`solver/lsll/`(runbook 见其 `README.md`)。
      语料由 `scripts/lsll-corpus.mts` 一次生成成单个 `corpus.txt`:前 148,384 行 —— 只两阶段解
      302+494=796 个基件,路线打乱靠 `composeState(zbll, zbls) ⇒ setup(zbll)+setup(zbls)` 拼接,
      149,188 条逐条回放校验;后 430,984 行 —— 拼不出来,但也不用逐个跑两阶段
      (43 万 × 100ms ≈ 12h):`scripts/lsll-scramble-bfs.mts` 用 9 个保槽生成元
      (`U^k` / `R U^k R'` / `F' U^k F`)对 9,331,200 个原始态做一次 BFS(3.6s,最深 11 层,
      实测全覆盖),回溯即得打乱,43 万条回放校验 10s。**这 9 条之外别乱加**:`R2 U R2` /
      `F U F'` / `R' U R` 会把 DRB / DLF 角送进顶层,收不回来。
      求解 `node solve_loop.mjs`:**固定 opt9 + 15.6G 表**(用户 2026-07-28 定,内存自己腾)、
      12 线程、**每个 case 算完即落盘**(Ctrl-C 最多丢当前那一个,≤16 次求解)、
      **全程只占一行原地覆盖**(重启走 `QUIET=1`,几百次重启也不刷屏)、每条解回放验证、
      启动时自动截掉写残的末行。换表只改速度不改答案,按 key 续跑 ⇒ 中途换表零重做。

      **⛔ 阻塞项已验(结论:h48 吐不出全部最优解)**,证据:
      - `solve_scramble` 第 3 个 int 是 **n_group =「同时解几条」**,**不是**解数上限 ——
        只喂 1 条打乱却传 8,函数空转返回、一行不打;前端 `/scramble/solver` 的「同时求解」
        下拉就是它(`wasm-worker.js:76`)。
      - embind 只导出 `get_mem_ptr / init / get_table_size / get_table_name / solve_scramble`;
        内部的 `get_prun_idx()` 与 `std::vector<sol_t>` 都没导出。
      - 拿 h48 当距离神谕自己 DFS 也不成立:每节点要对 18 个子局面求最优,其中绝大多数深度 L+1,
        **比父局面还贵一个分支因子**。
      ⇒ 阶段 1 的产物是 `htm`(确定的最优步数)+ **一条**最优解,`exhaustive=false`。
      阶段 2(并列全留)三条路按推荐序:①**自建定深枚举** —— L 已由阶段 1 钉死,只需固定深度
      枚举不必迭代加深,配像样的角块 PDB + 两张 6 棱 PDB,`prune_create.rs` 基建都在;
      ②取上游源重编 wasm 开枚举口;③维持退化口径。

      **进度显示**(用户要求:可密集,别刷屏)已按此实现:单行 `\r` 原地刷新(~200ms),
      每 1% 落一条持久行,非 TTY 只留持久行。
      **长跑机制复用 333opt**:每条 `appendFileSync`、按 key 续跑、`solve_loop.mjs` 自动重启
      (cubeopt in-proc 跑久了必抛 emscripten `unwind`),别裸跑 `solve.mjs`。
- [ ] **MCC 排序**:并列解**全留**,MCC(`@/lib/mcc` algSpeed,忽略首尾 U)只做**展示排序**,
      不再做 top-3 筛选(口径变了:并列都要)。
- [x] **存储 + API + 页面**(2026-07-27)。表 `lsll_cases`(migration **0094**):
      `canonical_key`(base36,= URL 的 `?k=`)PK、`htm`、`qtm`、`exhaustive`、
      `optimal_algs jsonb`、`stm` / `mcc_order` 预留。category / eo / co / setup **不入库** ——
      前端拿 key 现算(`classify` / `setupForCase`),别存第二份。
      灌库走 `solver/lsll/update_lsll.ps1`(照 `update_cross_stats.ps1` 的 `Load-*ToPg`:
      复用 `pg_incremental_diff.mjs` 做行级 sha1 增量,manifest 灌成功才落盘;`-Local` 灌本机 pg13)。
      API `GET /v1/alg/lsll/case/:key`(`max-age=300, s-maxage=86400`;未回填 `{status:'pending'}` + `no-store`)
      与 `GET /v1/alg/lsll/dist`(步数直方图)。case 页「HTM 最优解」区已接;`exhaustive=false` 时
      明写「只有一条最优解,QTM 并列未穷尽」。404 也当 pending —— 端点没部署到本环境时别显示成报错。
      ⚠️ **语料按展示相位生成**:case 页画的是 `displayState`,canonical key 认的是 16 个 AUF 像里最小的,
      差一个 AUF 解就贴不上去。`lsll-corpus.mts` 拼完打乱会枚举 16 种首尾 AUF 钉到展示相位,别弄丢。
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
