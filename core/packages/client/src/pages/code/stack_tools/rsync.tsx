import type { StackTool } from '../stack_tool_types';
import { k, v, s, n, c } from '../stack_tool_types';

// ─── rsync ──────────────────────────────────────────────────────────────────

export const RSYNC: StackTool = {
  slug: 'rsync',
  name: 'rsync',
  version: '3.4.2',
  since: '1996-06',
  group: 'dev',
  accent: '#8B5CF6',
  bright: '#A88AFA',
  glyph: '⇆',
  floats: ['rolling checksum', 'delta xfer', '--delete', '--link-dest', '-avz', '-P', 'ssh://', 'daemon :873', 'rsync.net', 'rsnapshot', 'BackupPC', 'mirror'],
  zh: {
    tagline: '只发改动的那几个字节',
    role: '把构建产物 / 备份 / 镜像在两台机器之间同步, 只传差异。',
    heroSub: <>1996 年 Andrew Tridgell 的博士论文产出。一个滚动校验 + 弱/强双 hash 的算法, 让远端文件只传<strong>本地缺的那几个字节</strong>。三十年来, 每个 Linux 发行版的镜像、每个 CI 部署脚本、每个 "把巨大的目录搬过去" 的命令背后都是它。</>,
    whatDesc: <>rsync 是一个 <strong>文件同步工具 + 协议</strong>。命令本身是 <code>rsync [src] [dst]</code>, 默认走 ssh, 也可以裸 TCP 873 跑 daemon。它做的事只有一件:让目标的文件树等于源的文件树, 但传输量等于差异。</>,
    historyDesc: <>1996 年 Tridgell 在 ANU 写博士论文时把"两个相似但不相同的文件如何高效同步"这件事正式化, 写成 TR-CS-96-05 论文 + 一个开源实现。Wayne Davison 2002 年接手维护, 一接就是 22 年。2024 年 Tridgell 重新介入做 3.4.0 的安全大修, 同年项目搬到 RsyncProject GitHub 组织独立运作。</>,
    conceptsTitle: '算法 + 选项核心',
    conceptsDesc: <>rsync 表面是 cli 工具, 内核是一个"两端基于弱 + 强 hash 滚动比对、只传 mismatched block"的算法。常用 flag 就那一打, 但每一个都对应远端一种行为变化。</>,
    whyDesc: <>2026 年还在用 rsync, 是因为它<strong>简单到无法被替代</strong> —— 一行命令, 走 ssh, 不需要 server, 不需要 schema, 不需要 token, 跨任何 POSIX 系统都能跑。</>,
    adoptersTitle: '谁在用',
    adoptersDesc: <>所有 Linux 发行版镜像、几乎每一个 CI/CD 的 "部署到机器" 那一步、备份产品 (rsnapshot / BackupPC / Borg 之外的另一档)、Time Machine 的灵感来源、本站的 SPA 镜像同步 —— 都是它。</>,
    cuberootDesc: <>本站两条核心数据流上都有 rsync。一是 <code>deploy_mirror.yml</code> 把 CI build 出的 SPA 同步到 GH Pages CNAME 镜像; 二是 stats-build 管道 (CI runner → 服务器) 用 scp/rsync 把生成的 <code>*.copy.tsv</code> 推上去, load.sql 再灌进 PG。手动场景:偶尔 <code>rsync -avz --progress</code> 把服务器上的产出拉回开发机。</>,
    outlookTitle: '当下与前景',
    outlookDesc: <>2025-01 那波 6 个 CVE 把 rsync 在安全社区的存在感拉满, 3.4.0 出来后大家发现这工具 30 年仍然是<strong>不可替代</strong>的。zsync / rclone / restic 各自补一些场景, 但"两端 POSIX, 一行命令同步"这件事没人做得更好。</>,
  },
  en: {
    tagline: 'Ship only the bytes that changed',
    role: 'Syncs build artifacts / backups / mirrors between two machines — only the delta crosses the wire.',
    heroSub: <>The 1996 PhD thesis output of Andrew Tridgell. A rolling checksum + weak/strong dual-hash algorithm that lets the remote file pull <strong>only the bytes it is missing</strong>. For thirty years, every Linux distro mirror, every CI deploy script, every "move a huge directory across machines" command has been this tool underneath.</>,
    whatDesc: <>rsync is a <strong>file sync tool + protocol</strong>. The command itself is <code>rsync [src] [dst]</code>, defaulting to ssh transport, with an optional raw-TCP daemon on port 873. It does exactly one thing: make the destination tree equal the source tree while the bytes on the wire equal the difference.</>,
    historyDesc: <>Tridgell formalized "how do you efficiently sync two similar-but-not-identical files" as his PhD work at ANU in 1996, published as TR-CS-96-05, alongside an open-source implementation. Wayne Davison took over maintenance in 2002 and held it for 22 years. In 2024 Tridgell stepped back in for the 3.4.0 security overhaul; the project moved to the RsyncProject GitHub organization the same year.</>,
    conceptsTitle: 'Algorithm + flags core',
    conceptsDesc: <>On the surface rsync is a CLI; at the core it is "both sides do weak + strong rolling hash and ship only the mismatched blocks." The common flags fit on one hand, but each one changes a real remote behavior.</>,
    whyDesc: <>Using rsync in 2026 is because it is <strong>too simple to replace</strong> — one command, over ssh, no server, no schema, no token, runs anywhere POSIX runs.</>,
    adoptersTitle: 'Who uses it',
    adoptersDesc: <>Every Linux distro mirror, almost every CI/CD's "deploy to a box" step, the whole backup-product tier (rsnapshot / BackupPC and the layer below Borg / restic), the inspiration behind macOS Time Machine, and this site's mirror sync — all rsync.</>,
    cuberootDesc: <>Two core data flows on this site touch rsync. First, <code>deploy_mirror.yml</code> rsyncs the CI-built SPA to the GH Pages CNAME mirror. Second, the stats-build pipeline (CI runner → server) uses scp/rsync to push the generated <code>*.copy.tsv</code> files, then load.sql ingests them into PG. Manual case: occasional <code>rsync -avz --progress</code> to pull built assets back to the dev box.</>,
    outlookTitle: 'Now and next',
    outlookDesc: <>The Jan 2025 wave of 6 CVEs put rsync front-and-center in security circles, and once 3.4.0 shipped, people realized this thirty-year-old tool is still <strong>irreplaceable</strong>. zsync / rclone / restic each cover a slice, but "two POSIX ends, one command, only the delta" still has no better answer.</>,
  },
  heroStats: [
    { num: '30', unit: 'y', zh: <>1996 年至今 <em>POSIX 同步事实标准</em></>, en: <>since 1996 <em>de-facto POSIX sync standard</em></> },
    { num: '6', zh: <>2025-01 一次性 CVE <em>3.4.0 一次清完</em></>, en: <>CVEs fixed at once in 2025-01 <em>cleared by 3.4.0</em></> },
    { num: '1', unit: ' line', zh: <>一行命令同步整棵目录 <em>没 server, 没 schema</em></>, en: <>one command syncs a whole tree <em>no server, no schema</em></> },
    { num: '3', unit: '.4.2', zh: <>当前稳定版 <em>2026-04-28</em></>, en: <>current stable <em>2026-04-28</em></> },
  ],
  intro: {
    zh: (
      <>
        <p>rsync 起源是 1996 年 Andrew Tridgell 在澳大利亚国立大学 (ANU) 的博士论文。要解决的问题非常具体:一个文件已经存在于本地, 远端有一个相似但不完全相同的版本, 怎么用<strong>最少的字节</strong>把本地变成远端? 朴素答案是把远端整文件下载, 朴素答案在 dial-up 时代是不可接受的。</p>
        <p>Tridgell 提出的算法分两步:接收端把本地文件切成固定大小的 block, 对每个 block 算一对 hash (一个便宜的 rolling checksum + 一个昂贵的强 hash), 把这串 hash 列表发给发送端;发送端拿着源文件, 用滚动校验在每一个字节偏移上扫一遍, 命中的 block 就只发"我用你那块"的 reference, 没命中的位置发原始字节。结果:同步量 ≈ 真实差异量, 不是文件总大小。</p>
        <p>这套算法变成了 <code>rsync(1)</code> 这个 cli + 一个公开协议。1996 年 6 月 19 日首版发布, Wayne Davison 2002 年接手维护一直到 2024 年。2025-01 那次 6 个 CVE 的集中披露逼出 3.4.0 安全大修, Tridgell 本人重新出山协助, 项目同时搬到独立 GitHub 组织 RsyncProject 自治。三十年了, 这个工具仍然是每一个 Linux 镜像、每一个 CI 部署、每一台备份服务器底下那一行命令。</p>
      </>
    ),
    en: (
      <>
        <p>rsync started as Andrew Tridgell's 1996 PhD thesis at the Australian National University. The problem was extremely concrete: one machine already has a file, a remote has a similar but not identical version — how do you make the remote equal the local with the <strong>fewest bytes on the wire</strong>? The naïve answer is to redownload the whole file; in the dial-up era, that was not an option.</p>
        <p>Tridgell's algorithm has two halves. The receiver splits its file into fixed-size blocks, computes a pair of hashes per block (a cheap rolling checksum plus an expensive strong hash) and ships that list to the sender. The sender walks the source file byte-by-byte using the rolling checksum; when a position matches a block, it emits a "use your block N" reference instead of the bytes; when it doesn't match, it emits the raw bytes. Result: traffic ≈ true delta, not file size.</p>
        <p>This became the <code>rsync(1)</code> CLI plus an open protocol. First release was 19 June 1996. Wayne Davison took maintainership in 2002 and held it until 2024. The Jan 2025 cluster of 6 CVEs forced the 3.4.0 security overhaul, with Tridgell himself stepping back in to assist, and the project moved to its own GitHub organization, RsyncProject. Thirty years in, this tool is still the one command underneath every Linux mirror, every CI deploy, every backup server.</p>
      </>
    ),
  },
  history: [
    { year: '1996·06', zh: { title: <>第一次发布</>, desc: <>6 月 19 日, Tridgell + Mackerras 公开发布 rsync 0.1, 同期发表论文 TR-CS-96-05 "The rsync algorithm"。Tridgell 同年还在写 Samba。</> }, en: { title: <>First release</>, desc: <>June 19: Tridgell + Mackerras ship rsync 0.1 publicly, alongside the paper TR-CS-96-05 "The rsync algorithm." Tridgell was simultaneously building Samba.</> } },
    { year: '1998', zh: { title: <>2.0 — daemon 模式</>, desc: <>2.0 引入裸 TCP 873 port 的 rsync daemon 协议, 不再需要 ssh 就能跑公开镜像。Linux 发行版镜像生态从这个版本起繁殖。</> }, en: { title: <>2.0 — daemon mode</>, desc: <>2.0 adds the raw-TCP rsync daemon on port 873 — public mirrors no longer need ssh. The Linux-distro mirror ecosystem booms from this version on.</> } },
    { year: '2002·05', zh: { title: <>Wayne Davison 接手</>, desc: <>Tridgell 转去全职 Samba + 后来的 ANU 研究, Wayne Davison 接管 rsync 维护。这次交接持续 22 年。</> }, en: { title: <>Wayne Davison takes over</>, desc: <>Tridgell moves to full-time Samba + later ANU research; Wayne Davison takes the rsync maintainership. The handoff lasts 22 years.</> } },
    { year: '2004', zh: { title: <>--link-dest 上线</>, desc: <>2.6.1 加 <code>--link-dest</code>, 让"每天全量备份, 只多占 delta 空间"成为可能 —— rsnapshot / Time Machine 这一代备份工具的底层基石。</> }, en: { title: <>--link-dest lands</>, desc: <>2.6.1 adds <code>--link-dest</code>, making "full backup every day, only delta on disk" possible — the foundation of rsnapshot / Time Machine-style backup tools.</> } },
    { year: '2013·09', zh: { title: <>3.1.0 协议 v31</>, desc: <>3.1 大改协议, 支持更大文件 / 更多 metadata / xattr / ACL。这版本之后, rsync 在容器镜像 layer 同步、跨平台备份里站稳。</> }, en: { title: <>3.1.0 / protocol v31</>, desc: <>3.1 overhauls the wire protocol — larger files, more metadata, xattrs, ACLs. After this, rsync becomes the default for container layer sync and cross-platform backup.</> } },
    { year: '2018·01', zh: { title: <>3.1.3 / 长稳定期</>, desc: <>3.1.3 之后进入一个少 feature 高稳定的时期。每个 Linux 发行版默认装 3.1.x, 没有人想升级因为它"就那么好用"。</> }, en: { title: <>3.1.3 / long stability era</>, desc: <>From 3.1.3 onward, rsync enters a low-feature, high-stability stretch. Every distro ships 3.1.x by default; nobody wants to upgrade because "it just works."</> } },
    { year: '2024·04', zh: { title: <>3.3.0 / 项目独立</>, desc: <>项目从 Samba.org 体系搬到独立 GitHub 组织 <code>RsyncProject</code>, 启动更主动的维护节奏。</> }, en: { title: <>3.3.0 / project goes independent</>, desc: <>The project moves out of the Samba.org umbrella into its own <code>RsyncProject</code> GitHub organization, kicking off a more active release cadence.</> } },
    { year: '2025·01', highlight: true, zh: { title: <>3.4.0 — 6 个 CVE 一次清</>, desc: <>1 月一次性披露 6 个安全漏洞 (其中一个 heap overflow CVE-2024-12084 高危), 3.4.0 集中修。Tridgell 本人协助 release, 这是他自 2002 年以来第一次主导 rsync 发版。</> }, en: { title: <>3.4.0 — 6 CVEs cleared at once</>, desc: <>January's coordinated disclosure of 6 vulnerabilities (CVE-2024-12084 heap overflow being the worst) — fixed in 3.4.0. Tridgell himself assisted with the release, his first since 2002.</> } },
    { year: '2025·06', zh: { title: <>3.4.1 修复回归</>, desc: <>3.4.0 的安全修复带来几个回归, 3.4.1 把它们收尾。这是新维护团队节奏建立的标志。</> }, en: { title: <>3.4.1 fixes regressions</>, desc: <>A few regressions from the 3.4.0 security work were cleaned up in 3.4.1, signalling the new maintenance team's rhythm.</> } },
    { year: '2026·04', highlight: true, zh: { title: <>3.4.2 当前稳定</>, desc: <>4 月 28 日发布。CVE-2026-41035 (xattr use-after-free) 在此修复, 兼容性小改若干。本站镜像 + stats 管道现跑此版。</> }, en: { title: <>3.4.2 / current stable</>, desc: <>Released April 28. Fixes CVE-2026-41035 (xattr use-after-free) plus minor compatibility tweaks. This site's mirror + stats pipeline runs this version.</> } },
  ],
  concepts: [
    { tag: 'A', zh: { title: <>rolling checksum</>, desc: <>Adler-32 变种, 把当前窗口的 hash 用 O(1) 更新到下一字节窗口的 hash。整个 delta 算法靠这个能在源文件每个字节偏移上扫一遍而不爆 CPU。</> }, en: { title: <>rolling checksum</>, desc: <>An Adler-32 variant where the hash of the next byte-offset window is updated from the current one in O(1). The delta algorithm relies on this to scan every byte offset of the source without blowing CPU.</> }, code: <code>{c('// weak hash slides byte-by-byte')}{'\n'}{k('for')} ({v('i')} = {n('0')}; {v('i')} &lt; {v('len')}; {v('i')}++) {'{'}{'\n'}  {v('w')} = {v('roll')}({v('w')}, {v('src')}[{v('i')}], {v('src')}[{v('i')}-{v('B')}]);{'\n'}  {k('if')} ({v('w')} {k('in')} {v('weakSet')}) {v('checkStrong')}();{'\n'}{'}'}</code> },
    { tag: 'B', zh: { title: <>-a / --archive</>, desc: <>等于 <code>-rlptgoD</code>, 一次性把 recursive + symlink + perm + mtime + group + owner + devices 全保留。99% 的命令第一个 flag 就是它。</> }, en: { title: <>-a / --archive</>, desc: <>Shorthand for <code>-rlptgoD</code> — recursive, symlinks, perms, mtimes, group, owner, devices all preserved in one go. 99% of rsync invocations lead with this flag.</> }, code: <code>{v('rsync')} -{v('avz')} {v('./dist/')} {v('user@host:/srv/www/')}</code> },
    { tag: 'C', zh: { title: <>-z + --partial</>, desc: <><code>-z</code> 走传输流压缩 (zlib);<code>--partial</code> 中断后保留半成品下次续传。配合 <code>-P</code> = <code>--partial --progress</code> 是最常用的"看着它跑"组合。</> }, en: { title: <>-z + --partial</>, desc: <><code>-z</code> compresses the wire stream (zlib); <code>--partial</code> keeps a half-finished file so the next run resumes. <code>-P</code> is shorthand for <code>--partial --progress</code> — the "watch it run" combo.</> }, code: <code>{v('rsync')} -{v('avzP')} {v('src/')} {v('user@host:dst/')}</code> },
    { tag: 'D', zh: { title: <>--delete</>, desc: <>"源没有的, 目标也别留"。镜像同步必带, 但带它意味着源出 bug 时目标会跟着掉数据 —— 配 <code>--dry-run</code> 先看清单。</> }, en: { title: <>--delete</>, desc: <>"What the source doesn't have, the destination shouldn't keep either." Mandatory for mirror sync — but it means a buggy source will wipe data. Pair with <code>--dry-run</code> first.</> }, code: <code>{v('rsync')} -{v('av')} --{v('delete')} --{v('dry-run')} {v('src/')} {v('dst/')}</code> },
    { tag: 'E', zh: { title: <>--link-dest</>, desc: <>"和上次备份相比, 没变的文件做 hardlink, 变了的真复制"。一夜之间让"每天全量备份"变得可负担。Time Machine 的灵感大半在这里。</> }, en: { title: <>--link-dest</>, desc: <>"Hardlink files that match the previous backup, copy only the changed ones." Overnight, "full backup every day" became affordable. Most of Time Machine's inspiration sits here.</> }, code: <code>{v('rsync')} -{v('a')} --{v('link-dest')}=../{v('prev')}/ {v('src/')} {v('today/')}</code> },
    { tag: 'F', zh: { title: <>--exclude / --include</>, desc: <>filter 规则可堆叠, 顺序敏感。<code>--exclude='*.log' --exclude='node_modules'</code> 是 CI 部署最常见模板。</> }, en: { title: <>--exclude / --include</>, desc: <>Filter rules stack and are order-sensitive. <code>--exclude='*.log' --exclude='node_modules'</code> is the standard CI deploy template.</> }, code: <code>{v('rsync')} -{v('av')} --{v('exclude')}={s("'.git'")} --{v('exclude')}={s("'node_modules'")} {v('./')} {v('user@host:/srv/app/')}</code> },
    { tag: 'G', zh: { title: <>SSH 传输</>, desc: <>默认 transport, 不需要 daemon、不需要开端口、不需要凭据管理 (用现成的 ssh key)。<code>-e 'ssh -i ~/.ssh/deploy_ed25519'</code> 自定义 ssh 命令。</> }, en: { title: <>SSH transport</>, desc: <>The default transport. No daemon, no extra ports, no credential management beyond existing ssh keys. <code>-e 'ssh -i ~/.ssh/deploy_ed25519'</code> customizes the ssh invocation.</> }, code: <code>{v('rsync')} -{v('avz')} -{v('e')} {s("'ssh -i ~/.ssh/deploy'")} {v('./')} {v('deploy@host:/srv/')}</code> },
    { tag: 'H', zh: { title: <>daemon :873</>, desc: <>裸 TCP 模式, 走 <code>rsync://host/module/path</code>。公开镜像 (Debian / Arch / kernel.org) 都靠这个, 走匿名只读, 无 ssh 开销。</> }, en: { title: <>daemon :873</>, desc: <>Raw TCP mode via <code>rsync://host/module/path</code>. Public mirrors (Debian, Arch, kernel.org) all use this — anonymous read-only, no ssh overhead.</> }, code: <code>{v('rsync')} -{v('av')} {v('rsync://mirror.host/debian/')} {v('/var/mirror/debian/')}</code> },
  ],
  whyCards: [
    { icon: '⇆', zh: { title: <>只传差异</>, desc: <>核心卖点。10 GB 文件改了 100 字节, 上传 100 字节左右 (加协议开销)。在窄带 / 跨大洲链路上, 这一项就是其它"全量上传"方案做不到的。</> }, en: { title: <>Wire = delta, not file</>, desc: <>The core selling point. 10 GB file, 100 bytes changed → about 100 bytes on the wire (plus protocol overhead). On narrow / cross-continent links, no full-upload tool can match this.</> }, code: <>{c('// 10 GB file, 100 B changed')}{'\n'}{c('// transferred ≈ 100 B + meta')}</> },
    { icon: '⚙', zh: { title: <>POSIX 即装即用</>, desc: <>每个 Linux 发行版默认装, macOS 自带, Windows 走 WSL 或 Cygwin 跑得到。不需要 server, 不需要 cluster, 不需要 daemon。</> }, en: { title: <>Ships everywhere POSIX</>, desc: <>Default-installed on every Linux distro, bundled with macOS, available on Windows via WSL or Cygwin. No server, no cluster, no daemon required.</> }, code: <>{v('apt')} {v('install')} {v('rsync')}  {c('# already there')}</> },
    { icon: '↻', zh: { title: <>断点续传</>, desc: <><code>--partial</code> 让网络断了之后 rerun 同一条命令直接续, 不重新算 hash 也不重传已传部分。CI 在不稳定链路上的救命选项。</> }, en: { title: <>Resumes after interruption</>, desc: <><code>--partial</code> means a dropped connection just needs the same command re-run — no hash recompute, no retransmit of already-shipped bytes. The lifesaver flag on flaky CI links.</> }, code: <>{v('rsync')} -{v('avzP')} {v('big/')} {v('host:dst/')}</> },
    { icon: '⚓', zh: { title: <>语义可预测</>, desc: <>cli flag 30 年没大改, 行为差异极少 trap。<code>src</code> 末尾有没有 <code>/</code> 是唯一一个新人会踩的坑 (有 = 同步目录内容, 无 = 同步目录本身)。</> }, en: { title: <>Predictable semantics</>, desc: <>The CLI flags haven't shifted in 30 years; the only trap newcomers hit is the trailing-slash behavior of <code>src</code> (with slash = sync contents, without = sync the directory itself).</> }, code: <>{v('rsync')} {v('a/')} {v('b/')}  {c('// contents of a/')}{'\n'}{v('rsync')} {v('a')} {v('b/')}   {c('// a/ becomes b/a/')}</> },
    { icon: '⟲', zh: { title: <>--dry-run 救命</>, desc: <>带 <code>--delete</code> 的命令上生产前先 <code>-n --dry-run</code> 跑一遍看清单, 三十年的标准做法。这个工具<strong>预设</strong>会被人误用, 所以预防机制做得很扎实。</> }, en: { title: <>--dry-run as safety net</>, desc: <>For any command with <code>--delete</code>, the thirty-year standard is to first run <code>-n --dry-run</code> and read the list. The tool <strong>assumes</strong> people will misuse it and built guardrails accordingly.</> }, code: <>{v('rsync')} -{v('avn')} --{v('delete')} {v('src/')} {v('dst/')}</> },
    { icon: '⛓', zh: { title: <>hardlink 备份</>, desc: <><code>--link-dest</code> 让 N 份"全量备份"占的磁盘 ≈ 1 份完整 + N 份 delta。rsnapshot / BackupPC / Time Machine 这一代产品就是它的封装。</> }, en: { title: <>Hardlink-based backups</>, desc: <><code>--link-dest</code> lets N "full backups" cost ≈ 1 complete copy + N deltas of disk. rsnapshot / BackupPC / Time Machine are all dressed-up wrappers.</> }, code: <>{v('rsync')} -{v('a')} --{v('link-dest')}=../{v('y')} {v('src/')} {v('today/')}</> },
    { icon: '⚡', zh: { title: <>没有 vendor lock-in</>, desc: <>不绑任何 SaaS, 不需要 API token, 不会哪天涨价, 不会哪天 EOL。源码自己编, 走自己的 ssh key, 把数据放在自己控制的盘上。</> }, en: { title: <>No vendor lock-in</>, desc: <>No SaaS dependency, no API token, no price hike, no EOL announcement. Build from source, use your own ssh keys, put data on your own disk.</> }, code: <>{c('// "Your data, your wire, your box."')}{'\n'}{c('// no auth provider in the loop')}</> },
    { icon: '🛡', zh: { title: <>安全模型可审计</>, desc: <>2025-01 那次 6 个 CVE 一起爆是因为这工具被太多人盯, 不是因为它脆。3.4.0 之后 fuzz / CI / 维护团队都加固到位, 攻击面比一堆"新世代"工具反而更稳。</> }, en: { title: <>Auditable security model</>, desc: <>The Jan 2025 cluster of 6 CVEs got reported precisely because so many eyes are on this tool — not because it's fragile. Post-3.4.0, fuzzing / CI / the new maintainer team have all hardened up; the attack surface is firmer than most "newer" tools'.</> }, code: <>{c('// CVE-2024-12084 fixed in 3.4.0')}{'\n'}{c('// CVE-2026-41035 fixed in 3.4.2')}</> },
    { icon: '⛯', zh: { title: <>每个 CI 都用</>, desc: <>从 1996 年 shell 脚本到 2026 年 GitHub Actions, 把 "build artifact 推到生产" 这一步用 rsync 写的, 现在还在 production 跑。代码兼容 30 年没断。</> }, en: { title: <>Every CI uses it</>, desc: <>From 1996 shell scripts to 2026 GitHub Actions, the "push build artifacts to production" step written with rsync still runs in production. 30 years of compatibility, unbroken.</> }, code: <>{c('# GH Actions step')}{'\n'}{v('rsync')} -{v('avz')} --{v('delete')} {v('./dist/')} {v('host:/srv/www/')}</> },
  ],
  adopters: [
    { name: 'Linux distro mirrors (Debian / Arch / kernel.org)', highlight: true, zhNote: '全球镜像同步默认走 rsync daemon :873', enNote: 'Global mirror sync defaults to the rsync daemon on :873' },
    { name: 'rsnapshot', href: 'https://rsnapshot.org', zhNote: 'rsync + cron + --link-dest 的封装备份', enNote: 'rsync + cron + --link-dest packaged as backup' },
    { name: 'BackupPC', href: 'https://backuppc.github.io/backuppc/', zhNote: '企业级备份系统, 后端就是 rsync', enNote: 'Enterprise backup system, rsync underneath' },
    { name: 'Time Machine (macOS)', zhNote: 'hardlink 增量备份的设计灵感来自 --link-dest', enNote: 'Hardlink-incremental design inspired by --link-dest' },
    { name: 'rsync.net', href: 'https://www.rsync.net', zhNote: '专门做 rsync over ssh 的离线备份托管 20 年了', enNote: 'rsync-over-ssh offsite backup hosting, running 20 years' },
    { name: 'GitHub Actions / GitLab CI / 自托管 runner', zhNote: '"部署到机器"那一步的事实标准', enNote: 'The de-facto standard for the "deploy to a box" step' },
    { name: 'Samba', href: 'https://www.samba.org', zhNote: '同一个 Tridgell 写的姊妹项目, 历史绑死', enNote: 'Same Tridgell, sister project, historically linked' },
    { name: 'OpenWrt / DD-WRT 镜像', zhNote: '路由器固件镜像分发的底层', enNote: 'Underneath router-firmware mirror distribution' },
    { name: 'restic / borg / kopia (作为对照)', zhNote: '更现代的备份工具, 但仍把 rsync 当 baseline', enNote: 'Newer backup tools, still benchmarked against rsync' },
    { name: 'rclone', href: 'https://rclone.org', zhNote: '"云端版 rsync"自我定位, 协议完全是致敬', enNote: '"rsync for cloud" — explicit homage in name + flags' },
    { name: 'cuberoot.me', highlight: true, zhNote: 'deploy_mirror.yml 把 SPA 同步到镜像; stats 管道 scp/rsync 把 *.copy.tsv 推到服务器', enNote: 'deploy_mirror.yml syncs the SPA to the mirror; stats pipeline scp/rsyncs *.copy.tsv to the server' },
  ],
  outlook: [
    { tag: <>HOT · 2026-04</>, hot: true, big: true, zh: { title: <>3.4.2 + CVE-2026-41035 修复</>, body: <><p>4 月 28 日发布的 3.4.2 把 xattr 处理里的 use-after-free 漏洞修了, 同时收尾 3.4.x 系列的若干兼容性小改。每个 Linux 发行版的 stable 仓在 5 月初已经跟上, Debian / Ubuntu / Alpine / Arch 默认都是这版。</p><p>更深一层:rsync 在 2024-2026 这两年从"维护稳定但缓慢"切到"维护团队主动 fuzz + 季度 release", 这是 22 年来第一次。</p></> }, en: { title: <>3.4.2 + CVE-2026-41035 fix</>, body: <><p>The April 28 release fixes a use-after-free in xattr handling and ties off compatibility tweaks across the 3.4.x line. Every Linux distro stable repo has it by early May — Debian / Ubuntu / Alpine / Arch all default to this.</p><p>The deeper shift: rsync moved from "stable but slow" maintenance to "team-driven fuzz + quarterly release" during 2024-2026, the first such shift in 22 years.</p></> } },
    { tag: 'ALG', zh: { title: <>滚动校验 30 年仍是 baseline</>, body: <><p>BLAKE3 + content-defined chunking 时代来了, restic / borg / kopia 各自有更高大上的方案。但要在"两端都是 POSIX, 一行命令, 不需要 server"这个约束下做同步, 还是没人比 rsync 的算法更合适。</p><p>2026 年的研究文献继续把 rsync 当 baseline 而不是淘汰对象。</p></> }, en: { title: <>Rolling checksum still the baseline</>, body: <><p>BLAKE3 + content-defined chunking has arrived; restic / borg / kopia each have flashier approaches. But under the constraint "both ends POSIX, one command, no server," nothing beats rsync's algorithm.</p><p>2026 research papers still cite rsync as the baseline, not as something to displace.</p></> } },
    { tag: 'ORG', zh: { title: <>RsyncProject 独立运作</>, body: <><p>2024 年项目从 Samba.org 体系搬出, 独立成 GitHub 组织 <code>RsyncProject</code>。Wayne Davison 退场之后由社区接手, Tridgell 顾问。release 节奏明显加快, issue 响应也跟上。</p></> }, en: { title: <>RsyncProject runs independent</>, body: <><p>In 2024 the project moved out of the Samba.org umbrella into its own GitHub org, <code>RsyncProject</code>. Post-Wayne-Davison, the community runs it; Tridgell advises. Release cadence is visibly faster and issue response time tracks it.</p></> } },
    { tag: <>SEC</>, zh: { title: <>Jan 2025 六个 CVE 之后</>, body: <><p>2025 年 1 月那次集中披露 (含 CVE-2024-12084 heap overflow) 把 rsync 推上各大 security 公告的头版。但事后看, 这是<strong>这工具被越来越多人审计</strong>的结果, 不是它越来越烂。3.4.0 之后所有现役系统升级率 90%+。</p></> }, en: { title: <>After the Jan 2025 6-CVE wave</>, body: <><p>The January 2025 cluster (including the CVE-2024-12084 heap overflow) put rsync at the top of every security bulletin. In hindsight, that was a function of <strong>more people auditing it</strong>, not the tool decaying. Post-3.4.0, 90%+ of fielded systems are on the patched line.</p></> } },
    { tag: <>USAGE</>, zh: { title: <>每个 Linux 发行版默认装</>, body: <><p>2026 年的实测:Debian / Ubuntu / Arch / Alpine / Fedora / openSUSE / Gentoo 全部默认或一键安装。macOS 自带 (Apple 不太愿意升级版本, 但你自己 brew 一份就行)。Windows 走 WSL2 / Cygwin / MSYS2 都跑得到。</p></> }, en: { title: <>Default-installed everywhere POSIX</>, body: <><p>As of 2026: Debian / Ubuntu / Arch / Alpine / Fedora / openSUSE / Gentoo all default or one-command install. macOS bundles it (Apple lags on version, but brew gets you current). Windows runs it via WSL2 / Cygwin / MSYS2.</p></> } },
  ],
  cuberoot: {
    zh: (
      <>
        <p>本站两条核心数据流上都用 rsync。第一条是 <strong>GH Pages 镜像同步</strong>:<code>deploy_mirror.yml</code> 这条 GitHub Actions workflow 在主 deploy 完成后跑, 把 <code>dist/</code> 整个构建产物 rsync 到 GH Pages CNAME 镜像 (<code>cuberoot.me</code> 这个域同时挂在两套基建上, 任何一边挂了另一边接得住)。命令模板就一行 <code>rsync -avz --delete ./dist/ ...</code>, <code>--delete</code> 保证旧 hashed asset 不会越攒越多。</p>
        <p>第二条是 <strong>stats-build 管道</strong>:CI runner 在 GH Actions 上跑 <code>pnpm --filter @cuberoot/stats-build compute</code> 算出 80+ 个 stat JSON + 一批 <code>*.copy.tsv</code> (给 PG 灌的); 然后 <code>stats.yml</code> 这一步用 scp/rsync 把 tsv 推到服务器, 服务器 cron 调 <code>load.sql</code> 把数据灌进 PG。这三件事 (builder 输出 / scp 列表 / load.sql) 必须三处一致 —— 少一处就静默空表, 见 memory <code>feedback_ci_pipeline_dry_run</code>。</p>
        <p>偶尔手动场景:把服务器上的 <code>/root/archive/</code> 备份 (pg_dump 出来的 .sql.gz, 每天 03:00 UTC 一次) 拉回开发机。<code>rsync -avzP --partial</code>, ssh key 已经在 <code>ssh root@cuberoot</code> 免密通道里。20+ GB 的归档过卫星链路掉两次连也能续上。</p>
        <p>没用 rclone / restic / borg 是有意为之 —— 这三个工具都需要在两端跑配套 daemon / API token / repo init。rsync over ssh 的"零安装、零状态"对单人维护的小站太省心:每台机器只要有 ssh 和 <code>rsync</code> 这两个 binary, 任何方向都能同步。</p>
      </>
    ),
    en: (
      <>
        <p>Two core data flows on this site touch rsync. First, the <strong>GH Pages mirror sync</strong>: <code>deploy_mirror.yml</code> runs after the main deploy, rsyncing the full <code>dist/</code> build to the GH Pages CNAME mirror (<code>cuberoot.me</code> is anchored to two independent stacks, so either side can carry the other). The command is essentially one line — <code>rsync -avz --delete ./dist/ ...</code> — and <code>--delete</code> stops stale hashed assets from accumulating.</p>
        <p>Second, the <strong>stats-build pipeline</strong>: a CI runner on GH Actions runs <code>pnpm --filter @cuberoot/stats-build compute</code>, producing 80+ stat JSON files plus a batch of <code>*.copy.tsv</code> files for PG ingestion. Then a <code>stats.yml</code> step scp/rsyncs the tsv files to the server, where cron triggers <code>load.sql</code> to ingest them into PG. The three pieces (builder outputs / scp list / load.sql) must stay in lockstep — drift in any one quietly empties a table. See memory <code>feedback_ci_pipeline_dry_run</code>.</p>
        <p>Manual cases: pulling the server's <code>/root/archive/</code> pg_dump backups (rolled out daily at 03:00 UTC as .sql.gz) back to the dev machine. <code>rsync -avzP --partial</code>, with ssh keys already living in the <code>ssh root@cuberoot</code> passwordless channel. A 20+ GB archive across a flaky satellite link can drop twice and still resume.</p>
        <p>rclone / restic / borg are intentionally not used — all three require a daemon / API token / repo init on both ends. rsync over ssh's "zero install, zero state" is exactly right for a one-person site: every machine only needs the ssh and <code>rsync</code> binaries, and any direction works.</p>
      </>
    ),
  },
  links: [
    { label: 'rsync.samba.org', href: 'https://rsync.samba.org' },
    { label: 'GitHub · RsyncProject/rsync', href: 'https://github.com/RsyncProject/rsync' },
    { label: 'The rsync algorithm (TR-CS-96-05)', href: 'https://www.andrew.cmu.edu/course/15-749/READINGS/required/cas/tridgell96.pdf' },
    { label: 'NEWS — full changelog', href: 'https://download.samba.org/pub/rsync/NEWS' },
  ],
};
