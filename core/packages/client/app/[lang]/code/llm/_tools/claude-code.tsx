import type { StackTool } from '../../stack/_lib/stack_tool_types';
import { v, s, n, f, p, c } from '../../stack/_lib/stack_tool_types';

// ─── Claude Code (Anthropic CLI agent) ──────────────────────────────────────

export const CLAUDE_CODE: StackTool = {
  slug: 'claude-code',
  name: 'Claude Code',
  version: '2.x',
  since: '2025-02',
  group: 'dev',
  accent: '#D97757',
  bright: '#E89578',
  glyph: '>_',
  floats: ['REPL', 'Read', 'Edit', 'Write', 'Bash', 'Grep', '/agents', '/loop', '/schedule', 'hooks', 'MCP', 'CLAUDE.md'],
  zh: {
    tagline: "Anthropic 官方 CLI agent",
    role: '本项目曾经的主维护环境;现已完全迁移到 Codex。',
    heroSub: <>2025-02 跟 Claude 4 一起放出, 起初叫 <code>claude</code> CLI, 后来正式品牌化成 Claude Code。它本质是一个 <strong>agent loop</strong>:Read / Write / Edit / Bash / Grep / Glob 等工具作为 tool_use schema 暴露给 Claude, 模型自驱循环, 直到 stop_reason = end_turn 或用户介入。npm <code>@anthropic-ai/claude-code</code> 全局装, 一年半之后这是 Anthropic 自家、Cursor 之外最被广泛采用的 AI 编码工具。</>,
    whatDesc: <>Claude Code 不是一个 IDE, 也不是 Copilot 那种 inline completion。它是一个 <strong>REPL + agent loop</strong>:你写自然语言任务, 它用 tool calls 操作仓库。和 Cursor 的差别在于 <em>composability</em> —— hooks / skills / subagents / MCP servers 全部是文件配置, 不是 GUI 设置。</>,
    historyDesc: <>从 2025-02 跟 Claude 4 一起首发, 到 2026-05 的当前版本, 一年半。中间核心扩展:hooks (生命周期 shell)、MCP (外部 tool 协议)、skills (Markdown + frontmatter)、subagents (并发子会话)、permissions / sandbox、plugin marketplace、cloud agent / scheduled routines。每一项都把 agent 的"能做什么"再扩一圈。</>,
    conceptsTitle: 'REPL + tools + skills + hooks',
    conceptsDesc: <>核心模型是 tool use: 模型 emit 一个 tool_use block, 客户端执行, 把 tool_result 接回去。剩下的是把这个 loop 用得舒服:slash command 是预录入快捷, skill 是按需触发的能力包, hook 是 lifecycle 上的 shell, subagent 是带独立窗口的子会话。</>,
    whyDesc: <>2026 年 AI 编码工具一抓一大把, 选 Claude Code 不是"它最好", 而是它在 <strong>开放度</strong> 上唯一。所有配置都是文件, 可以 commit、可以分享、可以脚本生成。Cursor / Copilot 这条线的 GUI 锁是相反方向。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>Anthropic 内部团队自然全员用, GitHub 团队大量替代 Copilot, 大学研究者 / 独立开发者群体里普及最快。本站曾用它覆盖代码与部署,现已迁移到 Codex。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>2026 年下半年的看点是 cloud agent (scheduled routines 已上线) 和 plugin marketplace 成熟。开放协议 MCP 让 Claude Code 成为生态中心而不是死胡同。锁定担忧仍在:全套工具都在 Anthropic 一家手里。</>,
  },
  en: {
    tagline: "Anthropic's official CLI agent",
    role: "This project's former primary maintenance environment; it has now fully migrated to Codex.",
    heroSub: <>Shipped in February 2025 alongside Claude 4, initially the <code>claude</code> CLI and later formally branded Claude Code. At its core it's an <strong>agent loop</strong>: Read / Write / Edit / Bash / Grep / Glob exposed as tool_use schemas; the model drives itself until stop_reason = end_turn or the user steps in. Distributed via npm as <code>@anthropic-ai/claude-code</code>, eighteen months in it's the most widely adopted AI coding tool outside Cursor.</>,
    whatDesc: <>Claude Code is not an IDE and not Copilot-style inline completion. It is a <strong>REPL + agent loop</strong>: you write natural-language tasks; it manipulates the repo via tool calls. The differentiator from Cursor is <em>composability</em> — hooks, skills, subagents, and MCP servers are all file configs, not GUI settings.</>,
    historyDesc: <>From the February 2025 launch alongside Claude 4 to the current May 2026 release, eighteen months in. Key extensions along the way: hooks (lifecycle shell), MCP (external tool protocol), skills (Markdown + frontmatter), subagents (parallel child sessions), permissions / sandbox, a plugin marketplace, and cloud agents / scheduled routines. Each round widens what the agent can do.</>,
    conceptsTitle: 'REPL + tools + skills + hooks',
    conceptsDesc: <>The core model is tool use: the model emits a tool_use block, the client executes it, the tool_result feeds back. The rest is making that loop comfortable — slash commands are recorded shortcuts, skills are on-demand capability bundles, hooks are lifecycle shells, subagents are child sessions with their own context window.</>,
    whyDesc: <>By 2026 AI coding tools are a dime a dozen. Picking Claude Code isn't because it's "best" — it's because on <strong>openness</strong> it's unique. Every config is a file: commit it, share it, generate it from scripts. Cursor / Copilot's GUI-lock model points the opposite way.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Anthropic's internal teams use it as the default; GitHub teams have widely replaced Copilot with it; academic researchers and indie devs are the fastest-adopting segment. This site once used it across code and deploys, and has since migrated to Codex.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>Second half of 2026 watch: cloud agents (scheduled routines already in) and a maturing plugin marketplace. The open MCP protocol positions Claude Code as an ecosystem hub rather than a dead-end. Lock-in is still the open worry — every piece sits inside Anthropic.</>,
  },
  heroStats: [
    { num: '2', unit: '.x', zh: <>当前主线版本 <em>2026-05</em></>, en: <>current major <em>2026-05</em></>
    },
    { num: '15', unit: '+', zh: <>内置工具数 <em>Read / Edit / Bash / ...</em></>, en: <>built-in tools <em>Read / Edit / Bash / ...</em></>
    },
    { num: '5', zh: <>本页并发 subagent 数 <em>2026-05-18</em></>, en: <>subagents writing this page <em>2026-05-18</em></>
    },
    { num: '2024', unit: '–26', zh: <>本项目历史主维护期 <em>现已迁移</em></>, en: <>historical primary-maintenance period <em>now migrated</em></>
    },
  ],
  intro: {
    zh: (
      <>
        <p>Claude Code 2025-02 跟 Claude 4 一起首发。最早叫 <code>claude</code> CLI, 包名是 <code>@anthropic-ai/claude-code</code>, npm 全局装, 起手就是一个 REPL —— 进去给一句自然语言任务, 它就开始 emit tool_use 调 Read / Write / Edit / Bash / Grep / Glob 这一组本地工具, 直到任务完成或者请求用户确认。</p>
        <p>设计上和 Cursor / Copilot 这条 IDE-augment 路线不同, Claude Code 是 <em>OS 一等公民</em>:你在自己的 shell 里用任何 editor 写 prompt, 模型操作真实的 fs, 不依赖任何 IDE。这条路线带来两个特性 (1) 一切可文件化:hooks 是 .json, skill 是 .md, 子 agent 是配置文件;(2) 一切可脚本化:CI 可以触发 claude-code 跑 review、可以 schedule 远程 agent。</p>
        <p>一年半里能力扩了一圈又一圈:hooks (2025-05) 让 lifecycle 接 shell;MCP (2025-07 成熟) 把外部 tool 通过协议挂进来;slash commands + skills (2025-09) 让常用工作流封装成单文件;subagents (2025-11) 实现并行子会话;sandbox (2025-12) + plugin marketplace (2026-01) + cloud agents / scheduled routines (2026-03) 一路推进。当前版本支持 <code>/loop</code> 和 <code>/schedule</code>, 底层是 Opus 4.7 的 1M 上下文。</p>
      </>
    ),
    en: (
      <>
        <p>Claude Code launched in February 2025 alongside Claude 4. Initially shipped as the <code>claude</code> CLI; package name <code>@anthropic-ai/claude-code</code>, installed globally from npm; first interaction is a REPL — enter a natural-language task and the agent starts emitting tool_use calls into Read / Write / Edit / Bash / Grep / Glob until the task completes or the user is asked to confirm.</p>
        <p>By design it diverges from the IDE-augment path of Cursor / Copilot. Claude Code is an <em>OS-native first-class citizen</em>: write prompts in your own shell with any editor; the model manipulates the real filesystem; no IDE in the loop. Two properties follow — (1) everything is file-configurable: hooks are .json, skills are .md, subagents are config files; (2) everything is scriptable: CI can fire claude-code for code review, and remote agents can be scheduled.</p>
        <p>Eighteen months of capability has expanded the surface twice over: hooks (2025-05) wire lifecycle to shell; MCP (mature 2025-07) plugs external tools in via a protocol; slash commands + skills (2025-09) bundle common workflows into single files; subagents (2025-11) enable parallel child sessions; sandbox (2025-12), plugin marketplace (2026-01), and cloud agents / scheduled routines (2026-03) followed. The current release supports <code>/loop</code> and <code>/schedule</code>, with Opus 4.7's 1M context underneath.</p>
      </>
    ),
  },
  history: [
    { year: '2025·02', zh: { title: <>初版发布</>, desc: <>跟 Claude 4 一起放出, 包名 @anthropic-ai/claude-code。初始功能:REPL + Read / Write / Edit / Bash / Grep / Glob 六件套工具。</> }, en: { title: <>Initial release</>, desc: <>Shipped alongside Claude 4 as @anthropic-ai/claude-code. Day-1 features: REPL plus six tools — Read / Write / Edit / Bash / Grep / Glob.</> } },
    { year: '2025·05', zh: { title: <>Hooks 系统</>, desc: <>settings.json 里给 lifecycle 事件 (PreToolUse / PostToolUse / Stop) 挂 shell。本站 CI 关 gate 第一次能在 commit 前强制 typecheck。</> }, en: { title: <>Hooks system</>, desc: <>settings.json lets shell scripts run on lifecycle events (PreToolUse / PostToolUse / Stop). This site's CI gate first enforced typecheck-before-commit via hooks.</> } },
    { year: '2025·07', zh: { title: <>MCP 成熟</>, desc: <>Model Context Protocol 把外部 tool / data source 通过 JSON-RPC 接入。Playwright / Slack / Google Drive 这些第三方能力第一次以协议方式进 Claude Code。</> }, en: { title: <>MCP matures</>, desc: <>The Model Context Protocol plugs external tools / data sources in via JSON-RPC. Playwright, Slack, Google Drive — third-party capabilities arrive through a protocol, not bespoke integrations.</> } },
    { year: '2025·09', zh: { title: <>Slash commands + skills</>, desc: <>/help / /clear / /config / /init 这些 slash 上线, 同期引入 skill —— 单文件 Markdown + frontmatter, 按需触发。本站 skill 体系 (theme-tokens / i18n / comp-data-schema 等十几个) 从这版起开始建。</> }, en: { title: <>Slash commands + skills</>, desc: <>/help, /clear, /config, /init slash commands land; skills (single-file Markdown + frontmatter, on-demand) arrive in parallel. This site's skill set (theme-tokens / i18n / comp-data-schema and a dozen others) was built starting here.</> } },
    { year: '2025·11', highlight: true, zh: { title: <>Subagents (Agent tool)</>, desc: <>Agent tool 上线 —— 父会话能 spawn 子会话, 每个有独立 context window, 可以并行跑。本页 /code/stack 整批工具数据就是 5 个 subagent 并发产出的。</> }, en: { title: <>Subagents (Agent tool)</>, desc: <>The Agent tool ships: a parent can spawn child sessions, each with its own context window, executable in parallel. The /code/stack tool data set on this page was generated by five subagents concurrently.</> } },
    { year: '2025·12', zh: { title: <>Sandbox + permission overhaul</>, desc: <>权限模型重做:allowlist / denylist 走 settings.json, sandbox 模式默认拒绝危险操作, 明示用户后再放行。 unattended 任务从这一刻变得安全。</> }, en: { title: <>Sandbox + permission overhaul</>, desc: <>Permission model rebuilt: allowlist / denylist live in settings.json; sandbox mode denies dangerous ops by default and asks for explicit user approval. Unattended jobs become safe from this point.</> } },
    { year: '2026·01', zh: { title: <>Plugin marketplace</>, desc: <>claude.ai/plugins 上线, 第三方 skill / agent / MCP server 集中分发。开发者第一次有了一个不靠 GitHub 搜索的发现入口。</> }, en: { title: <>Plugin marketplace</>, desc: <>claude.ai/plugins opens; third-party skills / agents / MCP servers get a central distribution. The first discovery path that doesn't rely on grepping GitHub.</> } },
    { year: '2026·03', zh: { title: <>Cloud agent + scheduled routines</>, desc: <>/schedule 让 agent 远端按 cron 跑,本机关机不影响。它把定时维护从一次性会话扩展到持续 routine。</> }, en: { title: <>Cloud agents + scheduled routines</>, desc: <>/schedule lets agents run remotely on cron while the local machine is offline, extending maintenance from one-off sessions into persistent routines.</> } },
    { year: '2026·05', highlight: true, zh: { title: <>当前 — /loop + Opus 4.7 fast</>, desc: <>当前主线加 /loop (定期重跑命令)、fast mode (Opus 出 token 速度从 ~80 提到 ~190 TPS)、底层切到 Opus 4.7 1M 上下文。这页就是这版写的。</> }, en: { title: <>Now — /loop + Opus 4.7 fast</>, desc: <>Current trunk adds /loop (recurring command), fast mode (Opus output bumped from ~80 to ~190 TPS), and Opus 4.7 / 1M context underneath. This page was written with this release.</> } },
    { year: '2026·05', zh: { title: <>npm 周下载 / 用户数</>, desc: <>npm @anthropic-ai/claude-code 周下载 ~80 万, MAU 估计在数十万量级 (Anthropic 未官宣)。增长速度比 Cursor 同期更陡。</> }, en: { title: <>npm downloads + user base</>, desc: <>@anthropic-ai/claude-code weekly npm downloads ~800K; MAU likely hundreds of thousands (Anthropic has not officially disclosed). Growth curve steeper than Cursor at the equivalent age.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>REPL 启动</>, desc: <>npm 全局装完, 进入项目目录 <code>claude</code> 起 REPL。它读当前目录的 CLAUDE.md + ~/.claude/ 用户配置进 system prompt。</> }, en: { title: <>REPL startup</>, desc: <>After a global npm install, run <code>claude</code> in any project directory. It reads CLAUDE.md from cwd plus the user config under ~/.claude/ into the system prompt.</> }, code: <code>{c('# install once')}{'\n'}npm i -g @anthropic-ai/claude-code{'\n\n'}{c('# enter a repo')}{'\n'}{f('cd')} my-project{'\n'}claude</code> },
    { tag: 'B', zh: { title: <>内置 tool set</>, desc: <>Read / Edit / Write 操 fs, Bash 跑命令, Grep / Glob 找文件, WebFetch / WebSearch 联网。所有 tool 走的就是 Claude API 的 tool_use schema, 没有魔法。</> }, en: { title: <>Built-in tool set</>, desc: <>Read / Edit / Write touch the filesystem; Bash runs commands; Grep / Glob find files; WebFetch / WebSearch hit the network. Everything rides Claude API tool_use — no magic.</> }, code: <code>{c('// tool call from model')}{'\n'}{'{'}{'\n'}  {p('type')}: {s('"tool_use"')},{'\n'}  {p('name')}: {s('"Edit"')},{'\n'}  {p('input')}: {'{'}{'\n'}    {p('file_path')}: {s('"src/App.tsx"')},{'\n'}    {p('old_string')}: {v('A')},{'\n'}    {p('new_string')}: {v('B')}{'\n'}  {'}'}{'\n'}{'}'}</code> },
    { tag: 'C', zh: { title: <>Slash commands</>, desc: <>/help / /clear / /config / /agents / /loop / /schedule / /security-review / /init。前缀触发, 本质是预设 prompt + 工具组合。skill 也是 slash 形式 (/skill-name)。</> }, en: { title: <>Slash commands</>, desc: <>/help, /clear, /config, /agents, /loop, /schedule, /security-review, /init. Prefix-triggered; essentially preset prompt + tool combos. Skills surface the same way (/skill-name).</> }, code: <code>{c('# in REPL')}{'\n'}{p('/init')}              {c('# generate CLAUDE.md')}{'\n'}{p('/security-review')}   {c('# audit current branch')}{'\n'}{p('/schedule daily 09:00 ./run.sh')}</code> },
    { tag: 'D', zh: { title: <>Skills (按需能力包)</>, desc: <>Markdown + frontmatter 单文件, 放 <code>~/.claude/skills/</code> 或 <code>.claude/skills/</code>。description + triggers 让 Claude 自动判断该不该调。本站的 skill 体系最早在这套环境中建立,后来迁入 Codex。</> }, en: { title: <>Skills (on-demand capability bundles)</>, desc: <>A single Markdown file with frontmatter, placed under <code>~/.claude/skills/</code> or <code>.claude/skills/</code>. description + triggers let Claude auto-decide when to invoke. This site's skill system began in that environment and was later migrated to Codex.</> }, code: <code>{c('# ~/.claude/skills/theme-tokens.md')}{'\n'}---{'\n'}name: theme-tokens{'\n'}description: Use when writing CSS color values...{'\n'}---{'\n'}{'\n'}Tokens live in `theme.css`. Never hardcode `#888`.</code> },
    { tag: 'E', zh: { title: <>Hooks (lifecycle shell)</>, desc: <>settings.json 里给 PreToolUse / PostToolUse / Stop / SessionStart 挂 shell 命令。本站曾用这套 PreToolUse 约束写入,相关守卫后来迁入 Codex hooks。</> }, en: { title: <>Hooks (lifecycle shell)</>, desc: <>settings.json wires shell commands to PreToolUse / PostToolUse / Stop / SessionStart. This site once used that PreToolUse system for write guards; those guards later moved to Codex hooks.</> }, code: <code>{c('// .claude/settings.json')}{'\n'}{'{'} {p('hooks')}: {'{'}{'\n'}  {s('"PreToolUse"')}: [{'{'}{'\n'}    {p('matcher')}: {s('"Edit|Write"')},{'\n'}    {p('hooks')}: [{'{ '}{p('type')}: {s('"command"')}, {p('command')}: {s('"pnpm typecheck"')} {'} ]'}{'\n'}  {'}]'}{'\n'}{'}}'}</code> },
    { tag: 'F', zh: { title: <>MCP servers</>, desc: <>外部工具 (Playwright / Slack / GDrive / custom) 用 MCP 协议 (JSON-RPC stdio / SSE) 接进来。一个配置里加 server, Claude 就能调它的 tool。</> }, en: { title: <>MCP servers</>, desc: <>External tools (Playwright / Slack / GDrive / custom) plug in via the MCP protocol (JSON-RPC stdio / SSE). Add a server in config; Claude can immediately call its tools.</> }, code: <code>{c('// .mcp.json')}{'\n'}{'{'} {p('mcpServers')}: {'{'}{'\n'}  {s('"playwright"')}: {'{'}{'\n'}    {p('command')}: {s('"npx"')},{'\n'}    {p('args')}: [{s('"-y"')}, {s('"@playwright/mcp"')}]{'\n'}  {'}'}{'\n'}{'}}'}</code> },
    { tag: 'G', zh: { title: <>Subagents (Agent tool)</>, desc: <>父会话用 Agent tool spawn 子会话, 每个独立 context window。可以串行 (链式) 或并行 (一条消息发 N 个)。本页 /code/stack 数据就是 5 个并行 subagent 写出来的。</> }, en: { title: <>Subagents (Agent tool)</>, desc: <>The parent uses the Agent tool to spawn child sessions, each with its own context window. They can chain or run in parallel (N invocations in one message). The /code/stack data set on this page is five parallel subagents.</> }, code: <code>{c('// parent message')}{'\n'}{f('Task')}({'{'}{'\n'}  {p('subagent_type')}: {s('"general-purpose"')},{'\n'}  {p('prompt')}: {s('"Write stack_tools/claude.tsx ..."')}{'\n'}{'}'});</code> },
    { tag: 'H', zh: { title: <>CLAUDE.md memory</>, desc: <>三层 memory:全局 ~/.claude/CLAUDE.md (跨项目偏好)、项目 ./CLAUDE.md (仓库规则, 入 git)、auto memory (用户偏好 / 项目事实自动累积)。每次会话头自动注入 system prompt。</> }, en: { title: <>CLAUDE.md memory</>, desc: <>Three layers of memory: global ~/.claude/CLAUDE.md (cross-project preferences), project ./CLAUDE.md (repo rules, committed), and auto memory (user preferences and project facts accumulated). All three inject into the system prompt at session start.</> }, code: <code>{c('# .claude/CLAUDE.md (this repo)')}{'\n'}# cuberoot.me{'\n'}{'\n'}- pnpm, not npm{'\n'}- typecheck before push{'\n'}- no emoji in UI</code> },
  ],
  whyCards: [
    { icon: '>_', zh: { title: <>OS 一等公民, 不是 IDE 插件</>, desc: <>真实 shell, 真实 fs, 任何 editor 都能配它。CI / cron / 远端 ssh 都能调用同一个 binary, Cursor 没法这样玩。</> }, en: { title: <>OS-native, not an IDE plugin</>, desc: <>Real shell, real filesystem, any editor pairs with it. CI / cron / remote ssh all invoke the same binary; Cursor cannot operate this way.</> }, code: <>{c('# CI step')}{'\n'}claude --headless {s('"/security-review"')}</> },
    { icon: '⌬', zh: { title: <>一切可文件化</>, desc: <>hooks / skills / mcp servers / agents 全部是 .json / .md 文件, 可 commit 进仓库。新人 clone 就拿到完整项目知识, 不需要重配 IDE。</> }, en: { title: <>Everything is a file</>, desc: <>hooks / skills / MCP servers / agents are all .json / .md files, committable into the repo. A newcomer clones it and inherits the full project knowledge — no IDE reconfig needed.</> }, code: <>.claude/{'{'}settings.json, skills/*.md, agents/*.md{'}'}</> },
    { icon: '⚙', zh: { title: <>Subagent 并行</>, desc: <>一个长任务可以拆成 5 个子会话并发跑, 每个有独立 1M context。本页 /code/stack 的 N 个 .tsx 就是这样产出的, 总时间从串行 ~50 分钟降到 ~12 分钟。</> }, en: { title: <>Subagent parallelism</>, desc: <>A long task splits into N parallel child sessions, each with its own 1M context window. The N .tsx files of /code/stack are produced this way — total time from ~50 minutes serial to ~12 minutes.</> }, code: <>{f('Task')} × {n('5')} → wait → merge</> },
    { icon: '⌁', zh: { title: <>MCP 让生态打开</>, desc: <>Playwright / Slack / GDrive / Notion / Linear 等都能通过开放协议接入。同一个 protocol 也支持你写自己的 server, 内部工具一并暴露给 agent。</> }, en: { title: <>MCP opens the ecosystem</>, desc: <>Playwright / Slack / GDrive / Notion / Linear plug in via an open protocol. The same protocol takes home-grown servers, exposing internal tools to the agent on equal footing.</> }, code: <>npx @playwright/mcp</> },
    { icon: '⛁', zh: { title: <>CLAUDE.md 是项目知识库</>, desc: <>项目规则 (用 pnpm / dev 端口 / 部署拓扑) 全部写一个 .md 入 git, 每次会话自动读。新人 onboarding / AI agent 上手共用同一份。</> }, en: { title: <>CLAUDE.md as the project knowledge base</>, desc: <>Project rules (pnpm not npm, dev port, deploy topology) live in one .md committed to git, auto-loaded each session. New humans and new AI agents share the same source.</> }, code: <>{c('// auto-injected into system prompt')}{'\n'}{c('// every session start')}</> },
    { icon: '⌖', zh: { title: <>Hooks 自动化 guard rail</>, desc: <>PreToolUse 钩住 Edit / Write, 强制跑 typecheck / lint;Stop 钩 commit message 检查。这些 guard 比"提醒 AI 别忘了"靠谱得多。</> }, en: { title: <>Hooks enforce guard rails</>, desc: <>PreToolUse hooks gate Edit / Write through typecheck / lint; Stop hooks audit commit messages. Far more reliable than "reminding the AI."</> }, code: <>{p('matcher')}: {s('"Edit|Write"')}, {p('command')}: {s('"pnpm tc"')}</> },
    { icon: '⌗', zh: { title: <>跑得起 unattended</>, desc: <>sandbox + 权限 allowlist + /schedule 让 agent 凌晨跑 stats 周更、blog 同步, 早上看 commit 列表。本站曾用这些能力运行定时维护。</> }, en: { title: <>Runs unattended safely</>, desc: <>Sandbox + permission allowlist + /schedule lets an agent run weekly stats / blog sync overnight — you check the commit list in the morning. This site formerly used those capabilities for scheduled maintenance.</> }, code: <>{p('/schedule')} {s('"weekly"')} {s('"./rebuild-stats.sh"')}</> },
    { icon: '⏚', zh: { title: <>1M 上下文配合极佳</>, desc: <>Opus 4.7 的 1M 在 Claude Code 里能直接表现为 "整仓库一次读完"。前代要切片 / RAG 才能完成的 repo-wide 任务现在是 single shot。</> }, en: { title: <>1M context pairs perfectly</>, desc: <>Opus 4.7's 1M window expresses inside Claude Code as "read the whole repo at once." Repo-wide tasks that previously needed chunking / RAG are single-shot now.</> }, code: <>{f('Read')}(repo) → {f('Edit')}(file₁..fileₙ)</> },
    { icon: '⚐', zh: { title: <>Lock-in 真实, 但开放协议在补</>, desc: <>所有工具都在 Anthropic 一家手里, 这是真实风险。但 MCP / skills / hooks 都是公开协议, 真要迁出 Cursor / Cline 等能接收同一组文件。比 IDE 锁好一点。</> }, en: { title: <>Lock-in is real, but the protocol is open</>, desc: <>Every piece sits inside Anthropic — a genuine risk. But MCP, skills, hooks are public protocols; if you migrate, Cursor / Cline can ingest the same files. Better than IDE-lock.</> }, code: <>{c('// MCP is an open spec')}{'\n'}{c('// not an Anthropic-only protocol')}</> },
  ],
  adopters: [
    { name: 'Anthropic (internal)', href: 'https://www.anthropic.com', highlight: true, zhNote: '自家全员日用, dogfood 跑得最深', enNote: 'Internal default; deepest dogfood' },
    { name: 'GitHub teams', href: 'https://github.com', highlight: true, zhNote: '部分团队替代 Copilot 给 PR review / triage 用', enNote: 'Some teams replace Copilot for PR review / triage' },
    { name: 'Vercel', href: 'https://vercel.com', zhNote: 'AI SDK 团队用 Claude Code 做开发', enNote: 'AI SDK team builds inside Claude Code' },
    { name: 'Shopify (eng)', href: 'https://shopify.engineering', zhNote: '工程团队公开聊过 Claude Code 工作流', enNote: 'Engineering team has spoken about Claude Code workflows' },
    { name: 'Stripe (eng)', href: 'https://stripe.com', zhNote: 'docs 团队用作主要 AI 协作工具', enNote: "Docs team's primary AI collaboration tool" },
    { name: 'Replit', href: 'https://replit.com', zhNote: '在线 IDE 集成版本 (Replit Agent 风格)', enNote: 'Integrated into the online IDE (Replit Agent flavor)' },
    { name: 'Hugging Face', href: 'https://huggingface.co', zhNote: 'datasets / model card 自动化', enNote: 'Automating datasets / model-card maintenance' },
    { name: '大学 / 研究者', highlight: true, zhNote: '论文复现 + 代码重构, 普及最快的群体', enNote: 'Paper reproduction + refactors — fastest-adopting cohort' },
    { name: 'OSS maintainers', zhNote: 'issue triage / PR review / changelog 自动写', enNote: 'Issue triage, PR review, changelog drafting' },
    { name: 'Independent devs', zhNote: '单人项目最常见的 AI 编码搭子', enNote: 'The default AI partner for solo projects' },
    { name: 'cuberoot.me', href: 'https://cuberoot.me', highlight: true, zhNote: '曾用作主维护环境,现已迁移到 Codex', enNote: 'Former primary maintenance environment, now migrated to Codex' },
  ],
  outlook: [
    { tag: <>HOT · 2026-03</>, hot: true, big: true, zh: { title: <>Cloud agent + scheduled routines</>, body: <><p>/schedule 把 agent 任务从"本机得开着"解放出来。Anthropic 远端跑, cron 触发, 跑完产 commit / PR / 通知。本站曾把部分 stats 与 blog 维护迁到这套流程,后来随开发环境一起转到 Codex。</p><p>更远一步的意义是 <strong>agent 跟 CI 边界模糊</strong> —— 以前 GH Actions 干的事, 部分可以让一个 prompt + skill 接管, 失败时给出可读的解释而不是一堆 log。</p></> }, en: { title: <>Cloud agents + scheduled routines</>, body: <><p>/schedule liberates agent tasks from "your laptop must be on." Anthropic runs them remotely on cron; on completion you get a commit / PR / notification. This site once moved part of its stats and blog maintenance into that workflow, then moved it to Codex with the rest of the development environment.</p><p>The deeper implication: <strong>the boundary between agent and CI blurs</strong>. Work that lived in GH Actions can pass to a prompt + skill, with human-readable explanations on failure instead of a wall of logs.</p></> } },
    { tag: 'MCP', zh: { title: <>MCP 成为生态枢纽</>, body: <><p>2025-07 MCP 成熟后, Playwright / Slack / GDrive / Notion / Linear 都有了官方 server。开放协议意味着不是 Anthropic 独占 —— Cursor / Cline 都在接 MCP, 你写的 server 在多个 host 复用。这是 Anthropic 在锁定担忧上最真诚的回答。</p></> }, en: { title: <>MCP becomes the ecosystem hub</>, body: <><p>After MCP matured in July 2025, Playwright / Slack / GDrive / Notion / Linear all shipped official servers. The open protocol means it's not Anthropic-only — Cursor / Cline both speak MCP, so a server you write runs on multiple hosts. The most credible answer Anthropic has to the lock-in worry.</p></> } },
    { tag: 'PLUGIN', zh: { title: <>Plugin marketplace 成熟</>, body: <><p>2026-01 上线后 skill / agent / mcp server 的发现路径终于不再靠 GitHub 搜索。年内有望见到第一批"付费 skill" (订阅模型 + 共享 cache), 个人开发者第一次能靠 skill 赚钱。</p></> }, en: { title: <>Plugin marketplace matures</>, body: <><p>Live since January 2026, the plugin marketplace finally replaces GitHub search as the discovery path for skills / agents / MCP servers. The first wave of paid skills (subscription + shared cache) is expected within the year — the first time indie devs can directly monetize a skill.</p></> } },
    { tag: <>RISK</>, zh: { title: <>vs Cursor / Copilot 的长期竞争</>, body: <><p>Cursor 在 GUI 这一侧 (inline edit / 多 tab diff) 体验仍是第一档, Copilot 借 GitHub 的渠道优势没消失。Claude Code 的开放 / 可脚本化是差异化优势, 但 GUI 上一直会差一截。"两件都得有" 是大多数人 2026 的现实做法。</p></> }, en: { title: <>vs Cursor / Copilot, the long competition</>, body: <><p>Cursor still leads on the GUI side (inline edits, multi-tab diff); Copilot has not lost GitHub's distribution moat. Claude Code's openness / scriptability is the differentiator — but it will always trail on GUI polish. "Use both" is most people's 2026 reality.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>cuberoot.me 在 2024 年下半年到 2026 年中曾把 Claude Code 作为主维护环境,覆盖前端、后端、统计管道、部署脚本与文档。这段经验是本项目保留这个产品页的原因。</p>
        <p>2026 年 8 月起,项目开发完全转到 Codex。项目约束进 <code>AGENTS.md</code>,skill 进 <code>.agents/skills</code>,钩子进 <code>.codex/hooks.json</code>,不再依赖 Claude 配置作为活跃入口。</p>
        <p>多 AI 并发、写入即拦截、可复用 skill 这些工作流仍保留,但它们现在由 Codex 的受支持机制承载。</p>
      </>
    ),
    en: (
      <>
        <p>From late 2024 through mid-2026, cuberoot.me used Claude Code as its primary maintenance environment across frontend, backend, statistics pipelines, deployment scripts, and documentation. That experience is why this product page remains part of the site.</p>
        <p>Since August 2026, development has fully moved to Codex. Project rules live in <code>AGENTS.md</code>, skills in <code>.agents/skills</code>, and hooks in <code>.codex/hooks.json</code>; Claude configuration is no longer an active entry point.</p>
        <p>Multi-AI concurrency, block-on-write guards, and reusable skills remain part of the workflow, but supported Codex mechanisms now carry them.</p>
      </>
    ),
  },
  links: [
    { label: 'claude.com/code', href: 'https://www.claude.com/code' },
    { label: 'docs · Claude Code', href: 'https://docs.claude.com/claude-code' },
    { label: 'npm · @anthropic-ai/claude-code', href: 'https://www.npmjs.com/package/@anthropic-ai/claude-code' },
    { label: 'MCP spec', href: 'https://modelcontextprotocol.io' },
  ],
};

export default CLAUDE_CODE;
