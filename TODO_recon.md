# Recon 页面 TODO

## 已完成（Phase 1 MVP）

- [x] 数据管线：`convert_recon_csv.py` 读取 CSV → 过滤模板行 → 输出 JSON
- [x] 前端骨架：`recon/index.md` + `recon.js` + `recon.css`
- [x] 表格列：成绩、选手、方法、比赛、轮次、日期、STM、TPS、OLL、PLL
- [x] 点击行展开完整复盘文本 + 打乱（最少步打乱 + WCA 打乱）
- [x] 筛选器：选手（按频率排序）、方法、项目
- [x] 搜索：选手名、比赛名、成绩、纪录标记（精确匹配 WR/NR/PR 等）
- [x] 表头排序（列点击切换升降序）
- [x] 分页加载（每次 50 条 + "加载更多"）
- [x] R Avg / R Single 列 + Record Badge 彩色标签
- [x] 国旗：选手和比赛国旗内联显示（数据来自 WCA 数据库，见 DEPLOYMENT.md）
- [x] i18n 中英文切换
- [x] 深色主题 + 响应式布局
- [x] 首页入口卡片：在 `index.html` 新增第三个入口卡片（🔍 Recon），与 Solver 和 WCA Stats 并列
- [x] 手机端适配：手机端显示所有列，与电脑端保持一致
- [x] 表头列顺序重排：按图2设计稿调整（Expand → Official? → Event → Method → Date → Comp → Rnd → AoXR → Avg → PR Avg → Single → PR Single → Solver → Recon Preview）
- [x] 详情展开布局：复盘在左、打乱/元数据在右（手机端复盘优先显示）
- [x] 比赛日期从 WCA 数据库获取：`comp_dates.json` 映射比赛名 → 日期，非 WCA 比赛 fallback 到 CSV 原始日期
- [x] 全站背景色调整：非求解器页面改为深灰 `#161616`，移除粒子动画（主页除外）

## 待完成

### 优先级高

- [ ] **搜索 placeholder 更新**：国旗功能已加入，但搜索说明文字未同步更新（支持搜索国家名）

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
| `scripts/convert_recon_csv.py` | CSV → JSON 转换脚本 |
| `recon/index.md` | Jekyll 页面入口 |
| `recon/recon.js` | 前端逻辑（渲染、筛选、排序、展开） |
| `recon/recon.css` | 页面样式 |
| `recon/recon_data.json` | 构建产物（需提交 git） |
| `_stats_build/generate_comp_countries.rb` | 生成国旗映射 JSON |
| `DEPLOYMENT.md` | 完整架构文档（含国旗渲染方案、数据流、Record Badge 规则） |

## 数据更新流程

```powershell
# 1. 从 Google Sheets 导出 CSV 到项目根目录（CubeAlgWB - Recon.csv）
# 2. 运行转换脚本
python scripts/convert_recon_csv.py
# 3. 提交
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
