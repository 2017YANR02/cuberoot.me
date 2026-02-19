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

## 标准测试流程 (Standard Verification Workflow)

每次修改统计代码（尤其是 HTML 结构）后，**必须**按以下步骤验证：

### 第一步：数据逻辑检查 (Data Check)
快速检查生成的 Markdown 数据内容是否正确，有无报错。

```bash
ruby test_stat.rb <statistic_name>
# 例: ruby test_stat.rb wr_bao5
```

### 第二步：HTML 渲染验证 (HTML Rendering Verification)
**（核心步骤）** 使用与 GitHub Pages 一致的 `kramdown (GFM)` 引擎生成真实 HTML，验证属性引号、表格结构和转义情况。

```bash
ruby verify_render_kramdown.rb <statistic_name>
# 例: ruby verify_render_kramdown.rb wr_bao5
```
脚本会生成 `preview_kramdown.html` 文件。

### 第三步：浏览器视觉验收 (Browser Inspection)
直接双击打开生成的 `preview_kramdown.html`：
1. **看格式**：表格样式是否正常，Tab 切换是否工作。
2. **看源码**：右键“检查元素”，确认 `data-i18n` 属性值是否完整（无截断、引号闭合正确）。

---

## 注意事项

- **大项目很慢**：`wr_dominance` 等需要全量查询的统计，在 333 (三阶) 上可能需要几分钟。建议先用小项目（如 `skewb`、`555bf`）测试逻辑是否正确。
- **内存占用**：全量查询会消耗大量内存（333 可达数 GB），测试完毕后注意 kill Ruby 进程。
- **忽略文件**：`test_output.html` 和 `preview_kramdown.html` 已在 `.gitignore` 中，不会被提交。
- **语法检查**：提交前推荐用 `ruby -c statistics/xxx.rb` 做语法检查。
