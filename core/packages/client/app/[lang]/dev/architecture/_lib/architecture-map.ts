export type ArchitectureLaneId = 'entry' | 'product' | 'service' | 'foundation';

type LocalizedText = { zh: string; en: string };

export interface ArchitectureTerm extends LocalizedText {
  name: string;
  fullName: string;
}

export interface ArchitectureFact extends LocalizedText {
  label: string;
}

export interface ArchitectureNode extends LocalizedText {
  id: string;
  lane: ArchitectureLaneId;
  x: number;
  y: number;
  label: LocalizedText;
  eyebrow: string;
  sourcePaths: string[];
  facts?: ArchitectureFact[];
  terms: ArchitectureTerm[];
}

export interface ArchitectureEdge extends LocalizedText {
  from: string;
  to: string;
  kind: 'request' | 'capability' | 'artifact';
}

export const ARCHITECTURE_LANES: Array<{ id: ArchitectureLaneId; label: LocalizedText }> = [
  { id: 'entry', label: { zh: '访问入口', en: 'Entry' } },
  { id: 'product', label: { zh: '产品界面', en: 'Products' } },
  { id: 'service', label: { zh: '服务与任务', en: 'Services & jobs' } },
  { id: 'foundation', label: { zh: '数据与共享能力', en: 'Data & foundations' } },
];

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: 'people', lane: 'entry', x: 10, y: 16, eyebrow: 'HTTP', sourcePaths: [],
    label: { zh: '用户与设备', en: 'People & devices' },
    zh: '浏览器、手机、桌面端和小程序从不同入口使用同一套账号与业务能力。',
    en: 'Browsers, phones, desktops, and Mini Programs enter through different surfaces while sharing account and product capabilities.',
    terms: [
      { name: 'DNS', fullName: 'Domain Name System', zh: '把域名解析到可访问入口的系统。', en: 'The system that resolves a domain name to a reachable entry point.' },
      { name: 'HTTP', fullName: 'Hypertext Transfer Protocol', zh: '浏览器和服务交换请求与响应的协议。', en: 'The request-and-response protocol used by browsers and services.' },
    ],
  },
  {
    id: 'delivery', lane: 'entry', x: 10, y: 48, eyebrow: 'ROUTING',
    sourcePaths: ['ops/nginx', '.github/workflows'],
    label: { zh: '生产交付入口', en: 'Production delivery' },
    zh: '同一份 Web 代码通过两条线路交付；API、静态资源和博客保持独立入口。',
    en: 'The same web code ships through two delivery paths; the API, static assets, and blog keep separate entry points.',
    facts: [
      { label: 'cuberoot.me', zh: '唯一规范 Web 域名；DNS 把请求送往边缘托管或自有托管的同一份 Next 应用。', en: 'The canonical web domain; DNS routes requests to the same Next app on edge-hosted or self-hosted infrastructure.' },
      { label: 'api.cuberoot.me', zh: 'Hono API 与 PostgreSQL 的稳定业务入口。', en: 'The stable business entry for the Hono API and PostgreSQL.' },
      { label: 'next.cuberoot.me', zh: '自有 Next 的预发布与直连入口。', en: 'The staging and direct entry for self-hosted Next.' },
      { label: 'static.cuberoot.me', zh: '分发静态工具、统计产物及 Web 的静态回源资源。', en: 'Serves static tools, statistics artifacts, and static fallback assets for the web app.' },
      { label: 'blog.cuberoot.me', zh: '独立博客应用，不与主站共用运行时。', en: 'An independent blog application with its own runtime.' },
    ],
    terms: [
      { name: 'Split DNS', fullName: 'Split-Horizon Domain Name System', zh: '同一个规范域名可按线路进入不同的 Web 交付端。', en: 'Lets one canonical domain reach different web delivery targets by route.' },
      { name: 'Reverse proxy', fullName: 'Reverse Proxy', zh: '接收外部请求，再转给内部运行的 Web 或 API 服务。', en: 'Accepts external requests and forwards them to an internal web or API service.' },
      { name: 'TLS', fullName: 'Transport Layer Security', zh: '为浏览器与入口之间的连接加密并验证域名身份。', en: 'Encrypts the browser connection and verifies the domain identity.' },
    ],
  },
  {
    id: 'development', lane: 'entry', x: 10, y: 81, eyebrow: 'DEV',
    sourcePaths: ['core/packages/client/next.config.ts', 'ops/nginx/www.cuberoot.me.conf'],
    label: { zh: '本地与外网开发', en: 'Local & remote development' },
    zh: '本机直接连接同一份 Next 开发服务；手机和外网设备经 TLS 反向代理与 frp 隧道接入。',
    en: 'The local machine connects directly to one Next development server; phones and off-network devices enter through a TLS reverse proxy and an frp tunnel.',
    facts: [
      { label: '127.0.0.1:3000', zh: '本机直接连接 Next 开发服务。', en: 'The local machine connects directly to the Next development server.' },
      { label: 'dev.cuberoot.me', zh: 'TLS 反向代理 → frp 隧道 → 本机 :3000；HMR 使用 WSS，响应不缓存，也不进入生产拓扑。', en: 'TLS reverse proxy → frp tunnel → local :3000; HMR uses WSS, responses are not cached, and this path stays outside production.' },
    ],
    terms: [
      { name: 'frp', fullName: 'Fast Reverse Proxy', zh: '把外网入口安全转发到本机开发服务的反向代理隧道。', en: 'A reverse-proxy tunnel that forwards a public entry to the local development server.' },
      { name: 'HMR', fullName: 'Hot Module Replacement', zh: '修改代码后只替换受影响模块，不整页重载。', en: 'Replaces changed modules during development without a full-page reload.' },
      { name: 'WSS', fullName: 'WebSocket Secure', zh: '在加密连接上维持开发热更新通道。', en: 'Keeps the development hot-update channel open over an encrypted connection.' },
    ],
  },
  {
    id: 'web', lane: 'product', x: 35, y: 18, eyebrow: 'WEB', sourcePaths: ['core/packages/client'],
    label: { zh: 'Web 前端', en: 'Web frontend' },
    zh: '唯一网站前端，负责页面、路由、服务端渲染、交互和多语言。',
    en: 'The sole web frontend, responsible for pages, routing, server rendering, interaction, and localization.',
    terms: [
      { name: 'SSR', fullName: 'Server-Side Rendering', zh: '先在服务端生成页面内容，再交给浏览器显示。', en: 'Generating page content on the server before it reaches the browser.' },
      { name: 'SSG', fullName: 'Static Site Generation', zh: '在构建时提前生成可直接分发的页面。', en: 'Generating ready-to-serve pages during the build.' },
      { name: 'Hydration', fullName: 'Hydration', zh: '浏览器把服务端 HTML 接管成可交互界面。', en: 'The browser attaching interactivity to server-rendered HTML.' },
      { name: 'Routing', fullName: 'Application Routing', zh: '把 URL 映射到页面和布局。', en: 'Mapping URLs to pages and layouts.' },
    ],
  },
  {
    id: 'installed', lane: 'product', x: 35, y: 43, eyebrow: 'APP',
    sourcePaths: ['core/packages/app-ui', 'core/apps/mobile', 'core/apps/desktop', 'core/apps/harmony'],
    label: { zh: '已安装客户端', en: 'Installed clients' },
    zh: 'Android、iOS、Windows、macOS 和 HarmonyOS 共用 React 产品层，各宿主只接系统能力。',
    en: 'Android, iOS, Windows, macOS, and HarmonyOS share one React product layer; each host only supplies system capabilities.',
    terms: [
      { name: 'Adapter', fullName: 'Capability Adapter', zh: '把蓝牙、存储等系统能力翻译成共享界面能调用的统一接口。', en: 'Translates system features such as Bluetooth or storage into a shared interface.' },
      { name: 'Thin host', fullName: 'Thin Native Host', zh: '只负责启动、打包和系统桥接，不复制业务界面。', en: 'Handles startup, packaging, and system bridges without duplicating product UI.' },
      { name: 'WebView', fullName: 'Embedded Web View', zh: '原生应用里承载 Web 技术界面的容器。', en: 'A native-app container that displays a web-based interface.' },
    ],
  },
  {
    id: 'miniprogram', lane: 'product', x: 35, y: 68, eyebrow: 'MINI APP', sourcePaths: ['core/apps/miniprogram'],
    label: { zh: '微信与抖音小程序', en: 'WeChat & Douyin Mini Programs' },
    zh: '独立运行时，共享协议和规则，但不复用 React DOM 界面。',
    en: 'A separate runtime that shares contracts and rules, but not React DOM UI.',
    terms: [
      { name: 'Runtime', fullName: 'Runtime Isolation', zh: '小程序有自己的组件、API 和生命周期，不能假装成普通网页。', en: 'Mini Programs have their own components, APIs, and lifecycle rather than behaving like ordinary web pages.' },
      { name: 'Platform adapter', fullName: 'Platform Adapter', zh: '把微信和抖音的差异收在平台适配层。', en: 'Keeps WeChat and Douyin differences inside platform-specific adapters.' },
    ],
  },
  {
    id: 'blog', lane: 'product', x: 35, y: 91, eyebrow: 'BLOG', sourcePaths: [],
    label: { zh: '独立博客', en: 'Independent blog' },
    zh: '文章内容由独立应用负责，主站只保留规范跳转入口。',
    en: 'Article content belongs to a separate application; the main site only keeps the canonical link entry.',
    terms: [
      { name: 'Redirect', fullName: 'HTTP Redirect', zh: '让旧入口明确跳到唯一规范地址。', en: 'Sends an old entry to its single canonical address.' },
      { name: 'Runtime boundary', fullName: 'Runtime Boundary', zh: '独立应用可以单独构建、发布和运行。', en: 'An independent application can be built, released, and run separately.' },
    ],
  },
  {
    id: 'api', lane: 'service', x: 60, y: 21, eyebrow: 'API', sourcePaths: ['core/apps/api'],
    label: { zh: 'Hono API', en: 'Hono API' },
    zh: '登录、权限、业务读写和数据访问的唯一在线后端。',
    en: 'The single online backend for sign-in, authorization, business writes, and data access.',
    terms: [
      { name: 'REST API', fullName: 'Representational State Transfer API', zh: '用 URL、HTTP 方法和 JSON 表达资源操作的接口风格。', en: 'An API style using URLs, HTTP methods, and JSON to operate on resources.' },
      { name: 'Authentication', fullName: 'Authentication', zh: '确认“你是谁”，例如登录和会话校验。', en: 'Confirms who you are, such as through sign-in and session checks.' },
      { name: 'Authorization', fullName: 'Authorization', zh: '确认“你能做什么”，发生在身份确认之后。', en: 'Determines what you may do after your identity is known.' },
      { name: 'RBAC', fullName: 'Role-Based Access Control', zh: '基于角色分配权限。本站当前把普通用户、管理员和根管理员分层。', en: 'Assigns permissions by role. CubeRoot currently separates users, administrators, and root administrators.' },
    ],
  },
  {
    id: 'fmc', lane: 'service', x: 60, y: 50, eyebrow: 'RUST', sourcePaths: ['core/apps/fmc-solver'],
    label: { zh: 'FMC 求解服务', en: 'FMC solver service' },
    zh: '独立构建和部署的计算服务，通过固定 HTTP 边界提供求解能力。',
    en: 'A separately built and deployed compute service exposed through a stable HTTP boundary.',
    terms: [
      { name: 'Service boundary', fullName: 'Service Boundary', zh: '用网络接口隔开运行时和发布周期。', en: 'Separates runtimes and release cycles behind a network interface.' },
      { name: 'Native', fullName: 'Native Code', zh: '直接编译成目标机器可执行代码，适合重计算。', en: 'Code compiled directly for the target machine, suited to heavy computation.' },
    ],
  },
  {
    id: 'jobs', lane: 'service', x: 60, y: 79, eyebrow: 'JOBS',
    sourcePaths: ['core/jobs/alg-build', 'core/jobs/scramble-stats-build', 'core/jobs/stats-build', 'core/jobs/wb-build'],
    label: { zh: '离线生成任务', en: 'Offline build jobs' },
    zh: '在请求之外批量计算公式、打乱统计、WCA 统计和非官方纪录。',
    en: 'Batch-computes algorithms, scramble statistics, WCA statistics, and unofficial records outside request handling.',
    terms: [
      { name: 'ETL', fullName: 'Extract, Transform, Load', zh: '提取数据、加工数据，再装入最终存储。', en: 'Extracting data, transforming it, then loading it into its final store.' },
      { name: 'Pipeline', fullName: 'Data Pipeline', zh: '按固定顺序运行的一串数据处理步骤。', en: 'An ordered series of data-processing steps.' },
      { name: 'Artifact', fullName: 'Build Artifact', zh: '任务生成并交给后续环节使用的文件或数据。', en: 'A file or dataset produced for a later stage to consume.' },
    ],
  },
  {
    id: 'database', lane: 'foundation', x: 86, y: 12, eyebrow: 'DATA', sourcePaths: [],
    label: { zh: 'PostgreSQL', en: 'PostgreSQL' },
    zh: '账号、内容、权限和业务数据的关系型事实源。',
    en: 'The relational source of truth for accounts, content, permissions, and product data.',
    terms: [
      { name: 'Transaction', fullName: 'Database Transaction', zh: '一组操作要么全部成功，要么全部撤销。', en: 'A group of operations that either all succeed or all roll back.' },
      { name: 'Migration', fullName: 'Schema Migration', zh: '用可追踪脚本逐步修改数据库结构。', en: 'A tracked script that changes the database schema step by step.' },
      { name: 'Relational DB', fullName: 'Relational Database', zh: '用表、键和约束组织彼此关联的数据。', en: 'Organizes related data through tables, keys, and constraints.' },
    ],
  },
  {
    id: 'static', lane: 'foundation', x: 86, y: 36, eyebrow: 'STATIC', sourcePaths: ['tools', 'stats'],
    label: { zh: '静态工具与数据', en: 'Static tools & data' },
    zh: '大型工具、统计 JSON 和上游静态资源从独立静态入口分发。',
    en: 'Large tools, statistics JSON, and upstream assets are served from a separate static origin.',
    terms: [
      { name: 'Cache', fullName: 'HTTP Cache', zh: '复用已经生成的响应，减少重复计算和传输。', en: 'Reuses an existing response to reduce repeated work and transfer.' },
      { name: 'CORS', fullName: 'Cross-Origin Resource Sharing', zh: '规定一个来源能否读取另一个来源的资源。', en: 'Controls whether one origin may read resources from another.' },
      { name: 'Static origin', fullName: 'Static Asset Origin', zh: '专门提供不需要在线计算的文件。', en: 'A dedicated origin for files that need no request-time computation.' },
    ],
  },
  {
    id: 'shared', lane: 'foundation', x: 86, y: 62, eyebrow: 'SHARED',
    sourcePaths: [
      'core/packages/event-icon', 'core/packages/puzzle-render-core', 'core/packages/puzzle-solvers',
      'core/packages/shared', 'core/packages/stack-kernel', 'core/packages/timer-ui',
      'core/packages/vendor-sr-puzzlegen', 'core/packages/visualcube', 'solver',
    ],
    label: { zh: '共享契约与引擎', en: 'Shared contracts & engines' },
    zh: '跨端稳定契约、魔方渲染和求解能力；各产品只通过公开入口复用。',
    en: 'Stable cross-platform contracts, puzzle rendering, and solving capabilities consumed through public entry points.',
    terms: [
      { name: 'Monorepo', fullName: 'Monorepository', zh: '多个应用和包放在一个仓库里统一协作。', en: 'Keeps multiple applications and packages in one coordinated repository.' },
      { name: 'SSOT', fullName: 'Single Source of Truth', zh: '同一事实只维护一份，所有使用方从这里读取。', en: 'Maintains one canonical copy of a fact for every consumer.' },
      { name: 'Package boundary', fullName: 'Package Boundary', zh: '只通过公开入口共享能力，避免跨目录偷用内部实现。', en: 'Shares capabilities through public exports instead of reaching into internals.' },
      { name: 'WASM', fullName: 'WebAssembly', zh: '把高性能编译代码带到浏览器运行。', en: 'Runs compiled high-performance code inside the browser.' },
    ],
  },
  {
    id: 'governance', lane: 'foundation', x: 86, y: 89, eyebrow: 'OWNERSHIP', sourcePaths: [],
    label: { zh: '自研、移植与上游代码', en: 'Own, port & upstream code' },
    zh: '自研能力在本站维护；port 把上游能力改写进产品；fork 保留上游实现并只维护固定包装边界。',
    en: 'First-party capabilities are maintained here; ports rewrite upstream work into the product; forks preserve upstream implementations behind fixed wrappers.',
    terms: [
      { name: 'own', fullName: 'First-party Implementation', zh: '由本站设计、实现并持续维护。', en: 'Designed, implemented, and maintained by this project.' },
      { name: 'port', fullName: 'Ported Implementation', zh: '依据上游项目在本站技术栈中重写。', en: 'Rewritten for this project\'s stack from an upstream project.' },
      { name: 'fork', fullName: 'Forked Upstream', zh: '保留上游实现，只在明确边界内同步和包装。', en: 'Preserves upstream code and only synchronizes or wraps it at an explicit boundary.' },
    ],
  },
];

export const ARCHITECTURE_EDGES: ArchitectureEdge[] = [
  { from: 'people', to: 'delivery', kind: 'request', zh: '网页请求', en: 'web request' },
  { from: 'delivery', to: 'web', kind: 'request', zh: '交付页面', en: 'deliver pages' },
  { from: 'delivery', to: 'api', kind: 'request', zh: 'API 入口', en: 'API entry' },
  { from: 'delivery', to: 'static', kind: 'request', zh: '静态入口', en: 'static entry' },
  { from: 'delivery', to: 'blog', kind: 'request', zh: '博客入口', en: 'blog entry' },
  { from: 'development', to: 'web', kind: 'request', zh: '本机 / frp', en: 'local / frp' },
  { from: 'people', to: 'installed', kind: 'request', zh: '安装应用', en: 'installed app' },
  { from: 'people', to: 'miniprogram', kind: 'request', zh: '小程序入口', en: 'mini-app entry' },
  { from: 'web', to: 'api', kind: 'request', zh: 'JSON / 会话', en: 'JSON / session' },
  { from: 'installed', to: 'api', kind: 'request', zh: '统一业务接口', en: 'shared product API' },
  { from: 'miniprogram', to: 'api', kind: 'request', zh: '平台登录 / 业务', en: 'platform auth / product' },
  { from: 'web', to: 'fmc', kind: 'request', zh: '求解请求', en: 'solve request' },
  { from: 'api', to: 'database', kind: 'request', zh: '查询 / 事务', en: 'queries / transactions' },
  { from: 'web', to: 'static', kind: 'request', zh: '工具 / 统计', en: 'tools / stats' },
  { from: 'jobs', to: 'database', kind: 'artifact', zh: '装载数据', en: 'load data' },
  { from: 'jobs', to: 'static', kind: 'artifact', zh: '生成文件', en: 'publish files' },
  { from: 'shared', to: 'web', kind: 'capability', zh: '共享能力', en: 'shared capability' },
  { from: 'shared', to: 'installed', kind: 'capability', zh: '共享能力', en: 'shared capability' },
  { from: 'shared', to: 'api', kind: 'capability', zh: '共享契约', en: 'shared contracts' },
  { from: 'shared', to: 'miniprogram', kind: 'capability', zh: '共享契约', en: 'shared contracts' },
  { from: 'governance', to: 'web', kind: 'capability', zh: '移植 / 包装', en: 'ports / wrappers' },
  { from: 'governance', to: 'static', kind: 'capability', zh: '上游静态资源', en: 'upstream assets' },
];

export const ARCHITECTURE_IGNORED_UNIT_PATHS = ['core/packages/platform'];
