import Link from '@/components/AppLink';
import { STACK_TOOLS_META } from '../_lib/stack_meta';
import type { StackTool } from '../_lib/stack_tool_types';

const meta = STACK_TOOLS_META.find((tool) => tool.slug === 'ncdu')!;

// Release facts checked against the official histories on 2026-09-16.
const NCDU: StackTool = {
  ...meta,
  floats: ['ncdu', 'disk usage', 'SSH', '-x', '-rr', '-o', '-O', '-f', 'snapshot', 'Zig', 'JSON', 'MIT'],
  zh: {
    ...meta.zh,
    heroSub: <>磁盘快满时，从最大的目录一路展开到具体文件。扫描结果可以保存，下次直接打开快照，不必再次遍历整块磁盘。</>,
    whatDesc: <>ncdu 全称 NCurses Disk Usage，是有交互界面的终端磁盘分析工具。</>,
    historyDesc: <>从 C 实现到 Zig 分支，再到并行扫描和压缩快照。日期来自项目发布记录。</>,
    conceptsTitle: '扫描、浏览与快照',
    conceptsDesc: <>先分清当前文件系统与上一次保存的结果，再选择扫描范围。</>,
    whyDesc: <>适合回答具体的空间问题。下面是排查时的使用思路，不是自动清理规则。</>,
    adoptersTitle: '软件包与移植',
    adoptersDesc: <>官网列出的分发渠道。这表示可以通过这些生态获取工具，不代表系统默认安装。</>,
    outlookTitle: '版本选择与使用边界',
    outlookDesc: <>基于已发布能力做选择，不预告尚未公布的功能。</>,
  },
  en: {
    ...meta.en,
    heroSub: <>When storage fills up, follow the largest directories down to individual files. Save the scan and reopen that snapshot later without walking the disk again.</>,
    whatDesc: <>ncdu stands for NCurses Disk Usage: an interactive disk analyzer for the terminal.</>,
    historyDesc: <>From C to the Zig branch, then parallel scans and compressed snapshots. Dates follow the official release histories.</>,
    conceptsTitle: 'Scan, browse, save',
    conceptsDesc: <>Distinguish the live filesystem from a saved result before choosing the scan scope.</>,
    whyDesc: <>Use it to investigate specific storage questions. These are investigation workflows, not automatic cleanup rules.</>,
    adoptersTitle: 'Packages and ports',
    adoptersDesc: <>Distribution channels listed by the project. Availability does not mean the tool is installed by default.</>,
    outlookTitle: 'Versions and boundaries',
    outlookDesc: <>Choose from released capabilities, without guessing future features.</>,
  },
  heroStats: [
    { num: '2007', zh: '首次发布', en: 'First release' },
    { num: '2.9.2', zh: '官网稳定版', en: 'Official stable release' },
    { num: 'MIT', zh: '开源许可', en: 'Open-source license' },
    { num: '-f', zh: '打开已有快照', en: 'Open a saved snapshot' },
  ],
  intro: {
    zh: <>
      <p>远程服务器通常只有 SSH 终端。ncdu 把目录占用整理成可展开的列表，让你沿着最大的几项逐层定位。它可以直接在终端运行，不需要为服务器安装桌面环境。</p>
      <p>它的结果是一次扫描的记录。直接运行 <code>ncdu /path</code> 会开始新扫描；需要反复查看时，先导出，再用 <code>ncdu -f</code> 打开保存的文件。更新记录需要重新扫描。</p>
      <p>安装 ncdu 不会自动给网站增加磁盘页面。项目另有 <a href="https://ncdu.blicky.net/" target="_blank" rel="noopener noreferrer">Ncdu Export Browser</a>，用于查看导出的结果；本站管理面板则有自己的扫描与存储逻辑。</p>
    </>,
    en: <>
      <p>A remote server often has only an SSH terminal. ncdu organizes directory usage into an expandable list so you can follow the largest entries. It runs in that terminal without installing a desktop environment.</p>
      <p>The result describes one scan. Running <code>ncdu /path</code> starts another scan; for repeated viewing, export once and open the saved file with <code>ncdu -f</code>. Updating the record requires a new scan.</p>
      <p>Installing ncdu does not add a disk page to your website. The project also offers an <a href="https://ncdu.blicky.net/" target="_blank" rel="noopener noreferrer">Ncdu Export Browser</a> for saved exports; this site’s admin panel has its own scanning and storage logic.</p>
    </>,
  },
  history: [
    { year: '2007-02', zh: { title: '0.1 首次发布', desc: '2 月 21 日发布初版，4 月 6 日进入 1.0 稳定版。' }, en: { title: 'First release', desc: 'Version 0.1 arrived on February 21; stable 1.0 followed on April 6.' } },
    { year: '2012-09', zh: { title: '1.9 保存与加载', desc: '加入 -o 导出和 -f 导入，把扫描与查看分开。' }, en: { title: '1.9 saves and loads', desc: 'Export with -o and import with -f separated scanning from viewing.' } },
    { year: '2021-12', zh: { title: '2.0 稳定版', desc: 'Zig 实现进入稳定发布线，C 分支继续维护。' }, en: { title: 'Stable 2.0', desc: 'The Zig implementation reached stable release; the C branch remained maintained.' } },
    { year: '2024-07', zh: { title: '2.5 并行扫描', desc: '加入 -t 线程数选项，默认仍为单线程。' }, en: { title: '2.5 parallel scans', desc: 'The -t option added configurable scan threads; the default remained one.' } },
    { year: '2024-09', zh: { title: '2.6 二进制快照', desc: '加入 -O，支持压缩导出和低内存浏览。' }, en: { title: '2.6 binary snapshots', desc: 'The -O format added compressed exports and low-memory browsing.' } },
    { year: '2025-10', highlight: true, zh: { title: '2.9.2 稳定版', desc: '10 月 24 日修复特定 Zig 构建下读取配置卡住的问题。' }, en: { title: 'Stable 2.9.2', desc: 'The October 24 release fixed a configuration-loading hang with a particular Zig build.' } },
  ],
  concepts: [
    { tag: 'SCOPE', zh: { title: '只扫描目标文件系统', desc: <>下面的例子只扫描 <code>/var</code> 所在文件系统；先缩小范围，再考虑整盘。</> }, en: { title: 'Choose the filesystem', desc: <>This example scans only the filesystem containing <code>/var</code>. Narrow the scope before scanning a whole disk.</> }, code: <code>ncdu -x -rr /var</code> },
    { tag: 'READ', zh: { title: '只读排查', desc: <><code>-rr</code> 同时禁用内置删除和打开 shell。方向键浏览，Enter 进入目录，q 退出。</> }, en: { title: 'Read-only investigation', desc: <><code>-rr</code> disables deletion and shell spawning. Browse with arrows, enter directories with Enter, and quit with q.</> }, code: <code>ncdu -rr /path</code> },
    { tag: 'SIZE', zh: { title: '逻辑大小与实际占用', desc: <>导出格式分别记录 <code>asize</code> 和 <code>dsize</code>。稀疏文件或硬链接会让“文件多大”和“能释放多少”不同。</> }, en: { title: 'Size versus allocated space', desc: <>Exports distinguish <code>asize</code> from <code>dsize</code>. Sparse files and hard links can make file size differ from reclaimable space.</> } },
    { tag: 'JSON', zh: { title: '便于工具读取的快照', desc: <>小写 <code>-o</code> 导出 JSON。文件含目录名与占用元数据，不是文件内容备份。<a href="https://dev.yorhel.nl/ncdu/jsonfmt" target="_blank" rel="noopener noreferrer">格式说明</a>。</> }, en: { title: 'A snapshot tools can read', desc: <>Lowercase <code>-o</code> exports JSON: names and usage metadata, not a backup of file contents. <a href="https://dev.yorhel.nl/ncdu/jsonfmt" target="_blank" rel="noopener noreferrer">Format specification</a>.</> }, code: <code>{'ncdu -x -o usage.json /var\nncdu -f usage.json'}</code> },
    { tag: 'BINARY', zh: { title: '大目录用二进制格式', desc: <>2.6+ 的大写 <code>-O</code> 保存压缩块和目录汇总，浏览时不必把整棵树加载进内存。</> }, en: { title: 'Binary for large trees', desc: <>Uppercase <code>-O</code>, available since 2.6, stores compressed blocks and directory totals, allowing browsing without loading the whole tree.</> }, code: <code>{'ncdu -x -O usage.ncdu /var\nncdu -f usage.ncdu'}</code> },
    { tag: 'ERROR', zh: { title: '不完整结果要单独判断', desc: '读取失败和排除项都有记录。部分目录没权限读取时，不能把显示的总量当成完整磁盘清单。' }, en: { title: 'Recognize incomplete results', desc: 'Read errors and exclusions are recorded. If permissions hide directories, the displayed total is not a complete disk inventory.' } },
  ],
  whyCards: [
    { icon: '▤', zh: { title: '先找到最大的几项', desc: '从占用最多的目录向下看，缩小排查对象；不要一开始逐个检查所有文件。' }, en: { title: 'Start with the largest entries', desc: 'Follow the largest directories to narrow the investigation instead of inspecting every file individually.' } },
    { icon: '↳', zh: { title: '把大小与用途对应起来', desc: '表文件、日志、缓存和部署版本需要不同处理。占用大只能提示值得检查，不能证明可以删除。' }, en: { title: 'Connect size to purpose', desc: 'Tables, logs, caches and releases need different treatment. A large size invites inspection; it does not prove an item is disposable.' } },
    { icon: '⇄', zh: { title: '复查直接打开快照', desc: '复盘同一次排查时使用保存结果。先看记录时间，再决定是否需要新的扫描。' }, en: { title: 'Revisit the same evidence', desc: 'Use saved results to revisit an investigation. Check the recording time before deciding whether another scan is needed.' } },
    { icon: '⊂', zh: { title: '缩小范围通常更有用', desc: '已经知道问题集中在哪个目录时，就扫描该目录。扫描速度需要实测，不承诺固定秒数或倍数。' }, en: { title: 'Reduce the scope', desc: 'Scan the relevant directory once you know where the problem lies. Measure speed rather than assuming a fixed duration or speedup.' } },
    { icon: '≠', zh: { title: '容量与目录分开核对', desc: '先用 df 看文件系统余量，再看目录构成。两者统计范围不同，目录合计不应直接当作可用空间。' }, en: { title: 'Check capacity separately', desc: 'Use df for filesystem availability, then inspect directories. Directory totals and available capacity answer different questions.' }, code: <code>df -h /</code> },
  ],
  adopters: [
    { name: 'Debian', zhNote: '发行版软件包', enNote: 'Distribution package' },
    { name: 'Ubuntu', zhNote: '发行版软件包', enNote: 'Distribution package' },
    { name: 'Alpine Linux', zhNote: '软件包仓库', enNote: 'Package repository' },
    { name: 'Arch Linux', zhNote: '软件包仓库', enNote: 'Package repository' },
    { name: 'Fedora', zhNote: '软件包仓库', enNote: 'Package repository' },
    { name: 'FreeBSD', zhNote: 'Ports 生态', enNote: 'Ports ecosystem' },
    { name: 'Homebrew', href: 'https://formulae.brew.sh/formula/ncdu', zhNote: 'macOS 等环境的安装渠道', enNote: 'Installation channel for macOS and other environments' },
    { name: 'MacPorts', zhNote: 'macOS 移植包', enNote: 'macOS port' },
  ],
  outlook: [
    { tag: 'VERSION', hot: true, big: true, zh: { title: '先确认安装的是哪条分支', body: <p>官网列出的稳定版是 Zig 2.9.2，C 长期维护版是 1.22。先运行 <code>ncdu --version</code>；旧软件源里的 1.x 不能直接照搬 2.x 的并行和二进制导出选项。</p> }, en: { title: 'Check the installed branch', body: <p>The project lists Zig 2.9.2 as stable and C 1.22 as LTS. Check <code>ncdu --version</code> first: a repository’s 1.x package cannot use the 2.x parallel and binary-export options.</p> } },
    { tag: 'IO', zh: { title: '并行需要按服务器负载选择', body: <p>2.5+ 可以显式指定线程数。增加线程不等于按比例提速；在线服务器先缩小扫描范围，再根据实际负载决定是否并行。</p> }, en: { title: 'Choose concurrency for the server', body: <p>Version 2.5+ accepts an explicit thread count. More threads do not guarantee proportional speedups; narrow the scope first, then choose concurrency based on actual server load.</p> } },
    { tag: 'WEB', zh: { title: '网页查看需要独立入口', body: <p>Export Browser 面向导出文件。要让自己的管理网站展示服务器磁盘，还需要采集、保存、访问控制和前端展示；安装一个终端程序不会自动完成这些工作。</p> }, en: { title: 'Browser viewing needs its own entry', body: <p>Export Browser works with exported files. A disk panel on your own website still needs collection, storage, access control and presentation; installing a terminal program does not provide that integration.</p> } },
  ],
  cuberoot: {
    zh: <>
      <p>本站的 <Link href="/admin/disk" prefetch={false}>管理员磁盘页面</Link> 使用 Hono API 内的目录扫描器，前端显示结果与进度。它没有把 ncdu 嵌进网页，也不读取 ncdu 的导出文件。</p>
      <p>ncdu 可以作为 SSH 排查时的辅助工具：先只读定位目录，再核对文件用途、当前服务引用和保留要求。本文示例不会运行扫描，也不会安装软件或执行清理。</p>
    </>,
    en: <>
      <p>This site’s <Link href="/admin/disk" prefetch={false}>admin disk page</Link> uses a directory scanner in the Hono API, with results and progress displayed by the frontend. It does not embed ncdu or read ncdu exports.</p>
      <p>ncdu can assist an SSH investigation: locate directories in read-only mode, then check file purpose, active service references and retention requirements. These examples do not run scans, install software or perform cleanup.</p>
    </>,
  },
  links: [
    { label: 'ncdu', href: 'https://dev.yorhel.nl/ncdu' },
    { label: 'Manual', href: 'https://dev.yorhel.nl/ncdu/man' },
    { label: '1.x history', href: 'https://dev.yorhel.nl/ncdu/changes' },
    { label: '2.x history', href: 'https://dev.yorhel.nl/ncdu/changes2' },
    { label: 'Binary format', href: 'https://dev.yorhel.nl/ncdu/binfmt' },
    { label: 'Export Browser', href: 'https://ncdu.blicky.net/' },
  ],
};

export default NCDU;
