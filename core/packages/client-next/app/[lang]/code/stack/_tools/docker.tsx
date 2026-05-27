import type { StackTool } from '../_lib/stack_tool_types';
import { k, v, s, n, f, c } from '../_lib/stack_tool_types';

// ─── Docker 29 ──────────────────────────────────────────────────────────────

export const DOCKER: StackTool = {
  slug: 'docker',
  name: 'Docker',
  version: '29.4',
  since: '2013-03',
  group: 'backend',
  accent: '#2496ED',
  bright: '#5EB6F4',
  glyph: '⊞',
  floats: ['Dockerfile', 'image', 'container', 'layer', 'volume', 'network', 'compose', 'buildx', 'BuildKit', 'OCI', 'runc', 'containerd'],
  zh: {
    tagline: '应用打包成镜像, 一行命令到处跑',
    role: '本地起 PG13 容器,在推生产前把 schema / migrations / load.sql 全部跑一遍。',
    heroSub: <>2013 年 Solomon Hykes 在 PyCon lightning talk 上五分钟演示了"把进程关进 namespace + cgroup + 联合文件系统", 整个行业的部署形态就被改写了。十三年后, Docker Engine 29 把 containerd 镜像存储设为默认, 而 "镜像" 这个抽象已经渗到所有 CI / 云服务 / 本地开发环境里。</>,
    whatDesc: <>Docker 不是虚拟机, 也不是单一二进制 —— 它是把 Linux 内核早就有的 <strong>namespace</strong> / <strong>cgroup</strong> / <strong>union filesystem</strong> 三件套, 用一个开发者能 5 分钟上手的 CLI + 镜像格式包起来。今天你说的"容器"其实就是 OCI 镜像 + runc 进程 + containerd 编排, Docker 是这套生态的入口工具。</>,
    historyDesc: <>2013 年 dotCloud 把内部工具开源, 一夜爆红, 公司改名 Docker Inc。中间经历 OCI 标准化 (2015)、runc / containerd 拆出 (2016-17)、Kubernetes 转 containerd 直连 (2020)、Docker Desktop 对大公司收费 (2022) 等几轮震荡, 但镜像格式这个事实标准从未动摇。</>,
    conceptsTitle: 'Dockerfile + 镜像 + 容器',
    conceptsDesc: <>能干的活很多, 但核心抽象只有四个:<strong>镜像</strong> (只读层堆叠)、<strong>容器</strong> (可写层 + 进程)、<strong>volume</strong> (持久化)、<strong>network</strong> (桥接/host)。其它 (compose / buildx / swarm) 都建在这之上。</>,
    whyDesc: <>2026 年还选 Docker 的理由不是"它最酷", 而是"它最 boring" —— 镜像格式是 OCI 标准, 文档烂熟, 任何 CI / 任何云都接得上, AI 工具生成的 Dockerfile 几乎 0 学习成本就能 build。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>到 2026 年, "容器" 已经是后端默认部署单位。每家主流 CI、每家云的 managed container 服务、每家 PaaS 接的都是 OCI 镜像 —— Docker 把这个事实标准砸成了行业地基。</>,
    cuberootDesc: <>cuberoot.me 用 Docker 的地方<strong>只在本地开发机</strong>:跑一个 <code>pg13</code> 容器 (端口 5433, 镜像版本对齐生产 PG 13), 用来在改 schema / 写 migration / 调 load.sql 时先本地 dry-run。生产 VM 上 nginx / Hono / PostgreSQL 全部是<strong>原生进程</strong> (pm2 + systemd), 没有容器化。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>v29 把 containerd image store 设为默认、最低 API 升到 1.44, 镜像层的未来基本就是 OCI + zstd + nydus。同时 Podman / nerdctl 这些"无 daemon" 替代品在 dev 端越来越主流, 但镜像格式没有人想再发明一遍。</>,
  },
  en: {
    tagline: 'Package apps as images and run them anywhere',
    role: 'Run a local PG13 container to dry-run schema / migrations / load.sql before pushing to prod.',
    heroSub: <>In March 2013 Solomon Hykes did a five-minute PyCon lightning talk showing "wrap a process in namespaces + cgroups + a union filesystem," and the industry's deploy story was rewritten. Thirteen years later, Docker Engine 29 makes containerd the default image store, and the image abstraction has soaked into every CI, every cloud, every dev environment.</>,
    whatDesc: <>Docker is not a VM, not a single binary — it is the three Linux-kernel primitives that already existed (<strong>namespaces</strong>, <strong>cgroups</strong>, <strong>union filesystem</strong>) wrapped in a CLI + image format a developer can learn in five minutes. What you call "a container" today is an OCI image + a runc process + containerd; Docker is the entry tool to that stack.</>,
    historyDesc: <>In 2013 dotCloud open-sourced its internal tool and it went viral overnight; the company renamed itself Docker Inc. The decade after brought OCI standardization (2015), the runc / containerd extraction (2016-17), Kubernetes moving to containerd directly (2020), Docker Desktop licensing for large companies (2022). Through it all, the image format as a de-facto standard never shifted.</>,
    conceptsTitle: 'Dockerfile + image + container',
    conceptsDesc: <>The surface is large, but the core abstractions are four: <strong>image</strong> (stacked read-only layers), <strong>container</strong> (writable layer + process), <strong>volume</strong> (persistence), <strong>network</strong> (bridge / host). Compose / buildx / swarm all sit on top.</>,
    whyDesc: <>Picking Docker in 2026 is not because it's "cool" — it's because it's <strong>boring</strong>. OCI is the standard, docs are mature, every CI and every cloud accepts it, and LLM-emitted Dockerfiles usually build first try.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>By 2026, "container" is the default backend deploy unit. Every major CI, every cloud's managed-container service, every PaaS speaks OCI images. Docker pounded that standard into the industry's foundation.</>,
    cuberootDesc: <>cuberoot.me uses Docker <strong>only on the dev machine</strong>: a <code>pg13</code> container (port 5433, image version matched to prod PG 13) for dry-running schema edits, migrations, and load.sql before they hit production. The production VM runs nginx / Hono / PostgreSQL as <strong>native processes</strong> (pm2 + systemd) — no containers on the server.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>v29 makes containerd the default image store and bumps the minimum API to 1.44. The image-layer future is essentially OCI + zstd + nydus. Daemon-less alternatives (Podman, nerdctl) gain ground in dev, but nobody is trying to reinvent the image format.</>,
  },
  heroStats: [
    { num: '29', unit: '.4', zh: <>当前稳定 Engine <em>2026-05 · 29.4.3</em></>, en: <>current stable Engine <em>2026-05 · 29.4.3</em></> },
    { num: '4', unit: '.73', zh: <>Docker Desktop <em>2026-05-11</em></>, en: <>Docker Desktop <em>2026-05-11</em></> },
    { num: '13', unit: 'y', zh: <>从 PyCon 2013 至今 <em>容器事实标准</em></>, en: <>since PyCon 2013 <em>the de-facto standard</em></> },
    { num: '17', unit: 'B+', zh: <>Docker Hub 镜像月拉取量 <em>行业基建级</em></>, en: <>monthly image pulls on Docker Hub <em>industry-scale infra</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Docker 的起点是 dotCloud, 一家在 2010 年代做 PaaS 的小公司。CTO Solomon Hykes 把内部用来在共享主机上隔离用户应用的工具 (Linux Containers 上的一层包装) 抽出来, 2013 年 3 月在 PyCon 的 lightning talk 上五分钟演示了一下 —— "看, 我可以在任何 Linux 上, 用这一个命令把 redis 跑起来, 不用装它的依赖"。</p>
        <p>那场演讲的视频在 YouTube 上炸了。GitHub 仓库一周内拿到几千 star, 半年内拿到上万。dotCloud 改名 Docker Inc, 把所有精力压到容器这条路上。Docker 的真正贡献不是发明了什么内核技术 (namespace / cgroup / union fs 早就在 Linux 内核里), 而是把它们打包成一个<strong>开发者用得起的 CLI + 一个能在公网传输的镜像格式</strong>。</p>
        <p>之后是几次关键节点:2015 年和 CoreOS / 大厂联合成立 OCI, 把镜像 / runtime 标准开放;2016-17 年把 runc / containerd 从 Docker daemon 拆出独立项目, 让 Kubernetes 等系统可以绕开 Docker 直连;2020 年 K8s 干脆宣布弃用 dockershim, "docker" 这个名字从生产编排里淡出, 但镜像格式留下来了。2022 年 Docker Desktop 对大公司收费, 引来一波 Podman / nerdctl 迁徙, 但小项目 / 个人开发者依然以 Docker 为默认。</p>
      </>
    ),
    en: (
      <>
        <p>Docker started inside dotCloud, a small PaaS company in the early 2010s. CTO Solomon Hykes pulled out the internal tooling they used to isolate users on shared hosts (a thin layer over Linux Containers) and did a five-minute PyCon lightning talk in March 2013: "Look, I can run redis on any Linux box with one command, no dependency install."</p>
        <p>The video went viral. The GitHub repo collected thousands of stars in a week and tens of thousands in six months. dotCloud renamed itself Docker Inc and poured everything into containers. The real contribution wasn't a new kernel primitive (namespaces, cgroups, union filesystems were already there) — it was wrapping them in a <strong>developer-friendly CLI</strong> and a <strong>transportable image format</strong>.</p>
        <p>The following decade had a handful of pivots: in 2015 Docker co-founded the OCI with CoreOS and a roster of large vendors, opening the image / runtime standards; 2016-17 saw runc and containerd extracted into their own projects so Kubernetes could call them directly; 2020 K8s dropped dockershim, retiring "docker" as a runtime in production orchestration — but the image format stayed. In 2022 Docker Desktop's licensing change triggered a Podman / nerdctl migration wave at large companies, while small projects and individual developers kept Docker as the default.</p>
      </>
    ),
  },
  history: [
    { year: '2013·03', zh: { title: <>PyCon lightning talk</>, desc: <>Solomon Hykes 在 PyCon US 五分钟演示 Docker。dotCloud 把内部工具开源, GitHub 一周几千 star。</> }, en: { title: <>PyCon lightning talk</>, desc: <>Solomon Hykes demos Docker in five minutes at PyCon US. dotCloud open-sources the internal tool; thousands of GitHub stars in a week.</> } },
    { year: '2014·06', zh: { title: <>1.0 GA + Hub</>, desc: <>Docker 1.0 + Docker Hub 上线。"docker pull / push" 第一次让镜像跨机器流转成为日常操作。</> }, en: { title: <>1.0 GA + Hub</>, desc: <>Docker 1.0 and Docker Hub launch. "docker pull / push" makes images flow between machines as a routine action for the first time.</> } },
    { year: '2015·06', zh: { title: <>OCI 成立</>, desc: <>和 CoreOS 等共同成立 Open Container Initiative, 镜像 / runtime 规范捐给基金会。"容器" 不再是 Docker 独占词。</> }, en: { title: <>OCI founded</>, desc: <>With CoreOS and others, Docker co-founds the Open Container Initiative; image and runtime specs go to the foundation. "Container" stops being a Docker-owned word.</> } },
    { year: '2016·07', zh: { title: <>Swarm + compose v1</>, desc: <>1.12 把 swarm mode 集成进 daemon, docker-compose 普及到本地多容器场景。同年 Kubernetes 已开始反超 swarm。</> }, en: { title: <>Swarm + compose v1</>, desc: <>1.12 bakes swarm mode into the daemon; docker-compose becomes the default for local multi-container setups. Kubernetes already begins to overtake swarm the same year.</> } },
    { year: '2017·03', zh: { title: <>containerd 独立 + Moby</>, desc: <>containerd / runc 从 Docker 主仓库拆出。Moby Project 接管开源部分, Docker 公司聚焦商业产品。</> }, en: { title: <>containerd extracted + Moby</>, desc: <>containerd and runc are split out of the main Docker repo. The Moby Project takes over the open source side; Docker Inc focuses on commercial products.</> } },
    { year: '2018·05', zh: { title: <>BuildKit GA</>, desc: <>新一代 builder 默认启用并行构建、跨阶段缓存、secret / ssh 挂载。多阶段构建从此是 Dockerfile 的最佳实践。</> }, en: { title: <>BuildKit GA</>, desc: <>The next-gen builder defaults to parallel builds, cross-stage cache, and secret / ssh mounts. Multi-stage builds become the canonical Dockerfile pattern.</> } },
    { year: '2019·11', zh: { title: <>Mirantis 收购企业部</>, desc: <>Docker Inc 把企业产品 (Docker EE) 卖给 Mirantis, 自己专注开发者工具:Docker Desktop + Docker Hub + 开源 Engine。</> }, en: { title: <>Mirantis buys the enterprise unit</>, desc: <>Docker Inc sells Docker EE to Mirantis and refocuses on developer tools: Docker Desktop, Docker Hub, and the open-source Engine.</> } },
    { year: '2020·12', zh: { title: <>K8s 弃用 dockershim</>, desc: <>Kubernetes 1.20 宣布弃用 dockershim, 1.24 完全移除。生产编排从此直连 containerd / CRI-O, 镜像格式 (OCI) 仍是同一个。</> }, en: { title: <>K8s drops dockershim</>, desc: <>Kubernetes 1.20 deprecates dockershim; 1.24 removes it. Production orchestration now talks to containerd / CRI-O directly — the image format (OCI) stays the same.</> } },
    { year: '2022·02', zh: { title: <>Desktop 商业化 + compose v2</>, desc: <>Docker Desktop 对 250+ 人公司开始收费, 引发 Podman / Rancher Desktop 迁移潮。compose v2 用 Go 重写并集成进 docker CLI。</> }, en: { title: <>Desktop monetized + compose v2</>, desc: <>Docker Desktop starts charging companies with 250+ employees, triggering a Podman / Rancher Desktop migration wave. compose v2 is rewritten in Go and integrated into the docker CLI.</> } },
    { year: '2023·03', zh: { title: <>buildx + 多架构默认</>, desc: <>buildx 完全替代 legacy builder, 默认支持 amd64 + arm64 多架构构建 + 远端 cache。Apple Silicon 时代的 Docker 友好度大幅提升。</> }, en: { title: <>buildx + multi-arch by default</>, desc: <>buildx fully replaces the legacy builder; multi-arch (amd64 + arm64) builds and remote cache become defaults. Docker's Apple Silicon story finally feels good.</> } },
    { year: '2025·02', zh: { title: <>Engine 28</>, desc: <>28.0 大改 iptables 网络默认, 容器间出站隔离更严。生产环境 host networking 行为有 breaking change, 升级前需 audit。</> }, en: { title: <>Engine 28</>, desc: <>28.0 overhauls iptables defaults, with stricter inter-container egress isolation. Host networking gets breaking changes in production; pre-upgrade audit required.</> } },
    { year: '2026·02', highlight: true, zh: { title: <>Engine 29 — containerd 默认</>, desc: <>v29 把 containerd image store 设为新装机默认, 最低 API 升到 1.44。nftables 替代 iptables (实验), zstd 镜像层一线支持。</> }, en: { title: <>Engine 29 — containerd default</>, desc: <>v29 makes the containerd image store the default for new installs, bumps the minimum API to 1.44, and ships experimental nftables (in place of iptables) plus first-class zstd image layers.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>29.4.3 / Desktop 4.73</>, desc: <>2026-05-13 Engine 29.4.3 + Desktop 4.73 (2026-05-11)。Desktop 加 MCP Toolkit profile / 自定义 catalog, vLLM Metal 进 Model Runner。</> }, en: { title: <>29.4.3 / Desktop 4.73</>, desc: <>Engine 29.4.3 on 2026-05-13; Desktop 4.73 on 2026-05-11. Desktop adds MCP Toolkit profiles / custom catalogs and vLLM Metal in Model Runner.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>Dockerfile</>, desc: <>一行一指令的纯文本, 描述怎么从一个基镜像逐层叠出最终镜像。每行就是一个缓存层。</> }, en: { title: <>Dockerfile</>, desc: <>A plain-text file, one instruction per line, describing how to layer the final image on top of a base. Each line is a cache layer.</> }, code: <code>{k('FROM')} {v('node:22-alpine')}{'\n'}{k('WORKDIR')} {v('/app')}{'\n'}{k('COPY')} {v('package*.json')} {v('./')}{'\n'}{k('RUN')} {v('npm ci --omit=dev')}{'\n'}{k('COPY')} {v('. .')}{'\n'}{k('CMD')} [{s('"node"')}, {s('"server.js"')}]</code> },
    { tag: 'B', zh: { title: <>多阶段构建</>, desc: <>一个 Dockerfile 写多个 FROM, 前面阶段编译, 后面阶段只 COPY 产物。最终镜像不带编译工具链。</> }, en: { title: <>Multi-stage build</>, desc: <>One Dockerfile with multiple FROMs: earlier stages compile, later stages COPY only artifacts. The final image is free of build tooling.</> }, code: <code>{k('FROM')} {v('rust:1-bookworm')} {k('AS')} {v('build')}{'\n'}{k('WORKDIR')} {v('/src')}{'\n'}{k('COPY')} {v('. .')}{'\n'}{k('RUN')} {v('cargo build --release')}{'\n\n'}{k('FROM')} {v('debian:bookworm-slim')}{'\n'}{k('COPY')} {k('--from=')}{v('build')} {v('/src/target/release/app')} {v('/usr/local/bin/')}{'\n'}{k('CMD')} [{s('"app"')}]</code> },
    { tag: 'C', zh: { title: <>镜像 vs 容器</>, desc: <>镜像是只读层栈 + manifest;容器是镜像 + 一个可写层 + 一个进程。同一个镜像可以同时跑出几十个容器。</> }, en: { title: <>Image vs container</>, desc: <>An image is a stack of read-only layers + a manifest; a container is an image + a writable layer + a process. One image can spawn dozens of containers concurrently.</> }, code: <code>{f('docker')} build {k('-t')} {v('myapp:dev')} .{'\n'}{f('docker')} run {k('--rm -it')} {v('myapp:dev')}{'\n\n'}{c('# 镜像缓存 / containers 状态')}{'\n'}{f('docker')} images{'\n'}{f('docker')} ps {k('-a')}</code> },
    { tag: 'D', zh: { title: <>volume + bind mount</>, desc: <>volume 由 Docker 管理, 在 Mac/Win 上性能好;bind mount 直接挂宿主机目录, 适合 dev 实时编辑。</> }, en: { title: <>volume vs bind mount</>, desc: <>A volume is Docker-managed and fast on Mac / Windows; a bind mount maps a host directory directly, ideal for live-edit dev loops.</> }, code: <code>{c('# named volume (持久化)')}{'\n'}{f('docker')} run {k('-v')} {v('pgdata:/var/lib/postgresql/data')} ...{'\n\n'}{c('# bind mount (实时同步)')}{'\n'}{f('docker')} run {k('-v')} {s('"$PWD"')}{v(':/app')} ...</code> },
    { tag: 'E', zh: { title: <>compose</>, desc: <>用一份 YAML 起多个相互依赖的服务 (app + db + cache)。本地复刻一个微型生产拓扑。</> }, en: { title: <>compose</>, desc: <>One YAML brings up multiple interdependent services (app + db + cache). It reproduces a miniature production topology locally.</> }, code: <code>{k('services')}:{'\n'}  {k('api')}:{'\n'}    {k('build')}: .{'\n'}    {k('ports')}: [{s('"3001:3001"')}]{'\n'}    {k('depends_on')}: [db]{'\n'}  {k('db')}:{'\n'}    {k('image')}: {v('postgres:13')}{'\n'}    {k('volumes')}: [{v('pgdata:/var/lib/postgresql/data')}]{'\n'}{k('volumes')}:{'\n'}  {k('pgdata')}: {'{}'}</code> },
    { tag: 'F', zh: { title: <>BuildKit + buildx</>, desc: <>下一代 builder。并行构建、跨平台 (amd64 + arm64)、远端 cache、secret / ssh 挂载。29 之后默认走 containerd image store。</> }, en: { title: <>BuildKit + buildx</>, desc: <>Next-gen builder. Parallel stages, multi-platform (amd64 + arm64), remote cache, secret / ssh mounts. From v29 on, the containerd image store is the default.</> }, code: <code>{f('docker')} buildx build {'\\'}{'\n'}  {k('--platform')} {v('linux/amd64,linux/arm64')} {'\\'}{'\n'}  {k('--cache-to')} {v('type=registry,ref=...')} {'\\'}{'\n'}  {k('-t')} {v('me/app:1.0')} {k('--push')} .</code> },
    { tag: 'G', zh: { title: <>OCI + runc + containerd</>, desc: <>"Docker" 这个名字背后, 镜像格式是 OCI 标准, runtime 是 runc, daemon 是 containerd。Docker CLI 只是其中一个入口工具。</> }, en: { title: <>OCI + runc + containerd</>, desc: <>Behind the "Docker" name: the image format is OCI, the runtime is runc, the daemon is containerd. The Docker CLI is just one entry into that stack.</> }, code: <code>{c('// One spec, many runtimes:')}{'\n'}{c('//   docker / podman / nerdctl / kubelet')}{'\n'}{c('// all consume the same OCI image.')}</code> },
    { tag: 'H', zh: { title: <>healthcheck + restart</>, desc: <>容器自带 healthcheck 和 restart policy, 不健康时编排器自动重启 / 不路由流量。生产里几乎所有 service 都该写。</> }, en: { title: <>healthcheck + restart</>, desc: <>Containers carry a built-in healthcheck and a restart policy; orchestrators auto-restart or drop unhealthy ones from routing. Almost every production service should set both.</> }, code: <code>{k('HEALTHCHECK')} {k('--interval=')}{n('30')}{v('s')} {'\\'}{'\n'}  {k('--timeout=')}{n('3')}{v('s')} {'\\'}{'\n'}  {k('CMD')} curl {k('-f')} http://localhost:3001/health {'|| exit 1'}</code> },
  ],
  whyCards: [
    { icon: '⊞', zh: { title: <>开发 / 生产同一份镜像</>, desc: <>"本机能跑, 服务器跑不起来" 这句话在 Docker 之后基本退役。镜像把 OS / 依赖 / 二进制冻在一起, 任何 OCI runtime 上行为一致。</> }, en: { title: <>Same image dev → prod</>, desc: <>"Works on my machine" mostly retires after Docker. Images freeze OS, deps, and binary together — behavior is identical across any OCI runtime.</> }, code: <>{c('// dev:')}{'\n'}{f('docker')} run {v('myapp:1.0')}{'\n'}{c('// prod:')}{'\n'}{f('docker')} run {v('myapp:1.0')}</> },
    { icon: '⌬', zh: { title: <>事实标准 = 任何 CI 都接</>, desc: <>每家 CI、每家云、每家 PaaS 都接 OCI 镜像。本地写一个 Dockerfile, 同一份能在 GitHub Actions / GitLab CI / Cloud Run / Fly / Render 上跑。</> }, en: { title: <>De-facto standard — every CI accepts it</>, desc: <>Every CI, every cloud, every PaaS speaks OCI. Write a Dockerfile once and it runs on GitHub Actions, GitLab CI, Cloud Run, Fly, Render — all the same.</> }, code: <>{c('// .github/workflows')}{'\n'}{k('uses')}: {v('docker/build-push-action@v6')}</> },
    { icon: '⎇', zh: { title: <>层缓存让构建快</>, desc: <>Dockerfile 一行一层, 没变的层直接命中缓存。先 COPY package.json + install, 再 COPY 源码, 改源码不用重装依赖。</> }, en: { title: <>Layer cache makes builds fast</>, desc: <>One Dockerfile line, one layer; unchanged layers hit cache. COPY package.json + install first, then COPY source — source edits never re-run install.</> }, code: <>{k('COPY')} {v('package*.json')} ./{'\n'}{k('RUN')} {v('npm ci')}{'\n'}{k('COPY')} {v('. .')}</> },
    { icon: '⌁', zh: { title: <>compose 一键多服务</>, desc: <>本地起 app + PG + redis 不用写脚本, 一份 yml + 一句 <code>docker compose up</code> 就是完整拓扑。CI 测多服务联调也用同一份。</> }, en: { title: <>compose: one command, many services</>, desc: <>Bring up app + PG + redis locally without a single shell script — one YAML + <code>docker compose up</code> is the whole topology. CI integration tests reuse the same file.</> }, code: <>{f('docker')} compose up {k('-d')}{'\n'}{f('docker')} compose logs {k('-f')} api</> },
    { icon: '⌖', zh: { title: <>多架构构建零成本</>, desc: <>buildx 一条命令同时出 amd64 + arm64, Apple Silicon 本机起 ARM 镜像直接跑, 推到 Hub 后 x86 服务器拉到 x86 layer。</> }, en: { title: <>Multi-arch builds are free</>, desc: <>buildx emits amd64 + arm64 in one command. Apple Silicon runs ARM images natively; once pushed to Hub, an x86 server pulls the x86 layer.</> }, code: <>{f('docker')} buildx build {'\\'}{'\n'}  {k('--platform')} {v('linux/amd64,linux/arm64')}</> },
    { icon: '⌗', zh: { title: <>本地裸跑外部服务的标准方式</>, desc: <>需要一个 PG 13 / Redis / MinIO, 不想在系统里装、改、卸 —— 一句 docker run 几秒钟拉镜像、起来、用完一句 rm 干净。</> }, en: { title: <>Standard way to host external services locally</>, desc: <>Need a PG 13 / Redis / MinIO without installing, configuring, or uninstalling on the host — docker run pulls + starts in seconds; one rm wipes it clean.</> }, code: <>{f('docker')} run {k('-d')} {k('--name')} {v('pg13')} {'\\'}{'\n'}  {k('-p')} {v('5433:5432')} {v('postgres:13')}</> },
    { icon: '⏚', zh: { title: <>开发文档化 = Dockerfile</>, desc: <>"怎么跑起来" 不写 README, 写在 Dockerfile / compose.yml 里。新人 clone 完一句 up, 整个栈就在跑, 没有"先装 a 再装 b" 的踩坑。</> }, en: { title: <>Dockerfile is the onboarding doc</>, desc: <>"How to run it" stops being a README — it's the Dockerfile / compose.yml. A new hire clones, runs one up, the whole stack is up; no "install a then b" trail.</> }, code: <>{c('// README ↓')}{'\n'}{c('//   git clone …')}{'\n'}{c('//   docker compose up')}</> },
    { icon: '⛯', zh: { title: <>OCI 标准让供应商绑定弱化</>, desc: <>Podman / nerdctl / Lima / Rancher Desktop / Orbstack 都消费同一个镜像格式。Docker Desktop 收费时迁出去不疼, 镜像不用变。</> }, en: { title: <>OCI standard erases vendor lock-in</>, desc: <>Podman, nerdctl, Lima, Rancher Desktop, Orbstack — all consume the same image format. When Docker Desktop's licensing changed, migrating off was painless because images didn't change.</> }, code: <>{c('// same image works on:')}{'\n'}{c('//   podman / nerdctl / orbstack')}</> },
    { icon: '⚐', zh: { title: <>AI 工具默认会写 Dockerfile</>, desc: <>LLM 训练数据里 Dockerfile 极多, Claude Code / Cursor 给任何项目生成的 Dockerfile 几乎都能一次 build 成。容器化的入门门槛被 AI 进一步压低。</> }, en: { title: <>AI tools default to Dockerfiles</>, desc: <>Dockerfiles are everywhere in LLM training data; Claude Code / Cursor will emit a build-ready Dockerfile for almost any project. The on-ramp to containerization keeps falling.</> }, code: <>{c('// "Containerize this Node app"')}{'\n'}{c('// LLMs almost always succeed')}</> },
  ],
  adopters: [
    { name: 'GitHub Actions', href: 'https://docs.github.com/actions', highlight: true, zhNote: '每个 runner 跑容器, Docker action 是一等公民', enNote: 'Every runner runs containers; Docker actions are first-class' },
    { name: 'GitLab CI', href: 'https://docs.gitlab.com/ee/ci/', zhNote: '每个 job 默认 docker executor', enNote: 'Every CI job defaults to a docker executor' },
    { name: 'Kubernetes', href: 'https://kubernetes.io', highlight: true, zhNote: 'OCI 镜像就是 K8s 的部署单元', enNote: 'OCI images are the K8s deploy unit' },
    { name: 'Fly.io', href: 'https://fly.io', zhNote: 'Dockerfile → 全球边缘 VM, 一键部署', enNote: 'Dockerfile → global edge VMs in one command' },
    { name: 'Render', href: 'https://render.com', zhNote: 'PaaS, 接 Dockerfile / 仓库自动构建', enNote: 'PaaS that auto-builds from Dockerfile / repo' },
    { name: 'Railway', href: 'https://railway.app', zhNote: 'Heroku 风 PaaS, 容器化为底', enNote: 'Heroku-style PaaS, container-native underneath' },
    { name: 'Vercel build container', href: 'https://vercel.com', zhNote: 'build 阶段每个项目跑独立容器', enNote: 'Each project builds inside its own container' },
    { name: 'HuggingFace Spaces', href: 'https://huggingface.co/spaces', zhNote: 'Docker SDK 选项支撑自定义 ML demo', enNote: 'Docker SDK option powers custom ML demos' },
    { name: 'Claude Code sandbox', href: 'https://github.com/anthropics/claude-code', zhNote: 'Anthropic CLI 的隔离执行环境基于容器', enNote: 'The agent’s isolated execution layer is container-based' },
    { name: 'Postgres Hub image', href: 'https://hub.docker.com/_/postgres', zhNote: '官方镜像月拉取 5 亿+, 业内常态', enNote: '500M+ pulls/month on the official image — table stakes' },
    { name: 'nginx Hub image', href: 'https://hub.docker.com/_/nginx', zhNote: '同上, web server 标配运行方式', enNote: 'Same scale — the standard way to ship a web server' },
    { name: 'Testcontainers', href: 'https://testcontainers.com', zhNote: '测试时按需起真实 PG/Kafka, 不再 mock', enNote: 'Spin up real PG/Kafka during tests — no more mocks' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本机 pg13 容器做 schema / migration dry-run', enNote: 'Local pg13 container for schema / migration dry-runs' },
  ],
  outlook: [
    { tag: <>HOT · 2026-02</>, hot: true, big: true, zh: { title: <>Engine 29 — containerd image store 默认</>, body: <><p>v29 是个分水岭:新装机默认走 containerd image store, classic graphdriver 进入维护模式。意味着 Docker / Kubernetes / nerdctl 三家终于在 image storage 这一层完全同源, 镜像 push/pull 行为更可预测, OCI artifact 这种"不止是容器镜像"的对象 (helm chart / WASM 模块) 也能放进来。</p><p>同时最低 API 升到 1.44, v25 以下 EOL。生产端在升级前必须 audit 一下还有没有客户端在用老 API。</p></> }, en: { title: <>Engine 29 — containerd image store default</>, body: <><p>v29 is a watershed: the containerd image store is the new-install default; the classic graphdriver enters maintenance. Docker / Kubernetes / nerdctl finally share the same image-storage layer, push / pull becomes more predictable, and OCI artifacts (helm charts, WASM modules — not only container images) can live in the same store.</p><p>The minimum API bumps to 1.44 and anything below v25 is EOL. Production sites should audit for old API clients before upgrading.</p></> } },
    { tag: 'BUILD', zh: { title: <>BuildKit + zstd + nydus</>, body: <><p>BuildKit 已经是默认 builder。下一步是 zstd 压缩层 (拉取速度提升 30-50%) 和 nydus 这类按需加载的 lazy image format —— 镜像数 GB 但启动只下到刚开机要用的几十 MB。冷启动 / serverless 容器场景受益最大。</p></> }, en: { title: <>BuildKit + zstd + nydus</>, body: <><p>BuildKit is already the default builder. Next stops are zstd-compressed layers (30-50% pull speedup) and on-demand image formats like nydus — multi-GB images that fetch only the tens of MB needed at boot. Cold-start and serverless containers benefit the most.</p></> } },
    { tag: 'DAEMONLESS', zh: { title: <>Podman / nerdctl 在 dev 端起来</>, body: <><p>Docker Desktop 2022 收费后, 大公司开发机批量迁到 Podman (无 daemon, 用户态 rootless) 和 Rancher Desktop / Orbstack。镜像格式没变, CLI 子集 兼容, 迁移成本只在 dev 端。生产端依然 containerd / K8s, 大局未变。</p></> }, en: { title: <>Daemonless gains on dev</>, body: <><p>After Docker Desktop's 2022 license change, large companies migrated dev machines to Podman (no daemon, rootless) and Rancher Desktop / Orbstack. Image format stays, CLI subsets overlap; the cost lives on dev only. Production is still containerd / K8s — no shift there.</p></> } },
    { tag: <>SECURITY</>, zh: { title: <>rootless + 镜像签名常态化</>, body: <><p>Rootless container (Docker 20.10+ / Podman) 在生产逐步默认开;镜像签名 (cosign / sigstore) 成为合规要求。Supply chain 攻击面被压窄, 但需要 CI 改写流水线 —— "build → sign → push → admission controller verify" 四步成新标准。</p></> }, en: { title: <>Rootless + signed images go mainstream</>, body: <><p>Rootless containers (Docker 20.10+ / Podman) become a production default; image signing (cosign / sigstore) becomes a compliance baseline. Supply-chain surface narrows, but CI pipelines must change: "build → sign → push → admission-controller verify" is the new four-step standard.</p></> } },
    { tag: <>AI</>, zh: { title: <>Model Runner + MCP Toolkit</>, body: <><p>Docker Desktop 4.x 加进 Docker Model Runner (本地跑 LLM, 支持 vLLM Metal / CUDA) 和 MCP Toolkit (管理 MCP server 集合)。把 "用容器跑 AI 模型" 推到本地默认体验。和 Ollama / LM Studio 这些专用工具竞争, 但赌的是开发者已经熟 docker CLI 这一点。</p></> }, en: { title: <>Model Runner + MCP Toolkit</>, body: <><p>Docker Desktop 4.x adds Docker Model Runner (run LLMs locally with vLLM Metal / CUDA) and the MCP Toolkit (manage MCP server collections). "Container runs the AI model" becomes the default local experience. Competes with Ollama / LM Studio, betting on developer familiarity with the docker CLI.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 用 Docker 的范围非常窄, 只在<strong>本地开发机</strong>。开发依赖的 PostgreSQL 13 在生产 VM 上是裸装进程, 本地用一个常驻容器 <code>pg13</code> 跑同版本镜像, 端口映 5433、密码 <code>dev</code>、数据库 <code>cuberoot_db</code>, 用来在改 schema / 写 migration / 调 load.sql 时先打一遍。生产 PG 升或加索引前, 同样的 SQL 先在这个容器里跑通, 才考虑往 prod 推。</p>
        <p>生产 VM <strong>没有用 Docker</strong>。nginx 是 systemd 管的原生服务, Hono API 是 pm2 启动的 Node 进程, PostgreSQL 13 是 apt / dnf 装的原生数据库。原因是单机部署、流量规模有限、运维只一个人, 多加一层容器化只会增加调试链路 (日志位置 / 网络命名空间 / volume 挂载) 而没有任何收益。等什么时候要横向扩到第二台机器、需要 image rollback 时再考虑容器化。</p>
        <p>CI 这块, GitHub Actions runner 本身就跑在容器里, 所以 stats-build 流水线 (压几十 GB 的 WCA dump、跑 SQL、产出 JSON) 是天然 isolated 的, 不需要本地 Docker 介入。client typecheck / test 也是 runner 的 ephemeral 容器环境, 完了即丢。</p>
        <p>个人开发还有一个常见用法是用 <code>docker run --rm</code> 起一次性的 utility 容器 (临时跑个 jq / yq / pandoc / 不想装到主机的 CLI), 但这跟 cuberoot.me 这个项目本身没强绑定。</p>
      </>
    ),
    en: (
      <>
        <p>cuberoot.me uses Docker narrowly — <strong>only on the dev machine</strong>. Production PostgreSQL 13 runs as a bare process on the VM; locally a long-lived container <code>pg13</code> runs the matching image with port 5433, password <code>dev</code>, database <code>cuberoot_db</code>. Whenever a schema change, migration, or load.sql tweak is in flight, it gets dry-run against this container first. Anything destined for prod PG (column adds, new indexes) clears the local container before being pushed.</p>
        <p>The production VM <strong>does not run Docker</strong>. nginx is a native systemd service, the Hono API is a Node process managed by pm2, PostgreSQL 13 is the distro-package install. The reasoning: single-host deploy, modest traffic, single-operator ops — adding a container layer would only stretch the debug path (log paths, network namespaces, volume mounts) for zero gain. The day this site scales to a second machine or wants image rollbacks, containerization moves on the table.</p>
        <p>For CI, GitHub Actions runners are themselves containerized, so the stats-build pipeline (chewing through multi-GB WCA dumps, running SQL, emitting JSON) is naturally isolated — no local Docker required. Client typecheck / test run in the same ephemeral runner containers.</p>
        <p>One adjacent dev habit is firing one-shot utility containers with <code>docker run --rm</code> (jq / yq / pandoc / random CLI you don't want on the host), but that's not specific to this project.</p>
      </>
    ),
  },
  links: [
    { label: 'docker.com', href: 'https://www.docker.com' },
    { label: 'GitHub · moby/moby', href: 'https://github.com/moby/moby' },
    { label: 'Docker Engine v29 release notes', href: 'https://docs.docker.com/engine/release-notes/29/' },
    { label: 'Docker Desktop release notes', href: 'https://docs.docker.com/desktop/release-notes/' },
    { label: 'OCI spec', href: 'https://opencontainers.org' },
  ],
};

export default DOCKER;
