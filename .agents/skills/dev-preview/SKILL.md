---
name: dev-preview
description: 配置、检查或撤销 CubeRoot 同事/电脑的 dev-姓名-设备.cuberoot.me 开发预览域名。用于“帮我配置 dev，名字是…电脑是…”、新增同事开发域名、开发隧道和登录自启；不用于生产发布或普通 localhost 开发。
---

# 开发预览接入

用户给出姓名与电脑后，按 [接入手册](../../../docs/dev-preview-onboarding.md) 完成整个流程。

- 事实源：`ops/dev-preview/machines.json`。先运行 `node core/scripts/dev-preview/cli.ts plan`；用 `register` 分配端口，禁止凭记忆选择。
- 默认命名 `dev-<owner>-<device>.cuberoot.me`，owner/device 用小写 ASCII 和连字符。已在目标电脑时自行识别 OS、仓库路径和服务状态；只有缺少访问目标电脑的方式、身份有歧义时才询问。
- 新同事用每设备独立的 SSH 反向隧道。私钥由 `client.ts init` 在目标电脑生成；只交换 public request 和 connection profile。现有 ruimin 三台设备仍使用 FRP，禁止把它们的共用令牌发给同事，也不为了新增设备重启它们。
- `pending → HTTP challenge 部署 → certificate → active → HTTPS/API 部署` 的顺序不可颠倒，否则 nginx 会引用不存在的证书。
- 阿里云已登录时直接操作 DNS 页面；新建 A 记录、默认线路、TTL 600。`plan` 提供确切名称和地址。保存后查 DNS，不重复创建。DNS 页面不可访问时说明阻塞点，先完成其余不依赖 DNS 的准备。
- 服务器 nginx/API 部署遵循仓库 AGENTS 和 `server-deploy`，通过 Actions 发布。使用独立 worktree；不覆盖其他 AI 的工作。任务授权范围内继续完成，不在每个步骤重复问确认；技能不扩大发布或访问授权。
- 短命令或文件传输优先于 U 远程长命令。远端输入可能延迟，先核对完整命令再回车；不能把“已输入”记成“已成功执行”。
- 验收必须含：DNS、有效 HTTPS、对应隧道端口、网页及全部首页启动 JS、API CORS、客户端本地服务、自启登记。运行 `verify`，再实际打开浏览器。未做重启验收就明确写“已登记自启，未实测重启”。
- 无法访问同事电脑时，交付已完成的服务器部分和目标端命令，明确“等待电脑接入”；不能宣称只填名字就已开通。
- 停用用 `revoke` 撤销公钥并断开现有会话，再部署清单生成物并移除 DNS。保留端口占用记录，避免过期配置重新接到另一个人的网址。

交付给用户：新网址、对应人/电脑、验证结果和任何确实未完成项。不要把内部执行步骤全部倒给用户。
