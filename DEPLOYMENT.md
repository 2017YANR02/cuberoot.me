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
├── index.html                 # 落地页（Solver / WCA Stats 入口）
├── solver/                    # 3x3x3 Solver（主解算器页面）
├── src/i18n/                  # 多语言支持（i18n 引擎 + 字典）
│   ├── i18n.js                # 语言切换引擎 + MutationObserver
│   ├── en.json                # 英文字典
│   └── zh.json                # 中文字典
├── _layouts/
│   └── default.html           # Stats 页面深色主题布局
├── .github/workflows/
│   └── stats.yml              # CI 配置
├── _stats_build/              # 构建脚本（不部署）
│   ├── bin/                   # Ruby 脚本
│   ├── core/                  # 核心逻辑
│   │   ├── tab_ui.rb          # Tab 双视图 mixin
│   │   └── ...                # 数据库、事件定义等
│   ├── statistics/            # 60+ 统计定义
│   │   └── abstract/          # 抽象基类（wr_round_history, ao_rounds 等）
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

## WCADB 统计迁移（进行中）

WCADB.xlsx 包含 27 个 sheet 的 WCA 世界纪录统计数据，目标是迁移到 `_stats_build` 框架实现自动化更新。

### 架构设计

- **Tab 双视图**：19 个统计支持「当前排名」和「WR 历史」双 Tab 切换
  - `core/tab_ui.rb`：通用 Tab UI mixin（样式、按钮、脚本、HTML 辅助方法）
- 抽象基类 `statistics/abstract/wr_round_history.rb`：封装 WR 轮次衍生指标的通用模式
  - SQL 统一查询 `regional_average_record = 'WR'` 的 value1-5 数据
  - 子类只需实现 `compute_metric(values, r)` 即可
  - 自动处理 WR 历史构建 + 当前排名（类级别缓存全量 results）
- 抽象基类 `statistics/abstract/ao_rounds.rb`：跨轮次 AoXR 的通用模式
  - 子类只需指定 `round_count` 即可

### 已完成脚本

| 脚本 | 说明 | Tab 双视图 |
|------|------|:-----------:|
| `wr_single_history.rb` | WR 单次历史 | ✅ |
| `wr_average_history.rb` | WR 平均历史 | ✅ |
| `wr_current.rb` | 当前 WR 总览 | — |
| `wr_bpa.rb` | BPA (前4次最佳3次均值) | ✅ |
| `wr_wpa.rb` | WPA (前4次最差3次均值) | ✅ |
| `wr_bao5.rb` | BAo5 (5次中最佳3次均值) | ✅ |
| `wr_wao5.rb` | WAo5 (5次中最差3次均值) | ✅ |
| `wr_mo5.rb` | Mo5 (5次全部均值) | ✅ |
| `wr_median.rb` | 中位数 | ✅ |
| `wr_best_counting.rb` | Ao5计入的最佳成绩 | ✅ |
| `wr_worst_counting.rb` | Ao5计入的最差成绩 | ✅ |
| `wr_worst.rb` | 整轮最差成绩 | ✅ |
| `wr_variance.rb` | 5次方差 | ✅ |
| `wr_best_average_ratio.rb` | best/average 比值 | ✅ |
| `wr_newcomer.rb` | NWR 首场比赛最佳成绩 | — |
| `wr_first_comp_wr.rb` | 首场就破 WR 的选手 | — |
| `wr_ao1r~4r.rb` | AoXR (跨轮次均值) ×4 | ✅ |
| `consecutive_sub_5_average.rb` | 连续 sub-5 average | ✅ |

### 待完成

- [x] SQL 验证（通过本地 MySQL 测试关键查询）
- [x] Git commit + push 全部新脚本
- [ ] CI 语法检查通过
- [ ] 手动触发完整构建
- [ ] 对比输出与 WCADB.xlsx 数据

### 验证步骤

1. 推送到 main → CI 语法检查通过
2. 手动触发完整构建（约 47 分钟）
3. 访问 `https://ruiminyan.github.io/stats/wr_XXX.html` 查看各统计页面
4. 与 WCADB.xlsx 对应 sheet 数据抽查对比

### 本地环境

#### MySQL

| 配置 | 值 |
|------|-----|
| MySQL 版本 | 8.0.37 |
| 服务名 | MySQL80 |
| 数据目录 | `E:\mysql_data\` |
| 临时目录 | `E:/mysql_tmp` |
| 数据库 | `wca_statistics`（121 张表）、`wca_export`（15 张表） |
| 导入命令 | `mysql -u root -p --default-character-set=utf8mb4 wca_statistics -e "source D:/path/to/dump.sql"` |

#### Ruby（本地验证用）

| 配置 | 值 |
|------|-----|
| Ruby 版本 | 3.4.8 (`x64-mingw-ucrt`) |
| 安装路径 | `C:\Ruby34-x64` |
| DevKit/MSYS2 | 内置，已全量升级 |
| mysql2 gem | 0.5.7（依赖 `libmariadbclient`，通过 MSYS2 pacman 安装） |
| bigdecimal gem | 4.0.1（Ruby 3.4 不再内置，需手动添加） |

> **注意**：MSYS2 默认镜像在国内可能超时，已在 `mirrorlist.ucrt64` 和 `mirrorlist.msys` 顶部添加清华镜像。

**安装步骤**（首次）：

```powershell
# 1. 安装 Ruby 3.4 with DevKit
winget install RubyInstallerTeam.RubyWithDevKit.3.4

# 2. 刷新 PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 3. 初始化 MSYS2 密钥环 + 全量升级
ridk exec bash -c "pacman-key --init && pacman-key --populate msys2 && pacman -Syu --noconfirm"
# NOTE: 核心升级后终端会关闭，再运行一次完成剩余升级
ridk exec bash -c "pacman -Syu --noconfirm"

# 4. 安装 mysql2 gem（自动拉取 libmariadbclient）
gem install mysql2 bigdecimal --no-document

# 5. 创建数据库配置（已在 .gitignore 中排除）
# _stats_build/database.yml:
#   database: "wca_statistics"
#   username: "root"
#   password: "<你的密码>"
#   host: "127.0.0.1"
```

**本地测试统计脚本**：

```powershell
cd _stats_build
ruby test_stat.rb <statistic_name>  # 例: ruby test_stat.rb wr_bpa
```

`test_stat.rb` 会运行指定统计并输出前 50 行 Markdown。不带参数可查看所有可用统计名。
