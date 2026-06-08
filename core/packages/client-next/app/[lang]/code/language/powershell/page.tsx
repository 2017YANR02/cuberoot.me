'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './powershell_intro.css';
import i18n from '@/i18n/i18n-client';

// Inline SVG: PowerShell-blue terminal with ">_" prompt
const PWSH_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="pwsh-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0B1F4D" />
        <stop offset="100%" stopColor="#012456" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#pwsh-grad)" />
    {/* title bar */}
    <rect x="0" y="0" width="256" height="34" rx="28" fill="#0B1428" />
    <rect x="0" y="22" width="256" height="14" fill="#0B1428" />
    <circle cx="22" cy="17" r="5" fill="#FF5F56" />
    <circle cx="40" cy="17" r="5" fill="#FFBD2E" />
    <circle cx="58" cy="17" r="5" fill="#27C93F" />
    {/* prompt > */}
    <text x="32" y="124" fontFamily="ui-monospace, Cascadia Code, monospace" fontWeight="700" fontSize="58" fill="#5391FE">{'>'}</text>
    {/* underscore caret */}
    <rect x="84" y="110" width="36" height="8" fill="#8EBBFF">
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
    </rect>
    {/* faint cmdlet */}
    <text x="32" y="178" fontFamily="ui-monospace, Cascadia Code, monospace" fontSize="18" fill="#5A7090">Get-Process | Sort CPU</text>
    <text x="32" y="206" fontFamily="ui-monospace, Cascadia Code, monospace" fontSize="18" fill="#5A7090">{'  -Desc | Select -First 5'}</text>
  </svg>
);

const PWSH_LOGO_SMALL = (
  <svg viewBox="0 0 256 256" width="28" height="28">
    <rect width="256" height="256" rx="28" fill="#012456" />
    <rect x="0" y="0" width="256" height="42" rx="28" fill="#0B1428" />
    <rect x="0" y="28" width="256" height="14" fill="#0B1428" />
    <circle cx="26" cy="22" r="6" fill="#FF5F56" />
    <circle cx="46" cy="22" r="6" fill="#FFBD2E" />
    <circle cx="66" cy="22" r="6" fill="#27C93F" />
    <text x="42" y="172" fontFamily="monospace" fontWeight="700" fontSize="110" fill="#8EBBFF">{'>_'}</text>
  </svg>
);

interface HistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

const HISTORY: HistoryItem[] = [
  {
    year: <>2002<small>·08</small></>,
    zh: { title: <>Monad Manifesto — Jeffrey Snover 的草案</>, desc: <>2002 年 8 月 Jeffrey Snover 在微软内部发布 <strong>"Monad Manifesto"</strong>: 一份 17 页的备忘录, 直陈 cmd.exe 与 Unix shell 都已经撑不起当时的 Windows 管理需求, <em>需要一个建立在 .NET 之上的新管理 shell</em>。<strong>核心论断: 管道里跑对象, 不跑文本</strong> — 这是后来 PowerShell 与所有传统 shell 的分水岭。</> },
    en: { title: <>Monad Manifesto — Snover's white paper</>, desc: <>August 2002. Jeffrey Snover publishes the <strong>"Monad Manifesto"</strong> inside Microsoft — a 17-page memo arguing that cmd.exe and the Unix shells cannot meet Windows administration's needs and that <em>a new management shell built on .NET is required</em>. <strong>The thesis: pipe objects, not text</strong> — the line that separates PowerShell from every traditional shell that followed.</> },
  },
  {
    year: <>2006<small>·11·14</small></>, highlight: true,
    zh: { title: <>PowerShell 1.0 GA</>, desc: <>2006 年 11 月 14 日 <strong>PowerShell 1.0 正式发布</strong>, 项目代号 Monad。Windows XP / Vista / Server 2003 全部支持。第一版就提供 <strong>cmdlet (Verb-Noun)</strong>、<strong>对象管道</strong>、<strong>PSDrive</strong> (把注册表、环境变量、证书都当文件系统挂载)。<em>Windows 管理脚本世界的"BC / AD"分界线</em>。</> },
    en: { title: <>PowerShell 1.0 GA</>, desc: <>14 November 2006: <strong>PowerShell 1.0</strong> ships under the project name Monad, supporting Windows XP, Vista and Server 2003. Day-one features include <strong>cmdlets (Verb-Noun)</strong>, the <strong>object pipeline</strong>, and <strong>PSDrives</strong> that mount the registry, env vars and certificate store as filesystems. <em>The BC/AD line for Windows management scripting</em>.</> },
  },
  {
    year: '2009',
    zh: { title: <>PowerShell 2.0 — Windows 7 默认集成</>, desc: <>Win7 / Server 2008 R2 首次<strong>开箱即带 PowerShell</strong>。引入 <strong>PowerShell Remoting (WinRM)</strong>: <code>Invoke-Command -ComputerName X -ScriptBlock {'{...}'}</code> 跨机执行, 序列化通过 wire 传对象。同年 ISE (集成脚本编辑器) 上线, 模块系统、Job 系统、调试器一起进入语言核心。</> },
    en: { title: <>PowerShell 2.0 — built into Windows 7</>, desc: <>Win7 / Server 2008 R2 are the first Windows versions where <strong>PowerShell is pre-installed</strong>. Adds <strong>PowerShell Remoting over WinRM</strong>: <code>Invoke-Command -ComputerName X -ScriptBlock {'{...}'}</code> runs a script on a remote box, with objects serialised across the wire. The Integrated Scripting Environment (ISE), modules, jobs and the debugger all enter the core that year.</> },
  },
  {
    year: '2012',
    zh: { title: <>PowerShell 3.0 — CIM + workflow</>, desc: <>Win8 / Server 2012 默认。<strong>CIM cmdlet</strong> 取代老的 WMI: <code>Get-CimInstance</code> 跨平台兼容、远程不靠 DCOM。引入 <code>workflow</code> 关键字 (基于 Windows Workflow Foundation, <em>后来在 7.x 被去掉</em>)、自动加载模块。<strong>从这一代起 PowerShell 在企业 IT 自动化里成事实标准</strong>。</> },
    en: { title: <>PowerShell 3.0 — CIM + workflow</>, desc: <>Default on Win8 / Server 2012. <strong>CIM cmdlets</strong> replace the older WMI surface: <code>Get-CimInstance</code> is cross-platform-friendly and doesn't depend on DCOM for remoting. The <code>workflow</code> keyword arrives (built on Windows Workflow Foundation — <em>later removed in 7.x</em>), and module autoloading lands. <strong>This is the release where PowerShell becomes the de-facto standard for enterprise IT automation</strong>.</> },
  },
  {
    year: '2016',
    zh: { title: <>PowerShell 5.1 — Windows 10 内置</>, desc: <>Win10 / Server 2016 出厂带 <strong>PowerShell 5.1</strong>: 真 <code>class</code> 关键字 (DSC 模块作者的福音)、增强的 <code>Enum</code>、PSReadLine 默认集成、<strong>PackageManagement</strong> (OneGet)。<em>这是"老 PowerShell" (Windows PowerShell) 的最后一版</em> — 之后所有新功能都进 PowerShell Core / 7.x。</> },
    en: { title: <>PowerShell 5.1 — built into Windows 10</>, desc: <>Win10 / Server 2016 ship with <strong>PowerShell 5.1</strong>: real <code>class</code> support (a gift to DSC module authors), beefed-up enums, PSReadLine integrated by default, and <strong>PackageManagement</strong> (OneGet). <em>The final release of "Windows PowerShell"</em> — everything beyond it goes into PowerShell Core / 7.x.</> },
  },
  {
    year: <>2016<small>·08·18</small></>, highlight: true,
    zh: { title: <>PowerShell 开源 + 跨平台</>, desc: <>2016 年 8 月 18 日, 微软在 GitHub 把 <strong>PowerShell Core 开源 (MIT 协议)</strong>, 同日发出第一个 <strong>Linux / macOS</strong> 的 alpha 包。底座从 .NET Framework 切换到 <strong>.NET Core</strong>。从这天起, 选 bash 还是 pwsh 不再是"用什么操作系统决定的", 是真的<em>语言选择</em>。</> },
    en: { title: <>PowerShell open-sourced, cross-platform</>, desc: <>18 August 2016. Microsoft <strong>open-sources PowerShell Core under MIT</strong> on GitHub and ships the first <strong>Linux and macOS</strong> alpha the same day. The runtime moves from .NET Framework to <strong>.NET Core</strong>. From this date forward, choosing bash or pwsh is no longer "whichever OS you booted into" — it's a real <em>language choice</em>.</> },
  },
  {
    year: <>2020<small>·03·04</small></>, highlight: true,
    zh: { title: <>PowerShell 7.0 GA — 一统支线</>, desc: <>2020 年 3 月 4 日 <strong>PowerShell 7.0</strong> GA, 基于 <strong>.NET Core 3.1</strong>。<em>"Windows PowerShell 5.1" 与 "PowerShell Core 6.x" 在此合流</em>。新增 <code>&amp;&amp;</code> / <code>||</code> 管道链运算符 (bash 一样的语义)、三元运算 <code>$x ? a : b</code>、null 合并 <code>??</code>、null 条件 <code>?.</code>、并行 <code>ForEach-Object -Parallel</code>。<strong>这是"现代 PowerShell"的零里程碑</strong>。</> },
    en: { title: <>PowerShell 7.0 GA — the branches reunite</>, desc: <>4 March 2020. <strong>PowerShell 7.0</strong> GA, built on <strong>.NET Core 3.1</strong>. <em>This is where "Windows PowerShell 5.1" and "PowerShell Core 6.x" merge back together</em>. New: <code>&amp;&amp;</code> / <code>||</code> pipeline chain operators (bash semantics), the ternary <code>$x ? a : b</code>, null-coalescing <code>??</code>, null-conditional <code>?.</code>, and <code>ForEach-Object -Parallel</code>. <strong>The mile-zero release of "modern PowerShell"</strong>.</> },
  },
  {
    year: '2022',
    zh: { title: <>PowerShell 7.2 LTS — 第一个长期支持版</>, desc: <>基于 <strong>.NET 6 LTS</strong>。第一个明确的<strong>长期支持 (LTS)</strong> 发布, 微软承诺 3 年安全维护。Azure / Microsoft Graph PowerShell 模块全面迁过来。<em>"现代 pwsh"开始进企业 IT 的生产白名单</em>。</> },
    en: { title: <>PowerShell 7.2 LTS — first long-term release</>, desc: <>Built on <strong>.NET 6 LTS</strong>. The first explicit <strong>Long-Term Support</strong> release, with Microsoft committing to three years of security fixes. The Azure and Microsoft Graph PowerShell modules fully migrate over. <em>"Modern pwsh" makes it onto enterprise IT production allow-lists</em>.</> },
  },
  {
    year: '2024',
    zh: { title: <>PowerShell 7.4 LTS — .NET 8</>, desc: <>第二个 LTS, 基于 <strong>.NET 8</strong>。性能再上一档 (AOT 编译路径), PSReadLine 2.3 预测式 IntelliSense 默认开启 — 命令行体验首次明显超过 bash。同期 GitHub Copilot CLI / Claude Code / Cursor 等 AI agent <strong>开始在 Windows 上默认生成 pwsh 命令</strong>而不是 cmd。</> },
    en: { title: <>PowerShell 7.4 LTS — .NET 8</>, desc: <>The second LTS, built on <strong>.NET 8</strong>. Another perf step (AOT-friendly paths), PSReadLine 2.3 turns on predictive IntelliSense by default — the interactive experience visibly beats bash for the first time. The same window sees GitHub Copilot CLI / Claude Code / Cursor and other AI agents <strong>default to pwsh on Windows</strong> instead of cmd.</> },
  },
  {
    year: '2025',
    zh: { title: <>PowerShell 7.5 — .NET 9 + 性能</>, desc: <>2025 年 1 月 <strong>PowerShell 7.5</strong> GA, 基于 <strong>.NET 9</strong>。重点是性能: <code>+=</code> 拼数组从 O(n²) 降到 O(n) (历史性能坑修了), <code>ConvertTo-Json</code> 快两倍。<strong>WinGet / Microsoft.PowerShell.PSResourceGet</strong> 进入主流, 取代 PowerShellGet v2。<em>cmdlet 包管理终于不再是 2010 的样子</em>。</> },
    en: { title: <>PowerShell 7.5 — .NET 9 + perf</>, desc: <>January 2025. <strong>PowerShell 7.5</strong> GA on <strong>.NET 9</strong>. The headline is performance: <code>+=</code>-array append drops from O(n²) to O(n) (a historical wart fixed), <code>ConvertTo-Json</code> roughly doubles in speed. <strong>WinGet</strong> and <strong>Microsoft.PowerShell.PSResourceGet</strong> become mainstream, replacing PowerShellGet v2. <em>Cmdlet package management finally stops looking like 2010</em>.</> },
  },
  {
    year: '2026',
    zh: { title: <>24 年了 — pwsh 成全平台 Windows 默认</>, desc: <>2026 年的现实: <strong>Windows 自动化 / Azure / Exchange / Active Directory / Microsoft 365</strong> 几乎全靠 pwsh; macOS 与 Linux 上 <code>brew install powershell</code> 一行装好, 多平台 CI 也越来越常见。Jeffrey Snover 早已离开微软 (2021), Steve Lee 接棒维护。<em>"对象管道是不是更好"已经从争论变成微软全栈的事实标准</em>; Windows-side 与 bash 在 Linux-side 的对称, 已经成立。</> },
    en: { title: <>24 years in — pwsh is the cross-platform Windows default</>, desc: <>In 2026: <strong>Windows automation, Azure, Exchange, Active Directory and Microsoft 365</strong> all run almost entirely on pwsh. macOS / Linux take one line — <code>brew install powershell</code> — and cross-platform CI is increasingly mixed. Jeffrey Snover left Microsoft in 2021; Steve Lee leads the project today. <em>"Are object pipelines better?" stopped being a debate</em> and became Microsoft-stack ground truth. The symmetry — pwsh on Windows, bash on Linux — has settled in.</> },
  },
];

interface PwshCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const PWSH_CARDS: PwshCard[] = [
  {
    tag: 'A',
    zh: { title: <>Verb-Noun cmdlet 命名</>, desc: <>所有 cmdlet 强制 <strong><code>动词-名词</code></strong> 命名: <code>Get-Process</code>、<code>Set-Location</code>、<code>New-Item</code>、<code>Remove-Item</code>。动词来自 <em>已批准动词表</em> (<code>Get-Verb</code> 自查), 限定 ≈ 100 个常用动作。<strong>啰嗦, 但 grep / Tab 补全 / 阅读都极顺</strong> — 而且不再有 bash 那种 "<code>cp</code> 是复制、<code>mv</code> 是改名、<code>install</code> 是装包还是装文件"的猜谜。</> },
    en: { title: <>Verb-Noun cmdlet naming</>, desc: <>Every cmdlet is named <strong><code>Verb-Noun</code></strong>: <code>Get-Process</code>, <code>Set-Location</code>, <code>New-Item</code>, <code>Remove-Item</code>. Verbs come from an <em>approved list</em> (<code>Get-Verb</code> shows it) — about 100 sanctioned actions. <strong>Verbose, but greppable, Tab-complete-friendly, and instantly readable</strong>. No more "is <code>cp</code> copy, is <code>install</code> install-a-package or install-a-file?" puzzlers like bash.</> },
    code: (
      <code>
        <span className="cl-c"># discover the verb table</span>{'\n'}
        <span className="cl-fn">Get-Verb</span> | <span className="cl-fn">Where-Object</span> Group <span className="cl-flag">-eq</span> <span className="cl-s">'Data'</span>{'\n\n'}
        <span className="cl-c"># standard 4-cmdlet rhythm</span>{'\n'}
        <span className="cl-fn">Get-Service</span>; <span className="cl-fn">Set-Service</span>{'\n'}
        <span className="cl-fn">Start-Service</span>; <span className="cl-fn">Stop-Service</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>对象管道 — 不传文本</>, desc: <>pwsh 的<strong>核心差异</strong>: <code>|</code> 两侧传<em>真正的 .NET 对象</em>, 不是字符串。<code>Get-Process | Where-Object CPU -gt 10</code> 里 <code>CPU</code> 是<strong>属性名</strong>, 不是从文本切出来的列。下游 cmdlet 直接读字段, 不写 awk / cut / sed 那种"按空格切第 5 列"的脆弱代码。</> },
    en: { title: <>Object pipeline — not text</>, desc: <>pwsh's <strong>defining difference</strong>: <code>|</code> passes <em>real .NET objects</em>, not strings. In <code>Get-Process | Where-Object CPU -gt 10</code>, <code>CPU</code> is a <strong>property name</strong>, not a text column. Downstream cmdlets read fields directly — no more brittle "split on whitespace, take column 5" awk / cut / sed code.</> },
    code: (
      <code>
        <span className="cl-c"># top 5 CPU-hogging processes</span>{'\n'}
        <span className="cl-fn">Get-Process</span> |{'\n'}
        {'  '}<span className="cl-fn">Where-Object</span> CPU <span className="cl-flag">-gt</span> <span className="cl-n">10</span> |{'\n'}
        {'  '}<span className="cl-fn">Sort-Object</span> CPU <span className="cl-flag">-Descending</span> |{'\n'}
        {'  '}<span className="cl-fn">Select-Object</span> <span className="cl-flag">-First</span> <span className="cl-n">5</span> Name,CPU
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>PSDrive — 一切都是文件系统</>, desc: <>注册表、环境变量、证书库、变量、函数, 全部当<strong>挂载的文件系统</strong>暴露: <code>HKLM:\</code>、<code>HKCU:\</code> 是注册表, <code>env:</code> 是环境变量, <code>Cert:\</code> 是证书。<code>cd</code>、<code>ls</code> 都能用。<em>Unix "everything is a file" 的诚实版本</em> — bash 表面像, 但 <code>/proc</code> 不会让你写注册表。</> },
    en: { title: <>PSDrive — everything is a filesystem</>, desc: <>The registry, environment variables, certificate store, variables, and functions are all exposed as <strong>mounted drives</strong>: <code>HKLM:\</code> and <code>HKCU:\</code> for the registry, <code>env:</code> for environment vars, <code>Cert:\</code> for certificates. <code>cd</code> and <code>ls</code> just work. <em>Unix's "everything is a file" taken seriously</em> — bash gestures at it via <code>/proc</code>, but <code>/proc</code> won't let you edit the registry.</> },
    code: (
      <code>
        <span className="cl-fn">cd</span> HKLM:\SOFTWARE\Microsoft{'\n'}
        <span className="cl-fn">Get-ChildItem</span> | <span className="cl-fn">Select</span> <span className="cl-flag">-First</span> <span className="cl-n">5</span>{'\n\n'}
        <span className="cl-c"># read / write env var</span>{'\n'}
        <span className="cl-v">$env:</span><span className="cl-prop">PATH</span> <span className="cl-flag">+=</span> <span className="cl-s">";C:\bin"</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Splatting <code>@params</code></>, desc: <>把<strong>一堆参数打包成 hashtable</strong>, 用 <code>@</code> 而不是 <code>$</code> 展开喂给 cmdlet — 比 bash 的位置参数清晰得多, 也避免一行 200 字符。<em>命名 + 可读 + 可复用</em>: 同一份 <code>@params</code> 可以喂多个 cmdlet。</> },
    en: { title: <>Splatting <code>@params</code></>, desc: <>Pack a <strong>bunch of arguments into a hashtable</strong> and expand it with <code>@</code> (not <code>$</code>) when invoking a cmdlet — way clearer than bash's positional args, and no more 200-char lines. <em>Named, readable, reusable</em>: the same <code>@params</code> can feed several cmdlets.</> },
    code: (
      <code>
        <span className="cl-v">$params</span> = <span className="cl-flag">@{'{'}</span>{'\n'}
        {'  '}<span className="cl-prop">Path</span>        = <span className="cl-s">'C:\out'</span>{'\n'}
        {'  '}<span className="cl-prop">ItemType</span>    = <span className="cl-s">'Directory'</span>{'\n'}
        {'  '}<span className="cl-prop">Force</span>       = <span className="cl-k">$true</span>{'\n'}
        <span className="cl-flag">{'}'}</span>{'\n'}
        <span className="cl-fn">New-Item</span> <span className="cl-v">@params</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>错误处理 — terminating vs non-terminating</>, desc: <>pwsh 的错误分两种: <strong>terminating</strong> (停下来) 与 <strong>non-terminating</strong> (报错但继续)。默认大多数 cmdlet 是<em>非终止</em>的, <code>try / catch</code> 抓不到。要让它能抓: 加 <strong><code>-ErrorAction Stop</code></strong> 或者全局设 <code>$ErrorActionPreference = 'Stop'</code>。<em>第一次写 pwsh 的人 80% 都踩这个坑</em>。</> },
    en: { title: <>Errors — terminating vs non-terminating</>, desc: <>pwsh has two error flavours: <strong>terminating</strong> (the script stops) and <strong>non-terminating</strong> (warn-but-continue). Most cmdlets are <em>non-terminating</em> by default, so <code>try / catch</code> never fires. To make it fire: add <strong><code>-ErrorAction Stop</code></strong>, or set <code>$ErrorActionPreference = 'Stop'</code> globally. <em>80% of newcomers fall into this pit first</em>.</> },
    code: (
      <code>
        <span className="cl-c"># silently wrong: catch never runs</span>{'\n'}
        <span className="cl-k">try</span> {'{'} <span className="cl-fn">Get-Item</span> nope {'}'} <span className="cl-k">catch</span> {'{'} <span className="cl-s">'oops'</span> {'}'}{'\n\n'}
        <span className="cl-c"># right: -ErrorAction Stop promotes it</span>{'\n'}
        <span className="cl-k">try</span> {'{'}{'\n'}
        {'  '}<span className="cl-fn">Get-Item</span> nope <span className="cl-flag">-ErrorAction Stop</span>{'\n'}
        {'}'} <span className="cl-k">catch</span> {'{'} <span className="cl-fn">Write-Host</span> <span className="cl-v">$_</span> {'}'}
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>String quoting — 单引号 vs 双引号</>, desc: <><strong>双引号 <code>"..."</code></strong> 做<em>变量插值</em>: <code>"hi $name"</code>。<strong>单引号 <code>'...'</code></strong> 是<em>字面量</em>: <code>'$ literal'</code>。<em>就 2 种, 没有 bash 那 6 层 quoting 鬼故事</em>。复杂表达式插值用 <code>"$(...)"</code> — <code>$()</code> 是子表达式语法。</> },
    en: { title: <>String quoting — single vs double</>, desc: <><strong>Double quotes <code>"..."</code></strong> interpolate: <code>"hi $name"</code>. <strong>Single quotes <code>'...'</code></strong> are literal: <code>'$ literal'</code>. <em>Two flavours, full stop — none of bash's six-layer quoting horror stories</em>. For interpolating complex expressions: <code>"$(...)"</code> — <code>$()</code> is the subexpression operator.</> },
    code: (
      <code>
        <span className="cl-v">$name</span> = <span className="cl-s">'world'</span>{'\n'}
        <span className="cl-s">"hello $name"</span>      <span className="cl-c"># hello world</span>{'\n'}
        <span className="cl-s">'hello $name'</span>      <span className="cl-c"># hello $name</span>{'\n'}
        <span className="cl-s">"now: $(Get-Date)"</span> <span className="cl-c"># subexpr</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>原生 exe 调用 — 路径含空格</>, desc: <>路径里有空格就<strong>用 call 操作符 <code>&amp;</code></strong>: <code>{'& "C:\\Program Files\\App\\a.exe" arg1'}</code>。直接写"<code>{'"C:\\Program Files\\..."'} arg1</code>" 会被解析成<em>字符串字面量</em>, 不会执行。<strong>停止解析记号 <code>--%</code></strong>: 把后面的原样喂给目标进程, 用来对付参数里有 <code>-</code> / <code>@</code> 等被 pwsh 抢走的字符。</> },
    en: { title: <>Invoking native exes — paths with spaces</>, desc: <>If the path contains spaces, <strong>use the call operator <code>&amp;</code></strong>: <code>{'& "C:\\Program Files\\App\\a.exe" arg1'}</code>. Writing "<code>{'"C:\\Program Files\\..."'} arg1</code>" just creates a <em>string literal</em>; it won't execute. <strong>The stop-parsing token <code>--%</code></strong>: hand the rest of the line verbatim to the target process — useful when args contain <code>-</code> or <code>@</code> that pwsh would otherwise eat.</> },
    code: (
      <code>
        <span className="cl-c"># spaces in path → call op</span>{'\n'}
        <span className="cl-k">&amp;</span> <span className="cl-s">"C:\\Program Files\\Git\\bin\\git.exe"</span> status{'\n\n'}
        <span className="cl-c"># preserve raw args</span>{'\n'}
        git log <span className="cl-flag">--%</span> <span className="cl-flag">--format=%H</span> <span className="cl-flag">-n5</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Format-Table / Format-List 与 ConvertTo-Json</>, desc: <>对象进了管道, 输出怎么变好看是另一个 cmdlet 的工作: <code>Format-Table -AutoSize</code> 表格、<code>Format-List</code> 竖排详情、<code>ConvertTo-Json -Depth 5</code> 直接序列化。<strong>关键铁律: <code>Format-*</code> 必须放管道最末端</strong> — 它返回的是<em>渲染对象</em>, 不能再喂给其它 cmdlet (新人最常见的"为什么我后面 Where 不工作"的根因)。</> },
    en: { title: <>Format-Table / Format-List / ConvertTo-Json</>, desc: <>Once objects exit a pipeline, a separate cmdlet shapes the output: <code>Format-Table -AutoSize</code> for tables, <code>Format-List</code> for stacked detail, <code>ConvertTo-Json -Depth 5</code> for serialisation. <strong>The iron rule: put <code>Format-*</code> at the very end</strong> — it returns <em>render objects</em>, not data, and downstream cmdlets break on it (the canonical "why doesn't my Where work after this?" newcomer trap).</> },
    code: (
      <code>
        <span className="cl-c"># right: filter first, format last</span>{'\n'}
        <span className="cl-fn">Get-Process</span> | <span className="cl-fn">Where</span> CPU <span className="cl-flag">-gt</span> <span className="cl-n">10</span> |{'\n'}
        {'  '}<span className="cl-fn">Format-Table</span> Name,CPU <span className="cl-flag">-AutoSize</span>{'\n\n'}
        <span className="cl-c"># JSON for tooling</span>{'\n'}
        <span className="cl-fn">Get-Process</span> | <span className="cl-fn">ConvertTo-Json</span> <span className="cl-flag">-Depth</span> <span className="cl-n">3</span>
      </code>
    ),
  },
];

interface WhyCard {
  icon: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const WHY_CARDS: WhyCard[] = [
  {
    icon: '|',
    zh: { title: <>对象管道是<em>字面</em>的</>, desc: <><strong>cmd1 | cmd2 实际传一个 .NET 对象</strong>, 不是经过 stdout 文本回环再 awk 切回来。结果: <em>过滤、排序、选列</em> 直接按字段名, 没有"按空格切第 N 列"的脆弱性。<strong>2026 年 AI 工具链生成 pwsh 命令时这套语义的可解释性也明显更高</strong> — 模型不用瞎猜列分隔符。</>} ,
    en: { title: <>Object pipelines, literally</>, desc: <><strong>cmd1 | cmd2 hands over an actual .NET object</strong>, not a stdout-text round-trip parsed back with awk. Effect: <em>filtering, sorting, projecting</em> work by field name with no "split on whitespace, take column N" fragility. <strong>In 2026 this also makes pwsh easier for AI tools to reason about</strong> — no guessing the column separator.</> },
    code: <><span className="cl-fn">Get-ChildItem</span> | <span className="cl-fn">Where</span> Length <span className="cl-flag">-gt</span> 1MB |{'\n'}{'  '}<span className="cl-fn">Sort</span> Length <span className="cl-flag">-Desc</span> | <span className="cl-fn">Select</span> Name,Length</>,
  },
  {
    icon: '>',
    zh: { title: <>Windows 自动化默认</>, desc: <>Windows 桌面 / Server / Azure / Active Directory / Exchange / Microsoft 365 / Intune / WinGet — <em>这些产品的官方自动化通道全是 pwsh</em>。GUI 是可选的, pwsh 是必选的。<strong>2026 在 Windows 上不会写 pwsh = 半残</strong>, 跟 Linux 上不会 bash 同等。</>} ,
    en: { title: <>The Windows automation default</>, desc: <>Windows desktop / Server / Azure / Active Directory / Exchange / Microsoft 365 / Intune / WinGet — <em>the official automation interface for every one of them is pwsh</em>. The GUI is optional; pwsh is not. <strong>In 2026, not knowing pwsh on Windows is the same handicap as not knowing bash on Linux</strong>.</> },
    code: <><span className="cl-fn">Connect-AzAccount</span>{'\n'}<span className="cl-fn">Get-AzVM</span> | <span className="cl-fn">Where</span> PowerState <span className="cl-flag">-eq</span> <span className="cl-s">'Running'</span></>,
  },
  {
    icon: '~',
    zh: { title: <>交互 = 脚本 (同形)</>, desc: <>与 bash 共享的优点: <strong>命令行敲的语法 = .ps1 脚本写的语法</strong>。在 prompt 验证好的一行复制进 <code>.ps1</code> 就跑。<em>差别: pwsh 的 prompt 体验更好</em> — PSReadLine 默认带历史预测、参数补全、错误高亮, 这是 bash 装一堆插件才接近的水平。</>} ,
    en: { title: <>Interactive = scripted</>, desc: <>It shares this with bash: <strong>what you type at the prompt is exactly what goes into a .ps1 file</strong>. Validate at the prompt, paste into a script, done. <em>The difference: pwsh's interactive experience is just better</em> — PSReadLine ships predictive history, parameter completion and error highlighting out of the box, which bash needs a stack of plugins to approximate.</> },
    code: <><span className="cl-c"># works at the prompt and in .ps1</span>{'\n'}<span className="cl-fn">Get-ChildItem</span> <span className="cl-flag">-Recurse</span> <span className="cl-flag">-Filter</span> <span className="cl-s">'*.log'</span></>,
  },
  {
    icon: '#',
    zh: { title: <>跨平台 — Linux / macOS 也能跑</>, desc: <>2016 年开源后 pwsh <strong>真的跨平台</strong>: <code>brew install powershell</code> / <code>apt install powershell</code> / docker 镜像。Microsoft 自己的跨平台模块 (Az / Microsoft.Graph) 在 Linux 上稳定生产。<em>同一个脚本管理 Windows 服务器和 Linux 服务器</em>, 是 bash 给不了的能力。</>} ,
    en: { title: <>Cross-platform — yes, Linux and macOS</>, desc: <>Since the 2016 open-source release pwsh is <strong>actually cross-platform</strong>: <code>brew install powershell</code>, <code>apt install powershell</code>, Docker images. Microsoft's own cross-platform modules (Az, Microsoft.Graph) are production-stable on Linux. <em>Managing Windows and Linux servers from one script</em> is something bash can't offer in reverse.</> },
    code: <><span className="cl-c"># works the same on Win / mac / Linux</span>{'\n'}pwsh <span className="cl-flag">-c</span> <span className="cl-s">'Get-Date | ConvertTo-Json'</span></>,
  },
  {
    icon: '$',
    zh: { title: <>装在每台现代 Windows 上</>, desc: <>Windows 7 (2009) 之后<strong>每台 Windows 都自带 PowerShell</strong> (老的 5.1 还在, 新的 7.x 一句 <code>winget install Microsoft.PowerShell</code>)。<em>不需要装 Python、不需要 WSL</em>。这是它和 bash 在 Linux 上对称的"<strong>预装即标准</strong>"地位。</>} ,
    en: { title: <>Pre-installed on every modern Windows</>, desc: <>Since Windows 7 (2009) <strong>every Windows ship has PowerShell built in</strong> (the older 5.1 is still there; modern 7.x is one line: <code>winget install Microsoft.PowerShell</code>). <em>No Python install, no WSL required</em>. This is its symmetric position to bash on Linux — <strong>pre-installed therefore default</strong>.</> },
    code: <><span className="cl-c"># on every Win11 / Server box, day-one</span>{'\n'}<span className="cl-v">$PSVersionTable</span>.<span className="cl-prop">PSVersion</span></>,
  },
];

interface Idiom {
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const IDIOMS: Idiom[] = [
  {
    zh: { title: <>过滤 + 排序 + 取前 N</>, desc: <>pwsh 的"hello world": <strong>三段管道</strong> 把对象筛掉、排序、截断。每段都按字段名工作。</> },
    en: { title: <>Filter + sort + take N</>, desc: <>pwsh's hello-world: a <strong>three-stage pipeline</strong> filtering, sorting, and slicing by field name.</> },
    code: <>Get-Process | Where CPU <span className="cl-flag">-gt</span> 10 | Sort CPU <span className="cl-flag">-Desc</span> | Select <span className="cl-flag">-First</span> 5</>,
  },
  {
    zh: { title: <>读 / 写环境变量</>, desc: <>用 <code>$env:</code> drive 读写, 不用 <code>setx</code> / <code>Set-Variable</code> 那种老接口。</> },
    en: { title: <>Read / write env vars</>, desc: <>Use the <code>$env:</code> drive — skip the legacy <code>setx</code> / <code>Set-Variable</code> route.</> },
    code: <><span className="cl-v">$env:</span><span className="cl-prop">PATH</span> += <span className="cl-s">';C:\bin'</span></>,
  },
  {
    zh: { title: <>JSON 双向</>, desc: <>读: <code>Get-Content x.json | ConvertFrom-Json</code>。写: 任意对象 <code>| ConvertTo-Json -Depth 5</code>。<strong>jq 不再是刚需</strong>。</> },
    en: { title: <>JSON in both directions</>, desc: <>Read: <code>Get-Content x.json | ConvertFrom-Json</code>. Write: any object <code>| ConvertTo-Json -Depth 5</code>. <strong>jq is no longer mandatory</strong>.</> },
    code: <>cat data.json | ConvertFrom-Json | Select id,name</>,
  },
  {
    zh: { title: <>幂等建目录</>, desc: <><code>New-Item -ItemType Directory -Force path</code>, 已存在不报错。pwsh 版的 <code>mkdir -p</code>。</> },
    en: { title: <>Idempotent mkdir</>, desc: <><code>New-Item -ItemType Directory -Force path</code> — no error if it already exists. The pwsh equivalent of <code>mkdir -p</code>.</> },
    code: <>New-Item <span className="cl-flag">-ItemType</span> Directory <span className="cl-flag">-Force</span> <span className="cl-s">'C:\out\data'</span></>,
  },
  {
    zh: { title: <>splatting 喂多参数</>, desc: <>把一堆命名参数装进 hashtable, 用 <code>@params</code> 展开。<strong>避免 200 字符长行</strong>。</> },
    en: { title: <>Splatting named args</>, desc: <>Pack named args into a hashtable, expand with <code>@params</code>. <strong>Kills 200-char lines</strong>.</> },
    code: <>{'$p = @{Path="C:\\x"; Force=$true}; New-Item @p'}</>,
  },
  {
    zh: { title: <>等待远端端口</>, desc: <>跨平台版本: <code>Test-NetConnection</code> (Win) 或 <code>Test-Connection -TcpPort</code> (7.x+ 跨平台)。<strong>容器化常用</strong>。</> },
    en: { title: <>Wait for a remote port</>, desc: <>Cross-platform: <code>Test-NetConnection</code> on Windows or <code>Test-Connection -TcpPort</code> (7.x+ cross-platform). <strong>Common in containerised flows</strong>.</> },
    code: <>{'while (-not (Test-Connection host -TcpPort 5432 -Quiet)) { Start-Sleep 1 }'}</>,
  },
  {
    zh: { title: <>错误强制终止</>, desc: <>所有 cmdlet 调用都加 <code>-ErrorAction Stop</code>, 或者文件首行 <code>{'$ErrorActionPreference = "Stop"'}</code>。<strong>strict mode pwsh 版</strong>。</> },
    en: { title: <>Force errors to terminate</>, desc: <>Either add <code>-ErrorAction Stop</code> per cmdlet or set <code>{'$ErrorActionPreference = "Stop"'}</code> at the top. <strong>The pwsh strict-mode posture</strong>.</> },
    code: <>{'$ErrorActionPreference = "Stop"; Set-StrictMode -Version Latest'}</>,
  },
  {
    zh: { title: <>shebang 让脚本跨平台跑</>, desc: <>Linux / macOS 上的 <code>.ps1</code> 也可以 chmod +x 直接跑, 头一行 <code>#!/usr/bin/env pwsh</code>。<strong>2026 跨平台脚本的合法形态</strong>。</> },
    en: { title: <>Shebang for cross-platform scripts</>, desc: <>On Linux / macOS, <code>chmod +x</code> a <code>.ps1</code> and ship it. Header: <code>#!/usr/bin/env pwsh</code>. <strong>The legitimate cross-platform script shape in 2026</strong>.</> },
    code: <><span className="cl-c">#!/usr/bin/env pwsh</span></>,
  },
  {
    zh: { title: <>Remoting — 在远端跑代码块</>, desc: <><code>Invoke-Command -ComputerName srv -ScriptBlock {'{ Get-Service }'}</code> — 序列化对象跨机回传。<strong>ssh + 命令行</strong> 的对象化版本。</> },
    en: { title: <>Remoting — execute a script block remotely</>, desc: <><code>Invoke-Command -ComputerName srv -ScriptBlock {'{ Get-Service }'}</code> — objects serialise across the wire and come back home. <strong>An object-aware ssh + run</strong>.</> },
    code: <>Invoke-Command <span className="cl-flag">-ComputerName</span> srv01 <span className="cl-flag">-ScriptBlock</span> {'{ Get-Service }'}</>,
  },
];

interface ShellLogo {
  href: string;
  zhName: string;
  enName: string;
  zhNote: string;
  enNote: string;
  highlight?: boolean;
  svg: ReactNode;
}

const ECOSYSTEM: ShellLogo[] = [
  {
    href: 'https://learn.microsoft.com/powershell/', highlight: true,
    zhName: 'PowerShell 7', enName: 'PowerShell 7',
    zhNote: 'pwsh 7.5 · MIT · 跨平台', enNote: 'pwsh 7.5 · MIT · cross-platform',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#012456"/><text x="50" y="66" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="34" fill="#8EBBFF">{'>_'}</text></svg>,
  },
  {
    href: 'https://learn.microsoft.com/powershell/scripting/windows-powershell/what-is-windows-powershell', highlight: true,
    zhName: 'Windows PowerShell 5.1', enName: 'Windows PowerShell 5.1',
    zhNote: '2016 · 老世代 · 每台 Win10/11', enNote: '2016 · legacy · on every Win10/11',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0B1428"/><text x="50" y="66" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="32" fill="#5391FE">PS</text></svg>,
  },
  {
    href: 'https://dotnet.microsoft.com/',
    zhName: '.NET 9', enName: '.NET 9',
    zhNote: 'pwsh 7.5 的运行时', enNote: 'pwsh 7.5 runtime',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#5028D7"/><text x="50" y="64" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="22" fill="#fff">.NET</text></svg>,
  },
  {
    href: 'https://www.powershellgallery.com/',
    zhName: 'PowerShell Gallery', enName: 'PowerShell Gallery',
    zhNote: 'Az / Microsoft.Graph / Pester', enNote: 'Az / Microsoft.Graph / Pester',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1B3A7A"/><circle cx="50" cy="50" r="22" fill="none" stroke="#8EBBFF" strokeWidth="4"/><circle cx="50" cy="50" r="6" fill="#8EBBFF"/></svg>,
  },
  {
    href: 'https://github.com/PowerShell/PSReadLine',
    zhName: 'PSReadLine', enName: 'PSReadLine',
    zhNote: '历史预测 · 语法高亮 · 默认装', enNote: 'Predictive history · highlighting · bundled',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F2030"/><rect x="20" y="42" width="40" height="3" fill="#5391FE"/><rect x="20" y="52" width="60" height="3" fill="#6680A8"/><rect x="20" y="62" width="30" height="3" fill="#6680A8"/></svg>,
  },
  {
    href: 'https://learn.microsoft.com/powershell/utility-modules/psresourceget/',
    zhName: 'PSResourceGet', enName: 'PSResourceGet',
    zhNote: '2024+ · 取代 PowerShellGet', enNote: '2024+ · replaces PowerShellGet',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#162845"/><rect x="32" y="30" width="36" height="36" fill="none" stroke="#8EBBFF" strokeWidth="3"/><rect x="42" y="60" width="16" height="14" fill="#8EBBFF"/></svg>,
  },
  {
    href: 'https://pester.dev/',
    zhName: 'Pester', enName: 'Pester',
    zhNote: 'pwsh 测试框架 · BDD', enNote: 'pwsh test framework · BDD',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1A2A"/><path d="M30 50 L46 66 L72 32" fill="none" stroke="#8EBBFF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://github.com/PowerShell/PSScriptAnalyzer',
    zhName: 'PSScriptAnalyzer', enName: 'PSScriptAnalyzer',
    zhNote: 'pwsh 版 ShellCheck', enNote: 'The pwsh equivalent of ShellCheck',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0B0F18"/><text x="50" y="68" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="40" fill="#8EBBFF">PSA</text></svg>,
  },
  {
    href: 'https://learn.microsoft.com/powershell/module/az/',
    zhName: 'Az module', enName: 'Az module',
    zhNote: 'Azure 全栈管理', enNote: 'Full-stack Azure management',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0078D4"/><path d="M30 70 L50 30 L70 70 L60 70 L50 50 L40 70 Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://learn.microsoft.com/powershell/microsoftgraph/',
    zhName: 'Microsoft.Graph', enName: 'Microsoft.Graph',
    zhNote: 'M365 / Entra / Intune', enNote: 'M365 / Entra / Intune',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F1A33"/><circle cx="50" cy="50" r="20" fill="none" stroke="#5391FE" strokeWidth="3"/><circle cx="32" cy="50" r="4" fill="#5391FE"/><circle cx="68" cy="50" r="4" fill="#5391FE"/><circle cx="50" cy="32" r="4" fill="#5391FE"/><circle cx="50" cy="68" r="4" fill="#5391FE"/></svg>,
  },
  {
    href: 'https://github.com/microsoft/winget-cli',
    zhName: 'WinGet', enName: 'WinGet',
    zhNote: '官方 Windows 包管理器', enNote: 'Official Windows package manager',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><rect x="28" y="40" width="44" height="28" fill="none" stroke="#8EBBFF" strokeWidth="3"/><rect x="38" y="30" width="24" height="14" fill="#8EBBFF"/></svg>,
  },
  {
    href: 'https://github.com/PowerShell/PowerShell',
    zhName: 'GitHub Actions', enName: 'GitHub Actions',
    zhNote: 'shell: pwsh · Win runner 默认', enNote: 'shell: pwsh · default on Win runners',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><circle cx="50" cy="50" r="22" fill="none" stroke="#5391FE" strokeWidth="4"/><path d="M50 38 L62 50 L50 62 L44 56 L50 50 L44 44 Z" fill="#5391FE"/></svg>,
  },
];

interface PitfallCard {
  tag: ReactNode;
  hot?: boolean;
  big?: boolean;
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const PITFALLS: PitfallCard[] = [
  {
    tag: <>HOT · <L zh="最常见" en="most common" /></>, hot: true, big: true,
    zh: {
      title: <>Execution Policy — "无法加载脚本"</>,
      body: (<>
        <p>第一次跑 <code>.ps1</code> 的人 100% 会撞: <strong>"<em>... 因为在此系统上禁止运行脚本</em>"</strong>。这不是病毒, 是 Windows 默认的 <strong><code>Restricted</code></strong> 执行策略 — 它<em>只允许交互式命令, 禁止脚本文件</em>。</p>
        <p><strong>正解</strong>: 给当前用户开 <code>RemoteSigned</code> — 本地脚本随便跑, 网上下的必须签名。一次永久, 不需要管理员:</p>
        <pre className="future-code"><code>
          <span className="cl-fn">Set-ExecutionPolicy</span> <span className="cl-flag">-Scope</span> CurrentUser <span className="cl-flag">-ExecutionPolicy</span> RemoteSigned{'\n\n'}
          <span className="cl-c"># sanity check</span>{'\n'}
          <span className="cl-fn">Get-ExecutionPolicy</span> <span className="cl-flag">-List</span>
        </code></pre>
      </>),
    },
    en: {
      title: <>Execution Policy — "running scripts is disabled"</>,
      body: (<>
        <p>Every newcomer hits this within five minutes: <strong>"<em>... the script cannot be loaded because running scripts is disabled on this system</em>"</strong>. It is not a virus warning — it's the default <strong><code>Restricted</code></strong> execution policy on Windows, which <em>permits interactive commands but blocks script files</em>.</p>
        <p><strong>The fix</strong>: enable <code>RemoteSigned</code> for the current user — local scripts run freely, downloaded ones must be signed. One command, no admin required:</p>
        <pre className="future-code"><code>
          <span className="cl-fn">Set-ExecutionPolicy</span> <span className="cl-flag">-Scope</span> CurrentUser <span className="cl-flag">-ExecutionPolicy</span> RemoteSigned{'\n\n'}
          <span className="cl-c"># sanity check</span>{'\n'}
          <span className="cl-fn">Get-ExecutionPolicy</span> <span className="cl-flag">-List</span>
        </code></pre>
      </>),
    },
  },
  {
    tag: 'TRAP',
    zh: { title: <><code>try / catch</code> 抓不到错</>, body: <><p>大部分 cmdlet 错误是 <strong>non-terminating</strong>: 屏幕红字、变量 <code>$Error</code> 有记录、但 <code>try / catch</code> 完全感知不到。<strong>修法</strong>: 单次加 <code>-ErrorAction Stop</code>, 全局加 <code>{'$ErrorActionPreference = "Stop"'}</code>。<em>不知道这条规则前, 你写的"防御性代码"几乎都是假象</em>。</p></> },
    en: { title: <><code>try / catch</code> doesn't catch anything</>, body: <><p>Most cmdlet errors are <strong>non-terminating</strong>: red text on screen, an entry in <code>$Error</code>, but <code>try / catch</code> never fires. <strong>The fix</strong>: <code>-ErrorAction Stop</code> per call, or <code>{'$ErrorActionPreference = "Stop"'}</code> globally. <em>Until you know this rule, all your "defensive" code is theatre</em>.</p></> },
  },
  {
    tag: 'TRAP',
    zh: { title: <>启动慢 — pwsh 7.x 冷启动 ~300ms</>, body: <><p>pwsh 启动比 bash 慢一档: <strong>冷启 ~300ms, 暖启 ~100ms</strong> (.NET 加载 + profile 解析)。CI 里跑很多小步骤会累加。<strong>缓解</strong>: <code>pwsh -NoProfile</code> 跳过用户配置, 7.4+ 的 AOT 路径再快一档。<em>但跟 bash 的 ~5ms 比, 数量级差距是真实的</em>。</p></> },
    en: { title: <>Slow startup — pwsh 7.x cold start ~300ms</>, body: <><p>pwsh starts one tier slower than bash: <strong>~300ms cold, ~100ms warm</strong> (.NET load + profile parse). In CI with many small steps it adds up. <strong>Mitigations</strong>: <code>pwsh -NoProfile</code> skips user config; 7.4+'s AOT paths help further. <em>But versus bash's ~5ms, the gap is an order of magnitude — and real</em>.</p></> },
  },
  {
    tag: <>IS PWSH "BLOATED" ?</>,
    zh: { title: <>它是 "重量级" shell 吗</>, body: <><p>形式上是: <strong>需要 .NET 运行时</strong> (~150MB 安装包)、cmdlet 名字啰嗦、启动比 bash 慢。这些都是真的。</p><p>但价值交换很清楚: <em>类型系统 + 对象管道 + 跨平台远程 + 与 Windows 全栈无缝</em>。<strong>选 pwsh 不是因为它轻, 是因为它把"shell"和"语言"做成了同一件东西</strong>。bash 那套"shell 是文本工具 + 语言是另外的事"的分裂, pwsh 不要。</p></> },
    en: { title: <>Is pwsh "heavyweight"?</>, body: <><p>Formally yes: <strong>requires the .NET runtime</strong> (~150MB install), cmdlet names are verbose, and startup is slower than bash. All true.</p><p>The trade is explicit, though: <em>a type system + an object pipeline + cross-platform remoting + native fit with the Windows stack</em>. <strong>You pick pwsh not because it's light, but because it merges "the shell" and "the language" into one thing</strong>. The bash split — "shell is a text tool, programming is something else" — pwsh refuses.</p></> },
  },
];

export default function PowershellIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'PowerShell : 2006 Jeffrey Snover · 对象管道 · Windows 自动化默认',
    'PowerShell : 2006 Jeffrey Snover · object pipeline · Windows automation default', "PowerShell : 2006 Jeffrey Snover · 物件管道 · Windows 自動化預設"
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    const targets = root.querySelectorAll<HTMLElement>(
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .compare-col, .cmp-table tr, .ts-card, .idiom-card, .tree-cell, .quote-block, .ai-takeaway'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.idiom-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 60}ms`; });

    const floats = root.querySelectorAll<HTMLElement>('.float');
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouse);
    let raf = 0;
    const loop = () => {
      tx += (mx - tx) * 0.06;
      ty += (my - ty) * 0.06;
      floats.forEach((el, i) => {
        const depth = (i % 3 + 1) * 6;
        el.style.translate = `${tx * depth}px ${ty * depth}px`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const navLinks = root.querySelectorAll<HTMLAnchorElement>('.nav-links a');
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
    const setActive = () => {
      const y = window.scrollY + 120;
      let cur = sections[0]?.id;
      for (const s of sections) if (s.offsetTop <= y) cur = s.id;
      navLinks.forEach((a) => {
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--sh-bright)' : '';
      });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();

    const onAnchorClick = (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = id === 'top' ? root : root.querySelector('#' + id);
      if (target) {
        e.preventDefault();
        const top = (target as HTMLElement).getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    };
    const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    anchors.forEach((a) => a.addEventListener('click', onAnchorClick));

    return () => {
      io.disconnect();
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', setActive);
      cancelAnimationFrame(raf);
      anchors.forEach((a) => a.removeEventListener('click', onAnchorClick));
    };
  }, []);

  return (
    <LangCtx.Provider value={lang}>
      <div ref={rootRef} className="powershell-intro-root">
        <div className="grid-bg" />
        <div className="scanlines" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            {PWSH_LOGO_SMALL}
            <span>PowerShell</span>
            <span className="nav-tag"><L zh=": 中文导览" en=": Guide" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#family"><L zh="家谱" en="Family" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#system"><L zh="语法精要" en="Essentials" /></a></li>
            <li><a href="#idioms"><L zh="名段" en="Idioms" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#shells"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#vs"><L zh="对比" en="vs" /></a></li>
            <li><a href="#pitfalls"><L zh="坑与现实" en="Pitfalls" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2006 — 2026 · Jeffrey Snover · Microsoft · object pipeline · #!/usr/bin/env pwsh</div>
            <h1 className="hero-title">
              <span className="hero-prompt">{'>'}</span>
              <span className="hero-name">pwsh</span>
              <span className="hero-cursor" />
            </h1>
            <p className="hero-sub">
              <L
                zh={<><strong>2006 年</strong> Jeffrey Snover 在微软发布 PowerShell 1.0, 写在 <strong>"Monad Manifesto"</strong> (2002) 之后 4 年。核心命题: <strong>管道传对象, 不传文本</strong>。20 年后, pwsh 7.5 是 Windows / Azure / Microsoft 365 自动化的事实通用语, MIT 开源, 跨平台跑 Linux 与 macOS。<em>2026 在 Windows 上不会写 pwsh, 跟 Linux 上不会 bash 是对称的残缺</em>。</>}
                en={<>In <strong>2006</strong> Jeffrey Snover shipped PowerShell 1.0 at Microsoft — four years after his <strong>"Monad Manifesto"</strong> (2002). Core thesis: <strong>pipe objects, not text</strong>. Twenty years later, pwsh 7.5 is the lingua franca of Windows / Azure / Microsoft 365 automation, MIT-licensed open source, cross-platform on Linux and macOS. <em>In 2026, not knowing pwsh on Windows is the symmetric handicap to not knowing bash on Linux</em>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2006<small></small></span>
                <span className="stat-label"><L zh={<>11 月 14 日 PowerShell 1.0<br /><em>Jeffrey Snover · Microsoft</em></>} en={<>PowerShell 1.0 · 14 Nov<br /><em>Jeffrey Snover · Microsoft</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">2016<small></small></span>
                <span className="stat-label"><L zh={<>开源 + 跨平台<br /><em>MIT · Linux / macOS</em></>} en={<>Open-sourced + cross-platform<br /><em>MIT · Linux / macOS</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">7.5<small></small></span>
                <span className="stat-label"><L zh={<>2025 LTS 候选<br /><em>.NET 9 · 性能再上一档</em></>} en={<>2025 LTS-bound<br /><em>.NET 9 · another perf tier</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">.NET<small></small></span>
                <span className="stat-label"><L zh={<>对象类型系统<br /><em>不是 awk-cut-sed 那套</em></>} en={<>Real type system<br /><em>not awk / cut / sed</em></>} /></span>
              </div>
            </div>

            <div className="hero-term">
              <div className="hero-term-bar">
                <span className="dot dot-red" />
                <span className="dot dot-yel" />
                <span className="dot dot-grn" />
                <span className="term-title">~/work — pwsh 7.5 — 80×24</span>
              </div>
              <div className="hero-term-body">
                <span className="p">{'>'}</span> <span className="fn">Get-Process</span> <span className="o">|</span>{'\n'}
                {'  '}<span className="fn">Where</span> <span className="k">CPU</span> <span className="o">-gt</span> <span className="s">10</span> <span className="o">|</span>{'\n'}
                {'  '}<span className="fn">Sort</span> <span className="k">CPU</span> <span className="o">-Desc</span> <span className="o">|</span>{'\n'}
                {'  '}<span className="fn">Select</span> <span className="o">-First</span> <span className="s">5</span>{'\n'}
                <span className="p">{'>'}</span> <span className="c"># objects, not text</span>{'\n'}
                <span className="p">{'>'}</span> _
              </div>
            </div>

            <div className="hero-floats">
              <span className="float f1">Get-Process</span>
              <span className="float f2">{'$_ | Where'}</span>
              <span className="float f3">{'@params'}</span>
              <span className="float f4">{'-ErrorAction Stop'}</span>
              <span className="float f5">{'$env:PATH'}</span>
              <span className="float f6">{'ConvertTo-Json'}</span>
              <span className="float f7">Invoke-Command</span>
              <span className="float f8">{'#!/usr/bin/env pwsh'}</span>
              <span className="float f9">{'HKLM:\\'}</span>
              <span className="float f10">{'ForEach -Parallel'}</span>
              <span className="float f11">{'Verb-Noun'}</span>
              <span className="float f12">{'pwsh -NoProfile'}</span>
            </div>
            <div className="scroll-cue">
              <span>scroll</span>
              <svg viewBox="0 0 12 24" width="12" height="24"><path d="M6 0v22M2 18l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
            </div>
          </section>

          {/* 01 What */}
          <section className="section" id="what">
            <header className="sec-head">
              <span className="sec-num">01</span>
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>pwsh</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>PowerShell 是<strong>建立在 .NET 上的命令行 shell + 脚本语言</strong>, Jeffrey Snover 在 2002 写 manifesto, 2006 发 1.0, 2016 开源跨平台。它<strong>同时</strong>是交互式命令解释器和脚本语言 — 跟 bash 共享这点。<strong>但</strong>它选了一条完全不同的路: <em>管道传 .NET 对象, 不传文本</em>。</>}
                  en={<>PowerShell is a <strong>command-line shell and scripting language on top of .NET</strong>. Jeffrey Snover wrote the manifesto in 2002, shipped 1.0 in 2006, and open-sourced it cross-platform in 2016. Like bash, it is <strong>both</strong> an interactive command interpreter and a scripting language. <strong>But</strong> it took a different road: <em>pipelines carry .NET objects, not text</em>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="对象管道" en="Object pipeline" />, tag: 'design', p: <L zh={<><code>|</code> 两端是<strong>真正的 .NET 对象</strong>, 不是 stdout 文本。<code>Get-Process | Where CPU -gt 10</code> 里 <code>CPU</code> 是<em>属性</em>不是文本切出来的列。<strong>20 年 shell 设计辩论的另一种答案</strong>。</>} en={<>Both ends of <code>|</code> are <strong>real .NET objects</strong>, not stdout text. In <code>Get-Process | Where CPU -gt 10</code>, <code>CPU</code> is a <em>property</em>, not a text column. <strong>The other answer to twenty years of shell-design debate</strong>.</>} /> },
                { h: <L zh="cmdlet (Verb-Noun)" en="cmdlet (Verb-Noun)" />, tag: 'naming', p: <L zh={<>所有内置命令叫 <strong>cmdlet</strong>, 强制 <code>Verb-Noun</code> 命名 + 约 100 个批准动词。<em>啰嗦, 但全自洽且可发现</em>。<code>Get-Verb</code> 把表自己列给你。</>} en={<>Built-in commands are called <strong>cmdlets</strong>, named <code>Verb-Noun</code> with ~100 approved verbs. <em>Verbose but consistent and discoverable</em>. <code>Get-Verb</code> prints the table for you.</>} /> },
                { h: <L zh="建在 .NET 上" en="Built on .NET" />, tag: 'runtime', p: <L zh={<>pwsh 7.5 用 <strong>.NET 9</strong>。<em>整个 .NET BCL 是它的标准库</em>: <code>[System.IO.Path]::GetFileName(...)</code> 直接在脚本里调。代价: ~150MB 运行时、启动比 bash 慢一档。</>} en={<>pwsh 7.5 runs on <strong>.NET 9</strong>. <em>The full .NET BCL is its standard library</em>: <code>[System.IO.Path]::GetFileName(...)</code> works directly in scripts. The cost: a ~150MB runtime and a slower start than bash.</>} /> },
                { h: <L zh="跨平台 (2016+)" en="Cross-platform (2016+)" />, tag: 'reach', p: <L zh={<>原本只在 Windows, 2016 开源后<strong>真跨平台</strong>: Linux / macOS 上 <code>brew install powershell</code> 一行。<em>Az / Microsoft.Graph 模块在 Linux 上是生产级</em>, 不是玩具支持。</>} en={<>Originally Windows-only — since 2016 it's <strong>genuinely cross-platform</strong>: <code>brew install powershell</code> on Mac, <code>apt install</code> on Linux. <em>Az / Microsoft.Graph modules are production-grade on Linux</em>, not toy ports.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">top5cpu.sh</span><span className="lang-tag js">bash · text pipeline</span></div>
                <pre className="code"><code>
                  <span className="cl-c">#!/usr/bin/env bash</span>{'\n'}
                  <span className="cl-k">set</span> <span className="cl-flag">-euo pipefail</span>{'\n\n'}
                  ps <span className="cl-flag">-eo</span> pid,pcpu,comm <span className="cl-flag">--sort=-pcpu</span> <span className="cl-flag">|</span>{'\n'}
                  {'  '}<span className="cl-fn">awk</span> <span className="cl-s">'NR&gt;1 &amp;&amp; $2+0 &gt; 10'</span> <span className="cl-flag">|</span>{'\n'}
                  {'  '}<span className="cl-fn">head</span> <span className="cl-flag">-5</span>{'\n\n'}
                  <span className="cl-c"># column index $2 is text. fragile.</span>{'\n'}
                  <span className="cl-c"># sort key is ps's --sort flag, not generic.</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">top5cpu.ps1</span><span className="lang-tag ts">pwsh · object pipeline</span></div>
                <pre className="code"><code>
                  <span className="cl-c">#!/usr/bin/env pwsh</span>{'\n'}
                  <span className="cl-v">$ErrorActionPreference</span> = <span className="cl-s">'Stop'</span>{'\n\n'}
                  <span className="cl-fn">Get-Process</span> |{'\n'}
                  {'  '}<span className="cl-fn">Where-Object</span> CPU <span className="cl-flag">-gt</span> <span className="cl-n">10</span> |{'\n'}
                  {'  '}<span className="cl-fn">Sort-Object</span> CPU <span className="cl-flag">-Descending</span> |{'\n'}
                  {'  '}<span className="cl-fn">Select-Object</span> <span className="cl-flag">-First</span> <span className="cl-n">5</span>{'\n\n'}
                  <span className="cl-c"># CPU is a real .NET property.</span>{'\n'}
                  <span className="cl-c"># Sort and Where compose generically.</span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 Family Tree */}
          <section className="section" id="family">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="家谱" en="Family Tree" /> <code>: ShellLineage</code></h2>
              <p className="sec-desc"><L
                zh={<>PowerShell 不在 1971 Thompson shell 那条主线上。它的血统是 <em>cmd.exe + Tcl + Perl + .NET</em> 的混合, Snover 在 manifesto 里明确致敬 — 选了对象管道这一支, 跟 bash 站在 Unix 哲学的另一边。</>}
                en={<>PowerShell does not descend from the 1971 Thompson shell. Its lineage is a blend of <em>cmd.exe + Tcl + Perl + .NET</em>, explicitly acknowledged in Snover's manifesto. It chose the object-pipeline branch, opposite bash on the Unix-philosophy axis.</>}
              /></p>
            </header>

            <div className="tree-wrap">
              <div className="tree-grid">
                <div className="tree-cell head">1990s</div>
                <div className="tree-cell head">2000s</div>
                <div className="tree-cell head">2010s early</div>
                <div className="tree-cell head">2016</div>
                <div className="tree-cell head">2020s</div>
                <div className="tree-cell head">2024+</div>
                <div className="tree-cell head"><L zh="血统" en="Lineage" /></div>

                {/* PS main line */}
                <div className="tree-cell empty"></div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name">Monad Manifesto</span>
                  <span className="tree-year">2002 · Snover</span>
                  <span className="tree-note"><L zh="17 页内部文档" en="17-page memo" /></span>
                </div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name pwsh">PowerShell 1.0</span>
                  <span className="tree-year">2006 · GA</span>
                  <span className="tree-note"><L zh="对象管道首航" en="object pipeline ships" /></span>
                </div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name">PS Core 6.0</span>
                  <span className="tree-year">2016 · OSS</span>
                  <span className="tree-note"><L zh="MIT · Linux / Mac" en="MIT · Linux / Mac" /></span>
                </div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name">pwsh 7.0</span>
                  <span className="tree-year">2020 · 合流</span>
                  <span className="tree-note"><L zh=".NET Core 3.1" en=".NET Core 3.1" /></span>
                </div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name">pwsh 7.5</span>
                  <span className="tree-year">2025 · .NET 9</span>
                  <span className="tree-note"><L zh="性能再上一档" en="another perf tier" /></span>
                </div>
                <div className="tree-cell"><L zh="PowerShell 主线" en="PowerShell main line" /></div>

                {/* .NET / DSL parent */}
                <div className="tree-cell lineage-net">
                  <span className="tree-name">.NET Framework</span>
                  <span className="tree-year">2002 · CLR</span>
                  <span className="tree-note"><L zh="对象 / 类型系统" en="object / type system" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell lineage-net">
                  <span className="tree-name">.NET Core 1.0</span>
                  <span className="tree-year">2016</span>
                  <span className="tree-note"><L zh="跨平台 CLR" en="cross-platform CLR" /></span>
                </div>
                <div className="tree-cell lineage-net">
                  <span className="tree-name">.NET 6 LTS</span>
                  <span className="tree-year">2021</span>
                  <span className="tree-note"><L zh="pwsh 7.2 底座" en="pwsh 7.2 base" /></span>
                </div>
                <div className="tree-cell lineage-net">
                  <span className="tree-name">.NET 9</span>
                  <span className="tree-year">2024</span>
                  <span className="tree-note"><L zh="pwsh 7.5 底座" en="pwsh 7.5 base" /></span>
                </div>
                <div className="tree-cell"><L zh=".NET 运行时血脉" en=".NET runtime lineage" /></div>

                {/* Windows CLI ancestors */}
                <div className="tree-cell lineage-cli">
                  <span className="tree-name">cmd.exe</span>
                  <span className="tree-year">1990s · NT</span>
                  <span className="tree-note"><L zh="批处理 .bat" en="batch .bat" /></span>
                </div>
                <div className="tree-cell lineage-cli">
                  <span className="tree-name">WSH / VBScript</span>
                  <span className="tree-year">1998 / 2000s</span>
                  <span className="tree-note"><L zh="WMI 自动化" en="WMI automation" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell"><L zh="Windows CLI 前世" en="Windows CLI ancestors" /></div>

                {/* Unix shell counterpart */}
                <div className="tree-cell lineage-shell">
                  <span className="tree-name">bash</span>
                  <span className="tree-year">1989 · Fox</span>
                  <span className="tree-note"><L zh="文本管道阵营" en="text-pipeline camp" /></span>
                </div>
                <div className="tree-cell lineage-shell">
                  <span className="tree-name">zsh / fish</span>
                  <span className="tree-year">1990 / 2005</span>
                  <span className="tree-note"><L zh="交互式分支" en="interactive branches" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell lineage-shell">
                  <span className="tree-name">nushell</span>
                  <span className="tree-year">2019 · Turner</span>
                  <span className="tree-note"><L zh="结构化 · 取经 pwsh" en="structured · pwsh-inspired" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell"><L zh="Unix shell 对照组" en="Unix-shell counterpart" /></div>
              </div>
              <div className="tree-legend">
                <span><span className="swatch sw-ps" /> <L zh="PowerShell 主线" en="PowerShell main line" /></span>
                <span><span className="swatch sw-net" /> <L zh=".NET 运行时" en=".NET runtime" /></span>
                <span><span className="swatch sw-cli" /> <L zh="Windows CLI 前世" en="Windows CLI ancestors" /></span>
                <span><span className="swatch sw-shell" /> <L zh="Unix shell 对照" en="Unix-shell counterpart" /></span>
              </div>
            </div>
          </section>

          {/* 03 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: 24 yr timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>从 2002 manifesto 到 2026 — 24 年。这条线穿过 Windows 内部、Server / Azure / Microsoft 365 的全栈, 也穿过 2016 那次"我们把它开源, 还要它跑 Linux"的方向反转。<em>Snover 设计的"对象管道"在 24 年后没人能否认</em>。</>}
                en={<>From the 2002 manifesto to 2026 — 24 years. The line runs through Windows internals, the Server / Azure / Microsoft 365 stack, and the 2016 reversal of "we'll open-source it, and yes it has to run on Linux". <em>Twenty-four years on, no one is still arguing against Snover's object pipeline</em>.</>}
              /></p>
            </header>

            <ol className="timeline">
              {HISTORY.map((it, i) => (
                <li className={`tl-item${it.highlight ? ' highlight' : ''}`} key={i}>
                  <div className="tl-year">{it.year}</div>
                  <div className="tl-card">
                    <h3>{lang === 'zh' ? it.zh.title : it.en.title}</h3>
                    <p>{lang === 'zh' ? it.zh.desc : it.en.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 04 Essentials */}
          <section className="section" id="system">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="语法精要" en="Language Essentials" /> <code>: PwshGotchas</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 pwsh 跟 bash <strong>最不像</strong>、也是<strong>最容易翻车</strong>的地方: Verb-Noun、对象管道、PSDrive、splatting、错误处理、quoting、原生 exe 调用、Format-*。第 9 张是"<em>pwsh 是不是 '重量级' shell</em>"的小回答。</>}
                en={<>The eight cards below cover where pwsh <strong>differs hardest</strong> from bash — and <strong>where scripts break</strong>: Verb-Noun, object pipelines, PSDrives, splatting, errors, quoting, native exes, Format-*. The ninth is a brief take on <em>"is pwsh a heavyweight shell?"</em>.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {PWSH_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>"重量级"问题: 是真的, 但不是 deal-breaker</>} en={<>The "heavyweight" question — real, but not a deal-breaker</>} /></h3>
                <p><L
                  zh={<>pwsh <strong>确实重</strong>: .NET 运行时 ~150MB, 启动比 bash 慢一档, cmdlet 名字啰嗦。<strong>但</strong>: 它换来对象管道、类型系统、与 Windows 全栈无缝、跨平台远程。<em>这是把 shell 和语言合并成一件事的代价</em>。bash 永远不付这个代价, 也永远不拥有它换来的东西。</>}
                  en={<>pwsh <strong>is</strong> heavyweight: a ~150MB .NET runtime, a startup-time gap with bash, verbose cmdlet names. <strong>But</strong>: in return — an object pipeline, a type system, native fit with the Windows stack, cross-platform remoting. <em>That's the price of merging "shell" and "language" into one thing</em>. Bash never pays it; bash also never gets what it buys.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>问题不是 shell 能不能解析文本。问题是<strong>为什么</strong>它必须把对象先序列化成文本, 让你再用 awk 解回来。</>}
                  en={<>The question isn't whether a shell can parse text. The question is <strong>why</strong> it should turn objects into text first and ask you to awk them back.</>}
                /></em>" — <L zh="Snover, Monad Manifesto, 2002 (释义)" en="Snover, Monad Manifesto, 2002 (paraphrased)" /></p>
              </div>
            </div>
          </section>

          {/* 05 Idioms */}
          <section className="section" id="idioms">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="名段" en="Idioms Hall of Fame" /> <code>: 9 patterns</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 9 段是 pwsh 圈<strong>认得就能少写一半搜索</strong>的常用模式。每一段都经过 PSScriptAnalyzer 校验。<em>记下来就是 pwsh 中级</em>。</>}
                en={<>Nine patterns that will <strong>cut your search time in half</strong>. Each one validates clean under PSScriptAnalyzer. <em>Memorise them and you're intermediate pwsh</em>.</>}
              /></p>
            </header>

            <div className="idiom-grid">
              {IDIOMS.map((it, i) => (
                <div className="idiom-card" key={i}>
                  <pre className="idiom-code">{it.code}</pre>
                  <h3>{lang === 'zh' ? it.zh.title : it.en.title}</h3>
                  <p>{lang === 'zh' ? it.zh.desc : it.en.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 06 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">06</span>
              <h2 className="sec-title"><L zh="为何还在涨" en="Why It's Still Growing" /> <code>: WhyPwshMatters</code></h2>
              <p className="sec-desc"><L
                zh={<>20 年里 pwsh 没像 bash 那样靠"装在每台机器上"赢, 它靠的是<strong>对象管道 + .NET 类型系统 + Microsoft 全栈的官方通道</strong>。2016 跨平台开源之后, 它从"Windows-only 的奇怪选项"变成"想跨平台管理 Win + Linux 时的合理选择"。</>}
                en={<>For twenty years pwsh hasn't won the way bash won (pre-installed everywhere). It won via <strong>the object pipeline + a real .NET type system + being Microsoft's official automation channel for the full stack</strong>. After the 2016 open-source release it shifted from "Windows-only oddity" to "the sensible pick for managing Win + Linux in one script".</>}
              /></p>
            </header>

            <div className="why-grid">
              {WHY_CARDS.map((c, i) => (
                <div className="why-card" key={i}>
                  <div className="why-icon">{c.icon}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="why-code"><code>{c.code}</code></pre>
                </div>
              ))}
            </div>
          </section>

          {/* 07 Ecosystem */}
          <section className="section" id="shells">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="生态 — pwsh 的工具圈" en="Ecosystem — the pwsh toolbelt" /> <code>: PwshStack</code></h2>
              <p className="sec-desc"><L
                zh={<>不只是 <code>pwsh</code> 二进制。下面 12 个 (运行时 + 模块 + 包 + CI 通道) 构成 2026 年现实里的 PowerShell 生态。<strong>每一个都是真用的</strong>: Windows 自动化跑 pwsh、Azure 跑 Az 模块、Microsoft 365 跑 Microsoft.Graph 模块、所有脚本必过 PSScriptAnalyzer + Pester。</>}
                en={<>More than the <code>pwsh</code> binary. The twelve below (runtime + modules + packaging + CI) make up the real 2026 PowerShell ecosystem. <strong>Every one is in real use</strong>: Windows automation runs pwsh, Azure uses Az, Microsoft 365 uses Microsoft.Graph, every script goes through PSScriptAnalyzer + Pester.</>}
              /></p>
            </header>

            <div className="logo-grid logo-grid-12">
              {ECOSYSTEM.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target="_blank" rel="noopener">
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>
          </section>

          {/* 08 vs */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="对比" en="vs Bash / Python / Nushell" /> <code>: pwsh vs the rest</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <a href="/code/language/bash">bash</a> 比: 文本流 vs 对象流, 两种世界观, 不是优劣是分工 — Linux 服务器跑 bash, Windows 全栈跑 pwsh。跟 <a href="/code/language/python">Python</a> 比: pwsh 是 shell + 语言合一, Python 是<em>不是 shell</em>的语言。跟 <strong>Nushell</strong> 比: Nushell 复用了 pwsh "<em>结构化数据进管道</em>" 的想法但用 Rust 重写、跨平台、不要 .NET。</>}
                en={<>vs <a href="/code/language/bash">bash</a>: text streams vs object streams — two worldviews, not a winner-loser comparison but a division of labour. Linux servers run bash; the Windows stack runs pwsh. vs <a href="/code/language/python">Python</a>: pwsh merges shell + language, Python is a language that is <em>not</em> a shell. vs <strong>Nushell</strong>: Nushell takes pwsh's "structured data in pipelines" idea and rewrites it in Rust, cross-platform, no .NET dependency.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">PowerShell</th>
                  <th className="th-js">Bash</th>
                  <th className="th-py">Python</th>
                  <th className="th-sw">Nushell</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    ps: <>Snover / MS · 2006</>,
                    sh: <>Brian Fox · 1989</>,
                    py: <>Guido · 1991</>,
                    nu: <>Turner · 2019</> },
                  { k: <L zh="管道载荷" en="Pipe payload" />,
                    ps: <L zh=".NET 对象" en=".NET objects" />,
                    sh: <L zh="纯文本流" en="Text streams" />,
                    py: <L zh={<>无 (函数调用)</>} en={<>None (function calls)</>} />,
                    nu: <L zh="结构化表 / 列" en="Structured tables / cols" /> },
                  { k: <L zh="类型" en="Types" />,
                    ps: <L zh=".NET 类型系统" en=".NET type system" />,
                    sh: <L zh={<>无 (全字符串)</>} en={<>None (all strings)</>} />,
                    py: <L zh="动态 · 可选 typing" en="Dynamic · optional typing" />,
                    nu: <L zh="结构化值类型" en="Structured value types" /> },
                  { k: <L zh="预装情况" en="Pre-installed" />,
                    ps: <L zh={<><strong>Win7+ · 默认</strong> · Linux/Mac 要装</>} en={<><strong>Win7+ · default</strong> · install on Linux/Mac</>} />,
                    sh: <L zh={<><strong>所有 Linux / macOS / WSL</strong></>} en={<><strong>every Linux / macOS / WSL</strong></>} />,
                    py: <L zh="多数 Linux 有 · 版本不齐" en="most Linux · version chaos" />,
                    nu: <L zh="要装" en="install required" /> },
                  { k: <L zh="交互 vs 脚本" en="Interactive vs script" />,
                    ps: <L zh={<><strong>同一种语法</strong></>} en={<><strong>same syntax</strong></>} />,
                    sh: <L zh={<><strong>同一种语法</strong></>} en={<><strong>same syntax</strong></>} />,
                    py: <L zh="REPL ≠ .py 写法" en="REPL ≠ .py form" />,
                    nu: <L zh={<><strong>同一种语法</strong></>} en={<><strong>same syntax</strong></>} /> },
                  { k: <L zh="错误处理" en="Error handling" />,
                    ps: <L zh={<>try / catch · 需 <code>-ErrorAction Stop</code></>} en={<>try / catch · needs <code>-ErrorAction Stop</code></>} />,
                    sh: <L zh={<><code>set -euo pipefail</code> · 边角多</>} en={<><code>set -euo pipefail</code> · corner cases</>} />,
                    py: <L zh="try / except · 一等" en="try / except · first-class" />,
                    nu: <L zh="try / 结构化错误" en="try / structured errors" /> },
                  { k: <L zh="字符串 quoting" en="String quoting" />,
                    ps: <L zh={<>2 种 · 干净</>} en={<>two flavours · clean</>} />,
                    sh: <L zh={<><strong>6 层</strong> · word splitting 陷阱</>} en={<><strong>six layers</strong> · word-split traps</>} />,
                    py: <L zh="字符串就是字符串" en="A string is a string" />,
                    nu: <L zh={<>2 种 · 干净</>} en={<>two flavours · clean</>} /> },
                  { k: <L zh="生态规模" en="Ecosystem size" />,
                    ps: <L zh="PowerShell Gallery · 整个 .NET BCL" en="PowerShell Gallery · all of .NET BCL" />,
                    sh: <L zh={<>每个 *nix 工具 (find/sed/awk/...)</>} en={<>every *nix tool (find/sed/awk/...)</>} />,
                    py: <L zh="PyPI · 50 万包" en="PyPI · ~500k packages" />,
                    nu: <L zh="小 · 早期" en="Small · early" /> },
                  { k: <L zh="典型场景" en="Typical use" />,
                    ps: <L zh="Win 自动化 · Azure / M365 · AD / Exchange" en="Win automation · Azure / M365 · AD / Exchange" />,
                    sh: <L zh={<>CI / 部署 / Dockerfile / 一次性脚本</>} en={<>CI / deploy / Dockerfile / one-off</>} />,
                    py: <L zh="数据 / Web / AI / 业务" en="Data / web / AI / business" />,
                    nu: <L zh="数据探索 / 个人 shell" en="Data exploration / personal shell" /> },
                  { k: <L zh="启动开销" en="Startup cost" />,
                    ps: <L zh={<>~300ms 冷 / 100ms 暖</>} en={<>~300ms cold / ~100ms warm</>} />,
                    sh: <L zh="~5ms · 极轻" en="~5ms · ultralight" />,
                    py: <L zh="~50ms" en="~50ms" />,
                    nu: <L zh="~50ms" en="~50ms" /> },
                  { k: <L zh="何时切走" en="When to leave it" />,
                    ps: <L zh={<>大型业务逻辑 / 工程化 · 切 C# 或 Python</>} en={<>Heavy business logic · move to C# or Python</>} />,
                    sh: <L zh={<>≥ 100 行 · 真错误处理 · 复杂数据</>} en={<>≥ 100 lines · real errors · complex data</>} />,
                    py: <L zh="不切" en="Don't" />,
                    nu: <L zh="任何要部署给别人的脚本" en="Any script you ship to someone else" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.ps}</td>
                    <td>{row.sh}</td>
                    <td>{row.py}</td>
                    <td>{row.nu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 09 Pitfalls */}
          <section className="section" id="pitfalls">
            <header className="sec-head">
              <span className="sec-num">09</span>
              <h2 className="sec-title"><L zh="坑与现实" en="Pitfalls & Reality" /> <code>: PwshTraps</code></h2>
              <p className="sec-desc"><L
                zh={<>承认 pwsh 的边角比假装它无懈可击更有用。下面是<strong>四个最常踩的坑</strong> + 一个老问题 ("pwsh 是不是太重了")。每一条都对应一个 PSScriptAnalyzer 规则或 about_* 帮助主题。</>}
                en={<>Owning pwsh's rough edges beats pretending. Below: the <strong>four most-stepped-in traps</strong> + the perennial "isn't pwsh heavy?" question. Each maps to a PSScriptAnalyzer rule or an <code>about_*</code> help topic.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>1992 年我加入微软的时候, Windows 没有真正的脚本管理通道。我写了那份 manifesto 是因为 <strong>看着 Unix 同行能用 100 行 shell 做完的事, 在 Windows 上要点 30 个对话框</strong>。<strong>但</strong>我不想把 shell 抄一遍 — 那是 1971 年的设计。我想要<em>对象</em>从命令的一端流到另一端。今天回头看, 这个赌对了。</>}
                en={<>When I joined Microsoft in 1992, Windows had no real scripting story for management. I wrote that manifesto because <strong>tasks Unix admins did in 100 lines of shell required clicking through thirty dialog boxes on Windows</strong>. <strong>But</strong> I didn't want to clone shell — that was a 1971 design. I wanted <em>objects</em> to flow from one command to the next. Looking back, that bet paid off.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Jeffrey Snover</span>
                <span className="quote-context"><L zh="Monad Manifesto 作者 · 多次访谈摘述 · PowerShell 原始首席架构师" en="Author of the Monad Manifesto · paraphrased from interviews · original PowerShell lead architect" /></span>
              </footer>
            </blockquote>

            <div className="future-grid">
              {PITFALLS.map((c, i) => (
                <div className={`future-card${c.big ? ' big' : ''}`} key={i}>
                  <div className={`future-tag${c.hot ? ' tag-hot' : ''}`}>{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  {lang === 'zh' ? c.zh.body : c.en.body}
                </div>
              ))}
            </div>

            <div className="ai-takeaway" style={{ marginTop: 48 }}>
              <p><strong><L zh="一句话总结: " en="In one line: " /></strong><L
                zh={<>pwsh 不是 bash 的"更好版本", 是另一个世界观: <strong>对象管道 + 类型系统 + .NET 全家桶</strong>。在 Windows / Azure / M365 上不是<em>选</em>, 是<em>必须</em>。在 Linux / Mac 上是真跨平台。<em>写完 <code>Set-ExecutionPolicy ... RemoteSigned</code>、 <code>{'$ErrorActionPreference = "Stop"'}</code> 就上路了</em>。</>}
                en={<>pwsh isn't a "better bash" — it's a different worldview: <strong>object pipeline + a type system + the full .NET runtime</strong>. On Windows / Azure / M365 it isn't a <em>choice</em>, it's required. On Linux / Mac it's truly cross-platform. <em>Run <code>Set-ExecutionPolicy ... RemoteSigned</code> and set <code>{'$ErrorActionPreference = "Stop"'}</code> — you're on the road</em>.</>}
              /></p>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-col">
              <h4><L zh="官方资源" en="Official" /></h4>
              <ul>
                <li><a href="https://learn.microsoft.com/powershell/" target="_blank" rel="noopener">learn.microsoft.com/powershell</a></li>
                <li><a href="https://github.com/PowerShell/PowerShell" target="_blank" rel="noopener">PowerShell/PowerShell (GitHub)</a></li>
                <li><a href="https://learn.microsoft.com/powershell/scripting/lang-spec/chapter-01" target="_blank" rel="noopener"><L zh="语言规范" en="Language Specification" /></a></li>
                <li><a href="https://www.powershellgallery.com/" target="_blank" rel="noopener">PowerShell Gallery</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="工具 / 检查" en="Tools / Lint" /></h4>
              <ul>
                <li><a href="https://github.com/PowerShell/PSScriptAnalyzer" target="_blank" rel="noopener">PSScriptAnalyzer</a></li>
                <li><a href="https://pester.dev/" target="_blank" rel="noopener">Pester (testing)</a></li>
                <li><a href="https://github.com/PowerShell/PSReadLine" target="_blank" rel="noopener">PSReadLine</a></li>
                <li><a href="https://learn.microsoft.com/powershell/utility-modules/psresourceget/" target="_blank" rel="noopener">PSResourceGet</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="参考阅读" en="Reading" /></h4>
              <ul>
                <li><a href="https://devblogs.microsoft.com/powershell/monad-manifesto-the-origin-of-windows-powershell/" target="_blank" rel="noopener">Monad Manifesto (2002)</a></li>
                <li><a href="https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_objects" target="_blank" rel="noopener">about_Objects</a></li>
                <li><a href="https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_pipelines" target="_blank" rel="noopener">about_Pipelines</a></li>
                <li><a href="https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_splatting" target="_blank" rel="noopener">about_Splatting</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/bash"><L zh="Bash — 文本管道对照组" en="Bash — the text-pipeline counterpart" /></a></li>
                <li><a href="/code/language/csharp"><L zh="C# — pwsh 的母语" en="C# — pwsh's parent language" /></a></li>
                <li><a href="/code/language/python"><L zh="Python — 跨平台脚本备选" en="Python — cross-platform fallback" /></a></li>
                <li><a href="/code/language/rust"><L zh="Rust — nushell 的载体" en="Rust — what powers nushell" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{PWSH_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`#!/usr/bin/env pwsh`}</code></p>
              <p className="footer-line dim"><code>{`$ErrorActionPreference = 'Stop'`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
