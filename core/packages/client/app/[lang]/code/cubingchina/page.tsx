'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './cubingchina_intro.css';

/* Self-contained bilingual helper — this page is a standalone /code umbrella
 * page, so it carries its own tiny Lang context instead of importing the
 * language-section one. */
type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useContext(LangCtx) === 'zh' ? zh : en}</>;
}

/* The real CubingChina wordmark (cookie-"C" + cube-sticker grid), copied into
 * public/images from the site's own assets. It's a transparent PNG built for a
 * light background, so it renders on a light chip; the zh / en variants track
 * the page language (粗饼·中国魔方赛事网 vs cubing.com under the mark). */
function CCLogo({ className }: { className?: string }) {
  const src = useContext(LangCtx) === 'zh'
    ? '/images/cubingchina-logo-zh.png'
    : '/images/cubingchina-logo-en.png';
  return <img className={className} src={src} alt="CubingChina 粗饼网" width={1600} height={891} />;
}

interface HistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

const HISTORY: HistoryItem[] = [
  {
    year: <>2010<small>·08·01</small></>,
    zh: { title: <>前身 CCA — 中国魔方协会</>, desc: <>据 Speedsolving Wiki 记述, 一个更早的组织 <strong>Chinese Cube Association (CCA)</strong> 于 2010 年 8 月在长春的一场 WCA 比赛上宣告成立, 存续到 2014 年。<em>后来的 Cubing China "似乎承接了" 这一脉</em>——措辞是社区记述里的原话, 并非官方定论。</> },
    en: { title: <>Predecessor: the CCA</>, desc: <>Per the Speedsolving Wiki, an earlier body — the <strong>Chinese Cube Association (CCA)</strong> — was announced at a WCA competition in Changchun in August 2010 and ran until 2014. <em>Cubing China "appears to have absorbed" that lineage</em> — the hedge is the community record's own wording, not an official statement.</> },
  },
  {
    year: <>2014<small>·04·04</small></>,
    zh: { title: <>cubingchina.com 域名注册</>, desc: <>主域名 <code>cubingchina.com</code> 于 2014 年 4 月 4 日注册; 互联网档案馆最早的抓取是 2014 年 6 月 9 日。<em>站点从这里开始有了地址</em>。</> },
    en: { title: <>cubingchina.com registered</>, desc: <>The primary domain <code>cubingchina.com</code> was registered on 4 Apr 2014; the earliest Wayback capture is 9 Jun 2014. <em>This is where the site first had an address</em>.</> },
  },
  {
    year: <>2014<small>·07·18</small></>,
    zh: { title: <>GitHub 仓库建立, 开发起步</>, desc: <><code>CubingChina/cubingchina</code> 仓库于 2014 年 7 月 18 日创建——比组织正式成立早约半年, 正好对上"经过约六个月开发与测试"的记述。<em>第一行代码从这天算</em>。</> },
    en: { title: <>GitHub repo created — development begins</>, desc: <>The <code>CubingChina/cubingchina</code> repository was created on 18 Jul 2014 — about six months before the organization's formal establishment, matching the "~6 months of development and testing" account. <em>The first commit dates from here</em>.</> },
  },
  {
    year: <>2014<small>·12·31</small></>, highlight: true,
    zh: { title: <>Cubing China 组织正式成立</>, desc: <>2014 年 12 月 31 日, <strong>Cubing China(粗饼)</strong> 正式成立, 官方全名"<strong>粗饼·中国魔方赛事网</strong>"。此后它被视为 <strong>WCA 认可的中国区官方魔方组织</strong>, 承担全国 WCA 比赛的在线报名与本地化成绩。</> },
    en: { title: <>Cubing China formally established</>, desc: <>On 31 Dec 2014, <strong>Cubing China (粗饼)</strong> was formally established, official full name "<strong>粗饼·中国魔方赛事网</strong>." It is since regarded as the <strong>WCA-recognized national cubing organization for China</strong>, carrying online registration and localized results for the country's WCA competitions.</> },
  },
  {
    year: <>cubing<small>.com</small></>,
    zh: { title: <>启用短域名 cubing.com</>, desc: <>站点后来把主入口收拢到更短的 <code>cubing.com</code>(<code>cubingchina.com</code> 仍可用, <code>i.cubing.com</code> 亦在用)。<em>确切启用时间社区未考据</em>——注意 2011 年 cubing.com 的旧抓取属于无关的前任所有者, 不能当作粗饼网的起点。</> },
    en: { title: <>The short domain cubing.com</>, desc: <>The site later consolidated onto the shorter <code>cubing.com</code> (<code>cubingchina.com</code> still works; <code>i.cubing.com</code> is used too). <em>The exact adoption date isn't documented</em> — and note that a 2011 cubing.com capture belonged to an unrelated prior owner, so it must not be cited as Cubing China's origin.</> },
  },
  {
    year: <>2021</>,
    zh: { title: <>京 ICP 备案</>, desc: <>页脚可见 ICP 备案号 <strong>京ICP备2021016168号</strong>——"京"字表明在北京登记, 备案号里的 2021 对应该次备案年份。<em>这是站点面向中国大陆合规运营的公开痕迹</em>。</> },
    en: { title: <>ICP filing (Beijing)</>, desc: <>The footer carries ICP filing <strong>京ICP备2021016168号</strong> — the "京" prefix marks a Beijing registration, and the 2021 in the number is the filing year. <em>A public trace of the site operating in compliance within mainland China</em>.</> },
  },
  {
    year: <>2026<small>·07</small></>, highlight: true,
    zh: { title: <>仍在活跃, cuberoot.me 收录此页</>, desc: <>仓库最近一次提交在 <strong>2026 年 7 月 16 日</strong>——立项十二年后, 单一 PHP 代码库仍在持续维护。同月 <strong>cuberoot.me</strong> 在 <code>/code</code> 里写下这一页, 作为同域姊妹站对它的技术侧写。</> },
    en: { title: <>Still active — profiled here by cuberoot.me</>, desc: <>The repo's most recent commit is <strong>16 Jul 2026</strong> — twelve years in, the single PHP codebase is still maintained. The same month, <strong>cuberoot.me</strong> wrote this page under <code>/code</code> as a sibling site's technical profile of it.</> },
  },
];

interface ArchCard {
  tag: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code: ReactNode;
}

const ARCH_CARDS: ArchCard[] = [
  {
    tag: 'A',
    zh: { title: <>Yii 1.1.20 · 老而稳的 MVC</>, desc: <>不是 Yii2——是 <strong>Yii 1.1.20</strong>(PHP 7.0+, 实测跑在 8.1)。框架本体在仓库<strong>外</strong>的兄弟目录 <code>../framework</code>。<code>protected/</code> 是应用代码, <code>public/</code> 是 web 根。配置四段级联: <code>bootstrap → main → &lt;env&gt; → console</code>。</> },
    en: { title: <>Yii 1.1.20 · the old, stable MVC</>, desc: <>Not Yii2 — <strong>Yii 1.1.20</strong> (PHP 7.0+, running on 8.1 in practice). The framework itself lives <strong>outside</strong> the repo at a sibling <code>../framework</code>. <code>protected/</code> is app code, <code>public/</code> the web root. Config cascades in four stages: <code>bootstrap → main → &lt;env&gt; → console</code>.</> },
    code: (
      <code>
        <span className="cl-c">// controllers extend the right base</span>{'\n'}
        <span className="cl-k">class</span> <span className="cl-type">CompetitionController</span>{'\n'}
        {'    '}<span className="cl-k">extends</span> <span className="cl-type">Controller</span> {'{}'}{'\n'}
        <span className="cl-c">// AdminController → /board (ROLE_CHECKED)</span>{'\n'}
        <span className="cl-c">// ApiController  → /api/v0 (no CSRF)</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>蓝绿双 WCA 镜像</>, desc: <>站点自有库之外, 另挂<strong>一对只读 WCA 导出镜像</strong> <code>wca_v2_0</code> / <code>wca_v2_1</code>。指针文件 <code>protected/config/wcaDb</code> 记录当前活跃的那个; 同步脚本把新导出灌进<strong>不活跃</strong>的一份, 灌完再翻指针——<em>零停机换库</em>。</> },
    en: { title: <>Blue-green WCA mirror</>, desc: <>Beside its own DB, the app mounts a <strong>read-only pair of WCA-export mirrors</strong> <code>wca_v2_0</code> / <code>wca_v2_1</code>. The pointer file <code>protected/config/wcaDb</code> names the live one; the sync loads a fresh export into the <strong>inactive</strong> half, then flips the pointer — <em>zero-downtime swap</em>.</> },
    code: (
      <code>
        <span className="cl-c"># wca_data_sync.sh (lftp + grep + sed)</span>{'\n'}
        <span className="cl-c"># 1. download the WCA export</span>{'\n'}
        <span className="cl-c"># 2. import into wca_v2_[inactive]</span>{'\n'}
        <span className="cl-c"># 3. flip protected/config/wcaDb</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>直播成绩 · Ratchet WebSocket</>, desc: <>比赛直播靠一个 <strong>Ratchet WebSocket 服务</strong>(<code>protected/websocket/</code>, 用 <code>./yiic websocket</code> 起, 反代在 <code>/ws</code>)。<code>LiveResultCommand</code> 摄入成绩, <code>LiveController</code> 推给现场页面。<em>成绩录一条, 观众端即时刷新</em>。</> },
    en: { title: <>Live results · Ratchet WebSocket</>, desc: <>Competition live-streaming rides a <strong>Ratchet WebSocket server</strong> (<code>protected/websocket/</code>, started with <code>./yiic websocket</code>, reverse-proxied at <code>/ws</code>). <code>LiveResultCommand</code> ingests, <code>LiveController</code> pushes to the venue page. <em>One result entered, the audience view updates instantly</em>.</> },
    code: (
      <code>
        <span className="cl-v">$ </span><span className="cl-fn">./yiic</span> websocket{'\n'}
        <span className="cl-c">{'// nginx: location /ws { proxy_pass'}</span>{'\n'}
        <span className="cl-c">{'//   http://127.0.0.1:8081; Upgrade... }'}</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>三语 i18n · 繁体现算</>, desc: <>三种语言 <code>en</code> / <code>zh_cn</code> / <code>zh_tw</code>。中文内容存在 <code>_zh</code> 列, <code>getAttributeValue()</code> 在语言以 <code>zh</code> 开头时自动补 <code>_zh</code>。<strong><code>zh_tw</code> 没有独立数据</strong>——渲染时把 <code>zh_cn</code> 过一遍 <code>ZhConversion.php</code> 现场转出繁体。</> },
    en: { title: <>Three-language i18n · trad on the fly</>, desc: <>Three languages: <code>en</code> / <code>zh_cn</code> / <code>zh_tw</code>. Chinese content lives in <code>_zh</code> columns; <code>getAttributeValue()</code> appends <code>_zh</code> when the language starts with <code>zh</code>. <strong><code>zh_tw</code> has no stored data</strong> — it's generated at render time by running <code>zh_cn</code> through <code>ZhConversion.php</code>.</> },
    code: (
      <code>
        <span className="cl-c">// zh_tw = zh_cn → ZhConversion</span>{'\n'}
        <span className="cl-v">$this</span>-&gt;<span className="cl-fn">translateTWInNeed</span>(<span className="cl-v">$text</span>);{'\n'}
        <span className="cl-c">// UI strings: Yii::t('Competitions', ...)</span>
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>board + api 两个模块</>, desc: <><strong><code>board</code></strong> 是主办方 / 管理后台(路由 <code>/board</code>, 要求 <code>ROLE_CHECKED</code>, 强制 <code>zh_cn</code>): 办赛、报名、结算、新闻、FAQ、用户。<strong><code>api</code></strong> 是对外 JSON 接口(<code>/api/v0/...</code>, 关掉 CSRF 与鉴权)。</> },
    en: { title: <>Two modules: board + api</>, desc: <><strong><code>board</code></strong> is the organizer / admin backend (routed at <code>/board</code>, requires <code>ROLE_CHECKED</code>, forces <code>zh_cn</code>): competitions, registrations, payouts, news, FAQ, users. <strong><code>api</code></strong> is the public JSON API (<code>/api/v0/...</code>, CSRF and auth disabled).</> },
    code: (
      <code>
        <span className="cl-c">// typed request + JSON envelope</span>{'\n'}
        <span className="cl-v">$id</span> = <span className="cl-v">$this</span>-&gt;<span className="cl-fn">iGet</span>(<span className="cl-s">'id'</span>);{'\n'}
        <span className="cl-k">return</span> <span className="cl-v">$this</span>-&gt;<span className="cl-fn">ajaxOK</span>(<span className="cl-v">$data</span>);{'\n'}
        <span className="cl-c">{'// { status, data, message }'}</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>缴费 + 微信 OAuth</>, desc: <><code>PayController</code> + <code>pay/*</code> 规则处理在线缴费(dev 走沙箱)——公开 FAQ 写明<strong>支付宝 / 网银</strong>, 代码里另含微信支付。登录用<strong>自有账号体系</strong>(邮箱 + 与证件相符的真实姓名), 基类支持<strong>微信 OAuth</strong>; <em>没有走 WCA OAuth</em>。</> },
    en: { title: <>Payments + WeChat OAuth</>, desc: <><code>PayController</code> plus <code>pay/*</code> rules handle online payment (sandbox in dev) — the public FAQ states <strong>Alipay / online banking</strong>, and the code also carries WeChat Pay. Login uses its <strong>own account system</strong> (email + real name matching your ID); the base controller supports <strong>WeChat OAuth</strong>. <em>It does not use WCA OAuth</em>.</> },
    code: (
      <code>
        <span className="cl-c">// params.payments (sandbox in dev)</span>{'\n'}
        <span className="cl-c">// Alipay / 网银 · WeChat in code</span>{'\n'}
        <span className="cl-c">// login: own accounts + WeChat OAuth</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>Redis 缓存 + 前端构建</>, desc: <>缓存走 <strong>Redis</strong>(<code>database 1</code>), 依赖走 <strong>Composer</strong>。前端是 <strong>webpack + Vue 2 + jQuery + Bootstrap 3 + LESS</strong>, 从 <code>public/f</code> 构建; 产物写进 <code>assets-map.json</code>, 由 <code>Controller::beforeAction</code> 读取注册带 hash 的 CSS/JS。<em>没构建就报错</em>。</> },
    en: { title: <>Redis cache + a front-end build</>, desc: <>Cache runs on <strong>Redis</strong> (<code>database 1</code>), dependencies via <strong>Composer</strong>. The front end is <strong>webpack + Vue 2 + jQuery + Bootstrap 3 + LESS</strong>, built from <code>public/f</code>; the build emits <code>assets-map.json</code>, which <code>Controller::beforeAction</code> reads to register hashed CSS/JS. <em>No build, and pages error</em>.</> },
    code: (
      <code>
        <span className="cl-v">$ </span><span className="cl-fn">cd</span> public/f && npm run build{'\n'}
        <span className="cl-c">// → assets-map.json (hashed bundles)</span>{'\n'}
        <span className="cl-c">// Redis: cache · database 1</span>
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>Shared-nothing · php-fpm</>, desc: <>跟所有 PHP 站一样, 每个请求在 <strong>php-fpm</strong> 里干净启动、跑完即死——<em>横向扩展极简</em>。部署一条 <code>deploy.sh</code> 串起 <code>git pull → composer install → yiic migrate → npm build</code>; DB 变更全走 <code>protected/migrations/</code>。</> },
    en: { title: <>Shared-nothing · php-fpm</>, desc: <>Like every PHP site, each request boots clean in <strong>php-fpm</strong> and dies on completion — <em>horizontal scaling stays trivial</em>. One <code>deploy.sh</code> chains <code>git pull → composer install → yiic migrate → npm build</code>; DB changes all go through <code>protected/migrations/</code>.</> },
    code: (
      <code>
        <span className="cl-v">$ </span><span className="cl-fn">./yiic</span> migrate{'\n'}
        <span className="cl-v">$ </span><span className="cl-fn">bash</span> commands/shell/deploy.sh{'\n'}
        <span className="cl-c">// request → fpm worker → dies</span>
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
    icon: '◎',
    zh: { title: <>中国 WCA 报名的单一入口</>, desc: <>按 FAQ, <strong>中国的 WCA 比赛报名必须在站上完成</strong>: 选比赛、填与证件相符的真实信息、在线缴费。<em>对国内选手, 它不是"一个选择", 而是"那个入口"</em>——赛事日历、报名名额、缴费状态都在这里。</> },
    en: { title: <>The single door for China's WCA sign-ups</>, desc: <>Per the FAQ, <strong>registration for Chinese WCA competitions must happen on the site</strong>: pick the comp, enter real details matching your ID, pay online. <em>For cubers in China it isn't "an option," it's "the door"</em> — calendar, seats, and payment status all live here.</> },
    code: <><span className="cl-c">// 赛事 → 报名 → 支付宝/网银 → 完成</span>{'\n'}<span className="cl-c">// competition → register → pay → done</span></>,
  },
  {
    icon: '⛁',
    zh: { title: <>WCA 成绩的本地镜像</>, desc: <>官方 WCA 每日导出被同步进本地库, 于是<strong>选手 / 比赛 / 排名 / 纪录 / 统计</strong>都能用中文、按中国视角查询。<em>不是重新计算成绩, 而是把权威数据搬到离用户更近、更本地化的一层</em>。</> },
    en: { title: <>A local mirror of WCA results</>, desc: <>The official daily WCA export is synced into local DBs, so <strong>persons / competitions / rankings / records / statistics</strong> are all queryable in Chinese and from a China-first view. <em>It doesn't recompute results — it brings the authoritative data to a closer, localized layer</em>.</> },
    code: <><span className="cl-c">// 成绩: 选手·比赛·排名·纪录·统计</span>{'\n'}<span className="cl-c">// mirror, not recompute</span></>,
  },
  {
    icon: '◉',
    zh: { title: <>现场直播</>, desc: <>WebSocket 直播让不在现场的人<strong>实时看成绩滚动</strong>。对一个以线下比赛为核心的社区, 这条实时链路把"比赛正在发生"这件事传得更远。</> },
    en: { title: <>Live at the venue</>, desc: <>WebSocket streaming lets people not at the venue <strong>watch results roll in live</strong>. For a community centered on in-person competition, that real-time link carries "the comp is happening" much further.</> },
    code: <><span className="cl-c">// LiveResultCommand → WS → 观众</span>{'\n'}<span className="cl-c">// ingest → push → audience</span></>,
  },
  {
    icon: '⌥',
    zh: { title: <>整套代码 GPL-2.0 开源</>, desc: <>一个运营全国赛事的平台, <strong>把源码整套放在 GPL-2.0 下</strong>(README 中英双语)。任何人能读、能学、能自建。<em>"国家级魔方平台是怎么搭的"这个问题, 有公开答案</em>。</> },
    en: { title: <>The whole codebase is GPL-2.0</>, desc: <>A platform that runs a nation's competitions <strong>ships its entire source under GPL-2.0</strong> (bilingual README). Anyone can read, learn from, or self-host it. <em>"How is a national cubing platform actually built" has a public answer</em>.</> },
    code: <><span className="cl-c">// github.com/CubingChina/cubingchina</span>{'\n'}<span className="cl-c">// LICENSE: GPL-2.0 · README: en/zh</span></>,
  },
  {
    icon: '★',
    zh: { title: <>十二年, 主要靠一个人</>, desc: <>约 <strong>2,626 次提交里, ~94% 出自主力开发者 董百强(Baiqiang)</strong>——WCA ID 2008DONG06, 2008 年就开始比赛, 也是 WCA 代表 / 组织者。<em>诚实地说, 这既是它的巧劲, 也是它的 bus factor</em>。</> },
    en: { title: <>Twelve years, largely one person</>, desc: <>Of roughly <strong>2,626 commits, ~94% come from lead developer Baiqiang Dong (董百强)</strong> — WCA ID 2008DONG06, competing since 2008, and a WCA delegate / organizer. <em>Honestly, that's both its efficiency and its bus factor</em>.</> },
    code: <><span className="cl-c">// Baiqiang        2,472</span>{'\n'}<span className="cl-c">// 2016WUJI01        130</span>{'\n'}<span className="cl-c">// oyyq99999 · guojia99 · …</span></>,
  },
  {
    icon: '∞',
    zh: { title: <>稳定压过新潮</>, desc: <>它跑在 <strong>Yii 1.1</strong>——一个上游早已 EOL 的框架——却把一个国家级平台稳稳带了十来年。<em>这跟 PHP 本身的故事一样: 不追时髦, 够用、能打钱、不出事, 就是最强的位置</em>。</> },
    en: { title: <>Stability over fashion</>, desc: <>It runs on <strong>Yii 1.1</strong> — a framework whose upstream is long EOL — yet has carried a national platform steadily for over a decade. <em>Same lesson as PHP itself: not chasing trends, just good-enough, revenue-earning, and boring is the strongest position there is</em>.</> },
    code: <><span className="cl-c">// Yii 1.1.20 · upstream EOL</span>{'\n'}<span className="cl-c">// still running a nation's comps</span></>,
  },
];

interface EcoItem {
  href: string;
  highlight?: boolean;
  zhName: string;
  enName: string;
  zhNote: string;
  enNote: string;
  svg: ReactNode;
}

const ECO: EcoItem[] = [
  {
    href: 'https://cubing.com', highlight: true,
    zhName: 'cubing.com', enName: 'cubing.com',
    zhNote: '站点本体 · 粗饼网', enNote: 'the site itself',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#E23B3B"/><path d="M50 18 L80 34 L50 50 L20 34 Z" fill="#fff" opacity=".95"/><path d="M20 34 L50 50 L50 82 L20 66 Z" fill="#fff" opacity=".55"/><path d="M80 34 L50 50 L50 82 L80 66 Z" fill="#fff" opacity=".78"/></svg>,
  },
  {
    href: 'https://www.worldcubeassociation.org', highlight: true,
    zhName: 'WCA', enName: 'WCA',
    zhNote: '上游数据源 + 治理机构', enNote: 'upstream data + governing body',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#263C6E"/><circle cx="50" cy="50" r="30" fill="none" stroke="#fff" strokeWidth="4"/><text x="50" y="59" textAnchor="middle" fontSize="24" fontWeight="800" fontFamily="system-ui, sans-serif" fill="#fff">WCA</text></svg>,
  },
  {
    href: 'https://github.com/CubingChina/cubingchina',
    zhName: 'GitHub 仓库', enName: 'GitHub repo',
    zhNote: 'CubingChina/cubingchina · GPL-2.0', enNote: 'CubingChina/cubingchina · GPL-2.0',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1B1F24"/><path d="M50 22 C34 22 22 34 22 50 c0 12 8 22 19 26 1 0 2-1 2-2v-6 c-8 2-10-3-10-3 -1-3-3-4-3-4 -3-2 0-2 0-2 3 0 4 3 4 3 3 4 7 3 9 2 0-2 1-3 2-4 -7-1-13-3-13-14 0-3 1-6 3-8 0-1-1-4 0-8 0 0 3-1 8 3 5-1 10-1 15 0 5-4 8-3 8-3 1 4 0 7 0 8 2 2 3 5 3 8 0 11-7 13-14 14 1 1 2 3 2 6v9 c0 1 1 2 2 2 11-4 19-14 19-26 0-16-12-28-28-28Z" fill="#fff"/></svg>,
  },
  {
    href: '/code', highlight: true,
    zhName: 'cuberoot.me', enName: 'cuberoot.me',
    zhNote: '同域姊妹站 · 统计 / 工具 / 训练', enNote: 'sibling site · stats / tools / training',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0A0B"/><text x="50" y="47" textAnchor="middle" fontSize="30" fontWeight="800" fontFamily="Georgia, serif" fill="#FF6E68">³√</text><text x="50" y="74" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#CBB8B9">root</text></svg>,
  },
  {
    href: 'https://www.speedsolving.com/wiki/index.php?title=Cubing_China',
    zhName: 'Speedsolving Wiki', enName: 'Speedsolving Wiki',
    zhNote: '社区历史记述来源', enNote: 'community history record',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#2E7D5B"/><text x="50" y="63" textAnchor="middle" fontSize="46" fontWeight="800" fontFamily="Georgia, serif" fill="#fff">S</text></svg>,
  },
  {
    href: 'https://github.com/CubingChina',
    zhName: 'cubecomps-checker', enName: 'cubecomps-checker',
    zhNote: '同组织的成绩核对小工具', enNote: 'org side-tool · results checker',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#3A2F2A"/><path d="M28 52 L44 68 L74 34" fill="none" stroke="#FF6E68" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
];

interface ToolItem { name: string; zhDesc: string; enDesc: string }
const STACK_TOOLS: ToolItem[] = [
  { name: 'Yii 1.1.20',    zhDesc: 'PHP MVC 框架 · 本体在仓库外', enDesc: 'PHP MVC · framework sits outside repo' },
  { name: 'PHP 7.0+',      zhDesc: '实测跑 8.1',                enDesc: 'runs on 8.1 in practice' },
  { name: 'MySQL 5.1+',    zhDesc: 'utf8mb4 · 自有库 + WCA 镜像', enDesc: 'utf8mb4 · own DB + WCA mirror' },
  { name: 'Redis',         zhDesc: '缓存 · database 1',         enDesc: 'cache · database 1' },
  { name: 'Ratchet',       zhDesc: 'WebSocket 直播服务',         enDesc: 'WebSocket live-results server' },
  { name: 'Composer',      zhDesc: 'PHP 依赖 · protected/',      enDesc: 'PHP deps · protected/' },
  { name: 'Vue 2',         zhDesc: '前端交互',                  enDesc: 'front-end interactivity' },
  { name: 'jQuery',        zhDesc: '老派 DOM 层',               enDesc: 'the legacy DOM layer' },
  { name: 'Bootstrap 3',   zhDesc: 'UI 栅格 / 组件',            enDesc: 'UI grid / components' },
  { name: 'LESS',          zhDesc: 'CSS 预处理',                enDesc: 'CSS preprocessor' },
  { name: 'webpack',       zhDesc: 'public/f 打包 → assets-map', enDesc: 'bundles public/f → assets-map' },
  { name: 'Nginx · php-fpm', zhDesc: 'Unix socket · try_files',  enDesc: 'Unix socket · try_files' },
  { name: 'lftp',          zhDesc: 'WCA 导出下载(同步脚本)',     enDesc: 'fetches the WCA export (sync)' },
  { name: 'Node / npm',    zhDesc: '仅用于前端构建',            enDesc: 'front-end build only' },
];

interface FutureCard {
  tag: ReactNode;
  hot?: boolean;
  big?: boolean;
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

const FUTURE_CARDS: FutureCard[] = [
  {
    tag: <>HOT · 2026</>, hot: true, big: true,
    zh: {
      title: <>"成熟、无聊、还在提交" — 粗饼网的当下位置</>,
      body: (<>
        <p>2026 年的粗饼网可以一句话概括: <strong>一个跑在 EOL 框架(Yii 1.1)上的国家级赛事平台, 主要由一个人维护, 十二年从没真正停过</strong>。它不追时髦、不换栈, 但赛事照办、成绩照镜像、直播照推。仓库最近一次提交是 <strong>2026 年 7 月 16 日</strong>——就在我们写这页的前一天。</p>
        <p>这跟 <a href="/code/language/php">PHP 自己的故事</a> 惊人地像: <strong>被唱衰的技术, 靠"够用 + 稳定 + 解决真问题"活成基础设施</strong>。它最大的变量不是技术, 而是 <em>bus factor</em>——一个平台的健康压在一个人的持续投入上。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="上游框架状态" en="Upstream framework" /></span><span className="bar-val">Yii 1.1 · EOL</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="平台实际运行" en="Platform in reality" /></span><span className="bar-val"><L zh="十二年 · 仍活跃" en="12 yrs · active" /></span></div>
        </div>
      </>),
    },
    en: {
      title: <>"Mature, boring, still committing" — where Cubing China sits now</>,
      body: (<>
        <p>Cubing China in 2026, in one line: <strong>a national competition platform on an EOL framework (Yii 1.1), maintained largely by one person, that hasn't truly stopped in twelve years</strong>. It doesn't chase fashion or re-platform, but comps run, results mirror, streams push. The repo's latest commit is <strong>16 Jul 2026</strong> — the day before this page was written.</p>
        <p>It rhymes with <a href="/code/language/php">PHP's own story</a>: <strong>written-off tech that survives into infrastructure by being good-enough, stable, and solving a real problem</strong>. Its biggest variable isn't technical — it's <em>bus factor</em>: a platform's health resting on one person's continued effort.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Upstream framework</span><span className="bar-val">Yii 1.1 · EOL</span></div>
          <div className="bar bar-new"><span className="bar-label">Platform in reality</span><span className="bar-val">12 yrs · active</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'DOMAIN',
    zh: { title: <>向 cubing.com 收拢</>, body: <><p>主入口已收到更短的 <code>cubing.com</code>(<code>cubingchina.com</code> 仍在)。<em>短域名 = 更好记、更像"品牌"而非"项目"</em>。启用的确切时间社区未考据, 但方向清楚: 一个国内平台在慢慢把自己的门牌号做短。</p></> },
    en: { title: <>Consolidating onto cubing.com</>, body: <><p>The main entry has moved to the shorter <code>cubing.com</code> (<code>cubingchina.com</code> still works). <em>A short domain reads as "brand," not "project."</em> The exact adoption date isn't documented, but the direction is clear: a domestic platform quietly shortening its address.</p></> },
  },
  {
    tag: 'WCA SYNC',
    zh: { title: <>数据仍走导出镜像</>, body: <><p>目前是<strong>拉 WCA 每日导出 → 灌本地库</strong>的镜像模式, 不是实时 API, 也没接 WCA OAuth。<em>未来若接官方 API / OAuth, 蓝绿双库那套换库逻辑正好是现成的过渡骨架</em>——但这是推测, 没有公开路线图。</p></> },
    en: { title: <>Data stays an export mirror</>, body: <><p>Today it's a <strong>pull-the-daily-WCA-export → load-local-DB</strong> mirror — not a live API, and no WCA OAuth. <em>If it ever adopts the official API / OAuth, the blue-green swap logic is a ready-made migration skeleton</em> — but that's speculation, there's no public roadmap.</p></> },
  },
  {
    tag: 'OPEN',
    zh: { title: <>开源即是一份公开教材</>, body: <><p>因为是 GPL-2.0, 整个"如何用 PHP 搭一个国家级赛事平台"的答案是公开的: 报名、缴费、直播、成绩镜像、后台。<em>对想做本地化魔方社区工具的人, 这是一份能直接读的参照</em>——也是 cuberoot.me 在 <code>/code</code> 收录它的理由之一。</p></> },
    en: { title: <>Open source is a public textbook</>, body: <><p>Being GPL-2.0 means the whole answer to "how do you build a national competition platform in PHP" is public: registration, payment, live results, WCA mirror, admin. <em>For anyone building localized cubing-community tools, it's a directly-readable reference</em> — one reason cuberoot.me profiles it under <code>/code</code>.</p></> },
  },
];

export default function CubingChinaIntroPage() {
  const { i18n } = useTranslation();
  const isZhLang = i18n.language.startsWith('zh');
  const lang: Lang = isZhLang ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    '粗饼网 CubingChina : 中国 WCA 赛事平台 — Yii 1.1 上的报名 / 直播 / 成绩镜像',
    'CubingChina : China\'s WCA competition platform — registration, live results and a WCA mirror on Yii 1.1'
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
      '.tl-item, .why-card, .def-card, .logo-card, .future-card, .ts-card, .web-tool, .spotlight, .bar, .cmp-table tr'
    );
    targets.forEach((el) => { el.classList.add('fade-up'); io.observe(el); });

    root.querySelectorAll<HTMLElement>('.tl-item').forEach((el, i) => { el.style.transitionDelay = `${Math.min(i * 60, 400)}ms`; });
    root.querySelectorAll<HTMLElement>('.why-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; });
    root.querySelectorAll<HTMLElement>('.logo-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 6) * 60}ms`; });
    root.querySelectorAll<HTMLElement>('.ts-card').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; });
    root.querySelectorAll<HTMLElement>('.web-tool').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 50}ms`; });

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
        a.style.color = a.getAttribute('href') === '#' + cur ? 'var(--cc-bright)' : '';
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
      <div ref={rootRef} className="cc-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <svg viewBox="0 0 256 256" width="28" height="28">
              <path d="M128 40 L212 84 L128 128 L44 84 Z" fill="#E23B3B" />
              <path d="M44 84 L128 128 L128 216 L44 172 Z" fill="#8E1A20" />
              <path d="M212 84 L128 128 L128 216 L212 172 Z" fill="#C1272D" />
            </svg>
            <span><L zh="粗饼网" en="CubingChina" /></span>
            <span className="nav-tag"><L zh=": 技术侧写" en=": Profile" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#arch"><L zh="架构" en="Architecture" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#eco"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#open"><L zh="开源" en="Open Source" /></a></li>
            <li><a href="#vs"><L zh="三方对比" en="vs" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 2010 CCA · 2014 established · WCA China · Yii 1.1 · GPL-2.0 · cubing.com</div>
            <h1 className="hero-title">
              <span className="hero-name"><L zh="粗饼网" en="CubingChina" /></span>
              <span className="hero-colon">:</span>
              <span className="hero-type">ChinaWcaHub</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>中国 WCA 比赛的<strong>报名、日历、成绩、纪录、直播</strong>都在这里。它是<strong>被视为 WCA 认可的中国区官方魔方组织</strong>, 2014 年底成立; 也是一个 <strong>GPL-2.0 开源的 Yii 1.1 PHP 平台</strong>——约 2,626 次提交里 ~94% 出自一个人。<em>不追时髦, 十二年稳稳运转</em>。本页是同域姊妹站 cuberoot.me 对它的技术侧写。</>}
                en={<>Registration, calendar, results, records and live-streaming for China's WCA competitions all live here. It's the <strong>organization regarded as China's WCA-recognized national cubing body</strong>, established in late 2014, and a <strong>GPL-2.0 open-source Yii 1.1 PHP platform</strong> — ~94% of its roughly 2,626 commits from one person. <em>No fashion-chasing, twelve years of steady operation</em>. This page is sibling site cuberoot.me's technical profile of it.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2014<small></small></span>
                <span className="stat-label"><L zh={<>组织成立 · 12·31<br /><em>域名 04·04 注册</em></>} en={<>Org founded · Dec 31<br /><em>domain reg. Apr 4</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">GPL<small>-2.0</small></span>
                <span className="stat-label"><L zh={<>整套代码开源<br /><em>~2.6k commits</em></>} en={<>Whole codebase open<br /><em>~2.6k commits</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">94<small>%</small></span>
                <span className="stat-label"><L zh={<>提交出自一人<br /><em>董百强 · 2008DONG06</em></>} en={<>commits from one dev<br /><em>Baiqiang · 2008DONG06</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">Yii<small>1.1</small></span>
                <span className="stat-label"><L zh={<>PHP 7 · MySQL · Redis<br /><em>蓝绿双 WCA 库</em></>} en={<>PHP 7 · MySQL · Redis<br /><em>blue-green WCA DB</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <CCLogo />
            </div>
            <div className="hero-floats">
              <span className="float f1">报名 register</span>
              <span className="float f2">直播 live</span>
              <span className="float f3">WCA 镜像</span>
              <span className="float f4">wca_v2_0 / _1</span>
              <span className="float f5">蓝绿换库</span>
              <span className="float f6">Yii 1.1.20</span>
              <span className="float f7">php-fpm</span>
              <span className="float f8">支付宝 / 网银</span>
              <span className="float f9">成绩 排名 纪录</span>
              <span className="float f10">zh_tw 现算</span>
              <span className="float f11">Ratchet WS</span>
              <span className="float f12">京ICP备</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>CubingChina</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>粗饼网(<strong>官方全名"粗饼·中国魔方赛事网", 域名 cubing.com / cubingchina.com</strong>)是<strong>中国 WCA 比赛的运营与成绩平台</strong>。"粗饼"是英文 <em>cubing</em> 的谐音(社区通用叫法, 官方未给出词源)。它把三件事合在一处: <strong>比赛报名 + 缴费</strong>、<strong>成绩 / 排名 / 纪录本地镜像</strong>、<strong>现场直播</strong>。</>}
                  en={<>Cubing China (<strong>official full name "粗饼·中国魔方赛事网," domains cubing.com / cubingchina.com</strong>) is <strong>the operations and results platform for China's WCA competitions</strong>. "粗饼" (cū bǐng) is a homophone of <em>cubing</em> — the community's universal name for it, with no official etymology stated. It brings three things together: <strong>registration + payment</strong>, a <strong>local mirror of results / rankings / records</strong>, and <strong>live-streaming</strong>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="报名 = 唯一入口" en="Registration = the door" />, tag: 'operations', p: <L zh={<>中国的 WCA 比赛报名<strong>必须在站上完成</strong>: 选赛、填与证件相符的真实信息、在线缴费。<em>赛事日历与名额也在这里</em>。</>} en={<>Registration for China's WCA comps <strong>must happen on the site</strong>: pick the comp, enter real ID-matching details, pay online. <em>Calendar and seats live here too</em>.</>} /> },
                { h: <L zh="成绩 = WCA 本地镜像" en="Results = a local WCA mirror" />, tag: 'data', p: <L zh={<>把 WCA 每日导出同步到本地, <strong>选手 / 比赛 / 排名 / 纪录 / 统计</strong>都能用中文按国内视角查。<em>镜像, 不重算</em>。</>} en={<>The daily WCA export is synced locally so <strong>persons / comps / rankings / records / stats</strong> are queryable in Chinese, China-first. <em>Mirror, not recompute</em>.</>} /> },
                { h: <L zh="直播 = 实时链路" en="Live = a real-time link" />, tag: 'realtime', p: <L zh={<>WebSocket 把现场成绩<strong>实时推给不在场的人</strong>。对一个以线下比赛为核心的社区, 这条链路很关键。</>} en={<>WebSocket pushes venue results <strong>live to those not present</strong>. For an in-person-centered community, that link matters.</>} /> },
                { h: <L zh="开源 = 全套可读" en="Open = fully readable" />, tag: 'GPL-2.0', p: <L zh={<>整套代码在 <strong>GPL-2.0</strong> 下, README 中英双语。<em>"国家级赛事平台怎么搭"有公开答案</em>——这也是本页收录它的理由。</>} en={<>The whole codebase is <strong>GPL-2.0</strong> with a bilingual README. <em>"How a national comp platform is built" has a public answer</em> — the reason this page profiles it.</>} /> },
              ].map((d, i) => (
                <div className="def-card" key={i}>
                  <div className="def-card-h">{d.h} <span className="def-card-tag">{d.tag}</span></div>
                  <p>{d.p}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 02 History */}
          <section className="section" id="history">
            <header className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title"><L zh="来路" en="History" /> <code>: Timeline</code></h2>
              <p className="sec-desc"><L
                zh={<>时间线只放<strong>能考据到日期</strong>的节点, 没查实的一律标注。2010 的 CCA 前身、2014 三连(域名 → 仓库 → 组织成立)、2021 的 ICP 备案、2026 仍在提交——<em>凡带 "似乎 / 未考据" 的都是社区记述, 非官方定论</em>。</>}
                en={<>The timeline only carries nodes with a <strong>verifiable date</strong>; anything unconfirmed is flagged. The 2010 CCA predecessor, the 2014 trio (domain → repo → org), the 2021 ICP filing, and still-committing in 2026 — <em>anything hedged "appears / not documented" is community record, not an official statement</em>.</>}
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

          {/* 03 Architecture */}
          <section className="section" id="arch">
            <header className="sec-head">
              <span className="sec-num">03</span>
              <h2 className="sec-title"><L zh="架构" en="Architecture" /> <code>: HowItsBuilt</code></h2>
              <p className="sec-desc"><L
                zh={<>下面 8 张卡是这套平台的骨架: Yii 1.1 MVC、蓝绿双 WCA 镜像、Ratchet 直播、三语 i18n(繁体现算)、board / api 两模块、缴费 + 微信 OAuth、Redis + 前端构建、shared-nothing 部署。<em>技术细节来自对仓库源码的通读</em>。</>}
                en={<>The eight cards below are the platform's skeleton: Yii 1.1 MVC, the blue-green WCA mirror, Ratchet live-results, three-language i18n (trad generated on the fly), the board / api modules, payment + WeChat OAuth, Redis + a front-end build, and shared-nothing deploy. <em>Details come from a read-through of the repo source</em>.</>}
              /></p>
            </header>

            <div className="ts-grid">
              {ARCH_CARDS.map((c, i) => (
                <div className="ts-card" key={i}>
                  <div className="ts-tag">{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  <p>{lang === 'zh' ? c.zh.desc : c.en.desc}</p>
                  <pre className="ts-code">{c.code}</pre>
                </div>
              ))}
              <div className="ts-card ts-callout">
                <div className="ts-tag ts-tag-soft">◆</div>
                <h3><L zh={<>为什么这套"老"栈能撑住?</>} en={<>Why does this "old" stack hold up?</>} /></h3>
                <p><L
                  zh={<>Yii 1.1 上游早已 EOL, 前端还是 Vue 2 + jQuery + Bootstrap 3——按 2026 的标准这套栈"过时"。但它<strong>解决的问题边界清晰、变化慢</strong>: 报名、缴费、成绩镜像、直播。<em>需求稳, 栈就不用动</em>。<strong>shared-nothing 的 PHP</strong> 让加机器就能扛更多并发, <strong>蓝绿双库</strong>让每天灌 WCA 数据零停机。这正是"无聊技术"的胜利。</>}
                  en={<>Yii 1.1's upstream is long EOL, and the front end is still Vue 2 + jQuery + Bootstrap 3 — by 2026 standards the stack is "dated." But the <strong>problem it solves is well-bounded and slow-changing</strong>: registration, payment, results mirror, live. <em>Stable requirements, so the stack needn't move</em>. <strong>Shared-nothing PHP</strong> means more machines = more concurrency; the <strong>blue-green DB</strong> makes the daily WCA load zero-downtime. This is the victory of boring technology.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>能每天照常办赛、镜像成绩、推直播的栈, 就是好栈——哪怕它上游 EOL 了十年。</>}
                  en={<>A stack that runs comps, mirrors results and pushes streams every day is a good stack — even if its upstream has been EOL for a decade.</>}
                /></em>"</p>
              </div>
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">CompetitionController.php</span><span className="lang-tag js">Yii 1.1</span></div>
                <pre className="code"><code>
                  <span className="cl-k">{'<?php'}</span>{'\n'}
                  <span className="cl-k">class</span> <span className="cl-type">CompetitionController</span> <span className="cl-k">extends</span> <span className="cl-type">Controller</span>{'\n'}
                  {'{'}{'\n'}
                  {'  '}<span className="cl-k">public function</span> <span className="cl-fn">actionRegister</span>()  <span className="cl-c">// /competition/register</span>{'\n'}
                  {'  '}{'{'}{'\n'}
                  {'    '}<span className="cl-v">$id</span> = <span className="cl-v">$this</span>-&gt;<span className="cl-fn">iGet</span>(<span className="cl-s">'competitionId'</span>);  <span className="cl-c">// typed int getter</span>{'\n'}
                  {'    '}<span className="cl-v">$comp</span> = <span className="cl-type">Competition</span>::<span className="cl-fn">model</span>()-&gt;<span className="cl-fn">findByPk</span>(<span className="cl-v">$id</span>);{'\n'}
                  {'    '}<span className="cl-k">if</span> (!<span className="cl-v">$comp</span>) <span className="cl-k">return</span> <span className="cl-v">$this</span>-&gt;<span className="cl-fn">ajaxError</span>(<span className="cl-type">Constant</span>::NOT_FOUND);{'\n'}
                  {'    '}<span className="cl-c">// zh content resolved via getAttributeValue() → *_zh</span>{'\n'}
                  {'    '}<span className="cl-k">return</span> <span className="cl-v">$this</span>-&gt;<span className="cl-fn">ajaxOK</span>([<span className="cl-s">'name'</span> =&gt; <span className="cl-v">$comp</span>-&gt;<span className="cl-fn">getAttributeValue</span>(<span className="cl-s">'name'</span>)]);{'\n'}
                  {'  '}{'}'}{'\n'}
                  {'}'}
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">wca_data_sync.sh</span><span className="lang-tag ts">blue-green</span></div>
                <pre className="code"><code>
                  <span className="cl-c">#!/usr/bin/env bash</span>{'\n'}
                  <span className="cl-c"># which mirror is live right now?</span>{'\n'}
                  <span className="cl-v">live</span>=$(cat protected/config/wcaDb)   <span className="cl-c"># "0" or "1"</span>{'\n'}
                  <span className="cl-v">idle</span>=$([ <span className="cl-s">"$live"</span> = <span className="cl-s">"0"</span> ] && echo 1 || echo 0){'\n\n'}
                  <span className="cl-c"># fetch WCA export, load into the IDLE db</span>{'\n'}
                  lftp -c <span className="cl-s">"get $WCA_EXPORT_URL"</span>{'\n'}
                  mysql <span className="cl-s">"wca_v2_$idle"</span> &lt; wca_export.sql{'\n\n'}
                  <span className="cl-c"># flip the pointer — zero downtime</span>{'\n'}
                  <span className="cl-k">echo</span> <span className="cl-s">"$idle"</span> &gt; protected/config/wcaDb{'\n'}
                  <span className="cl-c"># next request reads wca_v2_$idle</span>
                </code></pre>
              </div>
            </div>
          </section>

          {/* 04 Why */}
          <section className="section" id="why">
            <header className="sec-head">
              <span className="sec-num">04</span>
              <h2 className="sec-title"><L zh="为何重要" en="Why It Matters" /> <code>: WhyItMatters</code></h2>
              <p className="sec-desc"><L
                zh={<>粗饼网的价值不在技术新, 而在<strong>它是中国魔方社区绕不开的一块基础设施</strong>: 报名的唯一入口、成绩的本地镜像、直播的实时链路, 外加整套开源可读。<em>下面 6 条讲它为什么重要, 也诚实标出它的软肋</em>。</>}
                en={<>Cubing China's value isn't novelty — it's that <strong>it's an unavoidable piece of infrastructure for China's cubing community</strong>: the single registration door, the local results mirror, the live-results link, plus a fully-readable open codebase. <em>The six cards below say why it matters — and name its soft spot honestly</em>.</>}
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

          {/* 05 Ecosystem */}
          <section className="section" id="eco">
            <header className="sec-head">
              <span className="sec-num">05</span>
              <h2 className="sec-title"><L zh="生态位" en="Ecosystem" /> <code>: WhereItSits</code></h2>
              <p className="sec-desc"><L
                zh={<>粗饼网不是孤立的: 上游是 <strong>WCA</strong>(数据源 + 治理), 站点本体在 <strong>cubing.com</strong>, 代码在 <strong>GitHub</strong>, 历史记述来自 <strong>Speedsolving Wiki</strong>, 同域姊妹站是 <strong>cuberoot.me</strong>——大家都从同一份 WCA 数据里长出不同的东西。</>}
                en={<>Cubing China doesn't sit alone: upstream is the <strong>WCA</strong> (data + governance), the site itself is <strong>cubing.com</strong>, the code is on <strong>GitHub</strong>, its history is recorded on <strong>Speedsolving Wiki</strong>, and the sibling site is <strong>cuberoot.me</strong> — all growing different things from the same WCA data.</>}
              /></p>
            </header>

            <div className="logo-grid logo-grid-12">
              {ECO.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target={p.href.startsWith('http') ? '_blank' : undefined} rel={p.href.startsWith('http') ? 'noopener' : undefined}>
                  {p.svg}
                  <div className="logo-name">{lang === 'zh' ? p.zhName : p.enName}</div>
                  <div className="logo-note">{lang === 'zh' ? p.zhNote : p.enNote}</div>
                </a>
              ))}
            </div>

            <div className="web-tools">
              <h3 className="web-tools-h"><L zh="构建它的技术栈" en="The stack it's built on" /></h3>
              <div className="web-tools-grid">
                {STACK_TOOLS.map((t, i) => (
                  <div className="web-tool" key={i}>
                    <div className="web-tool-name">{t.name}</div>
                    <div className="web-tool-desc">{lang === 'zh' ? t.zhDesc : t.enDesc}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 06 Open source */}
          <section className="section" id="open">
            <header className="sec-head">
              <span className="sec-num">06</span>
              <h2 className="sec-title"><L zh="开源" en="Open Source" /> <code>: CubingChina/cubingchina</code></h2>
              <p className="sec-desc"><L
                zh={<>一个运营全国赛事的平台把源码整套开出来, 本身就少见。下面是这个仓库的公开数字, 以及一个容易看走眼的细节: <strong>GitHub 按字节把它标成 JavaScript, 但真正的服务端是 PHP</strong>。</>}
                en={<>A platform running a nation's competitions open-sourcing its whole codebase is itself rare. Below are the repo's public numbers, and an easily-misread detail: <strong>GitHub labels it JavaScript by byte count, but the actual server is PHP</strong>.</>}
              /></p>
            </header>

            <div className="spotlight">
              <div className="spotlight-tag">REPO</div>
              <div className="spotlight-grid">
                <div>
                  <h3>CubingChina/cubingchina <span className="spotlight-meta">— <L zh="GPL-2.0 · 十二年维护" en="GPL-2.0 · twelve years maintained" /></span></h3>
                  <p><L
                    zh={<>仓库 <strong>2014-07-18 建立</strong>, 最近提交 <strong>2026-07-16</strong>——立项十二年仍在动。约 <strong>2,626 次提交</strong>、<strong>39 星 / 14 fork</strong>、24 个开放 issue, 默认分支 <code>master</code>。<em>提交高度集中: 一个人写了绝大部分</em>。</>}
                    en={<>Repo <strong>created 2014-07-18</strong>, latest commit <strong>2026-07-16</strong> — twelve years in and still moving. About <strong>2,626 commits</strong>, <strong>39 stars / 14 forks</strong>, 24 open issues, default branch <code>master</code>. <em>Commits are highly concentrated: one person wrote the vast majority</em>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>Baiqiang</strong> — <L zh="董百强 · 2,472 提交 (~94%)" en="董百强 · 2,472 commits (~94%)" /></li>
                    <li><strong>2016WUJI01</strong> — <L zh="130 提交" en="130 commits" /></li>
                    <li><strong>oyyq99999 · guojia99</strong> — <L zh="个位数提交" en="single-digit commits" /></li>
                    <li><strong>License</strong> — GPL-2.0</li>
                    <li><strong><L zh="语言(字节)" en="Language (bytes)" /></strong> — JS 66% · PHP 29%</li>
                    <li><strong><L zh="同组织" en="Same org" /></strong> — cubecomps-checker · cubing-files</li>
                  </ul>
                  <p><L
                    zh={<><strong>为什么标成 JavaScript?</strong> GitHub 按代码字节数猜主语言, 而前端打包产物(Vue 2 + jQuery + 各种 JS)体量大, 把统计压过了后端。<em>但应用的核心——控制器、模型、命令、迁移——是 PHP + Yii 1.1</em>。所以"用 PHP 写的"对后端成立, GitHub 的标签只是字节数的错觉。</>}
                    en={<><strong>Why labelled JavaScript?</strong> GitHub guesses the main language by code bytes, and the bundled front end (Vue 2 + jQuery + assorted JS) is large enough to outweigh the backend. <em>But the app's core — controllers, models, commands, migrations — is PHP + Yii 1.1</em>. So "written in PHP" holds for the backend; GitHub's label is a byte-count illusion.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"># git clone</span>{'\n'}
                    <span className="cl-v">$ </span>git clone \{'\n'}
                    {'    '}github.com/CubingChina/cubingchina{'\n\n'}
                    <span className="cl-c"># framework lives OUTSIDE the repo</span>{'\n'}
                    <span className="cl-v">$ </span>ls ../framework   <span className="cl-c"># Yii 1.1.20</span>{'\n\n'}
                    <span className="cl-c"># PHP deps</span>{'\n'}
                    <span className="cl-v">$ </span>cd protected && composer install{'\n\n'}
                    <span className="cl-c"># front-end build (required)</span>{'\n'}
                    <span className="cl-v">$ </span>cd public/f && npm i && npm run build{'\n\n'}
                    <span className="cl-c"># db + WCA mirror</span>{'\n'}
                    <span className="cl-v">$ </span>./yiic migrate{'\n'}
                    <span className="cl-v">$ </span>bash commands/shell/wca_data_sync.sh
                  </code></pre>
                </div>
              </div>
            </div>
          </section>

          {/* 07 vs WCA / cuberoot */}
          <section className="section" id="vs">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="三方对比" en="Three-way" /> <code>: CubingChina vs WCA vs CubeRoot</code></h2>
              <p className="sec-desc"><L
                zh={<>三个站都围着 WCA 数据转, 但分工不同。<strong>官方 WCA</strong>(<a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener">worldcubeassociation.org</a>)是权威一手数据 + 全球治理; <strong>粗饼网</strong>是中国区赛事运营 + 成绩镜像; <strong>cuberoot.me</strong>(本站)是统计 / 工具 / 训练 / 可视化。三者互补, 不替代。</>}
                en={<>All three orbit WCA data, but divide the work. The <strong>official WCA</strong> (<a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener">worldcubeassociation.org</a>) is authoritative first-party data + global governance; <strong>Cubing China</strong> is China's competition operations + results mirror; <strong>cuberoot.me</strong> (this site) is statistics / tools / training / visualization. Complementary, not competing.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-ts"><L zh="粗饼网 CubingChina" en="CubingChina" /></th>
                  <th className="th-js"><L zh="官方 WCA" en="Official WCA" /></th>
                  <th className="th-sw">cuberoot.me</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="定位" en="Role" />,
                    ts: <L zh="中国区赛事运营 + 成绩镜像" en="China ops + results mirror" />,
                    js: <L zh="全球治理 + 权威数据源" en="Global governance + source of truth" />,
                    sw: <L zh="统计 / 工具 / 训练 / 可视化" en="Stats / tools / training / viz" /> },
                  { k: <L zh="数据来源" en="Data source" />,
                    ts: <L zh={<>WCA 每日导出(离线同步)</>} en={<>WCA daily export (offline sync)</>} />,
                    js: <L zh="一手(比赛录入)" en="First-party (comp entry)" />,
                    sw: <L zh={<>WCA 每日导出(离线构建)</>} en={<>WCA daily export (offline build)</>} /> },
                  { k: <L zh="报名 / 直播" en="Registration / live" />,
                    ts: <L zh={<><strong>是</strong> · 中国比赛入口 + WS 直播</>} en={<><strong>Yes</strong> · China entry + WS live</>} />,
                    js: <L zh="报名框架 · 官方直播另议" en="Registration framework" />,
                    sw: <L zh="否 · 不办赛" en="No · doesn't run comps" /> },
                  { k: <L zh="账号 / 鉴权" en="Accounts / auth" />,
                    ts: <L zh={<>自有账号 + 微信 OAuth</>} en={<>Own accounts + WeChat OAuth</>} />,
                    js: <L zh={<>WCA 账号(OAuth 提供方)</>} en={<>WCA account (OAuth provider)</>} />,
                    sw: <L zh="WCA OAuth 登录" en="WCA OAuth login" /> },
                  { k: <L zh="技术栈" en="Stack" />,
                    ts: <L zh="Yii 1.1 · PHP · MySQL · Redis" en="Yii 1.1 · PHP · MySQL · Redis" />,
                    js: <L zh="Ruby on Rails" en="Ruby on Rails" />,
                    sw: <L zh="Next 16 · React · Hono · PG 13" en="Next 16 · React · Hono · PG 13" /> },
                  { k: <L zh="开源" en="Open source" />,
                    ts: <L zh={<><strong>GPL-2.0</strong> · 全套</>} en={<><strong>GPL-2.0</strong> · whole app</>} />,
                    js: <L zh="是 · GPL" en="Yes · GPL" />,
                    sw: <L zh="自有代码库" en="Own codebase" /> },
                  { k: <L zh="语言" en="Languages" />,
                    ts: <L zh={<>en · zh_cn · zh_tw(现算)</>} en={<>en · zh_cn · zh_tw (generated)</>} />,
                    js: <L zh="多语社区翻译" en="Many, community-translated" />,
                    sw: <L zh="en · zh-Hans" en="en · zh-Hans" /> },
                  { k: <L zh="主维护" en="Maintainers" />,
                    ts: <L zh={<>~94% 一人(董百强)</>} en={<>~94% one person (Baiqiang)</>} />,
                    js: <L zh="WCA 软件团队 (WST)" en="WCA Software Team (WST)" />,
                    sw: <L zh="自有" en="In-house" /> },
                ].map((row, i) => (
                  <tr key={i}>
                    <td>{row.k}</td>
                    <td>{row.ts}</td>
                    <td>{row.js}</td>
                    <td>{row.sw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 08 Outlook */}
          <section className="section" id="future">
            <header className="sec-head">
              <span className="sec-num">08</span>
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheSteadyState</code></h2>
              <p className="sec-desc"><L
                zh={<>粗饼网没有"下一个大动作"式的路线图, 它已经在<strong>稳态</strong>: 栈不换、赛照办、成绩照镜像。看点是收拢到 cubing.com、继续走 WCA 导出镜像、以及"整套开源"本身作为一份公开教材的价值。<em>唯一真正的变量是 bus factor</em>。</>}
                en={<>Cubing China has no "next big move" roadmap — it's already in <strong>steady state</strong>: stack unchanged, comps run, results mirror. The watch-items are consolidating onto cubing.com, staying on the WCA-export mirror, and the value of "whole-app open source" as a public textbook. <em>The one real variable is bus factor</em>.</>}
              /></p>
            </header>

            <div className="future-grid">
              {FUTURE_CARDS.map((c, i) => (
                <div className={`future-card${c.big ? ' big' : ''}`} key={i}>
                  <div className={`future-tag${c.hot ? ' tag-hot' : ''}`}>{c.tag}</div>
                  <h3>{lang === 'zh' ? c.zh.title : c.en.title}</h3>
                  {lang === 'zh' ? c.zh.body : c.en.body}
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-col">
              <h4><L zh="站点" en="The Site" /></h4>
              <ul>
                <li><a href="https://cubing.com" target="_blank" rel="noopener">cubing.com</a></li>
                <li><a href="https://cubingchina.com" target="_blank" rel="noopener">cubingchina.com</a></li>
                <li><a href="https://cubing.com/faq" target="_blank" rel="noopener"><L zh="FAQ · 报名说明" en="FAQ · registration" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="代码" en="Code" /></h4>
              <ul>
                <li><a href="https://github.com/CubingChina/cubingchina" target="_blank" rel="noopener">GitHub · repo</a></li>
                <li><a href="https://github.com/CubingChina" target="_blank" rel="noopener">GitHub · org</a></li>
                <li><a href="https://github.com/CubingChina/cubingchina/blob/master/README.md" target="_blank" rel="noopener">README (en / zh)</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="出处" en="Sources" /></h4>
              <ul>
                <li><a href="https://www.speedsolving.com/wiki/index.php?title=Cubing_China" target="_blank" rel="noopener">Speedsolving Wiki</a></li>
                <li><a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener">worldcubeassociation.org</a></li>
                <li><a href="https://www.worldcubeassociation.org/persons/2008DONG06" target="_blank" rel="noopener">WCA · 2008DONG06</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/language/php"><L zh="PHP — 它的后端语言" en="PHP — its backend language" /></a></li>
                <li><a href="/code/architecture"><L zh="cuberoot.me 自己怎么搭" en="How cuberoot.me is built" /></a></li>
                <li><a href="/wca"><L zh="WCA 统计 — 本站的 WCA 线" en="WCA stats — this site's WCA thread" /></a></li>
                <li><a href="/code"><L zh="← 回 /code" en="← back to /code" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo"><CCLogo /></div>
              <p className="footer-line"><L zh="中文 / English 双语 · 事实截至 2026-07 · 未考据项已标注" en="Bilingual zh / en · facts as of 2026-07 · unverified items flagged" /></p>
              <p className="footer-line dim"><code>{'// 粗饼 = cubing · 谐音 · 社区通用'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
