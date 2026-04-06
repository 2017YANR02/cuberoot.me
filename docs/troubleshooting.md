# 故障排除

## CI/CD 问题

### 统计未更新？
1. 检查 [Actions 页面](https://github.com/RuiminYan/ruiminyan.github.io/actions) 是否有错误
2. 确认 `stats.yml` 中设置了 `permissions: contents: write`
3. 确保提交信息包含 `[skip ci]` 避免递归触发

### 镜像未更新？
1. 检查 "Deploy Mirror to cuberoot" 是否全绿
2. 查看日志定位错误（通常是 SSH 连接或 rsync 问题）

### 页面 404？
- 检查 Nginx 配置是否包含 `$uri.html`
- 宝塔面板修改站点后可能覆盖配置，需要重新添加 `^~` location 块

### SSH 连接失败？
- 检查阿里云安全组 22 端口
- 确认 `/root/.ssh/authorized_keys` 包含部署公钥

### SSL 证书过期？
- 宝塔默认自动续签
- 手动：宝塔面板 → 网站 → SSL → 续签

## 常见开发问题

### 内存不足
- GitHub Actions 上限 7GB
- 本地统计建议：`$env:NODE_OPTIONS='--expose-gc --max-old-space-size=6144'`
- 全量查询统计（如 `wr_dominance`）在 333 上可能很慢，建议先用小项目验证

### Windows → Linux 权限
- 从 Windows 复制的脚本在 Linux 上丢失可执行权限
- 解决：在 workflow 中用 `ruby script.rb` 而非 `./script.rb`

### GitHub Actions 默认权限
- `GITHUB_TOKEN` 默认只读（2023 年后的新仓库）
- 解决：workflow 中声明 `permissions: contents: write`

### TypeScript 类型检查
```powershell
pnpm --filter @cuberoot/stats-build typecheck
```

## 自动化测试（Playwright）

需要验证 DOM 交互行为时，使用 Playwright 临时脚本：

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('http://127.0.0.1:4000/stats/wr_metric', wait_until='networkidle')
    page.click('.event-btn[data-event="777"]')
    page.wait_for_timeout(500)
    bao5 = page.query_selector('.metric-dropdown-item[data-id="bao5"]')
    print("BAo5 classes:", bao5.get_attribute('class'))
    browser.close()
```

安装：`pip install playwright && playwright install chromium`

> 验证完即删，不提交到 git。
