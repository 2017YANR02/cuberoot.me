# Recon 页面 TODO

## 待完成

### 优先级高

- [ ] **搜索 placeholder 更新**：国旗功能已加入，但搜索说明文字未同步更新（支持搜索国家名）
- [ ] **添加/编辑复盘独立页面**：将当前弹窗（`recon_submit.js`）迁移为独立页面 `/recon/submit/`
  - 优势：更大编辑空间、手机端友好、可收藏 URL、编辑模式通过 `sessionStorage` 传递数据
  - 涉及文件：新建 `recon/submit/index.md` + `recon_submit_page.js`，修改 `recon.js` 跳转逻辑
  - 详细 AI 提示词见 `recon/PROMPT_submit_page.md`

### 优先级中

- [ ] **数据自动化**：当前需要手动从 Google Sheets 导出 CSV 再运行 Python 脚本。可考虑通过 Google Sheets API 自动拉取
- [ ] **无复盘数据展示**：大量 `recon?=NO` 的行（只有成绩没有复盘）目前未展示。可考虑显示为"暂无复盘"
- [ ] **手法分析字段**：废步(redundant)、换手(regrip)、卡顿(lockup)、基态(free pair) 等字段信息量大，可考虑在详情展开中显示

### 优先级低（Phase 2）

- [ ] **独立详情页**：点击 solve 跳转到独立页面，带 URL 可分享
- [ ] **统计图表**：选手成绩趋势、TPS 分布等可视化
- [ ] **3D 可视化**：Cube 状态可视化（需要解析打乱和步骤）

## 关键文件

| 文件 | 说明 |
|------|------|
| `recon/index.md` | Jekyll 页面入口 |
| `recon/recon.js` | 前端逻辑（渲染、筛选、排序、展开） |
| `recon/recon.css` | 页面样式 |
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
