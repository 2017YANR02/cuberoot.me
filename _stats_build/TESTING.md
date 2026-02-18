# 统计脚本本地测试说明

## 前提条件

1. **Ruby 3.x**（推荐 3.4）
   - Windows 下载: https://rubyinstaller.org/
   - 安装时勾选 DevKit（`mysql2` gem 编译需要）

2. **MySQL** 中已导入 WCA 数据库
   - 下载 WCA Developer Database Export: https://www.worldcubeassociation.org/export/results
   - 导入方式见 `bin/update_database.rb`
   - 配置文件 `database.yml`（格式见下方）

3. **安装 gem**
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

## 测试工具

### 1. `test_stat.rb` — 快速验证（控制台输出）

```bash
ruby test_stat.rb <statistic_name>
```

输出 markdown 的前 50 行到控制台，用于快速检查是否报错。

```bash
# 示例
ruby test_stat.rb wr_dominance
ruby test_stat.rb wr_bpa
```

### 2. `test_html.rb` — HTML 预览（浏览器查看）

```bash
ruby test_html.rb <statistic_name>
```

将统计输出包装为完整 HTML 页面，保存到 `test_output.html`，双击即可在浏览器中查看表格、Tab 切换等效果。

```bash
# 示例
ruby test_html.rb consecutive_sub_5_average
# 然后打开 test_output.html
```

### 3. 查看所有可用统计名称

```bash
ruby test_stat.rb
# 不带参数会列出所有统计名
```

## 注意事项

- **大项目很慢**：`wr_dominance` 等需要全量查询的统计，在 333 (三阶) 上可能需要几分钟。建议先用小项目（如 `skewb`、`555bf`）测试逻辑是否正确。
- **内存占用**：全量查询会消耗大量内存（333 可达数 GB），测试完毕后注意 kill Ruby 进程。
- **`test_output.html` 已在 .gitignore 中**，不会被提交。
- **语法检查**：提交前用 `ruby -c statistics/xxx.rb` 做语法检查。
