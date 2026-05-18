import type { StackTool } from '../stack_tool_types';
import { k, s, f, c } from '../stack_tool_types';

// ─── uv (Astral) ────────────────────────────────────────────────────────────

export const UV: StackTool = {
  slug: 'uv',
  name: 'uv',
  version: '0.11.14',
  since: '2024-02',
  group: 'dev',
  accent: '#DE5FE9',
  bright: '#EA8AF3',
  glyph: '✦',
  floats: ['uv pip', 'uv venv', 'uv run', 'uv python', 'uv tool', 'uv lock', 'uv sync', 'pyproject.toml', 'PEP 723', 'workspaces', 'uvx', 'Rust'],
  zh: {
    tagline: 'pip + virtualenv + pipx + pyenv 一个 Rust 二进制全替了',
    role: '管理 Python 工具链 + 依赖 + venv。本站脚本以后会迁过去, 现在还是 plain python3。',
    heroSub: <>Astral 2024 年 2 月扔出来的 Rust 重写, 起点是 "pip 的 drop-in 替代", 两年后已经把 pip / pip-tools / virtualenv / pipx / pyenv 五个工具的活儿全接走 —— 装包快 10-100 倍, 解析器干净, 还能直接帮你装 Python 解释器本身。</>,
    whatDesc: <>uv 不是 pip 的小补丁, 是 <strong>Python 打包链整条重写</strong>。一个 Rust 二进制, 没有 Python 本身的依赖 (它自己能去下 CPython), 把 "建 venv → 锁依赖 → 装包 → 跑脚本 → 装命令行工具 → 切 Python 版本" 全部塞进同一个 CLI。</>,
    historyDesc: <>2024-02 第一版只敢说 "pip 替代品", 2024-08 加 project + workspace + 自管 Python, 2025 一路把 pipx / pyenv / poetry 的角色都接过来。2025-08 推出 pyx 商业 registry, 2026-03 OpenAI 收购 Astral —— uv 仍开源、仍 0.x。</>,
    conceptsTitle: '七个子命令拼起来',
    conceptsDesc: <>uv 的 CLI 表面其实很小:<code>uv pip</code> 兼容旧 workflow, <code>uv venv / run / sync / lock / python / tool</code> 各管一块, <code>uvx</code> 是 <code>pipx run</code> 的同义快捷。组合起来覆盖从一次性脚本到 monorepo 的所有路径。</>,
    whyDesc: <>2026 年再开 Python 项目, 选 uv 不是因为它"新潮", 是因为它把 <strong>速度</strong>、<strong>可复现性</strong>、<strong>工具收敛</strong> 三件事同时解了 —— 一个二进制, 一个 lockfile, 装包从分钟级降到秒级。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>FastAPI / Pydantic / Hugging Face 官方文档里已经把 uv 当首选, Jane Street 拿它做 monorepo 内核, OpenAI 索性把 Astral 整个买了。两年时间从 0 到 PyPI 10% 流量。</>,
    cuberootDesc: <>本站 <code>scripts/</code> 下有 3 个 Python 脚本 (拉 WCA 比赛、生成中文翻译、build attempts), 目前还是裸 <code>python3 build_wca_attempts.py</code> 跑的, 没 <code>pyproject.toml</code> 也没 <code>uv.lock</code>。uv 是下一步替换方向, 不是已经在用。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>2026 上半年 uv 还在 0.11.x, 没有 1.0, 但 PyPI 流量、官方文档示例、新教程几乎一边倒倒向它。OpenAI 收购后保持开源 + 加大投入 + 推自家 registry, 接下来一两年大概率把 pip 挤到"兼容遗产"位置。</>,
  },
  en: {
    tagline: 'pip + virtualenv + pipx + pyenv, replaced by one Rust binary',
    role: 'Python toolchain + deps + venvs in one binary. The site’s scripts are still on plain python3 — uv is the migration plan.',
    heroSub: <>Astral dropped uv in February 2024 as a Rust-written pip replacement. Two years on, it has absorbed pip, pip-tools, virtualenv, pipx, and pyenv into a single binary — 10-100x faster installs, a clean resolver, and it even installs the Python interpreter for you.</>,
    whatDesc: <>uv isn’t a pip patch — it’s a <strong>full rewrite of the Python packaging chain</strong>. One Rust binary, no Python bootstrap requirement (it can download CPython itself), and one CLI that covers "make a venv → lock deps → install → run script → install CLI tools → switch Python versions."</>,
    historyDesc: <>2024-02 launched as just "a faster pip." 2024-08 grew project + workspace + managed Python. By 2025 it had also taken over pipx / pyenv / poetry roles. August 2025 brought pyx (commercial registry). March 2026 OpenAI acquired Astral — uv stays open source, still 0.x.</>,
    conceptsTitle: 'Seven subcommands, composed',
    conceptsDesc: <>The user-facing CLI is small: <code>uv pip</code> handles legacy flows, <code>uv venv / run / sync / lock / python / tool</code> each own one slice, and <code>uvx</code> is the shorthand for <code>pipx run</code>. Composed, they cover one-off scripts up through monorepos.</>,
    whyDesc: <>Picking uv in 2026 isn’t about being trendy — it solves <strong>speed</strong>, <strong>reproducibility</strong>, and <strong>tool consolidation</strong> simultaneously: one binary, one lockfile, installs go from minutes to seconds.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>FastAPI / Pydantic / Hugging Face docs all recommend uv first. Jane Street runs it as the core of their Python monorepo. OpenAI just bought Astral outright. Two years in, uv accounts for over 10% of PyPI traffic.</>,
    cuberootDesc: <>The site has 3 Python scripts in <code>scripts/</code> (fetch WCA comps, generate zh translations, build attempts JSON). They still run as plain <code>python3 build_wca_attempts.py</code> — no <code>pyproject.toml</code>, no <code>uv.lock</code> yet. uv is the obvious next step, not the current state.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Mid-2026 uv is still on 0.11.x with no 1.0 in sight, yet PyPI traffic, official-doc examples, and new tutorials lean overwhelmingly toward it. With OpenAI keeping it open source while adding investment and pushing pyx, pip is on track to become the "legacy compatibility" option within a year or two.</>,
  },
  heroStats: [
    { num: '10-100', unit: '×', zh: <>装包速度 vs pip <em>10-100 倍</em></>, en: <>install speed vs pip <em>10-100x</em></> },
    { num: '10', unit: '%', zh: <>PyPI 流量占比 <em>2025-08 Astral 数据</em></>, en: <>of PyPI traffic <em>2025-08 Astral figures</em></> },
    { num: '2.3', unit: 'y', zh: <>从 2024-02 至今 <em>已替代 5 个工具</em></>, en: <>since 2024-02 <em>replaced 5 tools</em></> },
    { num: '0', unit: '.11.14', zh: <>当前稳定版 <em>2026-05-12</em></>, en: <>current stable <em>2026-05-12</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>Astral 是 Charlie Marsh 2022 年开的公司, 第一个产品是 Rust 写的 Python linter <code>ruff</code> —— 把 Python 生态 "用 Rust 重写 + 速度上一个数量级" 这条路趟通了。2024 年初他们瞄准了下一块更大的硬骨头:Python 打包。</p>
        <p>当时的 Python 打包生态有多碎? 装包用 pip, 锁版本用 pip-tools, 隔离环境用 virtualenv, 全局命令行工具用 pipx, 换 Python 版本用 pyenv, 写"现代"项目还要再选 poetry / pdm / hatch / rye。每个工具自己一套 mental model, 互相能用但不顺。uv 在 2024-02-15 公开亮相, 第一版只是 "pip 替代品", 但速度差距大到所有人立刻注意到 —— 装 transformers + torch 这种重型依赖, pip 跑 90 秒, uv 跑 3 秒。</p>
        <p>之后两年里 uv 不停往外扩:8 月份加了 project + workspace + 自管 Python 解释器, 一夜之间把 poetry / pyenv 也放进同一个二进制;再之后接了 pipx 的活儿 (<code>uv tool install</code> / <code>uvx</code>), 接了 PEP 723 inline script (脚本顶部写一段 TOML 声明依赖, <code>uv run script.py</code> 自动建临时环境)。2026-03 OpenAI 收购 Astral, uv / ruff / ty 继续开源 —— 这是 Python 工具链十年内最大的一次整合。</p>
      </>
    ),
    en: (
      <>
        <p>Astral is Charlie Marsh’s company, founded in 2022. Their first product was <code>ruff</code>, a Rust-written Python linter that proved out one playbook: rewrite Python tooling in Rust and ship an order-of-magnitude speedup. In early 2024 they aimed at the next, larger bone: Python packaging.</p>
        <p>How fragmented was Python packaging? pip for installs, pip-tools for lockfiles, virtualenv for isolation, pipx for global CLIs, pyenv for switching Python versions, and for a "modern" project you still had to pick between poetry / pdm / hatch / rye. Each tool brought its own mental model. uv launched on 2024-02-15 as just a pip replacement, but the speed gap was loud — installing transformers + torch dropped from ~90 seconds on pip to ~3 seconds on uv.</p>
        <p>Over the next two years uv kept expanding. August 2024 added project + workspace + managed Python interpreters, folding poetry / pyenv into the same binary overnight. Then came the pipx role (<code>uv tool install</code> / <code>uvx</code>) and PEP 723 inline scripts (write a TOML block at the top of a .py file, <code>uv run script.py</code> spins an ephemeral env automatically). March 2026 OpenAI acquired Astral; uv / ruff / ty stay open source — the largest single consolidation of Python tooling in a decade.</p>
      </>
    ),
  },
  history: [
    { year: '2022', zh: { title: <>Astral 成立, ruff 先行</>, desc: <>Charlie Marsh 离开 Spring Discovery 开公司, 第一个产品是 Rust 写的 Python linter ruff。"用 Rust 重写 Python 工具" 这条路从这里跑通。</> }, en: { title: <>Astral founded, ruff first</>, desc: <>Charlie Marsh leaves Spring Discovery to found Astral. First product: ruff, a Rust-written Python linter. The "rewrite Python tools in Rust" playbook begins here.</> } },
    { year: '2024-02', zh: { title: <>uv 公开发布</>, desc: <>2024-02-15 第一版 0.1.0 上线, 定位 "pip / pip-tools 的 drop-in 替代"。重型依赖装包从 90 秒级降到秒级, 当天 Hacker News 头条。</> }, en: { title: <>uv goes public</>, desc: <>2024-02-15 ships 0.1.0, positioned as a drop-in replacement for pip / pip-tools. Heavy installs drop from ~90s to seconds. Hacker News front page that day.</> } },
    { year: '2024-05', zh: { title: <>接管 Rye</>, desc: <>Astral 从 Armin Ronacher 手里接过 Rye 的维护权, 计划把 Rye 的"统一项目管理"思路融进 uv。</> }, en: { title: <>Takes over Rye</>, desc: <>Astral takes stewardship of Armin Ronacher’s Rye, planning to fold its "unified project manager" model into uv.</> } },
    { year: '2024-08', zh: { title: <>0.3 — project + workspace</>, desc: <>uv 不再只是 pip 替代:加 pyproject.toml 项目管理、Cargo 风格 workspace、自动下载 + 管理 CPython 解释器、<code>uv run</code> / <code>uv sync</code> / <code>uv lock</code> 全套上线。</> }, en: { title: <>0.3 — project + workspace</>, desc: <>uv stops being "just a pip replacement": pyproject.toml project management, Cargo-style workspaces, automatic CPython download + management, full <code>uv run</code> / <code>uv sync</code> / <code>uv lock</code> set lands.</> } },
    { year: '2024-10', zh: { title: <>0.4 — uv tool / uvx</>, desc: <>把 pipx 的角色接过来:<code>uv tool install ruff</code> 全局装 CLI 工具, <code>uvx black .</code> 临时跑一次, 完全不污染当前 env。</> }, en: { title: <>0.4 — uv tool / uvx</>, desc: <>Takes over pipx’s job: <code>uv tool install ruff</code> for global CLI installs, <code>uvx black .</code> for one-off runs that don’t touch the current env.</> } },
    { year: '2024-12', zh: { title: <>0.5 — PEP 723 inline script</>, desc: <>支持脚本顶部内嵌 TOML 元数据, <code>uv run script.py</code> 直接按声明的依赖建临时 venv 跑。单文件分发 Python 脚本变得真正可行。</> }, en: { title: <>0.5 — PEP 723 inline scripts</>, desc: <>Supports inline TOML metadata at the top of a script; <code>uv run script.py</code> spins an ephemeral venv from the declared deps. Single-file Python script distribution becomes truly viable.</> } },
    { year: '2025-04', zh: { title: <>0.7 — torch / GPU 友好</>, desc: <>原生处理 PyTorch 这类多 index + GPU 变体场景, 不用再手写 extra-index-url 配置。AI / ML 领域全面跟进。</> }, en: { title: <>0.7 — torch / GPU friendly</>, desc: <>First-class support for PyTorch-style multi-index + GPU variant scenarios; no more hand-rolled extra-index-url config. AI / ML adoption accelerates.</> } },
    { year: '2025-08', zh: { title: <>pyx beta 发布</>, desc: <>Astral 推出 pyx, 一个 Python 原生的私有 / 加速 package registry, 跟 uv 深度配合。这是 Astral 第一个商业产品, uv / ruff 仍开源。</> }, en: { title: <>pyx beta launches</>, desc: <>Astral ships pyx, a Python-native private + accelerated registry tightly integrated with uv. First commercial product from Astral; uv / ruff stay open source.</> } },
    { year: '2025-11', zh: { title: <>0.10 — FastAPI/HF 钦定</>, desc: <>FastAPI 官方教程改成 uv, Hugging Face Inference Endpoints 文档改成 uv sync。"现代 Python 项目默认 uv" 在头部社区落地。</> }, en: { title: <>0.10 — FastAPI/HF endorse</>, desc: <>FastAPI’s official tutorial moves to uv. Hugging Face Inference Endpoints docs switch to uv sync. "Modern Python project = uv" lands in the headline communities.</> } },
    { year: '2026-01', zh: { title: <>0.11.0</>, desc: <>2026 年初版本号进入 0.11.x。Python 3.14 支持、lockfile schema 稳定、workspace 嵌套场景修一批边界 bug。</> }, en: { title: <>0.11.0</>, desc: <>Early 2026 the version bumps to 0.11.x. Python 3.14 support, lockfile schema stabilizes, nested workspace edge cases get cleaned up.</> } },
    { year: '2026-03', zh: { title: <>OpenAI 收购 Astral</>, desc: <>OpenAI 把 Astral 整个买下。Charlie Marsh 公开承诺 uv / ruff / ty 继续开源, 团队继续运营, 资源加大。Python 社区松一口气。</> }, en: { title: <>OpenAI acquires Astral</>, desc: <>OpenAI acquires Astral outright. Charlie Marsh publicly commits uv / ruff / ty stay open source, team keeps operating, resources increase. Python community exhales.</> } },
    { year: '2026-05', highlight: true, zh: { title: <>0.11.14 / 当前稳定</>, desc: <>2026-05-12 最新点 release。修了 Python 3.14 GC 在生产里的内存压力问题, mirror self-update 走 Astral CDN。仍是 0.x, 但已稳如 1.x。</> }, en: { title: <>0.11.14 / current stable</>, desc: <>Latest patch on 2026-05-12. Addresses Python 3.14 GC memory-pressure regressions, routes self-update through Astral’s mirror. Still 0.x, but production-stable.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>uv pip</>, desc: <>pip 的同名子命令, 接口一致, 速度 10-100 倍。最低门槛迁移:把脚本里 <code>pip install</code> 改成 <code>uv pip install</code> 就完。</> }, en: { title: <>uv pip</>, desc: <>The pip-compatible subcommand. Same interface, 10-100x faster. Lowest-friction migration: change <code>pip install</code> to <code>uv pip install</code> and done.</> }, code: <code>{f('uv')} pip install {s('"requests==2.32.*"')}{'\n'}{f('uv')} pip compile requirements.in {'>'}  requirements.txt{'\n'}{f('uv')} pip sync requirements.txt</code> },
    { tag: 'B', zh: { title: <>uv venv</>, desc: <>建虚拟环境, 比 <code>python -m venv</code> 快一个数量级。默认 <code>.venv/</code>, 跟 VS Code / direnv 约定相同。</> }, en: { title: <>uv venv</>, desc: <>Create a virtualenv — an order of magnitude faster than <code>python -m venv</code>. Defaults to <code>.venv/</code>, matching VS Code / direnv conventions.</> }, code: <code>{f('uv')} venv --python 3.13{'\n'}source .venv/bin/activate{'\n'}{c('# 没装 3.13? uv 自己下')}</code> },
    { tag: 'C', zh: { title: <>uv run</>, desc: <>在项目 venv 里跑命令, 不需要先 activate。脚本依赖缺啥它当场补。同步 lockfile + 跑命令一步完成。</> }, en: { title: <>uv run</>, desc: <>Run a command inside the project venv without activating it. Missing deps are installed on the fly. Lockfile sync + execution happen in one step.</> }, code: <code>{f('uv')} run pytest{'\n'}{f('uv')} run python build_wca_attempts.py{'\n'}{f('uv')} run --with httpx python -c {s('"import httpx; print(httpx.__version__)"')}</code> },
    { tag: 'D', zh: { title: <>uv python</>, desc: <>uv 自己管 Python 解释器, 完全替代 pyenv。<code>uv python install 3.13</code> 下并装, 跨平台一致。</> }, en: { title: <>uv python</>, desc: <>uv manages Python interpreters itself, fully replacing pyenv. <code>uv python install 3.13</code> downloads and installs cross-platform.</> }, code: <code>{f('uv')} python install 3.13 3.14{'\n'}{f('uv')} python list{'\n'}{f('uv')} python pin 3.13</code> },
    { tag: 'E', zh: { title: <>uv tool / uvx</>, desc: <>替代 pipx:<code>uv tool install</code> 全局装 CLI, 每个工具自己一个隔离 venv。<code>uvx</code> 是 <code>uv tool run</code> 的快捷, 一次性跑不留痕。</> }, en: { title: <>uv tool / uvx</>, desc: <>Replaces pipx: <code>uv tool install</code> installs CLIs globally, each in its own isolated venv. <code>uvx</code> is shorthand for <code>uv tool run</code> — one-off, leaves nothing behind.</> }, code: <code>{f('uv')} tool install ruff{'\n'}{f('uvx')} black --check .{'\n'}{f('uv')} tool upgrade --all</code> },
    { tag: 'F', zh: { title: <>uv lock + uv sync</>, desc: <>Cargo 风格:<code>uv lock</code> 生成 <code>uv.lock</code> 锁住整图依赖, <code>uv sync</code> 让 venv 精确匹配。CI / 本地 / 同事环境字节级一致。</> }, en: { title: <>uv lock + uv sync</>, desc: <>Cargo-style: <code>uv lock</code> writes <code>uv.lock</code> pinning the full graph; <code>uv sync</code> brings the venv to exact parity. CI / local / teammate environments match byte-for-byte.</> }, code: <code>{f('uv')} lock{'\n'}{f('uv')} sync{'\n'}{f('uv')} sync --frozen  {c('// CI 用, 不允许重解析')}</code> },
    { tag: 'G', zh: { title: <>pyproject.toml + workspace</>, desc: <>项目根 <code>pyproject.toml</code> 声明依赖, monorepo 用 <code>[tool.uv.workspace]</code> 串多个子包共享一份 lockfile。Cargo workspace 思路移植过来。</> }, en: { title: <>pyproject.toml + workspace</>, desc: <>Root <code>pyproject.toml</code> declares deps. For monorepos, <code>[tool.uv.workspace]</code> ties multiple sub-packages to one shared lockfile. The Cargo workspace model, ported.</> }, code: <code>[{k('tool.uv.workspace')}]{'\n'}members = [{s('"scripts/*"')}, {s('"core/packages/*"')}]</code> },
    { tag: 'H', zh: { title: <>PEP 723 inline script</>, desc: <>脚本顶部嵌一段 TOML 声明依赖 + Python 版本, <code>uv run script.py</code> 自动建临时 venv 跑完丢掉。单文件 Python 工具的标准做法。</> }, en: { title: <>PEP 723 inline scripts</>, desc: <>Embed a TOML block at the top of a script declaring deps + Python version; <code>uv run script.py</code> spins an ephemeral venv, runs, discards. The standard form for single-file Python tools.</> }, code: <code>{c('# /// script')}{'\n'}{c('# requires-python = ">=3.13"')}{'\n'}{c('# dependencies = ["httpx", "rich"]')}{'\n'}{c('# ///')}{'\n'}{k('import')} httpx, rich</code> },
    { tag: 'I', zh: { title: <>uvx 一次性</>, desc: <>跟 npx 同义。装都不装, 当场拉 wheel 跑一次, 跑完丢。临时验证脚本 / 一次性数据清洗最爽。</> }, en: { title: <>uvx one-off</>, desc: <>Same idea as npx. No install — fetch the wheel, run once, discard. Ideal for quick verification scripts or one-off data tasks.</> }, code: <code>{f('uvx')} cowsay {s('"hello"')}{'\n'}{f('uvx')} --from {s('"git+https://..."')} my-tool</code> },
  ],
  whyCards: [
    { icon: '✦', zh: { title: <>10-100 倍速度差</>, desc: <>装 transformers + torch + pandas 这种重型依赖, pip ~90 秒, uv ~3 秒。差距不是优化, 是写法重做 —— Rust + 并行下载 + 全局 wheel cache。</> }, en: { title: <>10-100x speed gap</>, desc: <>Installing transformers + torch + pandas: pip ~90s, uv ~3s. The gap isn’t optimization — it’s a rewrite. Rust + parallel downloads + a global wheel cache.</> }, code: <>{c('// pip: 90s')}{'\n'}{c('// uv:  3s')}</> },
    { icon: '◇', zh: { title: <>一个二进制收编五个工具</>, desc: <>pip / pip-tools / virtualenv / pipx / pyenv 五个独立工具的责任全归 uv。新机器装一个 <code>uv</code> 二进制, 别的都不用装。</> }, en: { title: <>One binary, five tools absorbed</>, desc: <>pip / pip-tools / virtualenv / pipx / pyenv — all collapsed into uv. On a fresh machine you install one <code>uv</code> binary; nothing else.</> }, code: <>{f('curl')} -LsSf astral.sh/uv/install.sh | sh</> },
    { icon: '◈', zh: { title: <>uv.lock 字节级可复现</>, desc: <>Cargo / pnpm 那套锁文件哲学终于到 Python:整图哈希、跨 OS 字节一致、CI 用 <code>--frozen</code> 拒绝重解析。"我这能跑" 终于跟"你那也能跑"画等号。</> }, en: { title: <>Byte-reproducible uv.lock</>, desc: <>The Cargo / pnpm lockfile philosophy finally reaches Python: hashed full graph, cross-OS byte-equal, <code>--frozen</code> in CI rejects re-resolution. "Works on my machine" finally equals "works on yours."</> }, code: <>{f('uv')} sync --frozen{'\n'}{c('// CI 默认这一行')}</> },
    { icon: '◉', zh: { title: <>自管 Python 解释器</>, desc: <>uv 自己下 CPython, 整机上可以完全没有系统 Python。这条对 Windows / macOS 用户尤其大 —— 不用动 system Python, 不用走 Homebrew, 不用 pyenv 配 shim。</> }, en: { title: <>Manages CPython itself</>, desc: <>uv downloads CPython on its own — your machine can have zero system Python. Especially valuable on Windows / macOS: no touching system Python, no Homebrew, no pyenv shim wiring.</> }, code: <>{f('uv')} python install 3.13{'\n'}{c('// 系统里完全没 python? 没事')}</> },
    { icon: '◊', zh: { title: <>resolver 干净</>, desc: <>PubGrub 风格的真 SAT 解析器, 冲突时给出可读的链, 不像旧 pip 抛"could not find a version"了事。版本冲突第一次能看懂为啥。</> }, en: { title: <>Clean resolver</>, desc: <>A real PubGrub-style SAT resolver. On conflicts you get a readable chain instead of pip’s "could not find a version" shrug. The first time version conflicts are debuggable.</> }, code: <>{c('// Because A 1.x requires B<2,')}{'\n'}{c('// and C 1.x requires B>=2, ...')}</> },
    { icon: '✺', zh: { title: <>PEP 723 让脚本独立</>, desc: <>单文件 Python 工具不再需要"先 pip install xxx"前置说明。脚本自带依赖声明, 给同事一份 .py 就能跑。本站这种"几个一次性 build 脚本"场景特别合适。</> }, en: { title: <>PEP 723 makes scripts self-contained</>, desc: <>Single-file Python tools no longer need "first pip install xxx" preambles. Scripts ship with their deps inline; send a coworker one .py and they can run it. A perfect fit for ad-hoc build scripts like this site’s.</> }, code: <>{c('# /// script')}{'\n'}{c('# dependencies = ["httpx"]')}{'\n'}{c('# ///')}</> },
    { icon: '◐', zh: { title: <>workspace 给 monorepo 用</>, desc: <>多个 Python 子包在同一仓库共享一份 lockfile, 互相 path 依赖。pnpm workspace / Cargo workspace 的直接对应物, Python 终于有了。</> }, en: { title: <>Workspaces for monorepos</>, desc: <>Multiple Python sub-packages in one repo, sharing one lockfile, with path-style intra-repo deps. The direct counterpart to pnpm / Cargo workspaces — Python finally has it.</> }, code: <>[{k('tool.uv.workspace')}]{'\n'}members = [{s('"apps/*"')}, {s('"libs/*"')}]</> },
    { icon: '⌬', zh: { title: <>头部框架默认推荐</>, desc: <>FastAPI / Pydantic / Hugging Face / OpenAI Agents SDK 的官方教程都已经把 uv 当首选。新手第一次写 Python 项目大概率不再先学 pip, 直接 uv 起步。</> }, en: { title: <>Default in headline frameworks</>, desc: <>FastAPI / Pydantic / Hugging Face / OpenAI Agents SDK’s official tutorials all prefer uv. A new dev starting a Python project today is likely to learn uv first and skip pip.</> }, code: <>{c('// FastAPI tutorial 2026:')}{'\n'}{f('uv')} init {s('"backend"')}</> },
    { icon: '◍', zh: { title: <>OpenAI 收购后仍开源</>, desc: <>2026-03 收购后 Charlie Marsh 公开承诺 uv / ruff / ty 继续开源 + 资源加大。"被大厂收购 = 死亡" 的剧本这次没演。</> }, en: { title: <>Open source after the OpenAI acquisition</>, desc: <>After the March 2026 acquisition, Charlie Marsh publicly committed uv / ruff / ty stay open source with more resources. The "acquired = dead" script didn’t play out this time.</> }, code: <>{c('// uv / ruff / ty: still MIT')}{'\n'}{c('// 2026-03+ OpenAI funded')}</> },
  ],
  adopters: [
    { name: 'FastAPI', href: 'https://fastapi.tiangolo.com', highlight: true, zhNote: '官方教程改用 uv init / uv sync', enNote: 'Official tutorial switched to uv init / uv sync' },
    { name: 'Pydantic', href: 'https://docs.pydantic.dev', highlight: true, zhNote: 'pydantic-ai 全套 uv-first 工程化', enNote: 'pydantic-ai is uv-first end to end' },
    { name: 'Hugging Face', href: 'https://huggingface.co/docs', highlight: true, zhNote: 'Inference Endpoints 文档默认 uv sync', enNote: 'Inference Endpoints docs default to uv sync' },
    { name: 'OpenAI', href: 'https://openai.com', highlight: true, zhNote: '2026-03 收购 Astral, 仍保持开源', enNote: 'Acquired Astral in 2026-03; keeps it open source' },
    { name: 'Anthropic Python SDK', href: 'https://github.com/anthropics/anthropic-sdk-python', zhNote: '示例 / CI 配置走 uv', enNote: 'Examples and CI configs use uv' },
    { name: 'Jane Street', href: 'https://blog.janestreet.com', zhNote: 'Python monorepo 内核改 uv', enNote: 'Python monorepo internals rebuilt on uv' },
    { name: 'Ramp', href: 'https://ramp.com', zhNote: 'pyx beta 早期合作方', enNote: 'pyx beta early partner' },
    { name: 'Intercom', href: 'https://intercom.com', zhNote: 'pyx beta 早期合作方', enNote: 'pyx beta early partner' },
    { name: 'fal', href: 'https://fal.ai', zhNote: 'pyx beta 早期合作方, GPU 调度场景', enNote: 'pyx beta early partner, GPU-scheduling shop' },
    { name: 'Polars', href: 'https://pola.rs', zhNote: 'Rust 系数据库 / dataframe, 自然走 uv', enNote: 'Rust-stack dataframe lib, naturally on uv' },
    { name: 'Modal', href: 'https://modal.com', zhNote: 'Serverless Python 平台, image build 走 uv', enNote: 'Serverless Python platform; image build uses uv' },
    { name: 'cuberoot.me', highlight: true, zhNote: '本站 scripts/ 还在裸 python3, uv 是下一步迁移', enNote: 'This site — scripts/ still on plain python3; uv is the planned migration' },
  ],
  outlook: [
    { tag: <>HOT · 2026-03</>, hot: true, big: true, zh: { title: <>OpenAI 收购 Astral</>, body: <><p>2026 年 3 月 OpenAI 把 Astral 整个收购。Charlie Marsh 公开承诺 uv / ruff / ty (Astral 的 type checker) 继续开源, 团队继续独立运营, 资源大幅加大。</p><p>更深一层:OpenAI 的内部工具链已经几乎全是 Python (Codex / Agents / 推理服务), 把 Python 工具链的核心团队买下来 = 自己掌控 dev velocity。对 uv 用户来说这是好消息 —— 投入只会更多, 不会更少。pip 真正进入"兼容遗产"轨道。</p></> }, en: { title: <>OpenAI acquires Astral</>, body: <><p>March 2026: OpenAI acquired Astral outright. Charlie Marsh publicly committed that uv / ruff / ty (Astral’s type checker) stay open source, the team keeps operating independently, and resources increase significantly.</p><p>The deeper read: OpenAI’s internal stack is overwhelmingly Python (Codex / Agents / inference services). Buying the core Python tooling team means owning dev velocity. For uv users that’s good news — investment only goes up. pip is now squarely on the "legacy compat" track.</p></> } },
    { tag: 'REGISTRY', zh: { title: <>pyx 商业 registry</>, body: <><p>2025-08 Astral 推出 pyx, 一个 Python 原生的私有 / 加速 registry, 跟 uv 深度配合。Ramp / Intercom / fal 是早期合作方。GPU 包变体自动选择是核心卖点。</p><p>这是 Astral 第一个商业产品, 也回答了 "uv 怎么挣钱" 这个长期问题 —— 工具开源, registry 收费。OpenAI 收购后 pyx 路线大概率保留, 继续作为 Astral 的商业支柱。</p></> }, en: { title: <>pyx, the commercial registry</>, body: <><p>August 2025 Astral shipped pyx, a Python-native private + accelerated registry tightly bound to uv. Ramp / Intercom / fal are early partners. GPU variant auto-selection is the headline feature.</p><p>This is Astral’s first commercial product and answers the long-standing "how does uv make money" question — open-source tools, paid registry. Post-OpenAI, pyx likely stays as the commercial pillar.</p></> } },
    { tag: 'PEP', zh: { title: <>PEP 751 lockfile 标准化</>, body: <><p>Python 终于有了官方 lockfile 标准 (PEP 751, 2025 通过)。uv.lock 是非标格式, 但 uv 已承诺产出标准 pylock 文件, poetry / pdm / pip 也跟进。未来跨工具读同一份 lockfile 不再是梦。</p></> }, en: { title: <>PEP 751 lockfile standard</>, body: <><p>Python finally has an official lockfile standard (PEP 751, accepted 2025). uv.lock is non-standard, but uv has committed to emitting standard pylock files; poetry / pdm / pip are following. Cross-tool lockfile interchange is finally coming.</p></> } },
    { tag: <>1.0</>, zh: { title: <>1.0 还在路上</>, body: <><p>2026 年中 uv 还在 0.11.x, 没有官方 1.0 时间表。Astral 的版本策略一向保守 (ruff 也是几年才到 1.0)。但已经被 Hugging Face / Jane Street / OpenAI 这级用户在生产里用, 实际意义上稳如 1.x。</p></> }, en: { title: <>1.0 is still pending</>, body: <><p>Mid-2026 uv is still 0.11.x with no published 1.0 timeline. Astral’s versioning is conservative on principle (ruff also took years to hit 1.0). But it’s already in production at Hugging Face / Jane Street / OpenAI scale — practically 1.x stable.</p></> } },
    { tag: 'DATA', zh: { title: <>PyPI 10% 流量</>, body: <><p>2025-08 Astral 数据:uv 月下载 1600 万, 占 PyPI 全站请求 10% 以上。半年后大概率翻一番。"pip 是默认" 的局面正被实际数据改写。</p></> }, en: { title: <>10% of PyPI traffic</>, body: <><p>2025-08 figures from Astral: 16M monthly downloads of uv, over 10% of PyPI requests. Likely doubling within six months. The "pip is the default" assumption is being rewritten by actual usage.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>诚实点说:本站目前没在用 uv。<code>scripts/</code> 下有三个 Python 脚本 —— <code>build_wca_attempts.py</code> (从 WCA dump 生成 attempts JSON)、<code>fetch_comp_names_zh.py</code> (拉中文比赛名翻译)、<code>fetch_upcoming_comps.py</code> (从 WCA API 拉将来比赛) —— 全部裸 <code>python3 xxx.py</code> 跑, 没 <code>pyproject.toml</code>, 没 <code>uv.lock</code>, 依赖现装现用。</p>
        <p>这种规模其实没大问题 (脚本依赖简单, 主要是 requests / json / mysql-connector), 但有几个明显的痛点:依赖版本不锁, CI / 本地 / 我换机器三个环境可能装到不同 minor 版本;新人 clone 仓库后跑脚本要先看 README 装一堆包;以后想加 <code>.tmp/zbls/build_alg_zbls.py</code> 那种重型 build 脚本 (依赖 PyTorch / numpy / pandas) 时, 缺 lockfile 就麻烦了。</p>
        <p>下一步迁移路径基本清晰:scripts/ 下加一个 <code>pyproject.toml</code> 声明依赖, <code>uv lock</code> 生成 <code>uv.lock</code>, GH Actions 改成 <code>uv sync --frozen &amp;&amp; uv run python scripts/fetch_upcoming_comps.py</code>。一次性迁完, 之后所有人 (包括 AI agent) 跑脚本都是同一份字节级一致的环境。</p>
        <p>更长远的一个想法:PEP 723 inline script 模式特别适合 <code>scripts/</code> 这种"几个独立小工具"的场景 —— 每个脚本顶部内嵌一段 TOML 声明依赖, <code>uv run script.py</code> 自动建临时 venv 跑完丢, 连 <code>pyproject.toml</code> 都不需要。这种"单文件 self-contained" 比 monorepo 化更符合 cuberoot 这边轻量脚本的实际形态。</p>
      </>
    ),
    en: (
      <>
        <p>To be honest: this site doesn’t use uv yet. The <code>scripts/</code> dir holds three Python scripts — <code>build_wca_attempts.py</code> (turns the WCA dump into attempts JSON), <code>fetch_comp_names_zh.py</code> (pulls Chinese comp-name translations), <code>fetch_upcoming_comps.py</code> (pulls future comps from the WCA API) — all run as plain <code>python3 xxx.py</code>. No <code>pyproject.toml</code>, no <code>uv.lock</code>, deps installed ad hoc.</p>
        <p>At this scale it mostly works (deps are simple — requests / json / mysql-connector), but a few pain points are obvious: deps aren’t pinned, so CI / local / a fresh machine can each grab different minors; new contributors have to read the README to install the right packages before running anything; and once a heavier build script lands (say <code>.tmp/zbls/build_alg_zbls.py</code> needing PyTorch / numpy / pandas), the missing lockfile starts hurting.</p>
        <p>The migration path is clear: drop a <code>pyproject.toml</code> in scripts/ declaring deps, run <code>uv lock</code> to generate <code>uv.lock</code>, switch GH Actions to <code>uv sync --frozen &amp;&amp; uv run python scripts/fetch_upcoming_comps.py</code>. One-shot migration, and afterwards everyone (humans + AI agents) runs the same byte-identical environment.</p>
        <p>A longer-term thought: PEP 723 inline scripts fit <code>scripts/</code> particularly well — each script declares its deps in a TOML block at the top, <code>uv run script.py</code> spins an ephemeral venv and discards it, no <code>pyproject.toml</code> needed at all. "Single-file self-contained" matches the lightweight shape of cuberoot’s scripts better than monorepo-ifying them would.</p>
      </>
    ),
  },
  links: [
    { label: 'docs.astral.sh/uv', href: 'https://docs.astral.sh/uv/' },
    { label: 'GitHub · astral-sh/uv', href: 'https://github.com/astral-sh/uv' },
    { label: 'Launch post (2024-02)', href: 'https://astral.sh/blog/uv' },
    { label: 'Unified packaging (2024-08)', href: 'https://astral.sh/blog/uv-unified-python-packaging' },
    { label: 'pyx beta (2025-08)', href: 'https://astral.sh/blog/introducing-pyx' },
  ],
};
