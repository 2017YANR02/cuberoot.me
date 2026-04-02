# TODO: 清除 Legacy 版 Recon

> 当 React SPA 版 Recon 功能完全覆盖 Jekyll 遗留版后，执行以下清理。
> 优先级：先迁移数据依赖 → 再删文件 → 最后清理配置。

## 前置条件（必须全部满足才能开始）

- [ ] React SPA `/recon` 已实现所有 legacy 功能（列表/详情/提交/编辑/评论）
- [ ] React SPA 的数据导出/备份不再依赖 PHP API
- [ ] 线上 SPA 版已稳定运行 2 周以上无重大 bug

---

## Phase 1: 数据迁移

### backup_recon.yml CI
- [ ] 将 `backup_recon.yml` 中的 API 源从 PHP (`toolkit.cuberoot.me/recon/api/?action=list`) 改为 Hono (`www.cuberoot.me/api/recon/list`)
- [ ] 将备份输出路径从 `recon/backup/` 改为 `legacy/recon/backup/`（或新路径 `data/recon_backup.json`）
- [ ] `build_wca_attempts.py` 迁移到 `scripts/` 或 `core/` 中

### update_upcoming.yml CI
- [ ] `git add recon/comp_names_zh.json` → 确认是否还需要这个路径
- [ ] 如已迁移到 React 内部加载，移除该 git add

### comp_names_zh.json
- [ ] 确认 React SPA 是否从 `comp_names_zh.json` 静态文件读取，还是从 API 读取
- [ ] 如仍需静态文件，将 `legacy/recon/comp_names_zh.json` 移到根目录或 `stats/` 下

---

## Phase 2: ECS 服务清理

### PHP 后端
- [ ] 删除 ECS 上 `legacy/recon/api/` 目录中的 PHP 文件
- [ ] 移除 Nginx 中 `location /legacy/recon/api/` 的 fastcgi 配置块
- [ ] 移除 `deploy_mirror.yml` 中的 rsync exclude（`--exclude='legacy/recon/api/data/'` 和 `--exclude='legacy/recon/api/db_config.php'`）

### CORS
- [ ] 移除 Hono CORS 中的 `http://localhost:4000`（不再需要 Jekyll 开发 Recon）

---

## Phase 3: 文件删除

### legacy/recon/ 目录（~3MB JS/CSS/JSON）
- [ ] `recon.js` / `recon.css` / `recon_*.js` — 列表页逻辑和样式
- [ ] `detail/` — 详情页（index.md + recon_detail.js）
- [ ] `submit/` — 提交页（index.html + recon_submit_page.js）
- [ ] `api/` — PHP 后端（index.php + db.php + db_config.php）
- [ ] `scripts/` / `temp/` — 临时脚本
- [ ] `index.md` — Jekyll 入口
- [ ] `recon_latest.json` / `recon_aux_data.json` — 静态数据快照
- [ ] `CubeAlgWB - Recon.csv` — 原始 CSV 数据

### 其他遗留文件
- [ ] `wca_auth.js` / `callback.html` — 旧版 WCA OAuth，确认 React 版是否完全替代
- [ ] `shared/wca_search.js` / `wca_person_picker.js` / `wca_comp_data.js` — 如 viz/calc 不再使用
- [ ] `404.html` 中的 `/recon/数字` 重定向逻辑 — 如 React SPA 的 client-side routing 已处理

---

## Phase 4: 配置清理

### Jekyll
- [ ] `_config.yml` 中移除 `legacy/recon` 的 defaults layout 配置
- [ ] `_layouts/default.html` 中检查是否有 recon 专用的 JS/CSS 引入

### 文档
- [ ] `CUBEROOT_ME.md` — 移除 PHP 后端小节，更新 Nginx 配置示例
- [ ] `docs/architecture.md` — 更新目录树，移除 legacy/recon
- [ ] `docs/recon-api.md` — 移除 PHP legacy 基址引用
- [ ] `docs/development.md` — 移除 PHP 后端相关说明
- [ ] `DEPLOYMENT.md` — 移除 PHP 后端表格行

### Git
- [ ] 确认 `.gitignore` 中是否有 recon 专用排除规则可以清理

---

## Phase 5: 验证

- [ ] `www.cuberoot.me/recon` — React SPA 正常工作
- [ ] `ruiminyan.github.io/recon` — GitHub Pages SPA 正常工作
- [ ] 备份 CI 从 Hono API 拉取成功
- [ ] `legacy/` 目录下 solver/trainer/cstimer 等非 recon 工具不受影响
- [ ] `git gc --prune=now` 清理删除产生的松散对象

---

## 不要删除的内容

> ⚠️ 以下内容虽然在 legacy/ 下，但仍在使用，不要误删：

- `legacy/recon/backup/recons_backup.json` — 仍由 CI 每日写入（迁移 CI 前不要删）
- `legacy/recon/data/wca_attempts.json` — 同上
- `legacy/recon/comp_names_zh.json` — 可能被 React SPA 引用
- `legacy/` 下除 recon 以外的所有目录（solver、各种 trainer、alg_trainers、cstimer、battle 等）
