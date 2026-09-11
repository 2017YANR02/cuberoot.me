# 全站玻璃 页面 CSS 适配审核

状态：页面样式实现已落地，静态检查通过；浏览器集成与逐页视觉验收尚未完成。不得据此标记全站已验收。

本记录由独立页面 CSS Agent 维护。本轮不暂存、不提交、不推送。

## 范围和实现

- 仅修改下表 128 个 app/[lang] 页面 CSS；保留原有声明，在 screen 媒体与 body[data-site-scenery] 双重作用域内追加覆盖。
- 106 个显式页面根背景透明，331 个显式既有表面消费共享材质；这里是 CSS 选择器数量，不是路由或可见卡片数量。
- 卡片使用 --glass-surface-bg，38 个已识别浮层使用 --glass-popover-bg；滤镜、边缘、阴影来自统一变量。未给整页根或所有 div 添加模糊。
- 开发介绍页和部分旧介绍页的局部中性色映射全站 token；品牌色、数据语义色和代码语法色保留。34 个代码相关样式用原有 --text 值提取局部 --code-plain，避免浅色外观造成深色代码画布黑字。
- 不改 home-background.css、appearance/appearance.css、music/music.css、sim/sim-mask-admin.css；不修改 iframe/fork、3D/map/video/canvas 渲染或纸张/表格单元格。

## 验证证据

- 128 个文件经 PostCSS 全量解析。新增选择器全部受场景作用域限制；没有新增前景渐变、侧向高光或硬编码材质色。--code-plain 逐值核对来自各文件原有 --text。
- 仅上述 128 文件的 git diff --check 退出码：0。纯 CSS 修改未运行 typecheck。
- 首次 Playwright 独立页：1280×900，/zh/dev/language/python 和 /zh/math/god 返回 HTTP 200，根无横向溢出；当时 body 没有 data-site-scenery，根仍不透明且卡片 filter=none。这仅证明无背景回退当时仍生效，不能作为玻璃效果通过证据。
- 同批 /zh/alg 与 /zh/tutorial/lbl 导航分别在 45 秒超时，未验收。
- 第二批计划在 390×844 对 python/math god 作显式场景作用域检查；导航未获得 document.body，evaluate 报 Cannot read properties of null (reading dataset)。没有形成有效样式/截图证据，未重复刷新。
- 上述浏览检查发生在多个 Agent 同时修改和 dev 编译期间，记录实际结果，不推断是产品代码错误或性能结论。

## 尚需产品验收

1. 基础层稳定后逐条执行主路由清单，记录真实 body 场景状态、截图和表面 computed style，不把 CSS 解析通过当成视觉通过。
2. 桌面/390px、亮/暗、系统与强制外观交叉、无背景、低对比、减少透明、浏览器滤镜回退与打印。
3. 浮层打开后的密度与层级、代码块前景、旧页面局部主题、长页底部背景、表格/纸张/画布原样、首页拖动点隔离。
4. 特别复查大型 dev 介绍页的其余历史装饰和局部硬编码文本；本次仅改已确认的中性入口，不能声称所有语义颜色都完成对比度验收。
5. frame-count 的旧深色工作台、sim/map/canvas 场景本体保留；外壳需结合主 Agent 的场景策略验收，不用透明化工作内容冒充覆盖。

## 文件清单

以下每个文件均为“源码静态检查通过，产品视觉待验收”；并不等于 128 个页面都已浏览。

| CSS 文件 | 状态 |
| --- | --- |
| [about/about.css](../core/packages/client/app/[lang]/about/about.css) | 静态通过，视觉待验收 |
| [about/ruimin/ruimin.css](../core/packages/client/app/[lang]/about/ruimin/ruimin.css) | 静态通过，视觉待验收 |
| [alg/3bld/3bld.css](../core/packages/client/app/[lang]/alg/3bld/3bld.css) | 静态通过，视觉待验收 |
| [alg/alg.css](../core/packages/client/app/[lang]/alg/alg.css) | 静态通过，视觉待验收 |
| [alg/commutator/commutator.css](../core/packages/client/app/[lang]/alg/commutator/commutator.css) | 静态通过，视觉待验收 |
| [alg/skewb-trainer/skewb.css](../core/packages/client/app/[lang]/alg/skewb-trainer/skewb.css) | 静态通过，视觉待验收 |
| [alg/_roux/roux.css](../core/packages/client/app/[lang]/alg/_roux/roux.css) | 静态通过，视觉待验收 |
| [alg/_roux/_components/AnalyzerView.css](../core/packages/client/app/[lang]/alg/_roux/_components/AnalyzerView.css) | 静态通过，视觉待验收 |
| [alg/_roux/_components/BlockTrainerView.css](../core/packages/client/app/[lang]/alg/_roux/_components/BlockTrainerView.css) | 静态通过，视觉待验收 |
| [alg/_roux/_components/CmllTrainerView.css](../core/packages/client/app/[lang]/alg/_roux/_components/CmllTrainerView.css) | 静态通过，视觉待验收 |
| [alg/_roux/_components/FavListView.css](../core/packages/client/app/[lang]/alg/_roux/_components/FavListView.css) | 静态通过，视觉待验收 |
| [alg/_roux/_components/TrackerView.css](../core/packages/client/app/[lang]/alg/_roux/_components/TrackerView.css) | 静态通过，视觉待验收 |
| [alg/_trainer/trainer.css](../core/packages/client/app/[lang]/alg/_trainer/trainer.css) | 静态通过，视觉待验收 |
| [calc/calc.css](../core/packages/client/app/[lang]/calc/calc.css) | 静态通过，视觉待验收 |
| [calc/_components/average_mode/average_mode.css](../core/packages/client/app/[lang]/calc/_components/average_mode/average_mode.css) | 静态通过，视觉待验收 |
| [calc-about/calc_about.css](../core/packages/client/app/[lang]/calc-about/calc_about.css) | 静态通过，视觉待验收 |
| [calendar/calendar.css](../core/packages/client/app/[lang]/calendar/calendar.css) | 静态通过，视觉待验收 |
| [comp-sim/comp-sim.css](../core/packages/client/app/[lang]/comp-sim/comp-sim.css) | 静态通过，视觉待验收 |
| [contact/contact.css](../core/packages/client/app/[lang]/contact/contact.css) | 静态通过，视觉待验收 |
| [dev/algorithms/algorithms_landing.css](../core/packages/client/app/[lang]/dev/algorithms/algorithms_landing.css) | 静态通过，视觉待验收 |
| [dev/algorithms/cfop-std-solver/algorithm_intro.css](../core/packages/client/app/[lang]/dev/algorithms/cfop-std-solver/algorithm_intro.css) | 静态通过，视觉待验收 |
| [dev/algorithms/gan-ble/gan-ble.css](../core/packages/client/app/[lang]/dev/algorithms/gan-ble/gan-ble.css) | 静态通过，视觉待验收 |
| [dev/algorithms/ida-star/algorithm_intro.css](../core/packages/client/app/[lang]/dev/algorithms/ida-star/algorithm_intro.css) | 静态通过，视觉待验收 |
| [dev/algorithms/kociemba/algorithm_intro.css](../core/packages/client/app/[lang]/dev/algorithms/kociemba/algorithm_intro.css) | 静态通过，视觉待验收 |
| [dev/algorithms/min2phase/algorithm_intro.css](../core/packages/client/app/[lang]/dev/algorithms/min2phase/algorithm_intro.css) | 静态通过，视觉待验收 |
| [dev/algorithms/webcodecs/webcodecs.css](../core/packages/client/app/[lang]/dev/algorithms/webcodecs/webcodecs.css) | 静态通过，视觉待验收 |
| [dev/api/api.css](../core/packages/client/app/[lang]/dev/api/api.css) | 静态通过，视觉待验收 |
| [dev/architecture/architecture.css](../core/packages/client/app/[lang]/dev/architecture/architecture.css) | 静态通过，视觉待验收 |
| [dev/code_index.css](../core/packages/client/app/[lang]/dev/code_index.css) | 静态通过，视觉待验收 |
| [dev/components/components_gallery.css](../core/packages/client/app/[lang]/dev/components/components_gallery.css) | 静态通过，视觉待验收 |
| [dev/cubingchina/cubingchina_intro.css](../core/packages/client/app/[lang]/dev/cubingchina/cubingchina_intro.css) | 静态通过，视觉待验收 |
| [dev/dead-code/dead-code.css](../core/packages/client/app/[lang]/dev/dead-code/dead-code.css) | 静态通过，视觉待验收 |
| [dev/fonts/fonts.css](../core/packages/client/app/[lang]/dev/fonts/fonts.css) | 静态通过，视觉待验收 |
| [dev/guards/guards.css](../core/packages/client/app/[lang]/dev/guards/guards.css) | 静态通过，视觉待验收 |
| [dev/infrastructure/infrastructure.css](../core/packages/client/app/[lang]/dev/infrastructure/infrastructure.css) | 静态通过，视觉待验收 |
| [dev/language/bash/bash_intro.css](../core/packages/client/app/[lang]/dev/language/bash/bash_intro.css) | 静态通过，视觉待验收 |
| [dev/language/c/c_intro.css](../core/packages/client/app/[lang]/dev/language/c/c_intro.css) | 静态通过，视觉待验收 |
| [dev/language/code_landing.css](../core/packages/client/app/[lang]/dev/language/code_landing.css) | 静态通过，视觉待验收 |
| [dev/language/compare/compare.css](../core/packages/client/app/[lang]/dev/language/compare/compare.css) | 静态通过，视觉待验收 |
| [dev/language/cpp/cpp_intro.css](../core/packages/client/app/[lang]/dev/language/cpp/cpp_intro.css) | 静态通过，视觉待验收 |
| [dev/language/csharp/csharp_intro.css](../core/packages/client/app/[lang]/dev/language/csharp/csharp_intro.css) | 静态通过，视觉待验收 |
| [dev/language/css/css_intro.css](../core/packages/client/app/[lang]/dev/language/css/css_intro.css) | 静态通过，视觉待验收 |
| [dev/language/go/go_intro.css](../core/packages/client/app/[lang]/dev/language/go/go_intro.css) | 静态通过，视觉待验收 |
| [dev/language/haskell/haskell_intro.css](../core/packages/client/app/[lang]/dev/language/haskell/haskell_intro.css) | 静态通过，视觉待验收 |
| [dev/language/html/html_intro.css](../core/packages/client/app/[lang]/dev/language/html/html_intro.css) | 静态通过，视觉待验收 |
| [dev/language/java/java_intro.css](../core/packages/client/app/[lang]/dev/language/java/java_intro.css) | 静态通过，视觉待验收 |
| [dev/language/javascript/javascript_intro.css](../core/packages/client/app/[lang]/dev/language/javascript/javascript_intro.css) | 静态通过，视觉待验收 |
| [dev/language/katex/katex_intro.css](../core/packages/client/app/[lang]/dev/language/katex/katex_intro.css) | 静态通过，视觉待验收 |
| [dev/language/kotlin/kotlin_intro.css](../core/packages/client/app/[lang]/dev/language/kotlin/kotlin_intro.css) | 静态通过，视觉待验收 |
| [dev/language/latex/latex_intro.css](../core/packages/client/app/[lang]/dev/language/latex/latex_intro.css) | 静态通过，视觉待验收 |
| [dev/language/lua/lua_intro.css](../core/packages/client/app/[lang]/dev/language/lua/lua_intro.css) | 静态通过，视觉待验收 |
| [dev/language/mojo/mojo_intro.css](../core/packages/client/app/[lang]/dev/language/mojo/mojo_intro.css) | 静态通过，视觉待验收 |
| [dev/language/php/php_intro.css](../core/packages/client/app/[lang]/dev/language/php/php_intro.css) | 静态通过，视觉待验收 |
| [dev/language/powershell/powershell_intro.css](../core/packages/client/app/[lang]/dev/language/powershell/powershell_intro.css) | 静态通过，视觉待验收 |
| [dev/language/python/python_intro.css](../core/packages/client/app/[lang]/dev/language/python/python_intro.css) | 静态通过，视觉待验收 |
| [dev/language/ruby/ruby_intro.css](../core/packages/client/app/[lang]/dev/language/ruby/ruby_intro.css) | 静态通过，视觉待验收 |
| [dev/language/rust/rust_intro.css](../core/packages/client/app/[lang]/dev/language/rust/rust_intro.css) | 静态通过，视觉待验收 |
| [dev/language/scramble/compare.css](../core/packages/client/app/[lang]/dev/language/scramble/compare.css) | 静态通过，视觉待验收 |
| [dev/language/sql/sql_intro.css](../core/packages/client/app/[lang]/dev/language/sql/sql_intro.css) | 静态通过，视觉待验收 |
| [dev/language/swift/swift_intro.css](../core/packages/client/app/[lang]/dev/language/swift/swift_intro.css) | 静态通过，视觉待验收 |
| [dev/language/ts/ts_intro.css](../core/packages/client/app/[lang]/dev/language/ts/ts_intro.css) | 静态通过，视觉待验收 |
| [dev/language/wasm/wasm_intro.css](../core/packages/client/app/[lang]/dev/language/wasm/wasm_intro.css) | 静态通过，视觉待验收 |
| [dev/language/zig/zig_intro.css](../core/packages/client/app/[lang]/dev/language/zig/zig_intro.css) | 静态通过，视觉待验收 |
| [dev/llm/fable/fable.css](../core/packages/client/app/[lang]/dev/llm/fable/fable.css) | 静态通过，视觉待验收 |
| [dev/llm/sonnet-5/sonnet-5.css](../core/packages/client/app/[lang]/dev/llm/sonnet-5/sonnet-5.css) | 静态通过，视觉待验收 |
| [dev/ops/ops.css](../core/packages/client/app/[lang]/dev/ops/ops.css) | 静态通过，视觉待验收 |
| [dev/solvers/solvers.css](../core/packages/client/app/[lang]/dev/solvers/solvers.css) | 静态通过，视觉待验收 |
| [dev/stack/stack_landing.css](../core/packages/client/app/[lang]/dev/stack/stack_landing.css) | 静态通过，视觉待验收 |
| [dev/stack/ts_intro.css](../core/packages/client/app/[lang]/dev/stack/ts_intro.css) | 静态通过，视觉待验收 |
| [dev/tokens/tokens.css](../core/packages/client/app/[lang]/dev/tokens/tokens.css) | 静态通过，视觉待验收 |
| [dev/utils/utils_ref.css](../core/packages/client/app/[lang]/dev/utils/utils_ref.css) | 静态通过，视觉待验收 |
| [dev/wca-site/wca-site_intro.css](../core/packages/client/app/[lang]/dev/wca-site/wca-site_intro.css) | 静态通过，视觉待验收 |
| [docs/edit/editor.css](../core/packages/client/app/[lang]/docs/edit/editor.css) | 静态通过，视觉待验收 |
| [feedback/admin/feedback-admin.css](../core/packages/client/app/[lang]/feedback/admin/feedback-admin.css) | 静态通过，视觉待验收 |
| [feedback/feedback.css](../core/packages/client/app/[lang]/feedback/feedback.css) | 静态通过，视觉待验收 |
| [frame-count-about/frame_count_about.css](../core/packages/client/app/[lang]/frame-count-about/frame_count_about.css) | 静态通过，视觉待验收 |
| [math/demigod/demigod.css](../core/packages/client/app/[lang]/math/demigod/demigod.css) | 静态通过，视觉待验收 |
| [math/god/god.css](../core/packages/client/app/[lang]/math/god/god.css) | 静态通过，视觉待验收 |
| [math/god/_components/sq1/sq1.css](../core/packages/client/app/[lang]/math/god/_components/sq1/sq1.css) | 静态通过，视觉待验收 |
| [math/group/group_theory.css](../core/packages/client/app/[lang]/math/group/group_theory.css) | 静态通过，视觉待验收 |
| [math/kernel/kernel.css](../core/packages/client/app/[lang]/math/kernel/kernel.css) | 静态通过，视觉待验收 |
| [math/lsll/lsll_math.css](../core/packages/client/app/[lang]/math/lsll/lsll_math.css) | 静态通过，视觉待验收 |
| [math/probability/probability.css](../core/packages/client/app/[lang]/math/probability/probability.css) | 静态通过，视觉待验收 |
| [math/unit-distance/unit_distance.css](../core/packages/client/app/[lang]/math/unit-distance/unit_distance.css) | 静态通过，视觉待验收 |
| [memo/colpi/colpi.css](../core/packages/client/app/[lang]/memo/colpi/colpi.css) | 静态通过，视觉待验收 |
| [mosaic/mosaic.css](../core/packages/client/app/[lang]/mosaic/mosaic.css) | 静态通过，视觉待验收 |
| [mosaic-about/mosaic_about.css](../core/packages/client/app/[lang]/mosaic-about/mosaic_about.css) | 静态通过，视觉待验收 |
| [nemesizer-about/nemesizer_about.css](../core/packages/client/app/[lang]/nemesizer-about/nemesizer_about.css) | 静态通过，视觉待验收 |
| [paint/paint.css](../core/packages/client/app/[lang]/paint/paint.css) | 静态通过，视觉待验收 |
| [recon/submit/recon_submit.css](../core/packages/client/app/[lang]/recon/submit/recon_submit.css) | 静态通过，视觉待验收 |
| [recon/[id]/recon_detail.css](../core/packages/client/app/[lang]/recon/[id]/recon_detail.css) | 静态通过，视觉待验收 |
| [recon-about/recon_about.css](../core/packages/client/app/[lang]/recon-about/recon_about.css) | 静态通过，视觉待验收 |
| [regulation/events/events.css](../core/packages/client/app/[lang]/regulation/events/events.css) | 静态通过，视觉待验收 |
| [regulation/one-handed/one-handed.css](../core/packages/client/app/[lang]/regulation/one-handed/one-handed.css) | 静态通过，视觉待验收 |
| [regulation/regulation.css](../core/packages/client/app/[lang]/regulation/regulation.css) | 静态通过，视觉待验收 |
| [scramble/555-about/scramble_555_about.css](../core/packages/client/app/[lang]/scramble/555-about/scramble_555_about.css) | 静态通过，视觉待验收 |
| [scramble/analyzer/analyze.css](../core/packages/client/app/[lang]/scramble/analyzer/analyze.css) | 静态通过，视觉待验收 |
| [scramble/gen/gen.css](../core/packages/client/app/[lang]/scramble/gen/gen.css) | 静态通过，视觉待验收 |
| [scramble/gen-about/gen_about.css](../core/packages/client/app/[lang]/scramble/gen-about/gen_about.css) | 静态通过，视觉待验收 |
| [scramble/pattern/patterns.css](../core/packages/client/app/[lang]/scramble/pattern/patterns.css) | 静态通过，视觉待验收 |
| [scramble/solver/sq1_solver.css](../core/packages/client/app/[lang]/scramble/solver/sq1_solver.css) | 静态通过，视觉待验收 |
| [scramble/stats/scramble_stats.css](../core/packages/client/app/[lang]/scramble/stats/scramble_stats.css) | 静态通过，视觉待验收 |
| [sheets/edit/spreadsheet.css](../core/packages/client/app/[lang]/sheets/edit/spreadsheet.css) | 静态通过，视觉待验收 |
| [sim/player-controls.css](../core/packages/client/app/[lang]/sim/player-controls.css) | 静态通过，视觉待验收 |
| [sim/setting-drawer.css](../core/packages/client/app/[lang]/sim/setting-drawer.css) | 静态通过，视觉待验收 |
| [site/sites.css](../core/packages/client/app/[lang]/site/sites.css) | 静态通过，视觉待验收 |
| [teachers/scripts/scripts.css](../core/packages/client/app/[lang]/teachers/scripts/scripts.css) | 静态通过，视觉待验收 |
| [timer/timer.css](../core/packages/client/app/[lang]/timer/timer.css) | 静态通过，视觉待验收 |
| [timer/_battle/battle.css](../core/packages/client/app/[lang]/timer/_battle/battle.css) | 静态通过，视觉待验收 |
| [timer/_shell/net.css](../core/packages/client/app/[lang]/timer/_shell/net.css) | 静态通过，视觉待验收 |
| [timer/_shell/shell.css](../core/packages/client/app/[lang]/timer/_shell/shell.css) | 静态通过，视觉待验收 |
| [tutorial/lbl/lbl.css](../core/packages/client/app/[lang]/tutorial/lbl/lbl.css) | 静态通过，视觉待验收 |
| [tutorial-legacy/tutorial.css](../core/packages/client/app/[lang]/tutorial-legacy/tutorial.css) | 静态通过，视觉待验收 |
| [wca/about/[id]/wca_about.css](../core/packages/client/app/[lang]/wca/about/[id]/wca_about.css) | 静态通过，视觉待验收 |
| [wca/comp/calendar_page.css](../core/packages/client/app/[lang]/wca/comp/calendar_page.css) | 静态通过，视觉待验收 |
| [wca/comp/comp.css](../core/packages/client/app/[lang]/wca/comp/comp.css) | 静态通过，视觉待验收 |
| [wca/comp/stats/calendar_stats.css](../core/packages/client/app/[lang]/wca/comp/stats/calendar_stats.css) | 静态通过，视觉待验收 |
| [wca/comp-about/comp_about.css](../core/packages/client/app/[lang]/wca/comp-about/comp_about.css) | 静态通过，视觉待验收 |
| [wca/globe-about/globe_about.css](../core/packages/client/app/[lang]/wca/globe-about/globe_about.css) | 静态通过，视觉待验收 |
| [wca/prediction/_components/lucky.css](../core/packages/client/app/[lang]/wca/prediction/_components/lucky.css) | 静态通过，视觉待验收 |
| [wca/prediction/_components/prediction.css](../core/packages/client/app/[lang]/wca/prediction/_components/prediction.css) | 静态通过，视觉待验收 |
| [wca/prediction/_components/prediction333.css](../core/packages/client/app/[lang]/wca/prediction/_components/prediction333.css) | 静态通过，视觉待验收 |
| [wca/prediction-about/prediction_about.css](../core/packages/client/app/[lang]/wca/prediction-about/prediction_about.css) | 静态通过，视觉待验收 |
| [wca/_globe/globe.css](../core/packages/client/app/[lang]/wca/_globe/globe.css) | 静态通过，视觉待验收 |
| [wca/_wca_stats.css](../core/packages/client/app/[lang]/wca/_wca_stats.css) | 静态通过，视觉待验收 |
| [wca/_wca_stats_extra.css](../core/packages/client/app/[lang]/wca/_wca_stats_extra.css) | 静态通过，视觉待验收 |
| [why-cube/why_cube.css](../core/packages/client/app/[lang]/why-cube/why_cube.css) | 静态通过，视觉待验收 |
| [wiki/wiki.css](../core/packages/client/app/[lang]/wiki/wiki.css) | 静态通过，视觉待验收 |
