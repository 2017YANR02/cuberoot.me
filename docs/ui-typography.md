# Web UI typography

普通正文、按钮、菜单和表单使用 `var(--font-sans)`，继承全站字体，不在页面重定义该变量或另写系统字体栈。定义由 `core/packages/timer-ui/src/typography.css` 统一维护，Web 通过 `app/fonts.css` 引入：拉丁文字 SF Pro Text，中文 SF Pro SC；加载失败时使用系统回退。

代码、公式、计时数字和有明确用途的衬线标题保留对应字体。字体展示、画布文字、打印卡片属于内容或输出样式，不按普通 UI 强制替换。

## 页面与共享控件覆盖

以下为中文路径，英文路径去掉 `/zh`；动态参数表示实际记录。

| 页面路径 | 统一范围 |
| --- | --- |
| /zh/wca/prediction 及其子页面 | 预测页面共享根样式 |
| /zh/alg | 公式库共享根样式 |
| /zh/calc | 页面、数字键盘与滚轮选择器 |
| /zh/cube-history | 页面根样式 |
| /zh/memo/colpi | 页面根样式 |
| /zh/site | 局部控件 |
| /zh/timer | 加载界面 |
| /zh/wca/persons/[wcaId]、/zh/wca/persons/[wcaId]/students | 移除选手页面局部字体变量覆盖 |
| /zh/wca/results | Top10 历史组件 |
| /zh/recon/submit 及其他复盘输入入口 | ReconAutofill 补全面板 |
| /zh/dev/continuous-corners | 页面根样式 |
| /zh/dev/language/html | HTML 实时示例 |
| /zh/ffmpeg-poc | 页面根样式 |
| /zh/dev/components | 复用组件的展示 |

全站启动状态、所有 WheelPicker 使用处，以及平台课程媒体的 LessonVideoPlayer 和快捷键面板，也统一使用同一变量。此表记录源码覆盖范围，不代表线上已发布或浏览器视觉验收。
