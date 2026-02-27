# 概览

## 当前状态

✅ **WCA 统计自动更新已上线**

- **地址**：[ruiminyan.github.io/stats/](https://ruiminyan.github.io/stats/)
- **国内镜像**：[toolkit.cuberoot.me](https://toolkit.cuberoot.me)（自动同步，CI 配置：`.github/workflows/deploy_mirror.yml`）
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
3. 并行计算 60+ 项统计（约 37 分钟，4 worker）
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
| **定时任务**（每周） | 完整数据库下载 + 计算 | 约 47 分钟 |
| **手动触发**（`workflow_dispatch`） | 完整构建 | 约 47 分钟 |

> Push 代码不再触发 CI。统计页面可本地生成后直接 push（见下方「本地发布」）。

## 手动触发 CI

如需立即全量更新所有统计：

1. 前往 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions)
2. 选择 "Update Stats" workflow
3. 点击 "Run workflow" → "Run workflow"

# 项目结构

## 重要文件

> 🔄 = 由 `sync_upstream.ps1` 从上游同步（勿手动修改，下次同步会覆盖）
> 📌 = 本地维护（不会被同步覆盖）
> ❌ = 上游有但不同步（有替代方案或不需要）

```
ruiminyan.github.io/
│
│── 🔄 上游同步（sync_upstream.ps1 管理，勿手动改）
├── solver/                    # 3x3x3 Solver（主求解器页面）
├── 2x2x2/                     # 2x2x2 求解器
├── cross_trainer/              # Cross 训练器
├── xcross_trainer/             # XCross 训练器
├── xxcross_trainer/            # XXCross 训练器
├── xcross_pairing_trainer/     # XCross Free Pair 训练器
├── eocross_trainer/            # EOCross 训练器
├── pairing_trainer/            # Free Pair 训练器
├── pseudo_xcross_trainer/      # Pseudo XCross 训练器
├── pseudo_pairing_trainer/     # Pseudo Free Pair 训练器
├── algTrainer/                 # JSON 公式训练器
├── jsonEditor/                 # JSON 编辑器
├── documentation/              # 文档页面
├── src/                        # 运行时模块（WASM、Worker、Solver 等，100% 上游）
├── icons/                     # PWA 图标
├── documents/                 # 文档资源
├── screenshots/               # 截图资源
├── url_params_compressor_simple.js  # URL 压缩工具
├── sw-register.js              # Service Worker 注册
├── sw.js                       # Service Worker 主文件
├── manifest.json               # PWA 清单
│
│── 📌 本地维护（不受同步影响）
├── index.html                 # 落地页（Solver / WCA Stats 入口卡片）
├── assets/css/                # Stats 页面统一 UI 样式
│   ├── stats_ui.css           # 所有选择器/Tab/下拉菜单 CSS（从 Ruby 迁出，集中管理）
│   └── card.css               # 落地页入口卡片样式
├── assets/js/                 # Stats 前端交互逻辑（前后端分离）
│   ├── stats_ui.js            # Metric/Tab/Source/Dropdown 交互函数 + initStatsUI() 自动生成按钮
│   ├── particles_stats.js     # Stats 页面粒子背景动画（当前使用版本）
│   ├── particles.js           # 粒子动画库
│   ├── particles_v2.0.js      # 粒子动画历史版本
│   ├── particles_v2.1.js      # 粒子动画历史版本
│   └── particles_v2.1_final.js  # 粒子动画历史版本
├── assets/images/             # 静态图片资源
│   └── ChineseTaipei.svg      # 中华台北旗帜图标（WCA 项目用）
├── i18n/                      # 多语言 + 项目选择器
│   ├── i18n.js                # 语言切换引擎：扫描 data-i18n 属性、MutationObserver 动态翻译
│   ├── event_selector.js      # WCA 项目选择器 + URL hash 状态持久化
│   ├── en.json                # 英文字典（solver/trainer 页面所有 key）
│   └── zh.json                # 中文字典（solver/trainer 页面所有 key）
├── .sync/                     # 同步脚本的配置和模板（修改这里来定制同步行为）
│   ├── page_config.json       # 页面映射表：上游 HTML → 本地子目录，含 i18n title key 和需同步的根文件/目录列表
│   └── menu_template.html     # 汉堡菜单模板：同步时替换上游菜单，加入 data-i18n 属性和本站专属链接
├── _layouts/                  # Jekyll 布局（Stats 深色主题框架，全局加载 stats_ui.js / i18n.js / event_selector.js）
├── _stats_build/              # WCA 统计构建脚本（Ruby，只生成数据面板 + data-label-* 属性，UI 由 JS 驱动）
├── stats/                     # 统计 Markdown 页面。由 CI 每周覆盖写入，也可本地生成后直接 push
│   ├── upcoming_comp/         # 近期比赛追踪页面（前端 JS 从 upcoming_comps.json 渲染）
│   └── upcoming_comps.json    # 选手比赛数据（由 scripts/fetch_upcoming_comps.py 生成）
├── scripts/                   # Python 数据脚本
│   ├── fetch_upcoming_comps.py  # 从 WCA API 抓取 432 名顶尖选手的近期比赛
│   └── convert_recon_csv.py   # 复盘 CSV → JSON 转换（含国家名→ISO2 映射）
├── recon/                     # 比赛复盘页面（数据来自 Google Sheets CSV + Firebase 社区提交）
│   ├── index.md               # 页面入口（Jekyll Markdown，引入 Firebase SDK + WCA Auth）
│   ├── recon.js               # 前端逻辑：表格渲染、筛选搜索、排序、行展开、WCA 登录 UI
│   ├── recon.css              # 页面样式（含社区行标记、WCA 登录按钮、比赛搜索下拉菜单样式）
│   ├── recon_submit.js        # 提交表单：选手/成绩/比赛/轮次/第几把，登录用户→Firestore，访客→localStorage
│   ├── recon_stats.js         # 统计计算引擎：STM/TPS/OLL/PLL/Cross 等指标分析
│   ├── wca_auth.js            # WCA OAuth 模块（Implicit Grant 流程，绕过 CORS）
│   ├── callback.html          # WCA OAuth 回调页（解析 URL hash 中的 access_token）
│   ├── firebase_store.js      # Firebase Firestore 数据层（社区复盘的 CRUD 封装）
│   └── recon_data.json        # 构建产物（由 convert_recon_csv.py 生成，需提交到 git）
├── .upcoming_cache/           # API 响应本地缓存（已在 .gitignore，24h TTL）
├── .github/workflows/         # CI 配置（stats.yml：每周定时构建 + push）
├── _config.yml                # Jekyll 配置（排除 _stats_build/、配置 permalink 等）
│
│── ❌ 上游有但不同步
│   analytics.js               # 已用内联 GA 替代（上游硬编码 or18.github.io 域名）
│   dist/                      # 开发/构建工具，非运行时依赖
│   _config.yml                # 上游的 Jekyll 配置，与本地不同
│   README.md                  # 上游的 README，与本地不同
└── LICENSE                    # 上游的许可证，与本地不同
```

# 本地环境搭建

## MySQL

| 配置 | 值 |
|------|-----|
| MySQL 版本 | 8.0.37 |
| 服务名 | MySQL80 |
| 数据目录 | `E:\mysql_data\` |
| 临时目录 | `E:/mysql_tmp` |
| 数据库 | `wca_statistics`（121 张表，数据在 `E:\mysql_data\wca_statistics\`）|
| Dump 文件 | `D:\cube\wca-developer-database\wca-developer-database-dump.sql`（从 [WCA Developer Export](https://www.worldcubeassociation.org/export/developer) 下载）|
| 导入命令 | `mysql -u root -p --default-character-set=utf8mb4 wca_statistics -e "source D:/cube/wca-developer-database/wca-developer-database-dump.sql"` |
| 连接凭据 | 见 `_stats_build/database.yml`（含密码，已在 `.gitignore` 中排除）|

**项目使用的表**：数据库共 121 张，统计脚本只用到 11 张，含完整列定义见 [`_stats_build/SCHEMA.md`](_stats_build/SCHEMA.md)。

**启用 sudo**（首次，Windows 11 24H2+）：设置 → 系统 → 开发者选项 → 启用 sudo。或通过命令：

```powershell
# 需要管理员终端执行一次
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Sudo" /v Enabled /t REG_DWORD /d 3 /f
```

**启动 MySQL**：

```powershell
# 启动
sudo net start MySQL80
```

> **关闭 MySQL**：务必用 `sudo net stop MySQL80` 或 `sudo mysqladmin shutdown` 干净关闭，**绝对不要强杀** `mysqld.exe`，否则会损坏 InnoDB。

## Firebase（Recon 社区提交）

| 配置 | 值 |
|------|------|
| 项目 | `recon-stats` |
| 区域 | `asia-southeast1` |
| 数据库 | Firestore（`recons` 集合） |
| 控制台 | [console.firebase.google.com/project/recon-stats](https://console.firebase.google.com/project/recon-stats/firestore) |
| 安全规则 | `read: true`、`create: wcaId 非空`、`delete: true`（前端按 wcaId 控制） |

> **注意**：Firebase API Key 在前端代码中是公开的（`firebase_store.js`），这是 Firebase 的正常设计。安全由 Firestore Security Rules 控制，不依赖 API Key 保密。GitHub Secret Scanning 会报警，标记为 "Used in tests" 忽略即可。

## WCA OAuth（Recon 登录）

| 配置 | 值 |
|------|------|
| 流程 | Implicit Grant（`response_type=token`，绕过 CORS） |
| Client ID | `mPeg5FiAn7l0CcyQ9CdiSEn3XlBrcA7IMw6Vd9AOsz4` |
| Scopes | `public` |
| Redirect URIs | `https://ruiminyan.github.io/recon/callback.html`<br>`http://localhost:4000/recon/callback.html` |
| 管理页面 | [worldcubeassociation.org/oauth/applications](https://www.worldcubeassociation.org/oauth/applications) |

> **为什么不用 Authorization Code 流程**：WCA 的 token endpoint 不开放 CORS，浏览器无法直接调用。Implicit Grant 将 token 直接放在 URL hash 中返回，完全绕过跨域问题。

## Ruby（本地验证用）

| 配置 | 值 |
|------|-----|
| Ruby 版本 | 3.4.8 (`x64-mingw-ucrt`) |
| 安装路径 | `C:\Ruby34-x64` |
| DevKit/MSYS2 | 内置，已全量升级 |
| mysql2 gem | 0.5.7（依赖 `libmariadbclient`，通过 MSYS2 pacman 安装） |
| bigdecimal gem | 4.0.1（Ruby 3.4 不再内置，需手动添加） |
| Gem 源 | `Gemfile` 写 `rubygems.org`（CI 兼容），本地通过 mirror 配置走国内镜像（见下方） |

> **注意**：MSYS2 默认镜像在国内可能超时，已在 `mirrorlist.ucrt64` 和 `mirrorlist.msys` 顶部添加清华镜像。

**Gem 源镜像配置**：

`Gemfile` 中 source 统一写 `https://rubygems.org`（确保 CI 在海外能正常访问）。本地通过 `bundle config` 设置镜像，让实际请求走国内源加速：

```powershell
# 首次设置（全局生效，存于 ~/.bundle/config，不会提交到 git）
bundle config set mirror.https://rubygems.org https://gems.ruby-china.com
```

> 设置后本地 `bundle install` 自动走 `gems.ruby-china.com`，CI 走 `rubygems.org`，互不影响。

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

**本地测试统计脚本**（详见 `_stats_build/TESTING.md`）：

```powershell
cd _stats_build
# 测试单个统计
$env:STATS_FILTER = "wr_bpa"
ruby bin/compute_all.rb

# 调整并行 worker 数（默认 4，本地 16GB 可增加，Linux 使用多进程，Win 使用多线程互不干扰）
$env:STATS_WORKERS = 8
ruby bin/compute_all.rb
```

> **注意**：全量查询统计（如 `wr_dominance`）在大项目（333）上可能很慢，建议先用小项目（如 `skewb`、`555bf`）验证逻辑。全量查询非常消耗内存（333可达数 GB），每次本地完整测试完毕后注意 kill 遗留的 Ruby 进程及释放。

## Jekyll 本地开发服务器

启动 Jekyll 本地预览服务器，修改文件后自动重新生成：

```powershell
# 必须要先用 bundle exec，否则可能会缺少依赖
cd D:\cube\ruiminyan.github.io
bundle exec jekyll serve
# 浏览器访问 http://127.0.0.1:4000
```

- **访问地址**：http://127.0.0.1:4000
- **自动重新生成**：已启用（保存文件后浏览器刷新即可看到变更）
- **停止服务器**：`Ctrl+C`

> 首次运行前需先 `bundle install` 安装依赖（见下方「本地环境 → Ruby」）。

### UI 快速测试 (无需数据库)

很多时候只需要调试前端渲染效果，无需花费几十分钟重跑数据库。
本项目提供专门的纯前端静态测试页，启动 Jekyll 后直接访问：

| 页面 | 布局模式 | 地址 |
|------|----------|------|
| `test_ui.md` | 测试页导航入口（链接到 a~e） | http://127.0.0.1:4000/stats/test_ui |
| `test_ui_a.md` | Mode A：简单双 tab | http://127.0.0.1:4000/stats/test_ui_a |
| `test_ui_b.md` | Mode B：metric 分段 + tab | http://127.0.0.1:4000/stats/test_ui_b |
| `test_ui_c.md` | Mode C：metric 下拉 + 全局 tab | http://127.0.0.1:4000/stats/test_ui_c |
| `test_ui_d.md` | Mode D：三级嵌套（metric + source + tab）| http://127.0.0.1:4000/stats/test_ui_d |
| `test_ui_e.md` | Mode E：metric 分段（无 tab）| http://127.0.0.1:4000/stats/test_ui_e |

> **改 JS/CSS 后只需刷新浏览器**，无需重跑 `compute_all.rb`。

### Playwright 自动化验证（前端行为测试）

需要验证具体的 DOM 交互行为时（如按钮变灰、class 是否正确添加、点击后状态是否变化），推荐使用 Playwright 编写临时 Python 脚本，在本地 Jekyll 服务器运行时执行：

```python
# 示例：验证七阶魔方下 BAo5 变灰、切回三阶后恢复
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('http://127.0.0.1:4000/stats/wr_metric', wait_until='networkidle')

    # 切换到七阶
    page.click('.event-btn[data-event="777"]')
    page.wait_for_timeout(500)

    # 检查 BAo5 下拉项是否含 disabled 类
    bao5 = page.query_selector('.metric-dropdown-item[data-id="bao5"]')
    print("BAo5 classes:", bao5.get_attribute('class'))  # 期望含 "disabled"

    browser.close()
```

**使用前提**：
```powershell
pip install playwright
playwright install chromium
```

**注意**：这类脚本是一次性临时工具，验证完即可删除，不提交到 git。

# 日常操作

## 近期比赛追踪（Upcoming Comps）

**页面**：[/stats/upcoming_comp/](https://ruiminyan.github.io/stats/upcoming_comp/)

追踪 434 名顶尖选手（WR 指标排名 + WR 历史）的近期 WCA 比赛，展示事件标签和 WR 徽章。

### 数据源

| 数据源 | 用途 | 方式 |
|--------|------|------|
| WCA API | 全球比赛 + 选手注册 | JSON API |
| cubing.com（粗饼网）| 中国内地比赛（WCA API 不覆盖）| JSON API（比赛列表）+ HTML 爬取（选手页面）|

cubing.com 集成流程：
1. `cubing.com/api/competition` → 获取 WCA 类型比赛列表
2. `cubing.com/competition/{alias}/competitors` → 爬取选手 HTML，提取 WCA ID
3. 与 top cubers 名单交叉匹配，有匹配才加入
4. comp ID = alias 去连字符（如 `Xianju-NxN-2026` → `XianjuNxN2026`），与 WCA 链接一致
5. 整体 `try/except` 降级——cubing.com 不可用时不影响 WCA 数据

### 运行脚本

```powershell
cd D:\cube\ruiminyan.github.io
python scripts/fetch_upcoming_comps.py
```

运行时会询问：
- **回车** → 使用 24h 内的缓存（秒完成）
- **输入 `y`** → 强制重新拉取全量数据（~15 分钟）
- **CI 用法** → `python scripts/fetch_upcoming_comps.py --refresh`（跳过交互直接刷新）

### 缓存机制

| 项目 | 说明 |
|------|------|
| 缓存目录 | `.upcoming_cache/`（已在 `.gitignore`） |
| TTL | 24 小时 |
| 首次运行 | ~15 分钟（434 人 × 0.5s API 延迟 + cubing.com 8 场 × 0.5s）|
| 缓存运行 | ~5 秒 |

缓存文件：
- `{WCA_ID}.json` — 每位选手的 WCA API 响应
- `_cubing_china_list.json` — cubing.com 比赛列表
- `_cubing_china_{alias}.html` — 各场 CN 比赛的选手页面 HTML

### 输出

`stats/upcoming_comps.json` — 前端契约文件，含：
- `updated_at`：生成时间
- `total_cubers_tracked`：追踪人数
- `competitions[]`：按日期排序，每场含 `top_cubers[].events[{id, wr}]`

### 数据过滤

- 只展示到**明年底**（当前年+1），排除遥远的占位赛事
- API 返回 404 的选手自动跳过（退役/无网站账号）
- 事件按 WCA 官方顺序排列，使用短名（`333`→`3`, `pyram`→`py`）
- CN 比赛的 `events` 通过 WCA API 获取（`/competitions/{id}`），已能正常显示项目图标

### 前端功能

- 按月份折叠分组（`<details>`）
- 搜索框实时过滤比赛名/选手名/WCA ID/国家
- 中英文切换（左下角🌐按鈕）
  - CN 比赛显示中文名称和城市
  - 有中文名的选手仅显示中文名
  - 搜索支持中文国家名（如“中国”“日本”）
- 一键全部收缩/展开
- WR 红底白字圆角徽章

## 本地发布统计（无需等待 CI）

本地有 MySQL 数据库，可直接生成 `.md` 文件后 push，线上立刻生效。

```powershell
cd _stats_build

# 查看所有可用统计名称 (ID)：
ruby -e "$LOADED_FEATURES << 'bundler/setup'; require_relative 'statistics/index'; puts STATISTICS.keys.sort.join(', ')"

# Step 1：测试/生成单个或多个统计（使用 STATS_FILTER，逗号分隔）
$env:STATS_FILTER="wr_bao5,average_of"
ruby bin/compute_all.rb

# Step 2：如果代码没改表结构和 SQL 查询只改了 UI 模板——用缓存跳过 MySQL（约 0.1 秒）
$env:STATS_USE_CACHE="1"; ruby bin/compute_all.rb

# 提交前可选：检查 Ruby 语法
ruby -c statistics/wr_bao5.rb

# Step 3：提交并 push，GitHub Pages 1-2 分钟内上线
git add ../stats/wr_bao5.md
git commit -m "chore: update wr_bao5"

# ⚠️ 关键步骤：由于 GitHub Actions (CI) 可能在后台推了 commit，
# 必须先拉取合并远程的新 commit 到本地最新进展的下方，然后推。
git pull --rebase origin main
git push
```

> 缓存文件存于 `.data_cache/`（已加入 `.gitignore`，不提交）。
> 周 CI 运行时不设 `STATS_USE_CACHE`，始终从 MySQL 全量刷新，数据始终最新。

### 统计计算架构（`compute_all.rb`）

62 个顶级统计 ID 分三阶段执行（详见 `_stats_build/bin/compute_all.rb`）：

| 阶段 | 模式 | 数量 | 说明 |
|------|------|------|------|
| Phase 1 | 串行 | 3 | 聚合统计，有类级缓存依赖，完成后立即释放 |
| Phase 2 | 串行 fork 隔离 | 11 | 重量级（RSS > 3GB），每个独立进程执行后回收内存 |
| Phase 3 | 4 worker 并行 | 48 | 轻量级（RSS < 2GB），可安全并行 |

**Phase 1 聚合统计**（输入子统计 ID 到 `STATS_FILTER` 无效，需输入聚合 ID）：

| 聚合 ID | 包含的子统计 |
|---------|-------------|
| `wr_metric` | `wr_single_history`, `wr_average_history`, `wr_bao5`, `wr_wao5`, `wr_mo5`, `wr_bpa`, `wr_wpa`, `wr_median`, `wr_best_counting`, `wr_worst_counting`, `wr_worst`, `wr_variance`, `wr_best_average_ratio` |
| `wr_aoxr` | `wr_ao1r`, `wr_ao2r`, `wr_ao3r`, `wr_ao4r` |
| `average_of` | `average_of_5`, `average_of_12`, `average_of_25`, `average_of_50`, `average_of_100` |

**Phase 2 重量级统计**（CI 内存调优时关注）：
`wr_newcomer`, `wr_dominance`, `best_result_off_podium`, `consecutive_sub_5_average`, `longest_streak_of_personal_records`, `longest_streak_of_podiums`, `most_competitions_before_winning`, `most_completed_solves`, `most_frequent_results`, `moving_average`, `smallest_diff_between_single_and_average`

**Phase 3 轻量级统计**：剩余 48 个，可通过命令查看完整列表（见上方 `ruby -e ...` 命令）。


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

2. 用本地发布流程生成并 push 新统计（见上方「本地发布统计」）
3. 等待 GitHub Pages 构建（约 1 分钟）
4. 新页面出现在 `ruiminyan.github.io/stats/my_new_stat`
5. **翻译维护**：在 `i18n/i18n.js` 中更新以下映射：
   - `_statsTitleZh`：添加页面标题的中文翻译
   - `_statsDescZh`：添加 Note 描述的中文翻译（如有）
   - `_headerZh`：添加新表头列名的中文翻译（如有新列名）

# 故障排除与经验

## 常见问题排查

### 统计未更新？
- 检查 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions) 是否有错误
- 确认 `stats.yml` 中设置了 `permissions: contents: write`
- 确保提交信息包含 `[skip ci]` 以避免递归触发

### 语法检查失败？
- 本地运行：`Get-ChildItem _stats_build/statistics/*.rb | ForEach-Object { ruby -c $_.FullName }`
- 检查 Ruby 3.4 兼容性（项目最低要求）

### 内存不足？
- GitHub Actions 内存上限 7GB
- 当前用量在限制范围内（MySQL + 表约 2GB）

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

## 同步上游 Solver

当上游 [or18/RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo) 有更新时，运行以下命令一键同步：

```powershell
# 1. 拉取上游最新代码
git -C D:\cube\RubiksSolverDemo pull

# 2. 运行同步脚本
cd D:\cube\ruiminyan.github.io
.\sync_upstream.ps1
```

脚本会自动：同步 `src/` 运行时模块、复制根目录依赖、转换 13 个 HTML 页面（应用背景色、汉化、菜单链接等定制化）。

**模板文件**（定制化集中管理）：
- `.sync/page_config.json`：页面映射表和 i18n key 配置
- `.sync/menu_template.html`：汉堡菜单链接模板

# 附录

## WCADB 统计迁移（已完成）

WCADB.xlsx 包含 27 个 sheet 的 WCA 世界纪录统计数据，目标是迁移到 `_stats_build` 框架实现自动化更新。

### 架构设计

- **Tab 双视图**：19 个统计支持「排名」和「历史」双 Tab 切换
  - `core/stat_panel.rb`：数据面板渲染 mixin（DB 数据 → stat-panel + table HTML，按钮由 JS 自动生成）
  - `core/metric_layout.rb`：多指标页面布局 mixin（flex 包装容器 + 下拉菜单 HTML，仅聚合页面用）
  - `assets/css/stats_ui.css`：所有 UI 样式集中管理
  - `assets/js/stats_ui.js`：`initStatsUI()` 扫描 data-label-* 自动生成按钮
- 抽象基类 `statistics/abstract/wr_round_history.rb`：封装 WR 轮次衍生指标的通用模式
  - SQL 统一查询 `regional_average_record = 'WR'` 的 value1-5 数据
  - 子类只需实现 `compute_metric(values, r)` 即可
  - 自动处理 历史构建 + 排名（类级别缓存全量 results）
- 抽象基类 `statistics/abstract/ao_rounds.rb`：跨轮次 AoXR 的通用模式
  - 子类只需指定 `round_count` 即可
- `recon/` 目录：存放复盘页面相关文件
  - `scripts/convert_recon_csv.py`：将 Google Sheets 导出的 CSV 转换为前端 JSON 数据

### 验证步骤

1. 推送到 main → CI 语法检查通过
2. 手动触发完整构建（约 47 分钟）
3. 访问 `https://ruiminyan.github.io/stats/wr_XXX` 查看各统计页面
4. 与 WCADB.xlsx 对应 sheet 数据抽查对比

# 国旗渲染

## 方案

全站统一使用 [flag-icons](https://github.com/lipis/flag-icons) CSS 库（基于 SVG），通过 `_layouts/default.html` 全局引入：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css">
```

用法：传入小写 ISO 3166-1 alpha-2 国家代码：

```html
<span class="fi fi-cn"></span>  <!-- 中国 -->
<span class="fi fi-us"></span>  <!-- 美国 -->
```

## ⚠️ 不要使用 Unicode Regional Indicator

**Windows 系统不支持 Unicode Regional Indicator 旗帜 emoji**（如 `\uD83C\uDDE8\uD83C\uDDF3`），在浏览器中会被渲染为纯字母（如 "CN"）而非旗帜图标。必须使用 `flag-icons` CSS 库。

## 使用位置

| 页面 | 国旗类型 | 数据来源 | 代码位置 |
|------|---------|---------|----------|
| stats（Ruby 生成页面） | 选手+比赛 | WCA `country_id`（已是 ISO2） | Ruby 模板直接输出 `<span class="fi fi-xx">` |
| upcoming_comp | 比赛 | WCA API `country_iso2` | `upcoming_comp/index.md` JS 中 `fi fi-${comp.country.toLowerCase()}` |
| recon（复盘页面） | 比赛 | `comp_name_countries.json`（比赛展示名 → ISO2） | `recon.js` 的 `compCountries[solve.comp]` |
| recon（复盘页面） | 选手 | `person_name_countries.json`（WCA 选手名 → ISO2） | `recon.js` 的 `solverCountry(solve)` |

### 国旗数据生成

`_stats_build/generate_comp_countries.rb` 从 WCA 数据库生成三个 JSON 映射文件：

| 文件 | 内容 | 大小 | 查询 |
|------|------|------|------|
| `stats/comp_countries.json` | 比赛 WCA ID → WCA country_id | ~700KB | `SELECT id, country_id FROM Competitions` |
| `stats/comp_name_countries.json` | 比赛展示名 → ISO2（recon 用） | ~500KB | `competitions.cell_name JOIN countries.iso2` |
| `stats/person_name_countries.json` | 选手全名 → ISO2（recon 用） | ~7MB | `persons.name JOIN countries.iso2 WHERE sub_id=1` |
| `stats/person_countries.json` | 选手 WCA ID → ISO2（stats 用） | ~各异 | `persons.wca_id → countries.iso2` |

运行方式：`cd _stats_build; bundle exec ruby generate_comp_countries.rb`（需要 MySQL 运行中）

### ⚠️ recon 页面选手国旗的中文名查找

WCA 数据库中中国选手名格式为 `"Ruimin Yan (颜瑞民)"`，而 CSV 中 `solver` 只有英文名 `"Ruimin Yan"`。
`recon.js` 的 `solverCountry()` 函数会先用 WCA 格式全名 `solver + ' (' + solverZh + ')'` 查找，
匹配不到再用纯英文名兜底。这确保中国选手也能正确显示国旗。

### 新增/更新国旗数据

重新运行 `generate_comp_countries.rb` 即可（需要本地 MySQL 有最新 WCA 数据库）。无需手动维护映射。

# Recon 复盘页面

## 数据流

```
Google Sheets → 导出 CSV（CubeAlgWB - Recon.csv，不提交 git）
    ↓
scripts/convert_recon_csv.py（Python 转换）
    ↓
recon/recon_data.json（前端数据，需提交 git）
    ↓
recon/recon.js（浏览器端渲染）
```

## 更新复盘数据

```powershell
# 1. 从 Google Sheets 下载最新 CSV 到项目根目录
# 2. 运行转换脚本
python scripts/convert_recon_csv.py
# 3. 提交生成的 JSON
git add recon/recon_data.json
git commit -m "data: update recon data"
```

## CSV 关键列

| JSON 字段 | CSV 列名 | 说明 |
|-----------|----------|------|
| `single` | `time` | 成绩（精确到毫秒，如 3.643） |
| `country` | `region_solver` | 选手国家（英文全名，仅存档用，国旗从 WCA 数据库获取） |
| `scramble` | `scr*` | 最少步打乱 |
| `wcaScramble` | `scr` | WCA 官方打乱 |
| `recon` | `recon` | 复盘步骤（优先显示） |
| `caption` | `caption` | 备选复盘文本 |
| `rAvg` | `R avg_full` | 平均纪录标记（WR/NR/PR 等） |
| `rSingle` | `R single` | 单次纪录标记 |

## Record Badge 颜色规则

| 颜色 | 含义 | 匹配规则 |
|------|------|----------|
| 🔴 红色 | 世界纪录/最好（WR, FWR, WB, YTWR 等） | `^[FXU]?W[RB]$` |
| 🟡 黄色 | 洲际纪录（AsR, ER, CR, SAR, WCR 等） | `(?:AS\|E\|C)[RB]$` |
| 🟢 绿色 | 国家纪录/最好（NR, FNR, NB 等） | `^[FXU]?N[RB]$` |
| 🔵 蓝色 | 个人纪录/最好（PR, PB 等） | `endsWith('PR'\|'PB')` |
| ⚪ 灰色 | 其他 | 默认 |

- 前缀 `F` = 女子纪录，颜色同上
- `B` = Best，与 `R` = Record 同色