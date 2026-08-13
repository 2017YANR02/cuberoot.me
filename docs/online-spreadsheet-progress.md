# 在线协作表格进度

## 目标

在 CubeRoot 内提供一个通用的在线协作表格，覆盖 Google Sheets 的主要日常工作流：多人实时同步、公式、范围编辑、格式、多个工作表、权限共享，以及 Excel、CSV、PDF 导入导出。

## 已完成

- [x] 复用协作文档的成员权限、Hocuspocus WebSocket 与 Yjs 持久化通道
- [x] 为协作资源增加 `document` / `spreadsheet` 类型和数据库迁移
- [x] 增加表格列表页、编辑页路由与双语页面 metadata
- [x] 首页“文档 / 表格”入口对所有访客可见，资源列表仍按登录账号权限隔离
- [x] Excel / CSV 导入，Excel / CSV / PDF 导出底层
- [x] A1 地址、范围、剪贴板和公式值等纯函数
- [x] Yjs 单元格、样式、列宽、工作表结构
- [x] HyperFormula 公式计算
- [x] 范围选择、键盘移动、复制粘贴、删除、公式栏和单元格编辑
- [x] 撤销重做、粗体、斜体、对齐、填充色、文字色
- [x] 多工作表新增、切换、重命名、删除
- [x] 行列扩展、列宽拖动、只渲染可见行
- [x] 多人在线状态和远端选择范围
- [x] 抽出文档与表格共用的成员共享面板

## 正在进行

- [x] 完成编辑器响应式样式和窄屏触摸布局
- [x] 将原协作文档页切换到共用共享面板，移除重复实现
- [x] 补齐组件目录、API 目录、数据库目录登记
- [x] 修复 typecheck / 测试发现的问题
- [ ] 两个真实浏览器中的 WebSocket 协作与窄屏交互验收

## 验证清单

- [x] 表格模型单元测试
- [x] Excel 公式与数据类型往返测试
- [x] client typecheck
- [x] server typecheck
- [x] 页面 metadata 覆盖测试
- [x] 本地 PostgreSQL 迁移事务验证
- [x] 两个 Yjs 客户端的并发合并测试
- [ ] 两个浏览器上下文的实时 WebSocket 同步验证
- [ ] 360px / 390px / 桌面宽度布局检查
- [x] 导出的 XLSX 可重新读取
- [x] 导出的 CSV 包含公式计算结果
- [x] 导出的 PDF 渲染检查
- [x] client lint
- [x] 目录、i18n、metadata 等 CI 守卫测试

## 已知边界

- 单个协作表格最多 50 个工作表、100,000 个非空单元格。
- 单个工作表最多 10,000 行、200 列；初始为 100 行、26 列。
- CSV 与 PDF 只导出当前工作表；XLSX 导出全部工作表。
- 公式引擎采用 HyperFormula GPLv3，并使用其 `gpl-v3` 许可证配置。
- 当前版本聚焦日常编辑主流程，暂不含筛选、排序、图表、合并单元格和冻结窗格。
- Excel / CSV 导入以数据与公式为主；单元格格式会在站内协作中同步，但当前 XLSX / CSV / PDF 导出不保留全部视觉格式。
- 当前会话按项目规则未主动打开浏览器；实际 WebSocket 双窗口和窄屏触摸验收仍待进行。

## 权限机制

- 首页入口公开，未登录访客也能进入文档或表格列表页。
- 列表查询按当前账号与资源成员表关联，只返回自己拥有或别人明确共享的资源。
- 所有者可改内容、标题和成员权限；编辑者可实时修改内容；只读者只能查看和导出。
- 未登录或未被邀请的账号不能读取资源详情，实时 WebSocket 连接也会拒绝；拿到直链不会获得权限。
- 当前只有管理员可新建或导入资源；共享对象必须是站内已注册用户。

## 交接说明

实现集中在：

- `core/packages/client/app/[lang]/sheets/`
- `core/packages/client/lib/spreadsheet-model.ts`
- `core/packages/client/lib/spreadsheet-export.ts`
- `core/packages/client/components/collaboration/`
- `core/packages/server/src/routes/documents.ts`
- `core/packages/server/migrations/0123_collaborative_resource_kinds.sql`

每完成一次验证就在本文件勾选，并在发现限制或遗留问题时追加到“已知边界”。
