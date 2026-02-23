# 统计脚本本地测试说明

## 前提条件

1. **Ruby 3.x**（推荐 3.4）
   - Windows 下载: https://rubyinstaller.org/
   - 安装时勾选 DevKit（`mysql2` gem 编译需要）
   - 如果 `ruby` 不在 PATH 中，需要使用完整路径，例如 `C:\Ruby34-x64\bin\ruby.exe`
   - 检查方法：`Get-Command ruby` 若报错则说明不在 PATH 中

2. **MySQL** 中已导入 WCA 数据库
   - 下载 WCA Developer Database Export: https://www.worldcubeassociation.org/export/results
   - 导入方式见 `bin/update_database.rb`
   - 配置文件 `database.yml`（格式见下方）

3. **安装 gem** (已安装)
   ```bash
   gem install mysql2
   ```

## 数据库配置

在 `_stats_build/database.yml` 中填写（该文件已在 .gitignore 中）：

```yaml
database: "wca_statistics"
username: "root"
password: "your_password"
```

## 测试方法

> **工作目录**：以下所有命令均需在 `_stats_build/` 目录下运行。

### 单个统计测试

使用 `STATS_FILTER` 环境变量，只计算指定的统计并写入 `stats/` 目录。Jekyll 的 `--watch` 会自动检测变化并重新构建，刷新浏览器即可看到结果。

```powershell
$env:STATS_FILTER = "average_of_5"
ruby bin/compute_all.rb
# 浏览器访问 http://127.0.0.1:4000/stats/average_of_5/
```

多个统计用逗号分隔：

```powershell
$env:STATS_FILTER = "wr_bpa,wr_dominance"
ruby bin/compute_all.rb
```

### 全部统计生成

```powershell
ruby bin/compute_all.rb
```

### 查看所有可用统计名称

```powershell
ruby -e "$LOADED_FEATURES << 'bundler/setup'; require_relative 'statistics/index'; puts STATISTICS.keys.sort.join(', ')"
```

### 语法检查

提交前推荐做语法检查：

```powershell
ruby -c statistics/xxx.rb
```

### UI 快速测试 (无需数据库)

很多时候只需要调试分段控件、标签、表格等前端渲染效果，并不需要花费几十分钟生成全站数据。
本项目提供了专门的静态测试页，无需启动数据库即可直接在 Jekyll 预览：

- 访问地址：[http://127.0.0.1:4000/stats/test_ui](http://127.0.0.1:4000/stats/test_ui)
- 源码位置：`stats/test_ui.md`
- 用途：各种布局、响应式折行、夜间模式等 CSS 和国际化 JS 逻辑调整。

## 注意事项

- **大项目很慢**：`wr_dominance` 等需要全量查询的统计，在 333 (三阶) 上可能需要几分钟。建议先用小项目（如 `skewb`、`555bf`）测试逻辑是否正确。
- **内存占用**：全量查询会消耗大量内存（333 可达数 GB），测试完毕后注意 kill Ruby 进程。
- **并行构建**：全量构建默认使用 4 个 worker 并行计算独立统计。可通过 `STATS_WORKERS` 环境变量调整：
  ```powershell
  $env:STATS_WORKERS = 8    # 本地 16GB 内存可适当增加
  ruby bin/compute_all.rb
  ```
  Linux 使用多进程模式（绕过 GIL），Windows 使用多线程模式（MySQL I/O 仍可并行）。
