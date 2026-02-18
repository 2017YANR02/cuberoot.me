# 部署指南

## 当前状态

✅ **WCA 统计自动更新已上线**

- **地址**：[ruiminyan.github.io/stats/](https://ruiminyan.github.io/stats/)
- **更新时间**：每周一凌晨 3:00（北京时间）= 周日 19:00 UTC
- **CI 配置**：`.github/workflows/stats.yml`

## 工作流程

```
定时触发（cron）
  ↓
GitHub Actions（ubuntu-latest, 2 核, 7GB 内存）
  ↓
1. 下载 WCA 数据库（约 2GB）
2. 导入 MySQL（约 9 分钟）
3. 计算 60+ 项统计（约 37 分钟）
4. 生成 Markdown 文件
5. 提交并推送到 main 分支
  ↓
GitHub Pages（Jekyll）
  ↓
上线：ruiminyan.github.io/stats/
```

## CI 策略

| 触发条件 | 执行内容 | 耗时 |
|----------|----------|------|
| **推送到 `main`**（代码变更） | 仅语法检查 | 约 30 秒 |
| **定时任务**（每周） | 完整数据库下载 + 计算 | 约 47 分钟 |
| **手动触发**（`workflow_dispatch`） | 完整构建 | 约 47 分钟 |

此分离策略避免每次代码变更都浪费 47 分钟。

## 重要文件

```
ruiminyan.github.io/
├── .github/workflows/
│   └── stats.yml              # CI 配置
├── _stats_build/              # 构建脚本（不部署）
│   ├── bin/                   # Ruby 脚本
│   ├── core/                  # 核心逻辑
│   ├── statistics/            # 60+ 统计定义
│   ├── Gemfile                # Ruby 依赖
│   └── LICENSE                # GPL 许可证（原项目）
├── stats/                     # 生成的输出（部署到线上）
│   ├── README.md              # 索引页
│   └── *.md                   # 各项统计页面
└── _config.yml                # Jekyll 配置
```

## 经验教训

### 1. Windows → Linux 权限问题
**问题**：从 Windows 复制的脚本在 Linux 上丢失可执行权限。
**解决**：在 workflow 中用 `ruby script.rb` 而非 `./script.rb`。

### 2. GitHub Actions 默认权限
**问题**：`GITHUB_TOKEN` 默认只读（2023 年后的新仓库）。
**解决**：在 workflow 中显式声明 `permissions: contents: write`。

### 3. 长时间 CI 优化
**问题**：每次推送代码都触发 47 分钟的完整构建。
**解决**：拆分为语法检查（push 触发）和完整构建（定时触发）。

## 手动触发

如需立即更新统计：

1. 前往 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions)
2. 选择 "Update Stats" workflow
3. 点击 "Run workflow" → "Run workflow"

## 添加新统计

1. 创建 `_stats_build/statistics/my_new_stat.rb`：
   ```ruby
   require_relative "../core/statistic"

   class MyNewStat < Statistic
     def initialize
       @title = "My New Statistic"
       @table_header = { "Rank" => :right, "Name" => :left }
     end

     def query
       <<-SQL
         SELECT ... FROM results ...
       SQL
     end
   end
   ```

2. 推送到 `main` → 语法检查运行（约 30 秒）
3. 等待下周一凌晨 3 点，或手动触发 workflow
4. 新页面出现在 `ruiminyan.github.io/stats/my_new_stat.html`

## 常见问题排查

### 统计未更新？
- 检查 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions) 是否有错误
- 确认 `stats.yml` 中设置了 `permissions: contents: write`
- 确保提交信息包含 `[skip ci]` 以避免递归触发

### 语法检查失败？
- 本地运行 `ruby -c _stats_build/statistics/*.rb`
- 检查 Ruby 2.7 兼容性

### 内存不足？
- GitHub Actions 内存上限 7GB
- 当前用量在限制范围内（MySQL + 表约 2GB）

## 致谢

- **原始 WCA 统计项目**：[jonatanklosko/wca_statistics](https://github.com/jonatanklosko/wca_statistics)
- **解算器与训练器**：[or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo)

---

## 待完成：WCADB 统计迁移

WCADB.xlsx 包含 27 个 sheet 的 WCA 世界纪录统计数据，目标是迁移到 `_stats_build` 框架实现自动化更新。

### 待开发：`wr_single_history.rb`（首个统计脚本）

- 继承 `GroupedStatistic`
- SQL：查 `results` 表中 `regional_single_record = 'WR'` 的记录
- transform：按 event_id 分组 → 组内按日期排序 → 计算 gain 和 duration → 倒序输出
- 表头：`| Result | Gain | Days | Person | Competition | Date | Details |`

### 验证步骤

1. `ruby -c _stats_build/statistics/wr_single_history.rb` 语法检查
2. 推送到 main → CI 语法检查通过
3. 手动触发完整构建（约 47 分钟）
4. 访问 `https://ruiminyan.github.io/stats/wr_single_history.html` 查看结果
5. 与 WCADB.xlsx "Best" sheet 数据抽查对比

### 批量迁移计划（约 15-18 个脚本）

**第一批**（与 Best 结构相同，改 SQL 条件即可）：
- Avg（WR average 历史）、Current（当前 WR 总览）

**第二批**（需更复杂的 transform）：
- BPA、WPA、BAo5、WAo5、Median、Mo5
- Best Counting、Worst Counting、Worst

**第三批**（特殊分析类）：
- Non-PR WR、NWR、1stWR、Dominance
- Variance、Best Average Ratio

### 本地 MySQL 环境

| 配置 | 值 |
|------|-----|
| MySQL 版本 | 8.0.37 |
| 服务名 | MySQL80 |
| 数据目录 | `E:\mysql_data\` |
| 临时目录 | `E:/mysql_tmp` |
| 数据库 | `wca_statistics`（121 张表）、`wca_export`（15 张表） |
| 导入命令 | `mysql -u root -p --default-character-set=utf8mb4 wca_statistics -e "source D:/path/to/dump.sql"` |
