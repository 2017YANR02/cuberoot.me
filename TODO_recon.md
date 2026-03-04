# Recon 页面 TODO

## 待完成

### 优先级高

- [ ] **搜索 placeholder 更新**：国旗功能已加入，但搜索说明文字未同步更新（支持搜索国家名）
- [x] **添加/编辑复盘独立页面**：已迁移为 `/recon/submit/`（`submit/index.html` + `recon_submit_page.js`）
  - 共享模块：`recon_local_store.js`（localStorage）、`recon_alg_utils.js`（公式清理）
  - `recon_submit.js` 精简为跳转逻辑（672→32行）

### 优先级中

- [ ] **数据自动化**：当前需要手动从 Google Sheets 导出 CSV 再运行 Python 脚本。可考虑通过 Google Sheets API 自动拉取
- [ ] **无复盘数据展示**：大量 `recon?=NO` 的行（只有成绩没有复盘）目前未展示。可考虑显示为"暂无复盘"
- [ ] **手法分析字段**：废步(redundant)、换手(regrip)、卡顿(lockup)、基态(free pair) 等字段信息量大，可考虑在详情展开中显示

### 优先级低（Phase 2）

- [x] **独立详情链接**：`/recon/#id` hash URL 分享，自动定位展开，详情中 link 复制按钮
- [ ] **统计图表**：选手成绩趋势、TPS 分布等可视化
- [ ] **3D 可视化**：Cube 状态可视化（需要解析打乱和步骤）

## 关键文件

| 文件 | 说明 |
|------|------|
| `recon/index.md` | Jekyll 页面入口 |
| `recon/recon.js` | 前端逻辑（渲染、筛选、排序、展开、hash 链接分享） |
| `recon/recon.css` | 页面样式（含提交页两列布局） |
| `recon/recon_submit.js` | 列表页提交入口（跳转 + localStorage 恢复 + 删除） |
| `recon/recon_local_store.js` | 共享 localStorage 模块 |
| `recon/recon_alg_utils.js` | 共享公式清理模块 |
| `recon/submit/index.html` | 独立提交页面 HTML |
| `recon/submit/recon_submit_page.js` | 提交页面逻辑 |
| `recon/recon_data.json` | 复盘数据（直接维护，需提交 git） |
| `_stats_build/generate_comp_countries.rb` | 生成国旗映射 JSON |
| `DEPLOYMENT.md` | 完整架构文档（含国旗渲染方案、数据流、Record Badge 规则） |

## 数据更新流程

```powershell
# 1. 编辑 recon/recon_data.json
# 2. 提交
git add recon/recon_data.json
git commit -m "data: update recon data"
git push
```

## 国旗更新流程

如果选手国家显示有误或缺失，重新运行 Ruby 脚本即可（需要 MySQL 运行中）：

```powershell
cd _stats_build; bundle exec ruby generate_comp_countries.rb
```

详见 `DEPLOYMENT.md` 的「国旗渲染」章节。
