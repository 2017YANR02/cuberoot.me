'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './bash_intro.css';
import i18n from '@/i18n/i18n-client';

// Inline SVG: terminal window with a $ prompt + blinking caret
const BASH_LOGO_SVG = (
  <svg viewBox="0 0 256 256">
    <defs>
      <linearGradient id="bash-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1A2218" />
        <stop offset="100%" stopColor="#060A08" />
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="28" fill="url(#bash-grad)" />
    {/* title bar */}
    <rect x="0" y="0" width="256" height="34" rx="28" fill="#121814" />
    <rect x="0" y="22" width="256" height="14" fill="#121814" />
    <circle cx="22" cy="17" r="5" fill="#FF5F56" />
    <circle cx="40" cy="17" r="5" fill="#FFBD2E" />
    <circle cx="58" cy="17" r="5" fill="#27C93F" />
    {/* prompt */}
    <text x="36" y="120" fontFamily="ui-monospace, Cascadia Code, monospace" fontWeight="700" fontSize="56" fill="#4EAA25">$</text>
    {/* underscore caret */}
    <rect x="92" y="108" width="36" height="8" fill="#7BD934">
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
    </rect>
    {/* faint command line below */}
    <text x="36" y="172" fontFamily="ui-monospace, Cascadia Code, monospace" fontSize="18" fill="#5A7050">echo "hello"</text>
    <text x="36" y="200" fontFamily="ui-monospace, Cascadia Code, monospace" fontSize="18" fill="#5A7050">hello</text>
  </svg>
);

const BASH_LOGO_SMALL = (
  <svg viewBox="0 0 256 256" width="28" height="28">
    <rect width="256" height="256" rx="28" fill="#060A08" />
    <rect x="0" y="0" width="256" height="42" rx="28" fill="#121814" />
    <rect x="0" y="28" width="256" height="14" fill="#121814" />
    <circle cx="26" cy="22" r="6" fill="#FF5F56" />
    <circle cx="46" cy="22" r="6" fill="#FFBD2E" />
    <circle cx="66" cy="22" r="6" fill="#27C93F" />
    <text x="36" y="158" fontFamily="monospace" fontWeight="700" fontSize="100" fill="#4EAA25">$_</text>
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
    year: '1971',
    zh: { title: <>Thompson shell — Unix V1 自带</>, desc: <>Ken Thompson 在贝尔实验室给 <strong>Unix V1</strong> 写的第一版 shell, 路径 <code>/bin/sh</code> (这个名字一直留到今天)。极简: 没有流程控制、没有变量, 只能起子进程、做重定向。<em>所有现代 shell 的起点</em>。</> },
    en: { title: <>Thompson shell — shipped with Unix V1</>, desc: <>Ken Thompson's first shell, written at Bell Labs for <strong>Unix V1</strong>, installed at <code>/bin/sh</code> (the name has stuck for 55 years). Minimal: no flow control, no variables, just process spawning and redirection. <em>The origin of every modern shell</em>.</> },
  },
  {
    year: '1977',
    zh: { title: <>Bourne shell (sh) — 加上控制流</>, desc: <>Stephen Bourne 在 Bell Labs 写出 <strong>sh</strong>: <code>if</code> / <code>for</code> / <code>while</code> / <code>case</code> / 函数 / 变量都齐了。语法是从 Algol 68 借来的奇怪味道 — <code>fi</code> 反写 <code>if</code>, <code>esac</code> 反写 <code>case</code>。<strong>POSIX shell 是它的标准化</strong>; 今天 macOS 上 <code>/bin/sh</code> 的语义仍然指这个。</> },
    en: { title: <>Bourne shell (sh) — control flow lands</>, desc: <>Stephen Bourne at Bell Labs ships <strong>sh</strong> with <code>if</code> / <code>for</code> / <code>while</code> / <code>case</code> / functions / variables — all of it. The Algol-68-flavoured syntax is where the famous <code>fi</code> (reversed <code>if</code>) and <code>esac</code> (reversed <code>case</code>) come from. <strong>POSIX shell is its standardisation</strong>; <code>/bin/sh</code> on macOS today still means this.</> },
  },
  {
    year: '1979',
    zh: { title: <>C shell (csh) — Berkeley 的另一条线</>, desc: <>Bill Joy 在 Berkeley 写 csh, 语法<strong>故意像 C</strong>: <code>if (cond) then ... endif</code>。引入了交互式好东西 — <strong>命令历史 (history)</strong>、<strong>job control</strong>、别名 — 但<strong>脚本语义出名地糟</strong>。Tom Christiansen 的 <em>"Csh Programming Considered Harmful"</em> 是 1995 年的经典劝退贴。</> },
    en: { title: <>C shell (csh) — the Berkeley fork</>, desc: <>Bill Joy at Berkeley writes csh with <strong>deliberately C-like syntax</strong>: <code>if (cond) then ... endif</code>. It introduces lovely interactive features — <strong>command history</strong>, <strong>job control</strong>, aliases — but its <strong>scripting semantics are infamously broken</strong>. Tom Christiansen's 1995 essay <em>"Csh Programming Considered Harmful"</em> is the canonical takedown.</> },
  },
  {
    year: '1983',
    zh: { title: <>Korn shell (ksh) — sh 的超集精修</>, desc: <>David Korn 在 AT&amp;T 推出 <strong>ksh</strong>: 完全兼容 Bourne, 但补上数组、关联数组、浮点数、正则、协程。<strong>商业 Unix (Solaris / AIX / HP-UX) 长期默认 shell</strong>。直到今天 ksh93 仍是某些金融/电信底层脚本的真正生产环境。</> },
    en: { title: <>Korn shell (ksh) — a refined Bourne superset</>, desc: <>David Korn at AT&amp;T ships <strong>ksh</strong>: fully Bourne-compatible, but adds arrays, associative arrays, floats, regex, coprocesses. <strong>The long-time default shell on commercial Unixes (Solaris / AIX / HP-UX)</strong>. ksh93 is still genuinely in production today for some finance / telecom backends.</> },
  },
  {
    year: <>1989<small>·06·08</small></>, highlight: true,
    zh: { title: <>Bash 1.0 — Brian Fox 给 GNU 写的</>, desc: <>1989 年 6 月 8 日 Brian Fox 在 FSF 发布 <strong>Bash 1.0</strong> ("<strong>Bourne again shell</strong>" — Stallman 的双关)。目标: 给 GNU 一个 sh 兼容、不被 AT&amp;T 许可证绑的 shell。bash 之后成为 Linux 几乎所有发行版的默认。Chet Ramey 1992 接手维护到今天。</> },
    en: { title: <>Bash 1.0 — Brian Fox writes it for GNU</>, desc: <>On 8 June 1989 Brian Fox releases <strong>Bash 1.0</strong> at the FSF — the name is Stallman's pun, "<strong>Bourne again shell</strong>". The goal: give GNU a Bourne-compatible shell free of AT&amp;T's licence. Bash becomes the default on nearly every Linux distribution. Chet Ramey takes over maintenance in 1992 and is still doing it today.</> },
  },
  {
    year: '1990',
    zh: { title: <>zsh — Paul Falstad 在 Princeton 写的</>, desc: <>同年 (1990) Paul Falstad 写出 <strong>zsh</strong>。功能上是 ksh + bash + tcsh 的<strong>并集</strong>: 强大的补全、glob (<code>**/*.ts</code>)、参数扩展、主题。多年小众, 直到 <strong>oh-my-zsh</strong> (Robby Russell 2009) 把它推上 Mac 开发者主屏。</> },
    en: { title: <>zsh — Paul Falstad at Princeton</>, desc: <>The same year (1990) Paul Falstad writes <strong>zsh</strong>. Feature-wise it's the <strong>union</strong> of ksh + bash + tcsh: powerful completion, recursive globs (<code>**/*.ts</code>), rich parameter expansion, themes. It stays niche for years until <strong>oh-my-zsh</strong> (Robby Russell, 2009) puts it on every Mac developer's screen.</> },
  },
  {
    year: '1992',
    zh: { title: <>POSIX.2 / IEEE 1003.2 — shell 标准化</>, desc: <>POSIX 把 Bourne shell 子集冻进标准 <strong>IEEE Std 1003.2</strong>。从此 <code>#!/bin/sh</code> 脚本有了<strong>跨 Unix 可移植</strong>的形式契约。<em>但"严格 POSIX shell" 远比 bash 难写</em> — 数组都没有。这条限制让 <code>checkbashisms</code> 这种工具至今有市场。</> },
    en: { title: <>POSIX.2 / IEEE 1003.2 — shell standardised</>, desc: <>POSIX freezes a Bourne-shell subset into <strong>IEEE Std 1003.2</strong>. From here on, <code>#!/bin/sh</code> scripts have a formal <strong>cross-Unix portability contract</strong>. <em>But "strict POSIX shell" is much harder to write than bash</em> — no arrays, for one. The constraint keeps tools like <code>checkbashisms</code> in business to this day.</> },
  },
  {
    year: '2005',
    zh: { title: <>fish (friendly interactive shell)</>, desc: <>Axel Liljencrantz 发布 <strong>fish</strong>: <strong>有意打破 POSIX</strong> 换更干净的语法 — 没有 <code>$(...)</code> 用 <code>(...)</code>、没有诡异 word-splitting、自动补全开箱即用。代价: 任何抄来的 bash 一行命令都跑不动。<em>"我们承认这是反向兼容性的代价 — 但 shell 该现代化了"</em>。</> },
    en: { title: <>fish (friendly interactive shell)</>, desc: <>Axel Liljencrantz releases <strong>fish</strong>: <strong>deliberately POSIX-incompatible</strong> for a cleaner language — <code>(...)</code> instead of <code>$(...)</code>, no surprise word-splitting, autosuggestions out of the box. Cost: copy-pasted bash one-liners just don't run. <em>"We accept this is the price of breaking back-compat — but shell needed modernising"</em>.</> },
  },
  {
    year: <>2006<small>·11</small></>,
    zh: { title: <>PowerShell 1.0 — 微软的对照实验</>, desc: <>Jeffrey Snover 设计的 <strong>PowerShell</strong> 公开 1.0。<strong>不传文本, 传对象</strong> — 管道传的是 .NET 对象。<em>"如果 shell 从头设计、有类型, 会是什么样"</em> 的现实样本。2016 开源后跨平台, 今天在 Windows 自动化上仍是默认。</> },
    en: { title: <>PowerShell 1.0 — Microsoft's counter-experiment</>, desc: <>Jeffrey Snover's <strong>PowerShell</strong> ships 1.0. The pitch: <strong>pipe objects, not text</strong> — pipelines carry .NET objects end-to-end. The real-world answer to <em>"what if shell were designed from scratch, with a type system"</em>. Open-sourced and cross-platform in 2016, still the default for Windows automation today.</> },
  },
  {
    year: '2010+',
    zh: { title: <>DevOps 时代 — shell 是 CI/CD 的胶水</>, desc: <>容器化 + 云爆发让 shell <strong>重新成为主角</strong>: Dockerfile 的 <code>RUN</code> 行、GitHub Actions 的 <code>run:</code> 块、K8s init containers、Ansible 任务、Homebrew 安装一行 (<code>/bin/bash -c "$(curl ...)"</code>)。<strong>没有哪个新语言取代了 shell, 因为没有哪个语言能像 shell 一样到处装好</strong>。</> },
    en: { title: <>DevOps era — shell as CI/CD glue</>, desc: <>Containers + cloud bring shell roaring <strong>back into the spotlight</strong>: Dockerfile <code>RUN</code> lines, GitHub Actions <code>run:</code> blocks, K8s init containers, Ansible tasks, the Homebrew installer one-liner (<code>/bin/bash -c "$(curl ...)"</code>). <strong>No newer language has displaced shell because none of them is pre-installed everywhere</strong>.</> },
  },
  {
    year: <>2014<small>·09·24</small></>, highlight: true,
    zh: { title: <>Shellshock — 25 年的洞</>, desc: <>9 月 24 日 Stéphane Chazelas 披露 <strong>CVE-2014-6271</strong>: bash 解析环境变量函数定义时<strong>会继续执行尾部代码</strong>。攻击面巨大 — 任何把用户输入塞进 env 再调 bash 的服务都中招 (CGI、DHCP、git over ssh)。<em>这条洞从 1989 年的代码起就存在 — 25 年没人发现</em>。同年 Heartbleed 一道击穿"开源即安全"叙事。</> },
    en: { title: <>Shellshock — a 25-year-old hole</>, desc: <>On 24 September Stéphane Chazelas discloses <strong>CVE-2014-6271</strong>: bash parses environment-variable function definitions and <strong>keeps executing the trailing code</strong>. The attack surface is huge — any service that pushes user input into env then invokes bash is exposed (CGI, DHCP, git-over-ssh). <em>The bug had been in the code since 1989 — undetected for 25 years</em>. Together with Heartbleed the same year, it cracked the "open source = secure" story.</> },
  },
  {
    year: '2016',
    zh: { title: <>PowerShell 开源, 跨平台</>, desc: <>Microsoft 把 PowerShell 开源, 出 Linux / macOS 版本。<em>从"Windows only 的奇怪选项"变成"全平台都能装的对照组"</em>。今天写 ops 自动化, 选 bash 还是 pwsh 成了一个真问题, 不再是"用什么系统就用什么 shell"。</> },
    en: { title: <>PowerShell open-sourced, cross-platform</>, desc: <>Microsoft open-sources PowerShell and ships Linux / macOS builds. <em>It moves from "the strange Windows-only option" to "a cross-platform contender"</em>. Today, choosing bash or pwsh for ops automation is a real decision rather than a function of which OS you booted into.</> },
  },
  {
    year: <>2019<small>·10</small></>, highlight: true,
    zh: { title: <>macOS Catalina — 默认 shell 从 bash 切 zsh</>, desc: <>苹果不是技术问题切的, 是<strong>许可证问题</strong>: 苹果不愿升级 bash 4+ (GPLv3), 长期把 macOS 锁在 <strong>bash 3.2 (2007, GPLv2)</strong>。2019 年 10 月 Catalina 索性<strong>默认换 zsh</strong> (BSD-style 许可)。<em>象征性时刻: 全世界最有钱的公司不要 GPLv3, 也不要 bash</em>。</> },
    en: { title: <>macOS Catalina — default shell flips from bash to zsh</>, desc: <>Apple didn't switch for technical reasons — it switched for <strong>licensing</strong>. Apple wouldn't ship bash 4+ (GPLv3), so it pinned macOS to <strong>bash 3.2 (2007, GPLv2)</strong> for over a decade. In October 2019 Catalina cuts the cord and ships <strong>zsh as the default</strong> (BSD-style licence). <em>A symbolic moment: the world's richest company opts out of GPLv3 — and out of bash</em>.</> },
  },
  {
    year: '2019',
    zh: { title: <>Nushell — Rust 写的结构化 shell</>, desc: <>Jonathan Turner 和 Andrés Robalino 启动 <strong>Nushell</strong>: <strong>管道传结构化数据</strong> (PowerShell 思路) + Rust 实现 + 现代语法。<code>ls | where size &gt; 1mb</code> 直接当表查询。<em>小众但已经稳定发版到 0.x 后段</em>; 没冲击 bash 的部署地盘, 但拿走了一批"shell 应该更好"的早期用户。</> },
    en: { title: <>Nushell — a structured shell in Rust</>, desc: <>Jonathan Turner and Andrés Robalino kick off <strong>Nushell</strong>: <strong>structured data through pipelines</strong> (the PowerShell intuition) + a Rust implementation + modern syntax. <code>ls | where size &gt; 1mb</code> reads like a table query. <em>Niche but past 0.x maturity</em>; it hasn't dented bash's deployment base, but it's taken the "shell should be better" early adopters.</> },
  },
  {
    year: '2020+',
    zh: { title: <>Oil shell / YSH — 想做"严格的 bash"</>, desc: <>Andy Chu 的 <strong>Oil</strong> (后期改名 <strong>YSH</strong>) 走另一条路: <strong>能跑 bash 脚本</strong>, 同时提供一个干净的 <em>新</em> 语言。哲学: "bash 不能丢, 但要给一条向上的路。" 至今规模小, 但是<strong>把 shell 当语言设计来想</strong>的少数项目之一。</> },
    en: { title: <>Oil shell / YSH — "a stricter bash"</>, desc: <>Andy Chu's <strong>Oil</strong> (later renamed <strong>YSH</strong>) takes a different angle: <strong>run bash scripts as-is</strong>, but offer a clean <em>new</em> language alongside. The philosophy: "bash can't be thrown away, but it needs an upward path." Small in size, but one of the few projects that <strong>thinks of shell as a designed language</strong>.</> },
  },
  {
    year: '2026',
    zh: { title: <>37 年了 — bash 还在</>, desc: <>2026 年 bash 的现状: <strong>Linux 几乎所有发行版默认</strong>、<strong>所有 CI/CD 默认</strong>、<strong>所有 Dockerfile 默认</strong>、<strong>所有云服务器初始化脚本</strong>。Chet Ramey 仍在维护 (5.x 系列)。zsh 拿走 Mac 桌面交互、PowerShell 拿走 Windows 自动化, 但<strong>服务器和 CI 的脚本基本盘 = bash</strong>。<em>没有替代品的事实垄断</em>。</> },
    en: { title: <>37 years in — bash is still here</>, desc: <>Bash in 2026: <strong>the default on nearly every Linux distribution</strong>, <strong>the default in every CI/CD system</strong>, <strong>the default in every Dockerfile</strong>, <strong>the default in every cloud-server bootstrap</strong>. Chet Ramey still maintains it (the 5.x series). Zsh has taken Mac desktop interactive use; PowerShell has taken Windows automation; but <strong>the server-side and CI scripting base is bash, period</strong>. <em>A de-facto monopoly with no real challenger</em>.</> },
  },
];

interface BashCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const BASH_CARDS: BashCard[] = [
  {
    tag: 'A',
    zh: { title: <><code>[ ]</code> vs <code>[[ ]]</code></>, desc: <><code>[</code> 是 <strong>外部命令</strong> (POSIX <code>test</code>), <code>[[</code> 是 bash <strong>关键字</strong>。<code>[[ ]]</code> 不做 word splitting、不会因为变量没引号而炸、支持 <code>==</code> glob 匹配。<em>写 bash 永远用 <code>[[</code></em>。</> },
    en: { title: <><code>[ ]</code> vs <code>[[ ]]</code></>, desc: <><code>[</code> is an <strong>external command</strong> (POSIX <code>test</code>); <code>[[</code> is a bash <strong>keyword</strong>. <code>[[ ]]</code> skips word-splitting, doesn't explode on unquoted vars, supports <code>==</code> glob matching. <em>In bash, always use <code>[[</code></em>.</> },
    code: (
      <code>
        <span className="cl-c"># fragile — splits if $f has spaces</span>{'\n'}
        <span className="cl-k">if</span> [ -f $f ]; <span className="cl-k">then</span> ...{'\n\n'}
        <span className="cl-c"># safe — quoting optional inside [[</span>{'\n'}
        <span className="cl-k">if</span> [[ -f $f &amp;&amp; $f == *.log ]]; <span className="cl-k">then</span> ...
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <><code>${'{var}'}</code> 参数扩展</>, desc: <>shell 里替代 <strong>sed/awk 的轻量办法</strong>: <code>${'{f%.*}'}</code> 去后缀、<code>${'{f##*/}'}</code> 取 basename、<code>${'{f:-default}'}</code> 默认值。<em>看着像乱码, 学会后省 fork 几百次</em>。</> },
    en: { title: <><code>${'{var}'}</code> parameter expansion</>, desc: <>The <strong>lightweight replacement for sed/awk</strong> in shell: <code>${'{f%.*}'}</code> strips suffix, <code>${'{f##*/}'}</code> is basename, <code>${'{f:-default}'}</code> is a default. <em>Looks like line noise — but learning it saves hundreds of forks</em>.</> },
    code: (
      <code>
        f=<span className="cl-s">/var/log/app.log</span>{'\n'}
        <span className="cl-fn">echo</span> <span className="cl-s">${'"${f##*/}"'}</span>   <span className="cl-c"># app.log</span>{'\n'}
        <span className="cl-fn">echo</span> <span className="cl-s">${'"${f%.*}"'}</span>    <span className="cl-c"># /var/log/app</span>{'\n'}
        <span className="cl-fn">echo</span> <span className="cl-s">${'"${name:-anon}"'}</span> <span className="cl-c"># default</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <><code>set -euo pipefail</code></>, desc: <><strong>strict mode</strong> 三件套: <code>-e</code> 命令失败即退出, <code>-u</code> 引用未定义变量即报错, <code>-o pipefail</code> 管道任何段失败都算失败。<em>每个 bash 脚本第一行</em>。再加 <code>IFS=$'\\n\\t'</code> 防 word splitting 偷袭。</> },
    en: { title: <><code>set -euo pipefail</code></>, desc: <>The <strong>strict-mode trio</strong>: <code>-e</code> exit on command failure, <code>-u</code> error on undefined-variable use, <code>-o pipefail</code> any pipe segment failing = pipeline failure. <em>First line of every bash script</em>. Pair with <code>IFS=$'\\n\\t'</code> to neutralise word-splitting ambushes.</> },
    code: (
      <code>
        <span className="cl-c">#!/usr/bin/env bash</span>{'\n'}
        <span className="cl-k">set</span> <span className="cl-flag">-euo pipefail</span>{'\n'}
        <span className="cl-v">IFS</span>=<span className="cl-s">$'\\n\\t'</span>{'\n\n'}
        <span className="cl-c"># now `cmd1 | cmd2` failing in cmd1 actually stops you</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>Here-docs <code>{'<<EOF'}</code></>, desc: <>把<strong>多行字符串</strong>当文件喂给命令。<code>&lt;&lt;EOF</code> 会做变量替换; <code>&lt;&lt;'EOF'</code> (引号) 完全字面化。git commit message、SQL、配置文件生成全靠它。</> },
    en: { title: <>Here-docs <code>{'<<EOF'}</code></>, desc: <>Feed a <strong>multiline string</strong> as if it were a file. <code>&lt;&lt;EOF</code> expands variables; <code>&lt;&lt;'EOF'</code> (quoted) is fully literal. Git commit messages, inline SQL, generated config files — all of them lean on this.</> },
    code: (
      <code>
        <span className="cl-fn">cat</span> <span className="cl-flag">&gt;config.yaml</span> <span className="cl-flag">&lt;&lt;EOF</span>{'\n'}
        host: <span className="cl-s">${'$HOSTNAME'}</span>{'\n'}
        port: <span className="cl-n">8080</span>{'\n'}
        EOF{'\n\n'}
        <span className="cl-c"># single-quoted EOF = no expansion</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>Process substitution <code>{'<(...)'}</code></>, desc: <>把<strong>命令输出当文件路径</strong>给另一个命令 — 不需要临时文件。<code>diff &lt;(sort a) &lt;(sort b)</code> 是经典: 比较两份排序后的数据, 不动磁盘。<strong>bash/zsh 才有, 严格 POSIX 没有</strong>。</> },
    en: { title: <>Process substitution <code>{'<(...)'}</code></>, desc: <>Hand a <strong>command's output as if it were a file path</strong> to another command — no temp file needed. <code>diff &lt;(sort a) &lt;(sort b)</code> is the canonical case: compare two sorted streams, never touch disk. <strong>bash/zsh only — strict POSIX doesn't have it</strong>.</> },
    code: (
      <code>
        <span className="cl-fn">diff</span> <span className="cl-flag">&lt;(</span><span className="cl-fn">sort</span> a.txt<span className="cl-flag">)</span> <span className="cl-flag">&lt;(</span><span className="cl-fn">sort</span> b.txt<span className="cl-flag">)</span>{'\n\n'}
        <span className="cl-fn">comm</span> <span className="cl-flag">-12</span> <span className="cl-flag">&lt;(</span>a-cmd<span className="cl-flag">)</span> <span className="cl-flag">&lt;(</span>b-cmd<span className="cl-flag">)</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <><code>trap</code> — 退出清理</>, desc: <>注册退出钩子。<code>trap '...' EXIT</code> = 脚本无论怎么死 (正常返回、被 kill、报错退出) 都跑一次。<strong>临时文件、子进程、锁</strong>的清理就靠它, 而不是写一堆 <code>rm -rf $TMP</code> 在每个 <code>exit</code> 之前。</> },
    en: { title: <><code>trap</code> — exit-time cleanup</>, desc: <>Register an exit hook. <code>trap '...' EXIT</code> = the handler runs once no matter how the script dies (normal return, kill, error-exit). The <strong>right place to clean up tempfiles, children, locks</strong> — not <code>rm -rf $TMP</code> before every <code>exit</code>.</> },
    code: (
      <code>
        <span className="cl-v">TMP</span>=<span className="cl-fn">$(</span><span className="cl-fn">mktemp</span> <span className="cl-flag">-d</span><span className="cl-fn">)</span>{'\n'}
        <span className="cl-k">trap</span> <span className="cl-s">'rm -rf "$TMP"'</span> EXIT{'\n\n'}
        <span className="cl-c"># do whatever; on any exit, $TMP is gone</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <><code>xargs</code> — 管道接命令行参数</>, desc: <>把 stdin 行<strong>转成下个命令的参数</strong>。<code>find . -name '*.log' | xargs grep ERROR</code> 是经典 — 但带空格文件名会炸; 安全版 <code>find ... -print0 | xargs -0</code> 或直接 <code>find -exec</code>。<strong>shell 编排的关键纽带</strong>。</> },
    en: { title: <><code>xargs</code> — pipe → command args</>, desc: <>Turns stdin lines <strong>into the next command's arguments</strong>. <code>find . -name '*.log' | xargs grep ERROR</code> is the canonical move — but filenames with spaces blow it up; the safe version is <code>find ... -print0 | xargs -0</code> or just <code>find -exec</code>. <strong>The connective tissue of shell orchestration</strong>.</> },
    code: (
      <code>
        <span className="cl-fn">find</span> . <span className="cl-flag">-name</span> <span className="cl-s">'*.log'</span> <span className="cl-flag">-print0</span> <span className="cl-flag">|</span>{'\n'}
        {'  '}<span className="cl-fn">xargs</span> <span className="cl-flag">-0</span> <span className="cl-fn">grep</span> <span className="cl-flag">-l</span> ERROR{'\n\n'}
        <span className="cl-c"># -print0 / -0 = NUL-delimited, space-safe</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Subshell <code>$(...)</code> vs backtick</>, desc: <>命令替换。<strong>新代码用 <code>$(cmd)</code></strong> — 可嵌套, 引号干净。反引号 <code>{'`cmd`'}</code> 是 1977 sh 遗产, 1992 POSIX 也建议弃用。还能看到不是 bug, 是 35 年的 muscle memory。</> },
    en: { title: <>Subshell <code>$(...)</code> vs backticks</>, desc: <>Command substitution. <strong>New code uses <code>$(cmd)</code></strong> — nestable, clean quoting. Backticks <code>{'`cmd`'}</code> are a 1977-sh artefact, deprecated even in POSIX (1992). You'll still see them — that's not a bug, that's 35 years of muscle memory.</> },
    code: (
      <code>
        <span className="cl-c"># preferred</span>{'\n'}
        <span className="cl-v">today</span>=<span className="cl-fn">$(</span><span className="cl-fn">date</span> <span className="cl-flag">+%F</span><span className="cl-fn">)</span>{'\n\n'}
        <span className="cl-c"># legacy — nesting gets ugly fast</span>{'\n'}
        <span className="cl-v">today</span>=<span className="cl-s">`date +%F`</span>
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
    icon: '$',
    zh: { title: <>装在每台机器上</>, desc: <>这是 shell <strong>所有理由的总根</strong>: bash 在 Linux 默认安装, sh 在每台 POSIX 系统都有。<strong>不需要装运行时</strong>, 写完直接跑。当你 ssh 进一台不认识的服务器, 你能确定的<em>只有 shell 和 ls</em>。Python 不能保证, Node 不能保证。</> },
    en: { title: <>Pre-installed everywhere</>, desc: <>This is the <strong>root of every other reason</strong>: bash ships by default on Linux, sh ships on every POSIX system. <strong>No runtime to install</strong> — write and run. When you ssh into a stranger's box, the <em>only</em> things you can count on are the shell and ls. Python? Maybe. Node? Definitely not.</> },
    code: <><span className="cl-c"># works on any *nix from 1989 onward</span>{'\n'}<span className="cl-c">#!/bin/sh</span>{'\n'}<span className="cl-fn">echo</span> <span className="cl-s">"hello $(uname -s)"</span></>,
  },
  {
    icon: '|',
    zh: { title: <>管道是宇宙模型</>, desc: <>Unix 哲学的字面化: <strong>每个程序读 stdin、写 stdout、做一件事</strong>。<code>cmd1 | cmd2 | cmd3</code> 用 22 byte 表达"组合"。<em>2026 年 LLM 工具链复活了这套思路</em>: 工具调用、流式 token、agent 链都是管道的同构。</> },
    en: { title: <>Pipes as a universe model</>, desc: <>Unix philosophy made literal: <strong>each program reads stdin, writes stdout, does one thing</strong>. <code>cmd1 | cmd2 | cmd3</code> expresses composition in 22 bytes. <em>The 2026 LLM tool-chain revived the same idea</em>: tool calls, streamed tokens, and agent chains are all isomorphic to pipes.</> },
    code: <><span className="cl-fn">curl</span> <span className="cl-flag">-s</span> api/data <span className="cl-flag">|</span>{'\n'}{'  '}<span className="cl-fn">jq</span> <span className="cl-s">'.[].id'</span> <span className="cl-flag">|</span>{'\n'}{'  '}<span className="cl-fn">xargs</span> <span className="cl-flag">-I</span>{'{}'} <span className="cl-fn">curl</span> <span className="cl-flag">-s</span> api/detail/{'{}'}</>,
  },
  {
    icon: '#',
    zh: { title: <>DevOps 默认语言</>, desc: <>Dockerfile <code>RUN</code>、GitHub Actions <code>run:</code>、K8s init container、Ansible <code>shell:</code>、Homebrew 一行装、Rust/Node 的官方 installer — <em>所有这些底下都是 bash</em>。<strong>你写"基础设施"几乎一定要会 shell</strong>, 哪怕你主语言是 Python / Go。</> },
    en: { title: <>The DevOps default</>, desc: <>Dockerfile <code>RUN</code>, GitHub Actions <code>run:</code>, K8s init containers, Ansible <code>shell:</code>, the Homebrew one-line install, the official Rust / Node installers — <em>all of them are bash underneath</em>. <strong>If you write "infrastructure" you almost certainly need shell</strong>, even if your day-job language is Python / Go.</> },
    code: <><span className="cl-c"># the Homebrew installer, one line</span>{'\n'}/bin/bash <span className="cl-flag">-c</span> <span className="cl-s">"$(curl -fsSL .../install.sh)"</span></>,
  },
  {
    icon: '>',
    zh: { title: <>胶水稳定性 — 30 年不破</>, desc: <>1989 写的 bash 脚本今天<strong>大概率还能跑</strong>。Python 2 → 3 砸了无数代码、Node 几乎每年 break api、Ruby 早期生态消失了一半 — <em>shell 没有这种事</em>。"无聊"是它最大的优点。</> },
    en: { title: <>Glue stability — 30 years unbroken</>, desc: <>A bash script written in 1989 <strong>probably still runs</strong>. Python 2 → 3 shattered tons of code, Node breaks APIs nearly every year, half of early Ruby's ecosystem is gone — <em>shell doesn't have this problem</em>. "Boring" is its greatest virtue.</> },
    code: <><span className="cl-c"># 1989 syntax · still works in 2026</span>{'\n'}<span className="cl-k">for</span> f <span className="cl-k">in</span> *.txt; <span className="cl-k">do</span>{'\n'}{'  '}<span className="cl-fn">mv</span> <span className="cl-s">"$f"</span> <span className="cl-s">"${'${f%.txt}'}.bak"</span>{'\n'}<span className="cl-k">done</span></>,
  },
  {
    icon: '~',
    zh: { title: <>交互式 + 脚本同形</>, desc: <>少有的语言, <strong>命令行交互</strong>和<strong>脚本文件</strong>是<em>同一套语法</em>。你 history 里调过一遍的命令, 直接粘进 <code>.sh</code> 就跑。<em>"探索 → 固化"的距离 = 0</em>。Python 有 REPL 但跟 .py 不同；shell 没这区别。</> },
    en: { title: <>Interactive + scripted are the same language</>, desc: <>Rare among programming languages, the <strong>interactive line</strong> and the <strong>script file</strong> share <em>one syntax</em>. A command you just ran in your history can be pasted into a <code>.sh</code> and it runs. <em>The distance from "explore" to "automate" is zero</em>. Python has a REPL but it's not the same as a .py; shell has no such gap.</> },
    code: <><span className="cl-c"># this works at the prompt</span>{'\n'}<span className="cl-fn">grep</span> <span className="cl-flag">-r</span> TODO . <span className="cl-flag">|</span> <span className="cl-fn">wc</span> <span className="cl-flag">-l</span>{'\n\n'}<span className="cl-c"># …and unchanged inside todo-count.sh</span></>,
  },
];

interface Idiom {
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const IDIOMS: Idiom[] = [
  {
    zh: { title: <>清单遍历</>, desc: <><code>find</code> 出来文件 <code>xargs</code> 喂 grep — <strong>shell 编排的入门式</strong>。空格安全要 <code>-print0 / -0</code>。</> },
    en: { title: <>Iterate a list of files</>, desc: <><code>find</code> the files, <code>xargs</code> them into grep — <strong>shell orchestration 101</strong>. For space-safety use <code>-print0 / -0</code>.</> },
    code: <>find . -name <span className="cl-s">'*.ts'</span> -print0 | xargs -0 grep -l TODO</>,
  },
  {
    zh: { title: <>strict mode 启动</>, desc: <>每个生产脚本第一行。把<strong>静默错误</strong>变成<strong>响亮报错</strong>。</> },
    en: { title: <>Strict-mode opener</>, desc: <>The first line of every production script. Turns <strong>silent failures</strong> into <strong>loud ones</strong>.</> },
    code: <>set -euo pipefail; IFS=<span className="cl-s">$'\\n\\t'</span></>,
  },
  {
    zh: { title: <>清理钩子</>, desc: <><code>trap EXIT</code> — 无论怎么死都跑一次。临时文件、子进程的<strong>正确归处</strong>。</> },
    en: { title: <>Exit-time cleanup</>, desc: <><code>trap EXIT</code> — runs once however the script dies. The <strong>right home</strong> for tempfile / child cleanup.</> },
    code: <>trap <span className="cl-s">'rm -rf "$TMP"'</span> EXIT</>,
  },
  {
    zh: { title: <>diff 两个流</>, desc: <>process substitution 经典: <strong>不写磁盘</strong>对比命令输出。</> },
    en: { title: <>Diff two streams</>, desc: <>Process substitution at its best: compare two command outputs <strong>without touching disk</strong>.</> },
    code: <>diff <span className="cl-flag">&lt;(</span>sort a<span className="cl-flag">)</span> <span className="cl-flag">&lt;(</span>sort b<span className="cl-flag">)</span></>,
  },
  {
    zh: { title: <>路径切片</>, desc: <>参数扩展去后缀 / 取 basename — <strong>不需要 sed/awk</strong>。</> },
    en: { title: <>Path slicing</>, desc: <>Parameter expansion strips suffixes / takes basenames — <strong>no sed/awk needed</strong>.</> },
    code: <>name=<span className="cl-s">${'"${path##*/}"'}</span>; base=<span className="cl-s">${'"${name%.*}"'}</span></>,
  },
  {
    zh: { title: <>here-doc 喂 SQL</>, desc: <>把多行 SQL <strong>直接灌进 psql/mysql</strong> 而不写中间 .sql 文件。</> },
    en: { title: <>Here-doc feeds SQL</>, desc: <>Pipe multiline SQL <strong>straight into psql / mysql</strong> with no intermediate <code>.sql</code> file.</> },
    code: <>psql -d db <span className="cl-flag">&lt;&lt;SQL</span>{'\n'}SELECT 1;{'\n'}SQL</>,
  },
  {
    zh: { title: <>幂等创建目录</>, desc: <><code>mkdir -p</code> 的"已经存在不报错"是 <strong>30 年的标准</strong>幂等模式。</> },
    en: { title: <>Idempotent mkdir</>, desc: <><code>mkdir -p</code>'s "doesn't fail if it exists" is the <strong>30-year-standard</strong> idempotency pattern.</> },
    code: <>mkdir -p <span className="cl-s">"$OUT/data/processed"</span></>,
  },
  {
    zh: { title: <>等待端口起来</>, desc: <>容器化常见: <strong>循环 + sleep + 退出码</strong>判服务就绪。</> },
    en: { title: <>Wait for a port</>, desc: <>A container-era staple: a <strong>loop with sleep and exit code</strong> waits for a service to be ready.</> },
    code: <>until nc -z host 5432; do sleep 1; done</>,
  },
  {
    zh: { title: <>shebang 找解释器</>, desc: <><code>#!/usr/bin/env bash</code> 比硬路径 <code>#!/bin/bash</code> <strong>更可移植</strong> (Mac 上 bash 在 /opt/homebrew/...)。</> },
    en: { title: <>Portable shebang</>, desc: <><code>#!/usr/bin/env bash</code> is <strong>more portable</strong> than the hardcoded <code>#!/bin/bash</code> (e.g. Homebrew bash lives in /opt/homebrew/...).</> },
    code: <><span className="cl-c">#!/usr/bin/env bash</span></>,
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

const SHELLS: ShellLogo[] = [
  {
    href: 'https://www.gnu.org/software/bash/', highlight: true,
    zhName: 'Bash', enName: 'Bash',
    zhNote: 'GNU · 1989 · Linux 默认', enNote: 'GNU · 1989 · Linux default',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#060A08"/><rect x="0" y="0" width="100" height="18" fill="#121814"/><circle cx="12" cy="9" r="3" fill="#FF5F56"/><circle cx="22" cy="9" r="3" fill="#FFBD2E"/><circle cx="32" cy="9" r="3" fill="#27C93F"/><text x="14" y="68" fontFamily="monospace" fontWeight="700" fontSize="36" fill="#4EAA25">$_</text></svg>,
  },
  {
    href: 'https://zsh.sourceforge.io/', highlight: true,
    zhName: 'Zsh', enName: 'Zsh',
    zhNote: '1990 · Mac 默认 · oh-my-zsh', enNote: '1990 · macOS default · oh-my-zsh',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A1A2A"/><text x="50" y="65" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="44" fill="#C8E68A">%</text></svg>,
  },
  {
    href: 'https://fishshell.com/', highlight: true,
    zhName: 'Fish', enName: 'Fish',
    zhNote: '2005 · 反 POSIX · 友好交互', enNote: '2005 · anti-POSIX · friendly',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0F2030"/><path d="M20 50 Q40 25, 65 50 Q40 75, 20 50 Z M62 50 L82 35 L82 65 Z" fill="#4EAA25"/><circle cx="33" cy="48" r="2.5" fill="#fff"/></svg>,
  },
  {
    href: 'https://learn.microsoft.com/powershell/',
    zhName: 'PowerShell', enName: 'PowerShell',
    zhNote: '2006 · 对象管道 · Windows 默认', enNote: '2006 · object pipeline · Windows',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#012456"/><text x="50" y="64" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="32" fill="#fff">{'>_'}</text></svg>,
  },
  {
    href: 'https://www.nushell.sh/',
    zhName: 'Nushell', enName: 'Nushell',
    zhNote: '2019 · Rust · 结构化数据', enNote: '2019 · Rust · structured data',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1F2A1F"/><text x="50" y="65" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="44" fill="#4EAA25">nu</text></svg>,
  },
  {
    href: 'https://www.kornshell.com/',
    zhName: 'Ksh (ksh93)', enName: 'Ksh (ksh93)',
    zhNote: '1983 · Bourne 超集 · 商业 Unix', enNote: '1983 · Bourne superset · commercial Unix',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#241C0A"/><text x="50" y="65" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="32" fill="#C8E68A">ksh</text></svg>,
  },
  {
    href: 'https://www.tcsh.org/',
    zhName: 'Tcsh', enName: 'Tcsh',
    zhNote: 'csh + readline · BSD 历史默认', enNote: 'csh + readline · historic BSD default',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#2A1A1A"/><text x="50" y="65" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="38" fill="#FFD060">{'%>'}</text></svg>,
  },
  {
    href: 'https://www.oilshell.org/',
    zhName: 'YSH / Oil', enName: 'YSH / Oil',
    zhNote: '2020+ · bash 升级路径', enNote: '2020+ · upgrade path from bash',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1A2218"/><text x="50" y="65" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="38" fill="#7BD934">ysh</text></svg>,
  },
  {
    href: 'https://www.shellcheck.net/',
    zhName: 'ShellCheck', enName: 'ShellCheck',
    zhNote: 'Vidar Holen · 静态分析器', enNote: 'Vidar Holen · static analyser',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0B0F0C"/><path d="M28 52 L44 68 L74 32" fill="none" stroke="#7BD934" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: 'https://ohmyz.sh/',
    zhName: 'oh-my-zsh', enName: 'oh-my-zsh',
    zhNote: '2009 · 把 zsh 推上桌面', enNote: '2009 · put zsh on every Mac',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#101820"/><text x="50" y="65" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="32" fill="#C8E68A">omz</text></svg>,
  },
  {
    href: 'https://docs.docker.com/reference/dockerfile/',
    zhName: 'Dockerfile', enName: 'Dockerfile',
    zhNote: 'RUN 行 · 默认 /bin/sh', enNote: 'RUN lines · default /bin/sh',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0DB7ED"/><rect x="22" y="40" width="14" height="14" fill="#fff"/><rect x="38" y="40" width="14" height="14" fill="#fff"/><rect x="54" y="40" width="14" height="14" fill="#fff"/><rect x="30" y="24" width="14" height="14" fill="#fff"/><rect x="46" y="24" width="14" height="14" fill="#fff"/><path d="M16 60 Q20 70 30 72 H76 Q88 72 88 60" fill="#fff" opacity=".9"/></svg>,
  },
  {
    href: 'https://docs.github.com/en/actions',
    zhName: 'GitHub Actions', enName: 'GitHub Actions',
    zhNote: 'run: · 全平台默认 bash', enNote: 'run: · bash by default',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#161B22"/><circle cx="50" cy="50" r="22" fill="none" stroke="#7BD934" strokeWidth="4"/><path d="M50 38 L62 50 L50 62 L44 56 L50 50 L44 44 Z" fill="#7BD934"/></svg>,
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
      title: <>Word splitting — 没引号的变量会爆炸</>,
      body: (<>
        <p>shell 默认<strong>对变量做 word splitting</strong> (按 <code>IFS</code> 切, 默认空格/tab/换行), <em>再</em>做 glob 展开。文件名含空格、<code>*</code>、<code>?</code> 就会出错——而且<strong>静默</strong>。</p>
        <p>规则: <strong>所有变量都加双引号</strong>。<code>"$f"</code>、<code>"$@"</code>、<code>"${'${arr[@]}'}"</code>。例外几乎没有。<em>ShellCheck SC2086 就在抓这个</em>, 任何 <code>$var</code> 不加引号都会被它提示。</p>
        <pre className="future-code"><code>
          <span className="cl-c"># BAD — file with spaces: silent disaster</span>{'\n'}
          <span className="cl-fn">rm</span> $f{'\n\n'}
          <span className="cl-c"># GOOD</span>{'\n'}
          <span className="cl-fn">rm</span> <span className="cl-s">"$f"</span>
        </code></pre>
      </>),
    },
    en: {
      title: <>Word splitting — unquoted variables explode</>,
      body: (<>
        <p>The shell <strong>splits variables on <code>IFS</code></strong> (whitespace by default) <em>then</em> expands globs. Filenames with spaces, <code>*</code>, or <code>?</code> turn into multiple arguments — <strong>silently</strong>.</p>
        <p>Rule: <strong>quote every variable</strong>. <code>"$f"</code>, <code>"$@"</code>, <code>"${'${arr[@]}'}"</code>. There are almost no exceptions. <em>ShellCheck's SC2086 catches every unquoted <code>$var</code></em>.</p>
        <pre className="future-code"><code>
          <span className="cl-c"># BAD — file with spaces: silent disaster</span>{'\n'}
          <span className="cl-fn">rm</span> $f{'\n\n'}
          <span className="cl-c"># GOOD</span>{'\n'}
          <span className="cl-fn">rm</span> <span className="cl-s">"$f"</span>
        </code></pre>
      </>),
    },
  },
  {
    tag: 'TRAP',
    zh: { title: <><code>set -e</code> 不抓你以为它抓的东西</>, body: <><p><code>set -e</code> <strong>不</strong>触发的场景比你想的多: 条件里 (<code>if cmd; then</code>)、管道左侧 (没 <code>pipefail</code>)、<code>cmd || echo bad</code>、函数被 <code>||</code> 调用、子 shell 里的失败。这条规则的"<em>边角</em>"多到 Greg Wooledge 专门写了 <code>BashFAQ/105</code>。<strong>strict mode 不是免疫, 是减弱面</strong>。</p></> },
    en: { title: <><code>set -e</code> doesn't catch what you think</>, body: <><p><code>set -e</code> <strong>does not</strong> trigger in more places than you'd guess: inside conditions (<code>if cmd; then</code>), the left side of a pipe (without <code>pipefail</code>), <code>cmd || echo bad</code>, functions invoked with <code>||</code>, and inside subshells. The corner-case list is long enough that Greg Wooledge's <code>BashFAQ/105</code> exists to document them. <strong>Strict mode reduces failure surface; it doesn't eliminate it</strong>.</p></> },
  },
  {
    tag: 'TRAP',
    zh: { title: <>关联数组要 bash 4+, 而 macOS 系统 bash 是 3.2</>, body: <><p>bash 4.0 (2009) 加了 <strong>关联数组</strong> <code>declare -A</code>, 但 <strong>macOS 默认 bash 仍是 3.2</strong> (2007, 因为 GPLv3)。在 Mac 上跑别人的脚本经常踩这个: 装 Homebrew bash 进 <code>/opt/homebrew/bin/bash</code>, shebang 写 <code>#!/usr/bin/env bash</code>。<em>2019 Catalina 之后 Apple 干脆默认换 zsh, 算是结案</em>。</p></> },
    en: { title: <>Associative arrays need bash 4+, but macOS ships bash 3.2</>, body: <><p>bash 4.0 (2009) added <strong>associative arrays</strong> via <code>declare -A</code>, but <strong>macOS still ships bash 3.2</strong> (2007 — because of GPLv3). On a Mac this trips up other people's scripts constantly: install Homebrew bash into <code>/opt/homebrew/bin/bash</code> and use <code>#!/usr/bin/env bash</code>. <em>After Catalina (2019) Apple just made zsh the default and called it done</em>.</p></> },
  },
  {
    tag: <>IS BASH A LANG ?</>,
    zh: { title: <>Bash 是编程语言吗</>, body: <><p>形式上是: <strong>Turing-complete</strong>, 有变量、循环、函数、数组、关联数组、协程。所以"shell 是不是编程语言"在<em>定义上</em>是 yes。</p><p>实践上: <strong>没人写超过 100 行 bash 不出错</strong>。变量没有类型、字符串和数字混合、quoting 规则有 6 层、错误处理靠 <code>set -e</code> 的边角...... <strong>BashFAQ + ShellCheck 的存在本身就是答案</strong>: 它是一门"<em>能用</em>"但"<em>不该写大型程序</em>"的语言。</p></> },
    en: { title: <>Is bash a programming language?</>, body: <><p>Formally yes: <strong>Turing-complete</strong>, with variables, loops, functions, arrays, associative arrays, coroutines. By definition the answer is yes.</p><p>In practice: <strong>nobody writes more than 100 lines of bash without bugs</strong>. Variables are untyped, strings and numbers mix freely, quoting has six layers, and error handling depends on <code>set -e</code>'s corner cases. <strong>The existence of BashFAQ and ShellCheck is itself the answer</strong>: it's a language that <em>works</em> but is <em>not built for large programs</em>.</p></> },
  },
];

export default function BashIntroPage() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'Bash : 1989 Brian Fox · 装在每台机器上 · DevOps 默认胶水',
    'Bash : 1989 Brian Fox · pre-installed everywhere · the DevOps default'
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
      <div ref={rootRef} className="bash-intro-root">
        <div className="grid-bg" />
        <div className="scanlines" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            {BASH_LOGO_SMALL}
            <span>Bash</span>
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
            <div className="hero-tag">// 1989 — 2026 · Brian Fox · GNU · Bourne-again shell · #!/usr/bin/env bash</div>
            <h1 className="hero-title">
              <span className="hero-prompt">$</span>
              <span className="hero-name">bash</span>
              <span className="hero-cursor" />
            </h1>
            <p className="hero-sub">
              <L
                zh={<><strong>1989 年</strong> Brian Fox 给 GNU 写的 sh 兼容 shell, 名字是 Stallman 的双关 "<strong>Bourne again shell</strong>"。37 年后它还在每台 Linux、每个 Dockerfile、每个 CI/CD 流水线、每段 <code>curl | bash</code> 安装命令的底下。<strong>没有哪门"更好的语言"取代过 shell — 因为没有哪门语言能像 shell 一样默认装在每台机器上</strong>。</>}
                en={<>Released in <strong>June 1989</strong> by Brian Fox at the FSF — the name is Stallman's pun, "<strong>Bourne again shell</strong>". Thirty-seven years on it still sits underneath every Linux box, every Dockerfile, every CI/CD pipeline, every <code>curl | bash</code> installer. <strong>No "better language" has displaced shell — because no language ships pre-installed everywhere the way shell does</strong>.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">1989<small></small></span>
                <span className="stat-label"><L zh={<>6 月 8 日 Bash 1.0<br /><em>Brian Fox · GNU / FSF</em></>} en={<>Bash 1.0 · 8 Jun<br /><em>Brian Fox · GNU / FSF</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">37<small> yr</small></span>
                <span className="stat-label"><L zh={<>仍是 Linux 默认<br /><em>Chet Ramey 维护中</em></>} en={<>Still Linux's default<br /><em>maintained by Chet Ramey</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">100<small>%</small></span>
                <span className="stat-label"><L zh={<>CI / Dockerfile 默认<br /><em>没有真正的替代品</em></>} en={<>CI / Dockerfile default<br /><em>no real challenger</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">25<small> yr</small></span>
                <span className="stat-label"><L zh={<>Shellshock 潜伏 1989→2014<br /><em>CVE-2014-6271</em></>} en={<>Shellshock latency 1989→2014<br /><em>CVE-2014-6271</em></>} /></span>
              </div>
            </div>

            <div className="hero-term">
              <div className="hero-term-bar">
                <span className="dot dot-red" />
                <span className="dot dot-yel" />
                <span className="dot dot-grn" />
                <span className="term-title">~/work — bash — 80×24</span>
              </div>
              <div className="hero-term-body">
                <span className="p">$</span> <span className="k">set</span> <span className="o">-euo pipefail</span>{'\n'}
                <span className="p">$</span> <span className="k">for</span> f <span className="k">in</span> *.log; <span className="k">do</span>{'\n'}
                {'  '}gzip <span className="s">"$f"</span>{'\n'}
                <span className="k">done</span>{'\n'}
                <span className="p">$</span> <span className="c"># still works in 2026</span>{'\n'}
                <span className="p">$</span> _
              </div>
            </div>

            <div className="hero-floats">
              <span className="float f1">set -euo pipefail</span>
              <span className="float f2">{'cmd | xargs'}</span>
              <span className="float f3">trap EXIT</span>
              <span className="float f4">{'$(date +%F)'}</span>
              <span className="float f5">{'<<EOF'}</span>
              <span className="float f6">{'${var%.*}'}</span>
              <span className="float f7">find -print0</span>
              <span className="float f8">{'#!/bin/bash'}</span>
              <span className="float f9">{'<(sort a)'}</span>
              <span className="float f10">IFS=$'\n\t'</span>
              <span className="float f11">{'[[ -f $f ]]'}</span>
              <span className="float f12">curl | bash</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>bash</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>Bash 是 <strong>GNU 的 sh 兼容命令行 shell</strong>, Brian Fox 在 1989 写出来。<em>"shell"</em> 同时指<strong>交互式命令解释器</strong>和<strong>脚本语言</strong> — 这是它最重要的设计选择: 你在命令行敲的, 跟你写在文件里的, 是同一套语法。</>}
                  en={<>Bash is <strong>GNU's sh-compatible command-line shell</strong>, written by Brian Fox in 1989. The word <em>"shell"</em> means <strong>both an interactive command interpreter and a scripting language</strong> — its single most important design decision: what you type at the prompt and what you write in a file share the same syntax.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="POSIX sh 的超集" en="Superset of POSIX sh" />, tag: 'lineage', p: <L zh={<>Bash <strong>兼容 1977 Bourne shell</strong> + POSIX.2, 同时加上数组、关联数组、<code>[[</code>、<code>$()</code>、 process substitution、brace expansion 等。<em>读 30 年前的脚本依然能跑</em>, 写新脚本不必假装活在 POSIX 里。</>} en={<>Bash <strong>is compatible with the 1977 Bourne shell</strong> + POSIX.2, and adds arrays, associative arrays, <code>[[</code>, <code>$()</code>, process substitution, brace expansion. <em>A 30-year-old script still runs</em>; new scripts don't have to pretend to live inside strict POSIX.</>} /> },
                { h: <L zh="交互式 = 脚本" en="Interactive = scripted" />, tag: 'design', p: <L zh={<><strong>命令行敲的 = 脚本写的</strong>。在 prompt 验证好一条命令直接粘进 <code>.sh</code> — 探索到自动化的距离 = 0。Python REPL 跟 .py 还是有区别; shell 没有。</>} en={<><strong>Prompt = script</strong>. A command you just validated at the prompt copies straight into a <code>.sh</code> — the distance from exploration to automation is zero. Python's REPL is still different from a <code>.py</code>; shell isn't.</>} /> },
                { h: <L zh="一切是文本流" en="Everything is a text stream" />, tag: 'philosophy', p: <L zh={<>Unix 哲学的字面化: <strong>程序读 stdin, 写 stdout, 做一件事</strong>。<code>|</code> 接线、<code>&gt;</code> 重定向、<code>&amp;</code> 后台。<em>2026 LLM 工具调用本质是这套思路的复活</em>。</>} en={<>Unix philosophy made literal: <strong>programs read stdin, write stdout, do one thing</strong>. <code>|</code> wires them; <code>&gt;</code> redirects; <code>&amp;</code> backgrounds. <em>The 2026 LLM tool-chain is a revival of the same idea</em>.</>} /> },
                { h: <L zh="装在每台机器上" en="Pre-installed everywhere" />, tag: 'ubiquity', p: <L zh={<>这是 shell <strong>最难复制的优势</strong>: 任何 POSIX 系统都有 <code>/bin/sh</code>, 几乎所有 Linux 都有 <code>/bin/bash</code>。<em>不需要装运行时</em>, 你能 ssh 进的服务器就能跑你的脚本。</>} en={<>The <strong>hardest-to-replicate</strong> advantage: every POSIX system has <code>/bin/sh</code>; nearly every Linux has <code>/bin/bash</code>. <em>No runtime to install</em> — anything you can ssh into, you can run your script on.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">deploy.py</span><span className="lang-tag js">Python · the heavy way</span></div>
                <pre className="code"><code>
                  <span className="cl-k">import</span> subprocess, pathlib, shutil{'\n'}
                  <span className="cl-k">from</span> contextlib <span className="cl-k">import</span> contextmanager{'\n\n'}
                  <span className="cl-k">@contextmanager</span>{'\n'}
                  <span className="cl-k">def</span> <span className="cl-fn">tmpdir</span>():{'\n'}
                  {'    '}d = pathlib.<span className="cl-fn">Path</span>(<span className="cl-s">"/tmp/build"</span>){'\n'}
                  {'    '}d.<span className="cl-fn">mkdir</span>(exist_ok=<span className="cl-k">True</span>){'\n'}
                  {'    '}<span className="cl-k">try</span>: <span className="cl-k">yield</span> d{'\n'}
                  {'    '}<span className="cl-k">finally</span>: shutil.<span className="cl-fn">rmtree</span>(d){'\n\n'}
                  <span className="cl-k">with</span> <span className="cl-fn">tmpdir</span>() <span className="cl-k">as</span> d:{'\n'}
                  {'    '}subprocess.<span className="cl-fn">run</span>([<span className="cl-s">"tar"</span>,<span className="cl-s">"xf"</span>,...], check=<span className="cl-k">True</span>){'\n'}
                  {'    '}subprocess.<span className="cl-fn">run</span>([<span className="cl-s">"make"</span>], cwd=d, check=<span className="cl-k">True</span>){'\n\n'}
                  <span className="cl-c"># 12 lines · subprocess everywhere · still calling shell tools</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">deploy.sh</span><span className="lang-tag ts">bash · the native way</span></div>
                <pre className="code"><code>
                  <span className="cl-c">#!/usr/bin/env bash</span>{'\n'}
                  <span className="cl-k">set</span> <span className="cl-flag">-euo pipefail</span>{'\n\n'}
                  <span className="cl-v">TMP</span>=<span className="cl-fn">$(</span><span className="cl-fn">mktemp</span> <span className="cl-flag">-d</span><span className="cl-fn">)</span>{'\n'}
                  <span className="cl-k">trap</span> <span className="cl-s">'rm -rf "$TMP"'</span> EXIT{'\n\n'}
                  <span className="cl-fn">tar</span> <span className="cl-flag">-xf</span> release.tgz <span className="cl-flag">-C</span> <span className="cl-s">"$TMP"</span>{'\n'}
                  <span className="cl-fn">make</span> <span className="cl-flag">-C</span> <span className="cl-s">"$TMP"</span>{'\n\n'}
                  <span className="cl-c"># 6 lines · cleanup guaranteed · no FFI</span>{'\n'}
                  <span className="cl-c"># runs on any POSIX box · no pip install</span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 02 Shell family tree */}
          <section className="section" id="family">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="家谱" en="Family Tree" /> <code>: ShellLineage</code></h2>
              <p className="sec-desc"><L
                zh={<>所有现代 shell 都从 1971 Thompson shell 来。主线: Bourne (sh) → ksh → bash → zsh; 旁支: csh → tcsh (Berkeley); 现代: fish (反 POSIX) / nushell (Rust); Windows: PowerShell (对象管道)。<em>bash 在主线最粗的那条上</em>。</>}
                en={<>Every modern shell traces back to the 1971 Thompson shell. Main line: Bourne (sh) → ksh → bash → zsh. Berkeley branch: csh → tcsh. Modern: fish (anti-POSIX) / nushell (Rust). Windows: PowerShell (object pipes). <em>Bash sits on the thickest part of the main line</em>.</>}
              /></p>
            </header>

            <div className="tree-wrap">
              <div className="tree-grid">
                <div className="tree-cell head">1970s</div>
                <div className="tree-cell head">1980s</div>
                <div className="tree-cell head">1990s</div>
                <div className="tree-cell head">2000s</div>
                <div className="tree-cell head">2010s</div>
                <div className="tree-cell head">2020s</div>
                <div className="tree-cell head"><L zh="血统" en="Lineage" /></div>

                {/* Bourne main line */}
                <div className="tree-cell lineage-bourne">
                  <span className="tree-name">sh</span>
                  <span className="tree-year">1977 · Bourne</span>
                  <span className="tree-note"><L zh="if / for / case" en="if / for / case" /></span>
                </div>
                <div className="tree-cell lineage-bourne">
                  <span className="tree-name">ksh</span>
                  <span className="tree-year">1983 · Korn</span>
                  <span className="tree-note"><L zh="数组 / 协程" en="arrays / coprocs" /></span>
                </div>
                <div className="tree-cell lineage-bourne">
                  <span className="tree-name bash">bash</span>
                  <span className="tree-year">1989 · Fox</span>
                  <span className="tree-note"><L zh="GNU 旗舰" en="GNU flagship" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell"><L zh="Bourne 主线" en="Bourne main line" /></div>

                {/* zsh */}
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell lineage-bourne">
                  <span className="tree-name">zsh</span>
                  <span className="tree-year">1990 · Falstad</span>
                  <span className="tree-note"><L zh="ksh ∪ bash ∪ tcsh" en="ksh ∪ bash ∪ tcsh" /></span>
                </div>
                <div className="tree-cell lineage-bourne">
                  <span className="tree-name">oh-my-zsh</span>
                  <span className="tree-year">2009 · Russell</span>
                  <span className="tree-note"><L zh="桌面爆款" en="desktop hit" /></span>
                </div>
                <div className="tree-cell lineage-bourne">
                  <span className="tree-name">zsh = macOS</span>
                  <span className="tree-year">2019 · Catalina</span>
                  <span className="tree-note"><L zh="苹果改默认" en="Apple flips default" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell"><L zh="zsh 分支" en="zsh branch" /></div>

                {/* csh / tcsh */}
                <div className="tree-cell lineage-csh">
                  <span className="tree-name">csh</span>
                  <span className="tree-year">1979 · Joy</span>
                  <span className="tree-note"><L zh="C 风语法" en="C-flavoured" /></span>
                </div>
                <div className="tree-cell lineage-csh">
                  <span className="tree-name">tcsh</span>
                  <span className="tree-year">1981</span>
                  <span className="tree-note"><L zh="csh + readline" en="csh + readline" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell"><L zh="Berkeley 旁支" en="Berkeley branch" /></div>

                {/* Modern: fish, nu, oil */}
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell lineage-modern">
                  <span className="tree-name">fish</span>
                  <span className="tree-year">2005 · Liljencrantz</span>
                  <span className="tree-note"><L zh="反 POSIX" en="anti-POSIX" /></span>
                </div>
                <div className="tree-cell lineage-modern">
                  <span className="tree-name">nushell</span>
                  <span className="tree-year">2019 · Turner</span>
                  <span className="tree-note"><L zh="Rust · 结构化" en="Rust · structured" /></span>
                </div>
                <div className="tree-cell lineage-modern">
                  <span className="tree-name">YSH / Oil</span>
                  <span className="tree-year">2020+ · Chu</span>
                  <span className="tree-note"><L zh="升级路径" en="upgrade path" /></span>
                </div>
                <div className="tree-cell"><L zh="现代实验" en="Modern experiments" /></div>

                {/* PowerShell */}
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name">PowerShell 1.0</span>
                  <span className="tree-year">2006 · Snover</span>
                  <span className="tree-note"><L zh="对象管道" en="object pipeline" /></span>
                </div>
                <div className="tree-cell lineage-ps">
                  <span className="tree-name">pwsh OSS</span>
                  <span className="tree-year">2016 · cross-platform</span>
                  <span className="tree-note"><L zh="Linux / macOS" en="Linux / macOS" /></span>
                </div>
                <div className="tree-cell empty"></div>
                <div className="tree-cell"><L zh="Windows 对照组" en="Windows counter" /></div>
              </div>
              <div className="tree-legend">
                <span><span className="swatch sw-bourne" /> <L zh="Bourne / POSIX 主线" en="Bourne / POSIX main line" /></span>
                <span><span className="swatch sw-csh" /> <L zh="Berkeley csh 旁支" en="Berkeley csh branch" /></span>
                <span><span className="swatch sw-modern" /> <L zh="2000s+ 重新设计" en="2000s+ redesigns" /></span>
                <span><span className="swatch sw-ps" /> <L zh="PowerShell (对象 shell)" en="PowerShell (object shell)" /></span>
              </div>
            </div>
          </section>

          {/* 03 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: 55 yr timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>从 1971 Thompson shell 到 2026 — 55 年。这条线穿过 Bell Labs / Berkeley / GNU / Apple / Microsoft, 也穿过 1 个吃了 25 年才被发现的洞 (Shellshock) 和 1 个许可证之争 (macOS 弃 bash)。<em>所有人都骂它, 所有人都用它</em>。</>}
                en={<>From 1971's Thompson shell to 2026 — 55 years. The line runs through Bell Labs, Berkeley, GNU, Apple, Microsoft — and through one 25-year-old security hole (Shellshock) and one licensing fight (macOS leaving bash). <em>Everyone complains about it. Everyone uses it</em>.</>}
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
              <h2 className="sec-title"><L zh="语法精要" en="Language Essentials" /> <code>: BashGotchas</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是 bash 跟其它语言<strong>最不像</strong>、也是<strong>最容易翻车</strong>的地方: <code>[ ]</code> vs <code>[[ ]]</code>、参数扩展、strict mode、here-docs、process substitution、<code>trap</code>、<code>xargs</code>、<code>$()</code>。第 9 张是"<em>bash 算不算编程语言</em>"的小回答。</>}
                en={<>The eight cards below cover where bash <strong>differs hardest</strong> from other languages — and <strong>where scripts break</strong>: <code>[ ]</code> vs <code>[[ ]]</code>, parameter expansion, strict mode, here-docs, process substitution, <code>trap</code>, <code>xargs</code>, <code>$()</code>. The ninth is a brief take on "<em>is bash even a programming language</em>".</>}
              /></p>
            </header>

            <div className="ts-grid">
              {BASH_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">∞</div>
                <h3><L zh={<>编程语言? 形式上是, 实践上别</>} en={<>Programming language? Formally yes, practically don't</>} /></h3>
                <p><L
                  zh={<>Bash 是 <strong>Turing-complete</strong>, 有函数、循环、数组、关联数组、协程, 形式上完全是编程语言。<strong>但</strong>: 变量没类型、quoting 规则 6 层、<code>set -e</code> 的边角能写一本书、字符串与数字的隐式转换没人能背全。<em>BashFAQ + ShellCheck 的存在本身就是答案</em>。</>}
                  en={<>Bash is <strong>Turing-complete</strong> — functions, loops, arrays, associative arrays, coprocesses. Formally a real language. <strong>But</strong>: no variable types, six layers of quoting rules, <code>set -e</code> corner cases worth a small book, implicit string/number coercion no one fully remembers. <em>The existence of BashFAQ + ShellCheck is itself the answer</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>任何写过 100 行 bash 没出错的人都在撒谎。</>}
                  en={<>Anyone who's written more than 100 lines of bash without bugs is lying.</>}
                /></em>"</p>
              </div>
            </div>
          </section>

          {/* 05 Idioms */}
          <section className="section" id="idioms">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="名段" en="Idioms Hall of Fame" /> <code>: 9 patterns</code></h2>
              <p className="sec-desc"><L
                zh={<>这 9 段是 shell 圈<strong>认得就能少写一半 Stack Overflow 搜索</strong>的常用模式。每一段都有十年以上的稳定形式, 也都被 ShellCheck 校验。<em>记下来就是 bash 中级</em>。</>}
                en={<>These nine patterns will <strong>cut your Stack Overflow searches in half</strong>. Each has a decade-plus of stable form and is validated by ShellCheck. <em>Memorise them and you're intermediate</em>.</>}
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
              <h2 className="sec-title"><L zh="为何还在" en="Why It's Still Here" /> <code>: WhyShellPersists</code></h2>
              <p className="sec-desc"><L
                zh={<>Shell 被骂了 50 年, 没有取代它的语言出现。原因不是 shell 多好 — 是<strong>它占的位置无可替代</strong>: 默认装在每台机器上, 管道模型是 Unix 哲学的字面化, 语法 30 年向前兼容, DevOps 整个领域的胶水。</>}
                en={<>Shell has been complained about for 50 years and no replacement has stuck. Not because shell is great — because <strong>the slot it occupies is irreplaceable</strong>: pre-installed everywhere, pipes are Unix philosophy made literal, the syntax is 30-year backward compatible, and it's the glue of all of DevOps.</>}
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

          {/* 07 Ecosystem / shells */}
          <section className="section" id="shells">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="生态 — 整个 shell 家族" en="Ecosystem — the whole shell family" /> <code>: ShellFamily</code></h2>
              <p className="sec-desc"><L
                zh={<>不止 bash。下面这 12 个 (shell + 工具 + 主要使用场景) 构成 2026 年现实里的 shell 生态。<strong>每一个都是真用的</strong>: 服务器跑 bash、Mac 桌面跑 zsh、Windows 自动化 pwsh、容器化的 Dockerfile / Actions 都默认 bash。</>}
                en={<>It's not just bash. The twelve below (shells + tools + main contexts) make up the real shell ecosystem in 2026. <strong>Every one is in real use</strong>: servers run bash, Mac desktops run zsh, Windows automation uses pwsh, and Dockerfiles / Actions default to bash.</>}
              /></p>
            </header>

            <div className="logo-grid logo-grid-12">
              {SHELLS.map((p, i) => (
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
              <h2 className="sec-title"><L zh="对比" en="vs Python / pwsh / Nushell" /> <code>: bash vs the rest</code></h2>
              <p className="sec-desc"><L
                zh={<>跟 <a href="/code/python">Python</a> 比: shell 写 ≤ 100 行的胶水、Python 写 ≥ 100 行的逻辑 — <strong>临界点大概是"<em>开始想要复杂错误处理</em>"那一刻</strong>。跟 <strong>PowerShell</strong> 比: 文本流 vs 对象流, 两种完全不同的世界观。跟 <strong>Nushell</strong> 比: 它想兼得, 但 35 年装机量摆在那里。</>}
                en={<>vs <a href="/code/python">Python</a>: shell for ≤ 100 lines of glue, Python for ≥ 100 lines of logic — <strong>the boundary is roughly the moment you want serious error handling</strong>. vs <strong>PowerShell</strong>: text streams vs object streams, two different worldviews. vs <strong>Nushell</strong>: tries to have both, but 35 years of install base is hard to beat.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts">Bash</th>
                  <th className="th-py">Python</th>
                  <th className="th-sw">PowerShell</th>
                  <th className="th-js">Nushell</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="出身" en="Origin" />,
                    sh: <>Brian Fox · 1989</>,
                    py: <>Guido · 1991</>,
                    ps: <>Snover / MS · 2006</>,
                    nu: <>Turner · 2019</> },
                  { k: <L zh="管道载荷" en="Pipe payload" />,
                    sh: <L zh="纯文本流" en="Text streams" />,
                    py: <L zh={<>无 (函数调用)</>} en={<>None (function calls)</>} />,
                    ps: <L zh=".NET 对象" en=".NET objects" />,
                    nu: <L zh="结构化表 / 列" en="Structured tables / cols" /> },
                  { k: <L zh="类型" en="Types" />,
                    sh: <L zh={<>无 (全字符串)</>} en={<>None (all strings)</>} />,
                    py: <L zh="动态 · 可选 typing" en="Dynamic · optional typing" />,
                    ps: <L zh=".NET 类型系统" en=".NET type system" />,
                    nu: <L zh="结构化值类型" en="Structured value types" /> },
                  { k: <L zh="预装情况" en="Pre-installed" />,
                    sh: <L zh={<><strong>所有 Linux / macOS / WSL</strong></>} en={<><strong>every Linux / macOS / WSL</strong></>} />,
                    py: <L zh={<>多数 Linux 有 · 版本不齐</>} en={<>most Linux · version chaos</>} />,
                    ps: <L zh="Windows 默认 · 其它要装" en="Windows default · elsewhere installable" />,
                    nu: <L zh={<>要装</>} en={<>Install required</>} /> },
                  { k: <L zh="交互 vs 脚本" en="Interactive vs script" />,
                    sh: <L zh={<><strong>同一种语法</strong></>} en={<><strong>same syntax</strong></>} />,
                    py: <L zh="REPL ≠ .py 写法" en="REPL ≠ .py form" />,
                    ps: <L zh={<><strong>同一种语法</strong></>} en={<><strong>same syntax</strong></>} />,
                    nu: <L zh={<><strong>同一种语法</strong></>} en={<><strong>same syntax</strong></>} /> },
                  { k: <L zh="错误处理" en="Error handling" />,
                    sh: <L zh={<><code>set -euo pipefail</code> · 边角多</>} en={<><code>set -euo pipefail</code> · corner cases</>} />,
                    py: <L zh="try / except · 一等" en="try / except · first-class" />,
                    ps: <L zh="try / catch · ErrorRecord" en="try / catch · ErrorRecord" />,
                    nu: <L zh={<>try { '{ ... }'} · 结构化错误</>} en={<>try { '{ ... }'} · structured errors</>} /> },
                  { k: <L zh="字符串 quoting" en="String quoting" />,
                    sh: <L zh={<><strong>6 层</strong> · word splitting 陷阱</>} en={<><strong>six layers</strong> · word-split traps</>} />,
                    py: <L zh="字符串就是字符串" en="A string is a string" />,
                    ps: <L zh={<>2 种 · 干净</>} en={<>two flavours · clean</>} />,
                    nu: <L zh={<>2 种 · 干净</>} en={<>two flavours · clean</>} /> },
                  { k: <L zh="生态规模" en="Ecosystem size" />,
                    sh: <L zh={<>每个 *nix 工具 (find/sed/awk/...)</>} en={<>every *nix tool (find/sed/awk/...)</>} />,
                    py: <L zh="PyPI · 50 万包" en="PyPI · ~500k packages" />,
                    ps: <L zh="PowerShell Gallery" en="PowerShell Gallery" />,
                    nu: <L zh="小 · 早期" en="Small · early" /> },
                  { k: <L zh="典型场景" en="Typical use" />,
                    sh: <L zh={<>CI / 部署 / Dockerfile / 一次性脚本</>} en={<>CI / deploy / Dockerfile / one-off</>} />,
                    py: <L zh="数据 / Web / AI / 业务" en="Data / web / AI / business" />,
                    ps: <L zh="Windows 自动化 / AD / Exchange" en="Windows automation / AD / Exchange" />,
                    nu: <L zh="数据探索 / 个人 shell" en="Data exploration / personal shell" /> },
                  { k: <L zh="何时切走" en="When to leave it" />,
                    sh: <L zh={<>≥ 100 行, 真错误处理, JSON / SQL 复杂逻辑</>} en={<>≥ 100 lines · real error handling · complex JSON/SQL</>} />,
                    py: <L zh="不切" en="Don't" />,
                    ps: <L zh="跨平台部署" en="Cross-platform deploy" />,
                    nu: <L zh="任何要部署给别人的脚本" en="Any script you ship" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.sh}</td>
                    <td>{row.py}</td>
                    <td>{row.ps}</td>
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
              <h2 className="sec-title"><L zh="坑与现实" en="Pitfalls & Reality" /> <code>: ShellTraps</code></h2>
              <p className="sec-desc"><L
                zh={<>承认 bash 烂的地方比假装它好更有用。下面是<strong>四个最常踩的坑</strong> + 一个老问题 ("bash 是不是编程语言")。每一条都对应一个 ShellCheck 规则或者 BashFAQ 词条。</>}
                en={<>Owning bash's bad parts beats pretending. Below: the <strong>four most-stepped-in traps</strong> + the perennial question ("is bash a programming language?"). Each one maps to a ShellCheck rule or a BashFAQ entry.</>}
              /></p>
            </header>

            <blockquote className="quote-block">
              <div className="quote-mark">"</div>
              <p className="quote-text"><L
                zh={<>我维护 bash <strong>30 多年</strong>了。每一个新功能我都会被人骂"shell 不该做这个", 每一个老 bug 我都会被人骂"shell 不该这样设计"。<strong>但每次我看 GitHub Actions 的日志或者别人发的部署脚本, 还是 bash</strong>。它不是好语言, 它是不可替代的语言 — 这是两件事。</>}
                en={<>I've been maintaining bash for <strong>30+ years</strong>. Every new feature gets me "shell shouldn't do that"; every old bug gets me "shell shouldn't have been designed that way". <strong>But every time I look at someone's GitHub Actions log or deploy script, it's still bash</strong>. It isn't a good language — it's an irreplaceable one. Those are different claims.</>}
              /></p>
              <footer className="quote-footer">
                <span className="quote-author">— Chet Ramey</span>
                <span className="quote-context"><L zh="Bash 维护者 1992 至今 · 多次访谈摘述" en="Bash maintainer 1992 → present · paraphrased from interviews" /></span>
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
                zh={<>Bash 不是 2026 年你想<em>选</em>的语言, 是你<em>已经在用</em>的语言。<strong>承认它、写 strict mode、用 ShellCheck</strong>; 超过 100 行复杂逻辑就切 <a href="/code/python">Python</a>。<em>这才是诚实的 shell 工程实践</em>。</>}
                en={<>In 2026 bash isn't the language you <em>pick</em> — it's the language you <em>already use</em>. <strong>Own it, run strict mode, use ShellCheck</strong>. Past 100 lines of nontrivial logic, switch to <a href="/code/python">Python</a>. <em>That's honest shell engineering</em>.</>}
              /></p>
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-col">
              <h4><L zh="官方资源" en="Official" /></h4>
              <ul>
                <li><a href="https://www.gnu.org/software/bash/" target="_blank" rel="noopener">gnu.org/software/bash</a></li>
                <li><a href="https://www.gnu.org/software/bash/manual/" target="_blank" rel="noopener"><L zh="Bash 参考手册" en="Bash Reference Manual" /></a></li>
                <li><a href="https://git.savannah.gnu.org/cgit/bash.git" target="_blank" rel="noopener">bash.git (savannah)</a></li>
                <li><a href="https://pubs.opengroup.org/onlinepubs/9699919799/" target="_blank" rel="noopener">POSIX shell spec</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="工具 / 检查" en="Tools / Lint" /></h4>
              <ul>
                <li><a href="https://www.shellcheck.net/" target="_blank" rel="noopener">ShellCheck</a></li>
                <li><a href="https://github.com/mvdan/sh" target="_blank" rel="noopener">shfmt (formatter)</a></li>
                <li><a href="https://github.com/bminor/bash" target="_blank" rel="noopener">GitHub mirror</a></li>
                <li><a href="https://mywiki.wooledge.org/BashFAQ" target="_blank" rel="noopener">BashFAQ (Wooledge)</a></li>
                <li><a href="https://wiki.bash-hackers.org/" target="_blank" rel="noopener">Bash Hackers wiki</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="其它 shell" en="Other shells" /></h4>
              <ul>
                <li><a href="https://zsh.sourceforge.io/" target="_blank" rel="noopener">zsh.sourceforge.io</a></li>
                <li><a href="https://ohmyz.sh/" target="_blank" rel="noopener">ohmyz.sh</a></li>
                <li><a href="https://fishshell.com/" target="_blank" rel="noopener">fishshell.com</a></li>
                <li><a href="https://www.nushell.sh/" target="_blank" rel="noopener">nushell.sh</a></li>
                <li><a href="https://www.oilshell.org/" target="_blank" rel="noopener">oilshell.org</a></li>
                <li><a href="https://learn.microsoft.com/powershell/" target="_blank" rel="noopener">PowerShell</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/python"><L zh="Python — 100 行切走的目标" en="Python — where to graduate to" /></a></li>
                <li><a href="/code/c"><L zh="C — bash 自己用 C 写的" en="C — bash itself is written in C" /></a></li>
                <li><a href="/code/rust"><L zh="Rust — nushell 的载体" en="Rust — the language behind nushell" /></a></li>
                <li><a href="/code/go"><L zh="Go — shfmt 的载体" en="Go — the language behind shfmt" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo">{BASH_LOGO_SVG}</div>
              <p className="footer-line"><L zh="单页中文 / English 双语 · 资料截至 2026-05" en="Single-page guide · zh / en · last updated 2026-05" /></p>
              <p className="footer-line dim"><code>{`#!/usr/bin/env bash`}</code></p>
              <p className="footer-line dim"><code>{`set -euo pipefail`}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
