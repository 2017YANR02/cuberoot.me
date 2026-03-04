# 任务：将复盘提交弹窗迁移为独立页面

## 背景

当前 Recon 页面 (`/recon/`) 的"添加复盘"和"编辑复盘"功能通过 JS 弹窗（Modal）实现，代码在 `recon/recon_submit.js` 中。弹窗空间有限、手机端体验差、无法通过 URL 分享。需要将其迁移为独立页面 `/recon/submit/`。

## 当前架构

### 关键文件

| 文件 | 职责 |
|---|---|
| `recon/recon_submit.js` | 弹窗创建、表单构建、比赛搜索下拉、预览动画、提交/编辑处理 |
| `recon/recon.js` | 主表格渲染，点击"➕"打开弹窗，点击"✏️ 编辑"触发 `recon-edit-request` 事件 |
| `recon/firebase_store.js` | Firestore CRUD API（`addRecon`, `updateRecon`, `saveEdit`, `saveEditHistory` 等） |
| `recon/wca_auth.js` | WCA OAuth2 登录、`isAdmin()` 判断 |
| `recon/recon_stats.js` | 复盘文本统计计算（STM、TPS 等） |
| `recon/recon.css` | 所有样式（包括弹窗样式） |

### 当前数据流

**新增模式：**
1. 用户点击"➕"按钮 → `recon_submit.js` 的 `openModal(null)` 生成弹窗
2. 用户填写表单 → 点击"提交" → `handleSubmit()` 收集数据
3. 调用 `ReconStats.computeAllStats()` 计算统计
4. 调用 `ReconStore.addRecon()` 写入 Firestore + 存 localStorage
5. 关闭弹窗，刷新表格

**编辑模式：**
1. 管理员点击"✏️ 编辑" → `recon.js` 触发 `recon-edit-request` 事件，携带完整 solve 对象
2. `recon_submit.js` 监听事件 → `openModal(editSolve)` 生成弹窗并预填充
3. 提交时做差异对比 → 只保存变更字段
4. 社区复盘用 `updateRecon(_firestoreId, ...)`, 静态 JSON 用 `saveEdit(id, ...)`
5. 触发 `recon-edit-done` 事件通知 `recon.js` 刷新

### `openModal()` 中的关键逻辑

- **比赛搜索下拉**：从 `comp_dates.json` 加载比赛列表，支持模糊搜索、国旗显示、自动填充日期
- **预览动画**：将打乱 + 复盘步骤构建 alg.cubing.net URL 加载到 iframe
- **编辑专用字段**：`EDIT_ONLY_FIELDS` 数组定义了编辑模式额外显示的字段（选手中文名、显示成绩、日期、AoXR 等）
- **打乱提取**：编辑模式从 recon 文本第二行提取打乱（第一行是统计行如 `44STM /3.73=11.80TPS`）
- **实时统计**：输入 recon 文本时实时计算并显示 STM/TPS

## 目标

创建独立页面 `/recon/submit/`，替代当前弹窗：

1. **新建 `recon/submit/index.md`** — Jekyll 页面，包含完整表单 HTML（不再用 JS 动态创建 DOM）
2. **新建 `recon/submit/recon_submit_page.js`** — 页面逻辑（从 `recon_submit.js` 迁移核心逻辑）
3. **修改 `recon_submit.js`** — 移除弹窗创建逻辑，改为页面跳转
4. **修改 `recon.js`** — 编辑按钮改为跳转

## 详细要求

### 1. 页面布局 (`recon/submit/index.md`)

- 使用站点现有 Jekyll layout（`default`），保持深色主题一致
- 表单直接写在 HTML 中（不用 JS 动态生成），附带 `id` 属性
- 宽屏（>768px）时采用**两列布局**：左列表单字段 + 右列预览动画
- 手机端（≤768px）自动切换为单列
- 页面标题根据模式动态切换：新增 → "➕ 添加复盘"，编辑 → "✏️ 编辑复盘"
- 底部固定"返回列表"链接

### 2. 数据传递（编辑模式）

- `recon.js` 编辑按钮改为：
  ```javascript
  sessionStorage.setItem('recon_edit_solve', JSON.stringify(solve));
  location.href = '/recon/submit/';
  ```
- 新页面 JS 在 `DOMContentLoaded` 时检查 `sessionStorage.getItem('recon_edit_solve')`
- 如果有数据 → 进入编辑模式，预填充所有字段，显示编辑专用字段
- 读取后立即 `sessionStorage.removeItem('recon_edit_solve')` 防止刷新重复

### 3. 逻辑迁移 (`recon_submit_page.js`)

从 `recon_submit.js` 迁移以下逻辑（不要复制粘贴，重写以适配页面模式）：

- [x] 比赛搜索下拉（`comp_dates.json` 加载、模糊搜索、国旗、日期自动填充）
- [x] 预览动画（alg.cubing.net iframe，打乱行检测与排除）
- [x] 实时统计显示（STM / TPS 计算）
- [x] 编辑模式字段预填充（含 `EDIT_ONLY_FIELDS`）
- [x] 打乱提取（从 recon 文本第二行）
- [x] 提交处理：新增模式 → `ReconStore.addRecon()` + localStorage，编辑模式 → 差异保存
- [x] 提交成功后跳转回 `/recon/`

### 4. 修改现有文件

**`recon_submit.js`：**
- 保留 `restoreLocalSolves()` 函数（页面加载时恢复本地复盘）
- 保留 `recon-local-delete` 事件监听（删除逻辑）
- 移除 `openModal()`、`closeModal()`、`handleSubmit()` 等弹窗相关代码
- "➕" 按钮改为跳转 `/recon/submit/`

**`recon.js`：**
- "✏️ 编辑" 按钮改为存 sessionStorage + 跳转
- 移除 `recon-edit-request` 事件分发（不再需要）
- 保留 `recon-edit-done` 事件监听（编辑后从新页面跳回时需要刷新）

### 5. 样式

- 表单样式复用 `recon.css` 中已有的 `.recon-form-*` 类
- 新增的页面布局样式写在 `recon.css` 末尾或独立 CSS 文件

## 注意事项

1. **需要引入的 JS 依赖**：新页面的 `<script>` 标签需要引入 `firebase_store.js`、`wca_auth.js`、`recon_stats.js`
2. **编辑模式的 `_firestoreId`**：社区复盘的原始 Firestore 文档 ID 存在 `_firestoreId` 字段中，editSolve 通过 sessionStorage 传递时会包含这个字段
3. **编辑模式的 `_community`**：判断数据来源的标志，决定用 `updateRecon` 还是 `saveEdit`
4. **i18n**：所有文本需要支持中英文（通过 `localStorage.getItem('i18n_locale')` 判断）
5. **Firestore 安全规则**：已设置为全部开放（`allow read, write: if true`）
6. **不要修改** `firebase_store.js`、`wca_auth.js`、`recon_stats.js` — 这些是稳定的 API 层

## 验证方式

1. 点击"➕"按钮 → 跳转到 `/recon/submit/`，正常提交新复盘 → 跳回列表页看到新行
2. 管理员点击"✏️ 编辑" → 跳转到 `/recon/submit/` 并预填充 → 修改字段 → 保存 → 跳回列表页看到更新
3. 手机端表单可正常使用
4. 预览动画正常加载（打乱在 SCRAMBLE 栏，步骤在 SOLVE 栏）

## 站点技术栈

- Jekyll + GitHub Pages（静态站点）
- Firebase Firestore（数据存储）
- 原生 JavaScript（无框架，IIFE 模式）
- CSS 深色主题（背景 #161616）
