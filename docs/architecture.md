# 项目架构

## 目录结构

> 🤖 = CI 自动生成 · 📌 = 本地维护 · 🔄 = 上游同步

```
ruiminyan.github.io/
├── index.html                 # 🤖 Vite SPA 入口（deploy_core.yml 生成）
├── _assets/                   # 🤖 Vite 构建产物
├── 404.html                   # 🤖 GitHub Pages SPA fallback（index.html 副本）
├── .nojekyll                  # 📌 禁止 GitHub Pages Jekyll 构建
│
├── core/                      # 📌 Monorepo 源码（React 19 + Vite 8 + Zustand）
│   ├── packages/client/       #    React 前端（SPA 主体）
│   ├── packages/server/       #    Hono API 后端
│   ├── packages/shared/       #    共享类型 + PLL/OLL 数据
│   ├── packages/stats-build/  #    WCA 统计数据生成管道（88 个统计）
│   └── README.md              #    开发文档
│
├── tools/                     # 🔧 独立 HTML/JS 工具模块（iframe 嵌入）
│   ├── solver/                #    3x3x3 Solver
│   ├── *_trainer/             #    各类训练器（cross/xcross/eocross/...）
│   ├── alg_trainers/          #    公式训练器（mihlefeld/Alg-Trainers）
│   ├── cstimer/               #    csTimer 计时器
│   └── ...                    #    其他工具
│
├── stats/                     # 📌 统计页面 + JSON 数据（CI 每周更新）
├── viz/                       # 📌 成绩分布演化可视化
├── scripts/                   # 📌 Python 数据脚本
├── assets/{css,js,images}/    # 📌 Stats UI 静态资源
├── i18n/                      # 📌 多语言字典 + 项目选择器
├── shared/                    # 📌 跨页面共享 JS（WCA 搜索/选手选择器）
├── .sync/                     # 📌 上游同步配置和模板
│
├── docs/                      # 📌 项目文档（本目录）
├── DEPLOYMENT.md              # CI/CD 概览与索引
└── CUBEROOT_ME.md             # ECS 运维手册
```

> 详细的文件级说明见各目录下的 README 或 `core/README.md`。

## URL 架构

| URL | 服务 | 说明 |
|-----|------|------|
| `cuberoot.me/` | React SPA | Vite 构建，GitHub Pages + ECS 双部署 |
| `cuberoot.me/blog/` | WordPress | ECS 专有，符号链接到 `/www/wwwroot/wordpress/` |
| `cuberoot.me/tools/` | 静态文件 | 独立 HTML/JS 工具模块（iframe 嵌入 SPA） |
| `cuberoot.me/wca-stats/` | React SPA | WCA 统计数据展示（SPA 路由） |
| `cuberoot.me/stats/` | 静态 JSON | WCA 统计数据文件（SPA fetch） |
| `cuberoot.me/api/` | Hono API | Nginx 反代到 127.0.0.1:3001 |

## Recon 详情页路由

用户访问 `/recon/2263` 时，不同环境有不同路由方式：

| 环境 | 实现方式 | 闪烁 |
|------|---------|------|
| **localhost** | `getDetailUrl()` 跳 `/recon/detail/?id=2263` → `replaceState` | 无 |
| **GitHub Pages** | `404.html` 检测 → `location.replace` → `replaceState` | 极短 |
| **cuberoot.me** | Nginx `rewrite` 内部转发 | 无 |

相关文件：`404.html`、`CUBEROOT_ME.md`、`recon.js`、`recon_detail.js`

## 国旗渲染

全站使用 [flag-icons](https://github.com/lipis/flag-icons) CSS（SVG），通过 SPA `index.html` 全局引入：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/css/flag-icons.min.css">
```

用法：`<span class="fi fi-cn"></span>`（小写 ISO 3166-1 alpha-2）

> ⚠️ **不要使用 Unicode Regional Indicator**——Windows 不支持，会渲染为字母（如 "CN"）。

### 国旗数据文件

由 `core/packages/stats-build` 统计管线从 WCA 数据库生成：

| 文件 | 用途 | 大小 |
|------|------|------|
| `stats/person_countries.json` | 选手 WCA ID → ISO2（前端 personFlagIso2）| ~5MB raw / ~1MB gz |
| `stats/comp_countries.json` | 比赛 ID → country_id（前端 compFlagIso2）| ~650KB |

运行：
- 全量统计：`npx tsx core/packages/stats-build/src/bin/compute_all.ts`（需要 MySQL）
- 仅查表：`npx tsx core/packages/stats-build/src/bin/gen_lookup_data.ts`
