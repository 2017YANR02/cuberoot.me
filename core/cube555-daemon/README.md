# cube555-daemon

实时随机状态 5x5 打乱生成器 —— Java 长寿命子进程,Hono server 用 stdin/stdout
协议跟它对话,提供 `/v1/scramble/555-rs`。

唯一进 git 的是 `Daemon.java`(我们自己写的胶水)。求解器内核来自上游
[cs0x7f/cube555](https://github.com/cs0x7f/cube555)(GPL-3.0 / MIT 双协议),
部署时 git clone 到 `/opt/cube555/`,**不进 repo**。

## 上游设计

cube555 是 5-phase reduction solver:平均 reduction ~51 步 + 3x3 解 ~20 步
→ 完整 scramble ~70 步。单条 ~1.5s,4-worker 并行 ~0.5s/条 wall。**首次启动需要
~5 分钟建 13 张剪枝表共 ~230MB 到磁盘**,后续启动 ~3s 从盘读回。

## 部署到服务器(一次性)

```bash
# 1. 装 JDK 21
apt update && apt install -y temurin-21-jdk  # 或 openjdk-21-jdk

# 2. 拉 cube555 上游源码
git clone https://github.com/cs0x7f/cube555.git /opt/cube555

# 3. 我们的 Daemon.java 由 deploy_core.yml rsync 进 /opt/cube555/example/
#    (首次 deploy 之前可以先手动 cp 验证)

# 4. 编译 cube555 + 我们的 Daemon
cd /opt/cube555
mkdir -p dist
javac -target 8 -source 8 -d dist -cp lib/twophase.jar src/*.java example/MainProgram.java
javac -d dist -cp 'dist:lib/twophase.jar' example/Daemon.java

# 5. 预热剪枝表(首次 ~5 分钟,生成 ~230MB 到 /opt/cube555/Phase*.j[hp]data)
echo 'QUIT' | java -Xmx1g -cp 'dist:lib/twophase.jar' cs.cube555.Daemon
```

5 步做完后,Hono(`core-api`)启动时会自动 spawn daemon 子进程,只 ~3s 冷启就
能响应 `/v1/scramble/555-rs`。

## 后续部署

`deploy_core.yml` 在 server 同步阶段:

```bash
rsync core/cube555-daemon/Daemon.java root@cuberoot:/opt/cube555/example/
ssh root@cuberoot 'cd /opt/cube555 && javac -d dist -cp "dist:lib/twophase.jar" example/Daemon.java'
# pm2 reload core-api 会让 Hono 重启,子进程 Java daemon 跟着重启
```

## 本地 dev

Windows 上 cube555 已 clone 在 `D:\cube\cube555\`,本地 dev 时:

```bash
# 启 Hono dev(指 PORT=3002 + CUBE555_HOME 到本地 cube555 目录)
PORT=3002 CUBE555_HOME='D:/cube/cube555' pnpm --filter @cuberoot/server dev

# Vite proxy /v1 → 127.0.0.1:3002(在 vite.config.ts 加一行,见注释)
pnpm --filter @cuberoot/client dev
```

## 配置环境变量

`core/packages/server` 启动时读:

| 变量 | 默认 | 含义 |
|------|------|------|
| `CUBE555_HOME` | `/opt/cube555` | cube555 上游源码目录,含 dist/ 和 lib/(也是 native 二进制 CWD) |
| `CUBE555_WORKERS` | `4` | 内部并行求解线程数 |
| `CUBE555_NATIVE_BIN` | (unset) | 设为某路径则 spawn 该 GraalVM 编出的 native 二进制(无 JVM 启动开销,-Xmx512m 固定);留空走 `java -cp ...` |
| `CUBE555_DISABLED` | (unset) | 设为 `1` 时 Hono 跳过 spawn,`/v1/scramble/555-rs` 返 503 |

## GraalVM native binary(可选,推荐生产用)

`.github/workflows/cube555_native.yml` 用 GraalVM 21 AOT 编 `Daemon.java` 为单文件
Linux x64 静态二进制(`--static --libc=musl` 脱离 glibc),scp 到
`/opt/cube555/cube555-daemon`。生产环境 `.env` 加一行:

```
CUBE555_NATIVE_BIN=/opt/cube555/cube555-daemon
```

`pm2 restart core-api --update-env` 即生效。RSS 比 JVM 模式省 ~170MB(540→370),
可以多塞 1 个 worker。性能数据见 `BENCHMARKS.md`。

切回 JVM:把 `.env` 里这行注释掉再 restart。

## 协议

见 `Daemon.java` 顶部注释。Hono 客户端实现在
`core/packages/server/src/cube555/daemon.ts`。

## 致谢

求解器由 [cs0x7f](https://github.com/cs0x7f) 编写。`Daemon.java` 这个胶水也只是
他 `example/MainProgram.java` GUI 示例的 stdio-API 版本而已。
