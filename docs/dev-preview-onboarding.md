# 同事和新电脑的开发预览接入

用户可以直接说：**“帮我配置 dev，名字 xiaoming，电脑 macbook-pro。”**
AI 从 `AGENTS.md` 进入 `dev-preview` skill，再使用本手册和命令完成配置。无需用户自己记 DNS、证书、端口或修改哪些代码。已有目标电脑访问能力时直接推进；没有访问能力时需要同事执行电脑端命令或提供远程连接，这是实际接入的必要条件。

## 事实源与边界

- 清单：`ops/dev-preview/machines.json`，无密码或私钥。
- 命名：`dev-<姓名>-<设备>.cuberoot.me`；只用小写英文字母、数字和连字符。不能让不同的姓名/设备组合产生相同域名。
- TypeScript 管理器：`core/scripts/dev-preview/cli.ts`；电脑端：同目录 `client.ts`。
- 生成物：`ops/nginx/dev-machines.conf`、`core/packages/shared/src/dev-preview.ts`。client 环境识别和 API CORS 都消费这个 shared 入口；以后不再分别手工加名单。
- 管理器 `register` 查询服务器监听端口、服务器保留端口和清单后分配 7105–7198。7101/7102 为原有服务保留，7199 为接入机制验收保留；已撤销设备的端口也不重用。
- 现有 ruimin 三台继续使用 FRP：Mac Mini→7100，Alienware→7103，MacBook Pro→7104。Mac Mini 本机还经过 Caddy 3001 压缩到 Next 3000。旧域名仍兼容，`dev.cuberoot.me` 的 nginx 单独维护。
- 新增设备使用 OpenSSH 22 端口的独立密钥，只准在服务器 `127.0.0.1:<分配端口>` 监听，禁止 shell/SFTP、执行命令、本地转发、Unix socket 转发、代理转发、TTY 和任意其他端口。管理员私钥、FRP 共用令牌不交给同事。
- 密钥只让该电脑连接开发预览，不授予 CubeRoot 网站管理员身份。当前网站开发代理仍连接线上 API；不能把它解释成独立测试数据库。

## 管理端前提

在有仓库和 Node **24+** 的管理员电脑执行。现有 `ssh cuberoot` 必须通过已验证的主机密钥登录服务器；`gh` 已登录；阿里云 DNS 页面能操作。不要给同事复制管理员 SSH 密钥。

所有下文 `node scripts/...` 命令都在仓库 **`core/`** 中运行。新建隔离 worktree 后先在其 `core/` 安装依赖；禁止软链接复用另一份 node_modules。先查看 `plan` 和当前 git diff，保留其他任务的改动。

```sh
node scripts/dev-preview/cli.ts plan
node scripts/dev-preview/cli.ts register --owner xiaoming --device macbook-pro --os mac
```

Windows 用 `--os windows`。同一身份重跑 register 返回现有记录；不会重新分配端口。新记录为 `pending`，只生成 HTTP 验证入口，尚未开放 HTTPS 或加入 CORS。

## 1. 目标电脑生成专用密钥

目标电脑应已有项目、Node 24+、pnpm 和 OpenSSH 客户端；先使项目在 `localhost:3000` 正常运行。首次环境准备使用仓库现有安装/构建命令，不能假定“下载了项目”就已经能运行。

在目标电脑仓库 `core/` 执行：

```sh
node scripts/dev-preview/client.ts init --id xiaoming-macbook-pro
```

它在用户目录 `.cuberoot/dev-preview/xiaoming-macbook-pro/` 创建私钥，只输出 **request.json 路径**。重跑复用原私钥。把 `request.json` 给管理端；不要传 `id_ed25519`。macOS 使用目录 700/文件 600，Windows 去掉继承 ACL 并限定当前用户。

## 2. 管理端授权并返回连接文件

```sh
node scripts/dev-preview/cli.ts authorize --id xiaoming-macbook-pro --request /实际路径/request.json --out /实际路径/connection.json
```

管理器创建专用 `crdev-<hash>` 系统账号，以该用户的 Match 块限制权限；校验 `sshd -t` 和 `sshd -T` 后仅 reload，不重启现有 SSH 会话。端口有服务器侧保留记录和操作锁。已有不同公钥时拒绝覆盖，应先确认身份并明确撤销旧设备。

`connection.json` 只有公钥、服务器公开地址/主机公钥、专用用户和分配端口。主机公钥通过已信任的管理员 SSH 取得；目标电脑使用严格主机密钥验证，不能用 `StrictHostKeyChecking=no`。

把 connection.json 传回同一台电脑。目标端检查它是否匹配本机生成的公钥。

## 3. DNS 和 HTTP 验证入口

`plan --id xiaoming-macbook-pro` 输出 DNS 参数。打开：

https://dnsnext.console.aliyun.com/authoritative/domains/cuberoot.me

先查同名记录。不存在时添加：A、主机记录 `dev-xiaoming-macbook-pro`、默认线路、记录值 `47.97.30.181`、TTL 10 分钟。存在时比对值，冲突不要直接覆盖。阿里云“添加并继续”可能清空默认线路，下一条必须重新选择默认，不能只填名称和 IP。不订购额外套餐。

提交 pending 清单和生成 nginx，按仓库授权 push；等待 **Deploy Web Ops Config** 成功。这里不引用新证书文件，因此不会破坏现有 HTTPS。若正在并行接入其他设备，先同步 main 并重新检查端口，解决清单冲突后再生成。

## 4. 证书、激活和发布

```sh
node scripts/dev-preview/cli.ts certificate --id xiaoming-macbook-pro
node scripts/dev-preview/cli.ts activate --id xiaoming-macbook-pro
node scripts/dev-preview/cli.ts render --check
pnpm --filter @cuberoot/shared build
node --test scripts/dev-preview/model.test.ts
pnpm --filter @cuberoot/client exec vitest run tests/admin-environment.test.ts
pnpm --filter @cuberoot/server exec vitest run tests/drive_contract.test.ts
```

证书命令要求 DNS 已指向服务器并使用已部署的 webroot 验证入口。activate 校验证书域名与有效期后才生成 TLS 站点和允许列表。**activate 是准备发布，不是已经上线。**

提交本次清单和生成物，按仓库授权 push；观察 nginx、API、Next 和对应测试工作流。常规 API 发布会跑现有求解器检查，可能耗时数分钟；不绕过，也不对服务器 git pull。只有 Actions 成功且线上验收通过才报完成。

## 5. 目标电脑接入与登录自启

Mac 示例（路径使用目标电脑的实际值）：

```sh
node scripts/dev-preview/client.ts configure --id xiaoming-macbook-pro --profile /实际路径/connection.json --repo /Users/xiaoming/Documents/cuberoot.me
node scripts/dev-preview/client.ts run --id xiaoming-macbook-pro
```

Windows 同样使用 Node 命令，带空格的文件路径加双引号：

```text
node scripts/dev-preview/client.ts configure --id xiaoming-alienware --profile "C:/Users/xiaoming/Downloads/connection.json" --repo "D:/cube/cuberoot.me"
node scripts/dev-preview/client.ts run --id xiaoming-alienware
```

run 在前台保持运行。已有健康 CubeRoot 服务时复用；3000 被不相关服务占用时退出，不杀端口进程。未运行时先构建已有 cubing worker，再直接启动 Next 的现有 binary（绕开会清理端口的 predev-clean）；只停止自身创建的进程。SSH 断线会自动重连。不能同时运行两份 runner。

前台验收通过后，Ctrl+C 停止该 runner，然后登记登录自启：

```sh
node scripts/dev-preview/client.ts install --id xiaoming-macbook-pro
```

- Mac：LaunchAgent `me.cuberoot.dev.<id>`，随用户登录启动。
- Windows：计划任务 `CubeRootDev-<id>`，当前用户交互登录启动，无管理员权限/存储密码；没有默认三天运行时限。
- 日志：用户目录 `.cuberoot/dev-preview/<id>/service.log`，Mac 另有 launchd.log/error.log。
- 自启复制必要的 TS runner 到用户目录，用当前 Node 的绝对路径启动。升级/移动 Node 或仓库路径后需重新 configure 并检查自启定义，不要在其他服务运行时盲目重启。
- 电脑关机、休眠、断网时网址不可用，其他设备不受影响。登录自启不是无人登录时的开机服务。

## 6. 完成判据

```sh
# 管理端
node scripts/dev-preview/cli.ts verify --id xiaoming-macbook-pro
# 目标端
node scripts/dev-preview/client.ts check --id xiaoming-macbook-pro
```

verify 使用公共 DNS 核对解析（避免本机网络代理的虚拟 IP 造成误判），并检查可信 HTTPS、CubeRoot 页面、HTML 声明的全部 Next 启动 JS 和 API CORS。再通过浏览器真实打开页面，确认没有启动失败提示；若任务要求手机验收，再用真实手机测试。UI 服务能打开不等于登录/支付等全部业务已验收。

另检查 `launchctl print gui/<uid>/me.cuberoot.dev.<id>` 或 Windows 计划任务状态和日志。未实际登出/重启时应写“登录自启已登记，重启未实测”。

## 停用、轮换与失败恢复

```sh
node scripts/dev-preview/cli.ts revoke --id xiaoming-macbook-pro
```

先清空该设备授权公钥并终止它的现有会话，再将清单标记 revoked；部署生成的 nginx/CORS 变更，最后在阿里云移除对应 DNS。端口保留，私钥不再有效。系统账号和 SSH 限制保留，便于追溯；授权文件只包含公钥，撤销备份不会被 sshd 使用。FRP 老设备不适用此命令，管理器会拒绝。

证书失败：保留 pending，不产生引用缺失证书的 TLS 配置。DNS 错误：先修解析再重跑 certificate。部署失败：按 Actions 的回滚结果核对，不把本地 active 当成功。隧道失败：看 service.log、核对主机公钥/账号/端口占用，禁止临时取消验证。重复请求不新建第二个身份。

`--registry FILE` 仅用于隔离权限验收：允许 plan/authorize/revoke 和读取，禁止生成生产文件；正式接入使用默认清单。不要把测试身份发布到 DNS。

## 验证范围与实现参考

自动检查覆盖端口冲突、非法名称、pending/active/revoked 输出、生成物漂移、独立密钥生成及幂等性、错误连接文件拒绝；工作流在 Linux、macOS、Windows 运行。真实服务器端还需验收授权端口转发、拒绝其他端口/命令、撤销后失效。登录自启的实际重启结果须单独记录。

SSH 限制依据：[OpenSSH sshd_config](https://man.openbsd.org/sshd_config)、[authorized_keys](https://man.openbsd.org/sshd.8)、[ssh 反向转发](https://man.openbsd.org/ssh.1)。

### 2026-09-24 实机证据

在管理员 Mac Mini 生成一次性独立密钥，通过真实服务器的 7199 回环端口接回本机 CubeRoot：网页 HTTP 200；shell 请求、其他远端端口 7198、本地转发到服务器 3001 均被拒绝。revoke 后 7199 监听立即关闭，旧密钥重新连接收到 Permission denied。测试客户端已停止，临时私钥/连接文件已清理；服务器保留已撤销的验收账号和 7199 端口记录。未新增测试 DNS，不改变现有三台 FRP。
