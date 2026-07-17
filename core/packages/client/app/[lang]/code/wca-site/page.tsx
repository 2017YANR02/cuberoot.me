'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './wca-site_intro.css';

/* Self-contained bilingual helper — this page is a standalone /code umbrella
 * page, so it carries its own tiny Lang context instead of importing the
 * language-section one. */
type Lang = 'zh' | 'en';
const LangCtx = createContext<Lang>('zh');
function L({ zh, en }: { zh: ReactNode; en: ReactNode }) {
  return <>{useContext(LangCtx) === 'zh' ? zh : en}</>;
}

/* The official WCA cube mark, reproduced inline from the repo's own
 * public/files/WCAlogo.svg (the ® glyph dropped for a cleaner render at size).
 * Six twisty-puzzle face colours with the letters W / C / A knocked out in
 * white — recognizable on the light chip the hero/footer place it on. */
function WcaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 265 265" fill="none" role="img" aria-label="World Cube Association">
      <path d="M133.752 30.1771V0.000183228C188.323 -0.0901669 228.077 33.249 246.599 65.4137C223.198 78.9662 220.669 80.5022 220.669 80.5022C203.502 51.2287 170.886 30.5385 133.752 30.1771Z" fill="#FFD313" />
      <path d="M45.7507 182.688V83.3032L131.674 132.905V231.839C102.852 215.666 45.7507 182.688 45.7507 182.688Z" fill="#FFD313" />
      <path d="M221.753 182.598C240.546 148.717 237.564 110.679 221.753 82.3092C221.934 81.7671 239.1 72.2803 247.683 67.2207C274.156 115.739 266.567 165.16 247.683 197.596C237.112 191.723 231.601 188.38 221.663 182.507L221.753 182.598Z" fill="#FF5800" />
      <path d="M17.3809 67.4917L43.4017 82.1284C25.2413 118.72 26.8676 146.367 43.221 182.598L17.2905 197.415C-8.82069 150.433 -1.41198 100.56 17.2905 67.4917H17.3809Z" fill="#C62535" />
      <path d="M133.752 132.996C162.754 116.1 219.404 83.7549 219.404 83.7549C219.042 150.072 219.404 88.0013 219.313 182.779C191.214 199.493 164.832 214.311 133.661 231.929C133.481 211.149 133.661 207.806 133.661 132.996H133.752Z" fill="#C62535" />
      <path d="M18.6458 65.3234C38.7035 29.0026 83.1558 -0.0901403 131.493 0.000209873V30.1772C90.1127 31.6228 61.5621 52.6743 44.4859 80.3215C34.6377 74.6294 29.8492 71.8286 18.6458 65.3234Z" fill="#029347" />
      <path d="M44.3052 184.405C63.3691 216.208 97.0697 234.368 131.493 234.82V264.455C86.3181 264.726 42.1368 240.151 18.3748 199.313L44.3052 184.314V184.405Z" fill="#EEEEEE" />
      <path d="M47.106 81.6764L132.577 32.4355L218.229 81.8571L132.668 131.098L47.0156 81.6764H47.106Z" fill="#0051BA" />
      <path d="M133.662 264.455V234.73C174.41 234.73 208.2 207.263 220.669 184.495C231.872 191 236.028 193.44 246.69 199.493C210.098 262.196 143.058 264.455 133.662 264.455Z" fill="#0051BA" />
      <path d="M112.158 195.428C112.158 189.645 112.158 188.651 111.526 188.019C111.164 187.567 103.485 183.23 94.5399 178.351C76.7409 168.684 75.0243 167.6 72.6752 165.251C70.7477 163.323 69.7237 157.481 69.6032 147.723C69.5129 135.254 69.5129 134.803 70.2357 134.261C71.7717 133.176 71.5006 132.996 93.275 145.103C112.339 155.674 111.345 155.131 111.797 154.409C111.977 154.138 112.158 150.885 112.158 147.271C112.158 141.489 112.158 140.585 111.526 139.862C110.803 138.959 75.6567 119.534 72.8559 118.449C66.441 115.919 62.4656 117.004 60.2972 121.792C59.0323 124.774 58.7612 127.936 58.7612 141.94C58.7612 160.281 59.484 165.07 63.3691 171.666C65.2664 174.828 70.4164 180.068 73.8497 182.327C75.205 183.23 84.1496 188.2 93.8171 193.44C106.556 200.397 111.345 202.836 111.706 202.565C112.068 202.294 112.158 200.397 112.158 195.518V195.428Z" fill="white" />
      <path d="M117.67 108.601C118.483 108.149 119.477 107.427 119.748 106.975C120.019 106.523 123 101.012 126.253 94.7776C129.506 88.5434 132.306 83.3934 132.397 83.3934C132.487 83.3934 135.378 88.6337 138.631 95.0486C142.787 103.09 145.046 107.065 145.859 107.788C148.389 109.956 153.087 110.227 155.888 108.24C157.333 107.246 158.237 105.529 167.904 86.375C173.687 74.9005 178.295 65.3234 178.204 65.0524C178.024 64.6006 176.849 64.5103 171.88 64.5103C168.537 64.5103 165.555 64.6006 165.375 64.7813C165.103 64.962 161.851 71.1962 158.147 78.6952C154.352 86.2846 151.19 92.2477 151.009 92.067C150.828 91.8863 148.118 86.7364 144.955 80.6829C141.793 74.5391 138.812 69.0278 138.269 68.305C135.74 64.8717 129.686 64.7813 126.885 68.1243C126.343 68.7567 123.271 74.4488 119.928 80.7733C116.585 87.0978 113.785 92.3381 113.694 92.3381C113.604 92.3381 110.532 86.375 106.918 79.0566C103.304 71.7383 100.142 65.5041 99.7803 65.1427C99.3286 64.6006 98.5154 64.5103 93.3655 64.5103C90.1129 64.5103 87.2217 64.691 86.9506 64.8717C86.4085 65.2331 89.2997 71.6479 100.593 94.5968C106.647 106.884 107.37 108.059 110.08 109.143C111.978 109.866 115.682 109.595 117.579 108.601H117.67Z" fill="white" />
      <path d="M182.812 124.413C182.541 124.413 182.27 124.413 181.999 124.503C180.553 124.864 178.295 127.033 177.301 129.201C176.849 130.105 172.783 141.489 168.266 154.409C163.748 167.329 158.056 183.411 155.617 190.188C153.177 196.964 151.37 202.656 151.461 202.927C151.732 203.288 154.894 201.662 159.682 198.771L161.941 197.416L165.284 187.658L168.627 177.9L180.644 171.214C187.239 167.51 192.751 164.528 192.931 164.528C193.112 164.528 194.377 166.696 195.913 169.407C197.358 172.117 198.894 174.647 199.256 175.099L199.888 175.912L204.135 173.473C206.484 172.117 208.471 170.762 208.562 170.401C208.562 170.039 204.857 162.631 200.25 153.867C195.642 145.103 190.311 135.074 188.504 131.641C185.342 125.678 184.348 124.232 182.631 124.322L182.812 124.413ZM181.095 142.844C181.637 143.025 187.781 154.409 187.51 154.77C187.33 155.132 176.126 161.275 174.861 161.727C174.319 161.908 174.861 159.83 177.481 152.331C179.288 147 180.915 142.754 181.095 142.844Z" fill="white" />
    </svg>
  );
}

interface HistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

const HISTORY: HistoryItem[] = [
  {
    year: <>1982<small>·06·05</small></>,
    zh: { title: <>第一届世界锦标赛 · 布达佩斯</>, desc: <>1982 年 6 月 5 日, 首届魔方世界锦标赛在<strong>布达佩斯</strong>举行, Minh Thai 以 <strong>22.95 秒</strong>夺冠。这不是 WCA 办的, 但<em>这场比赛的成绩是今天 WCA 数据库里最早的一条</em>——cuberoot.me 的时间轴也以它为第 0 帧。</> },
    en: { title: <>First World Championship · Budapest</>, desc: <>On 5 Jun 1982 the first Rubik's Cube World Championship was held in <strong>Budapest</strong>, won by Minh Thai in <strong>22.95 s</strong>. The WCA didn't run it — but <em>its results are the earliest rows in today's WCA database</em>, and the frame-0 of cuberoot.me's own timeline.</> },
  },
  {
    year: <>2003<small>·08</small></>,
    zh: { title: <>现代赛事重启 · 多伦多</>, desc: <>2003 年 8 月的<strong>多伦多世界锦标赛</strong>(Dan Gosbee 主导)让国际魔方比赛在沉寂二十年后重新启动。这轮复兴直接催生了次年成立的 WCA——<em>WCA 官方成绩即从 2003 这一届算起连续记录</em>。</> },
    en: { title: <>Modern era restarts · Toronto</>, desc: <>The <strong>2003 World Championship in Toronto</strong> (led by Dan Gosbee) restarted international competition after two dormant decades. That revival led straight to the WCA the next year — <em>official WCA results are recorded continuously from this 2003 edition on</em>.</> },
  },
  {
    year: <>2004<small>·10·18</small></>, highlight: true,
    zh: { title: <>WCA 正式成立</>, desc: <>2004 年 10 月 18 日, <strong>Ron van Bruchem</strong>(荷兰)与 <strong>Tyson Mao</strong>(美国)共同创立<strong>世界魔方协会 (WCA)</strong>。宗旨一句话:"<em>更多国家、更多人、更多比赛、更多乐趣, 在公平平等的条件下</em>"。此后 WCA 成为速拧运动的全球治理机构与官方成绩的唯一权威。</> },
    en: { title: <>The WCA is founded</>, desc: <>On 18 Oct 2004 <strong>Ron van Bruchem</strong> (Netherlands) and <strong>Tyson Mao</strong> (USA) founded the <strong>World Cube Association</strong>. Its mission, in one line: "<em>more competitions in more countries with more people and more fun, under fair and equal conditions</em>." The WCA has been the global governing body of speedcubing and the sole authority on official results ever since.</> },
  },
  {
    year: <>2008<small>·02·28</small></>,
    zh: { title: <>网站仓库第一次提交</>, desc: <>代码库最早一条提交是 <strong>2008 年 2 月 28 日</strong>的 "The initial structure import"——一个 <strong>Ruby on Rails</strong> 应用。此后十八年, worldcubeassociation.org 一直是同一个 Rails 单体, 沿着 Rails 版本一路升级过来。<em>组织比代码早四年</em>。</> },
    en: { title: <>First commit to the website repo</>, desc: <>The repo's earliest commit is "The initial structure import" on <strong>28 Feb 2008</strong> — a <strong>Ruby on Rails</strong> app. For eighteen years since, worldcubeassociation.org has been the same Rails monolith, upgraded along the Rails version train. <em>The organization predates the code by four years</em>.</> },
  },
  {
    year: <>React<small>_on_rails</small></>,
    zh: { title: <>交互 UI 进场 · React 挂进 Rails</>, desc: <>随着比赛表单、报名、成绩页越来越复杂, 团队用 <strong>react_on_rails</strong> 把 <strong>React 18 + Semantic UI</strong> 组件当"岛"嵌进 Rails 页面, 由 <strong>Shakapacker</strong>(webpack)打包。<code>app/webpacker/</code> 至今仍是大部分现役交互界面所在。<em>确切起点未在本快照里逐条考据</em>。</> },
    en: { title: <>Interactive UI arrives · React inside Rails</>, desc: <>As forms, registration and results pages grew complex, the team mounted <strong>React 18 + Semantic UI</strong> components as islands inside Rails pages via <strong>react_on_rails</strong>, bundled by <strong>Shakapacker</strong> (webpack). <code>app/webpacker/</code> still holds most of the live interactive UI. <em>The exact start isn't pinned in this snapshot</em>.</> },
  },
  {
    year: <>2017<small>·11·20</small></>,
    zh: { title: <>注册为加州非营利组织</>, desc: <>WCA 于 2017 年推进法人化, <strong>2017 年 11 月 20 日</strong>在美国加利福尼亚州正式登记为<strong>非营利组织</strong>, 总部设于洛杉矶。<em>一个志愿者驱动的社区组织有了正式的法律主体</em>。</> },
    en: { title: <>Incorporated as a California non-profit</>, desc: <>The WCA moved toward incorporation in 2017 and was officially registered as a <strong>non-profit in California, USA on 20 Nov 2017</strong>, headquartered in Los Angeles. <em>A volunteer-driven community body gained a formal legal entity</em>.</> },
  },
  {
    year: <>2025<small>·03·05</small></>,
    zh: { title: <>Next.js 迁移开工</>, desc: <>提交 "Exploration: NextJS" (#9136) 于 <strong>2025 年 3 月 5 日</strong>落地, 仓库里多出一个独立的 <code>next-frontend/</code>——<strong>Next.js + React 19 + Chakra UI 3 + Payload CMS</strong>。它通过一份类型化 API 客户端和 Rails 后端对话。<em>十七年的单体开始把前端解耦出去</em>。</> },
    en: { title: <>The Next.js migration begins</>, desc: <>The commit "Exploration: NextJS" (#9136) landed on <strong>5 Mar 2025</strong>, adding a standalone <code>next-frontend/</code> — <strong>Next.js + React 19 + Chakra UI 3 + Payload CMS</strong>. It talks to the Rails backend through a typed API client. <em>A seventeen-year-old monolith starts decoupling its frontend</em>.</> },
  },
  {
    year: <>2026<small>·06</small></>, highlight: true,
    zh: { title: <>仍在高速开发, cuberoot.me 收录此页</>, desc: <>本地快照里最近一条提交是 <strong>2026 年 6 月 5 日</strong>。仓库累计 <strong>约 16,071 次提交、201 位贡献者</strong>, 由 <strong>WCA 软件团队 (WST)</strong> 领衔。同月 <strong>cuberoot.me</strong> 在 <code>/code</code> 写下这一页, 作为下游数据消费者对它的技术侧写。</> },
    en: { title: <>Still shipping fast — profiled here by cuberoot.me</>, desc: <>The latest commit in this local snapshot is <strong>5 Jun 2026</strong>. The repo has <strong>~16,071 commits from 201 contributors</strong>, led by the <strong>WCA Software Team (WST)</strong>. The same month, <strong>cuberoot.me</strong> wrote this page under <code>/code</code> as a downstream data consumer's technical profile of it.</> },
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
    zh: { title: <>Rails 单体 · 唯一真相源</>, desc: <>核心是一个 <strong>Ruby 3.4.6 + Rails</strong> 单体, 数据落 <strong>MySQL</strong>, 缓存 <strong>Redis</strong>, 队列 <strong>Sidekiq</strong>, 服 <strong>Puma</strong>。它渲染 ERB 视图, 也吐 <code>/api/v0</code> 与 <code>/api/v1</code> 两套 JSON。<em>所有比赛 / 成绩数据的唯一真相都在这里</em>。</> },
    en: { title: <>Rails monolith · source of truth</>, desc: <>The core is one <strong>Ruby 3.4.6 + Rails</strong> monolith over <strong>MySQL</strong>, cached with <strong>Redis</strong>, queued on <strong>Sidekiq</strong>, served by <strong>Puma</strong>. It renders ERB views and serves the <code>/api/v0</code> and <code>/api/v1</code> JSON APIs. <em>The single source of truth for all competition / results data lives here</em>.</> },
    code: (
      <code>
        <span className="cl-c"># domain core — results are sacred</span>{'\n'}
        <span className="cl-type">Competition</span> · <span className="cl-type">Round</span> · <span className="cl-type">Event</span>{'\n'}
        <span className="cl-type">Result</span> · <span className="cl-type">Person</span> · <span className="cl-type">Registration</span>{'\n'}
        <span className="cl-c"># app/models/*.rb</span>
      </code>
    ),
  },
  {
    tag: 'B',
    zh: { title: <>三套代码库 · 迁移进行时</>, desc: <>同一个仓库里住着三样东西: <strong>①Rails 后端 + ERB 遗留前端</strong>; <strong>②<code>app/webpacker/</code></strong> 的 React 18 + Semantic UI(react_on_rails 挂载); <strong>③<code>next-frontend/</code></strong> 独立 Next.js 项目。<em>后端稳如磐石, 前端正从 ②搬向 ③</em>。</> },
    en: { title: <>Three codebases · mid-migration</>, desc: <>One repo houses three things: <strong>①the Rails backend + legacy ERB frontend</strong>; <strong>②<code>app/webpacker/</code></strong> React 18 + Semantic UI (mounted by react_on_rails); <strong>③<code>next-frontend/</code></strong>, a standalone Next.js project. <em>The backend is bedrock; the frontend is moving from ② to ③</em>.</> },
    code: (
      <code>
        <span className="cl-c">// 1. Rails + ERB  (source of truth)</span>{'\n'}
        <span className="cl-c">// 2. app/webpacker (React 18 + SUI)</span>{'\n'}
        <span className="cl-c">// 3. next-frontend (Next + React 19)</span>
      </code>
    ),
  },
  {
    tag: 'C',
    zh: { title: <>成绩校验子系统</>, desc: <>比赛成绩导入时会跑一整套<strong>可组合的校验器</strong>(<code>lib/results_validators/</code>, 约 16 个类), 由 <code>competition_results_import.rb</code> 编排: 项目合法性、纪录一致性、人员归并、地点校验等。<em>历史成绩神圣不可乱动, 这层就是守门人</em>。</> },
    en: { title: <>Results validation subsystem</>, desc: <>When competition results are imported, a set of <strong>composable validators</strong> runs (<code>lib/results_validators/</code>, ~16 classes) orchestrated by <code>competition_results_import.rb</code>: event legality, record consistency, person merging, venue checks. <em>Historical results are sacred; this layer is the gatekeeper</em>.</> },
    code: (
      <code>
        <span className="cl-c"># 16 composable validator classes</span>{'\n'}
        <span className="cl-type">CompetitorsValidator</span>{'\n'}
        <span className="cl-type">ResultsValidator</span> · <span className="cl-type">RecordsValidator</span>{'\n'}
        <span className="cl-c"># run on import → errors + warnings</span>
      </code>
    ),
  },
  {
    tag: 'D',
    zh: { title: <>静态参考数据 = JSON</>, desc: <>项目、格式、国家、大洲、轮次类型这些"字典"不是硬编码, 而是 <code>lib/static_data/</code> 里的 <strong>JSON</strong>(<code>events.json</code> / <code>formats.json</code> / <code>countries.real.json</code> …), 经 <code>concerns/static_data.rb</code> 暴露给模型。<em>要改, 改 JSON, 不改代码里的清单</em>。</> },
    en: { title: <>Static reference data = JSON</>, desc: <>Events, formats, countries, continents and round types aren't hardcoded — they're <strong>JSON</strong> in <code>lib/static_data/</code> (<code>events.json</code> / <code>formats.json</code> / <code>countries.real.json</code> …), exposed to models via <code>concerns/static_data.rb</code>. <em>To change one, edit the JSON, not a list buried in code</em>.</> },
    code: (
      <code>
        <span className="cl-c"># lib/static_data/</span>{'\n'}
        events.json · formats.json{'\n'}
        countries.real.json · continents.json{'\n'}
        round_types.json · available_locales.json
      </code>
    ),
  },
  {
    tag: 'E',
    zh: { title: <>WCA = OAuth 提供方</>, desc: <>登录用 <strong>Devise</strong> + <strong>devise-two-factor</strong>(TOTP 两步验证); 对外则是 <strong>Doorkeeper OAuth + OpenID Connect</strong> 的<strong>提供方</strong>——整个生态(含 cuberoot.me)用"用 WCA 账号登录"。公开 API 版本化在 <code>api/v0</code> 与 <code>api/v1</code>。</> },
    en: { title: <>WCA = the OAuth provider</>, desc: <>Login uses <strong>Devise</strong> + <strong>devise-two-factor</strong> (TOTP 2FA); externally it is a <strong>Doorkeeper OAuth + OpenID Connect provider</strong> — the whole ecosystem (cuberoot.me included) offers "sign in with your WCA account." The public API is versioned under <code>api/v0</code> and <code>api/v1</code>.</> },
    code: (
      <code>
        <span className="cl-c"># it hands out tokens, doesn't consume</span>{'\n'}
        <span className="cl-fn">use_doorkeeper</span> <span className="cl-k">do</span>{'\n'}
        {'  '}<span className="cl-c"># + OpenID Connect</span>{'\n'}
        <span className="cl-k">end</span>
      </code>
    ),
  },
  {
    tag: 'F',
    zh: { title: <>直播成绩 · AnyCable</>, desc: <>现场直播成绩走 <strong>AnyCable / ActionCable</strong> 的 WebSocket(<code>lib/live/</code> + <code>app/channels/</code>), 还带一套 diff 协议增量推送。<em>成绩一录入, 观众端即时更新</em>——这条实时链路是近两年的重点建设。</> },
    en: { title: <>Live results · AnyCable</>, desc: <>Live competition results ride <strong>AnyCable / ActionCable</strong> WebSockets (<code>lib/live/</code> + <code>app/channels/</code>), with a diff protocol for incremental pushes. <em>One result entered, the audience view updates instantly</em> — this real-time link has been a focus of the last two years.</> },
    code: (
      <code>
        <span className="cl-c"># app/channels/*.rb</span>{'\n'}
        <span className="cl-type">LiveResultsChannel</span>{'\n'}
        <span className="cl-c"># AnyCable in prod, diff-protocol push</span>
      </code>
    ),
  },
  {
    tag: 'G',
    zh: { title: <>角色与权限 · 组织结构建模</>, desc: <>WCA 的<strong>代表 (delegates)、团队、委员会、理事会</strong>全部建模在 <code>groups_metadata_*</code> 模型 + 一批 role concern 里, 权限判断逻辑相当庞大。<em>加权限校验前先搜现成 helper, 别自己发明</em>——这是仓库 CLAUDE.md 的原话。</> },
    en: { title: <>Roles &amp; permissions · org modeled</>, desc: <>The WCA's <strong>delegates, teams, committees and councils</strong> are all modeled via <code>groups_metadata_*</code> models plus a set of role concerns; the permission logic is extensive. <em>Search existing role helpers before inventing a check</em> — straight from the repo's own CLAUDE.md.</> },
    code: (
      <code>
        <span className="cl-c"># delegates · teams · committees</span>{'\n'}
        <span className="cl-type">GroupsMetadataDelegateRegions</span>{'\n'}
        <span className="cl-type">GroupsMetadataCouncils</span> · role concerns
      </code>
    ),
  },
  {
    tag: 'H',
    zh: { title: <>后台任务 + 云基建</>, desc: <>后台跑 <strong>Sidekiq + sidekiq-cron</strong>(<code>app/jobs/</code>, 计划在 <code>config/schedule.yml</code>), 生产另用 <strong>Shoryuken</strong> 吃 SQS。缴费走 <strong>Stripe</strong>。基建大量吃 <strong>AWS</strong>(S3 / SQS / RDS / CloudFront), 密钥在 <strong>HashiCorp Vault</strong>, 监控 <strong>New Relic</strong>, 开发用 <strong>Docker Compose</strong> 一键起全栈。</> },
    en: { title: <>Background jobs + cloud infra</>, desc: <>Background work runs on <strong>Sidekiq + sidekiq-cron</strong> (<code>app/jobs/</code>, schedules in <code>config/schedule.yml</code>), with <strong>Shoryuken</strong> consuming SQS in production. Payments via <strong>Stripe</strong>. Infra leans on <strong>AWS</strong> (S3 / SQS / RDS / CloudFront), secrets in <strong>HashiCorp Vault</strong>, monitoring by <strong>New Relic</strong>, dev via a one-command <strong>Docker Compose</strong> stack.</> },
    code: (
      <code>
        <span className="cl-v">$ </span><span className="cl-fn">docker</span> compose up{'\n'}
        <span className="cl-c"># rails + mysql + redis + sidekiq</span>{'\n'}
        <span className="cl-c"># + webpacker + next.js + mailcatcher</span>
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
    zh: { title: <>每一条官方成绩的唯一真相</>, desc: <>从 1982 到今天, 每一场 WCA 比赛的<strong>成绩、排名、纪录</strong>都由这个后端定义与保管。别处能镜像、能重算, 但<strong>权威只有这一份</strong>。<em>仓库把历史成绩数据称作"神圣的", 不容乱动</em>——这是整个速拧世界的账本。</> },
    en: { title: <>The one truth for every official result</>, desc: <>From 1982 to today, every WCA competition's <strong>results, rankings and records</strong> are defined and kept by this backend. Others can mirror or recompute, but <strong>the authority is this one copy</strong>. <em>The repo calls historical results data "sacred"</em> — it's the ledger of the entire speedcubing world.</> },
    code: <><span className="cl-c">// results / rankings / records</span>{'\n'}<span className="cl-c">// authoritative, since 1982</span></>,
  },
  {
    icon: '⇄',
    zh: { title: <>整个生态都建在它的 API 上</>, desc: <>公开 <strong><code>/api/v0</code></strong>、<strong>WCIF</strong> 比赛格式、<strong>WCA OAuth</strong> 三件套, 是所有第三方工具的地基: 报名、编排、直播、统计——包括 cuberoot.me 自己。<em>WCA 定义数据形状, 别人在上面长东西</em>。</> },
    en: { title: <>The whole ecosystem builds on its API</>, desc: <>The public <strong><code>/api/v0</code></strong>, the <strong>WCIF</strong> competition format, and <strong>WCA OAuth</strong> are the foundation every third-party tool stands on: registration, scheduling, live, stats — cuberoot.me included. <em>The WCA defines the shape of the data; everyone else grows on top</em>.</> },
    code: <><span className="cl-c">// /api/v0 · WCIF · WCA OAuth</span>{'\n'}<span className="cl-c">// the shared foundation</span></>,
  },
  {
    icon: '★',
    zh: { title: <>一支团队, 不是一个人</>, desc: <>约 <strong>16,071 次提交、201 位贡献者</strong>, 由 <strong>WCA 软件团队 (WST)</strong> 主导——Jeremy Fleischman、Jonatan Kłosko、Lucas Garron、Stefan Pochmann 等长期投入。<em>和很多单人维护的社区站不同, WCA 官网没有明显的 bus factor</em>。</> },
    en: { title: <>A team, not one person</>, desc: <>About <strong>16,071 commits from 201 contributors</strong>, led by the <strong>WCA Software Team (WST)</strong> — Jeremy Fleischman, Jonatan Kłosko, Lucas Garron, Stefan Pochmann and others sustained over years. <em>Unlike many one-person community sites, the WCA site has no obvious bus factor</em>.</> },
    code: <><span className="cl-c">// jfly · Jonatan Kłosko · lgarron</span>{'\n'}<span className="cl-c">// WST + 200 contributors</span></>,
  },
  {
    icon: '⌥',
    zh: { title: <>整站 GPL-3.0 开源</>, desc: <>"所有跑在 worldcubeassociation.org 上的代码"整套开在 <strong>GPL-3.0</strong> 下, 配 <a href="https://docs.worldcubeassociation.org/" target="_blank" rel="noopener">docs.worldcubeassociation.org</a> 讲清整个软件生态。<em>"一个全球赛事平台怎么搭"有一份公开、可跑、可学的答案</em>。</> },
    en: { title: <>The whole site is GPL-3.0</>, desc: <>"All of the code that runs on worldcubeassociation.org" is open under <strong>GPL-3.0</strong>, with <a href="https://docs.worldcubeassociation.org/" target="_blank" rel="noopener">docs.worldcubeassociation.org</a> documenting the whole software ecosystem. <em>"How do you build a global competition platform" has a public, runnable, learnable answer</em>.</> },
    code: <><span className="cl-c">// github.com/thewca/</span>{'\n'}<span className="cl-c">//   worldcubeassociation.org · GPL-3.0</span></>,
  },
  {
    icon: '§',
    zh: { title: <>它同时是标准的定义者</>, desc: <>WCA 不只是站点, 还是<strong>规则 (Regulations)</strong> 与 <strong>WCIF</strong> 数据格式的制定者。项目怎么算、纪录怎么判、比赛数据长什么样——<em>整个行业照它的定义走</em>。代码里的 <code>lib/static_data/</code> 与校验器就是这些标准的可执行版本。</> },
    en: { title: <>It also defines the standards</>, desc: <>The WCA isn't only a site — it authors the <strong>Regulations</strong> and the <strong>WCIF</strong> data format. How events score, how records are judged, what competition data looks like — <em>the whole field follows its definitions</em>. The <code>lib/static_data/</code> files and validators are the executable form of those standards.</> },
    code: <><span className="cl-c">// Regulations + WCIF</span>{'\n'}<span className="cl-c">// the domain everyone else follows</span></>,
  },
  {
    icon: '⛁',
    zh: { title: <>每日数据导出喂养下游</>, desc: <>后端每天发布一份<strong>完整成绩导出</strong>(<code>lib/database_dumper.rb</code>), 让任何人离线构建统计而不冲击生产库。cuberoot.me 的全部 WCA 统计、以及非官方 REST API, 都从这份导出长出来。<em>开放数据把生态的天花板抬高了</em>。</> },
    en: { title: <>A daily export feeds downstream</>, desc: <>The backend publishes a full <strong>results export daily</strong> (<code>lib/database_dumper.rb</code>) so anyone can build stats offline without hitting production. Every WCA stat on cuberoot.me — and the unofficial REST API — grows from that export. <em>Open data raises the ceiling for the whole ecosystem</em>.</> },
    code: <><span className="cl-c">// daily full results export</span>{'\n'}<span className="cl-c">// → stats, mirrors, the REST API</span></>,
  },
];

interface EcoItem {
  href: string;
  highlight?: boolean;
  internal?: boolean;
  zhName: string;
  enName: string;
  zhNote: string;
  enNote: string;
  svg: ReactNode;
}

const ECO: EcoItem[] = [
  {
    href: 'https://www.worldcubeassociation.org', highlight: true,
    zhName: 'worldcubeassociation.org', enName: 'worldcubeassociation.org',
    zhNote: '站点本体 · 唯一真相源', enNote: 'the site itself · source of truth',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0051BA"/><path d="M50 20 L78 36 L50 52 L22 36 Z" fill="#FFD313"/><path d="M22 36 L50 52 L50 82 L22 66 Z" fill="#029347"/><path d="M78 36 L50 52 L50 82 L78 66 Z" fill="#C62535"/></svg>,
  },
  {
    href: 'https://github.com/thewca/worldcubeassociation.org',
    zhName: 'GitHub 仓库', enName: 'GitHub repo',
    zhNote: 'thewca/worldcubeassociation.org · GPL-3.0', enNote: 'thewca/… · GPL-3.0',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1B1F24"/><path d="M50 22 C34 22 22 34 22 50 c0 12 8 22 19 26 1 0 2-1 2-2v-6 c-8 2-10-3-10-3 -1-3-3-4-3-4 -3-2 0-2 0-2 3 0 4 3 4 3 3 4 7 3 9 2 0-2 1-3 2-4 -7-1-13-3-13-14 0-3 1-6 3-8 0-1-1-4 0-8 0 0 3-1 8 3 5-1 10-1 15 0 5-4 8-3 8-3 1 4 0 7 0 8 2 2 3 5 3 8 0 11-7 13-14 14 1 1 2 3 2 6v9 c0 1 1 2 2 2 11-4 19-14 19-26 0-16-12-28-28-28Z" fill="#fff"/></svg>,
  },
  {
    href: 'https://docs.worldcubeassociation.org/',
    zhName: 'WCA Docs', enName: 'WCA Docs',
    zhNote: '软件生态总览 + 开发文档', enNote: 'software ecosystem + dev docs',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#1E3A6E"/><rect x="30" y="26" width="40" height="48" rx="4" fill="#fff"/><rect x="37" y="36" width="26" height="4" rx="2" fill="#1E3A6E"/><rect x="37" y="46" width="26" height="4" rx="2" fill="#1E3A6E"/><rect x="37" y="56" width="18" height="4" rx="2" fill="#1E3A6E"/></svg>,
  },
  {
    href: '/code/wca-export', internal: true,
    zhName: 'WST 数据导出', enName: 'WST Export',
    zhNote: '每日成绩快照 · 本站另有一页', enNote: 'daily results dump · own page here',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#2A3F66"/><ellipse cx="50" cy="34" rx="24" ry="9" fill="none" stroke="#8FB4FF" strokeWidth="4"/><path d="M26 34 v32 c0 5 11 9 24 9 s24-4 24-9 V34" fill="none" stroke="#8FB4FF" strokeWidth="4"/><path d="M26 50 c0 5 11 9 24 9 s24-4 24-9" fill="none" stroke="#8FB4FF" strokeWidth="4"/></svg>,
  },
  {
    href: '/code/wcif', internal: true,
    zhName: 'WCIF', enName: 'WCIF',
    zhNote: '比赛交换格式 · 本站另有一页', enNote: 'competition format · own page here',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#22345C"/><path d="M50 22 L74 36 L74 64 L50 78 L26 64 L26 36 Z" fill="none" stroke="#7FA8F0" strokeWidth="4" strokeLinejoin="round"/><text x="50" y="57" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="system-ui, sans-serif" fill="#7FA8F0">{ }</text></svg>,
  },
  {
    href: '/code/wca-rest-api', internal: true,
    zhName: '非官方 REST API', enName: 'Unofficial REST API',
    zhNote: 'Robin Ingelbrecht · 本站另有一页', enNote: 'R. Ingelbrecht · own page here',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#123E36"/><path d="M40 34 L26 50 L40 66" fill="none" stroke="#42C79A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><path d="M60 34 L74 50 L60 66" fill="none" stroke="#42C79A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    href: '/code/cubingchina', internal: true,
    zhName: '粗饼网 CubingChina', enName: 'CubingChina',
    zhNote: '下游镜像 · 本站另有一页', enNote: 'downstream mirror · own page here',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#E23B3B"/><path d="M50 18 L80 34 L50 50 L20 34 Z" fill="#fff" opacity=".95"/><path d="M20 34 L50 50 L50 82 L20 66 Z" fill="#fff" opacity=".55"/><path d="M80 34 L50 50 L50 82 L80 66 Z" fill="#fff" opacity=".78"/></svg>,
  },
  {
    href: '/code', highlight: true, internal: true,
    zhName: 'cuberoot.me', enName: 'cuberoot.me',
    zhNote: '本站 · 统计 / 工具 / 训练', enNote: 'this site · stats / tools / training',
    svg: <svg viewBox="0 0 100 100" className="logo-svg"><rect width="100" height="100" rx="14" fill="#0E0A0B"/><text x="50" y="47" textAnchor="middle" fontSize="30" fontWeight="800" fontFamily="Georgia, serif" fill="#FF6E68">³√</text><text x="50" y="74" textAnchor="middle" fontSize="15" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#CBB8B9">root</text></svg>,
  },
];

interface ToolItem { name: string; zhDesc: string; enDesc: string }
const STACK_TOOLS: ToolItem[] = [
  { name: 'Ruby on Rails',   zhDesc: '后端单体框架',              enDesc: 'the backend monolith' },
  { name: 'Ruby 3.4.6',      zhDesc: '.ruby-version 钉死',        enDesc: 'pinned in .ruby-version' },
  { name: 'MySQL',           zhDesc: '主数据库 · mysql2',         enDesc: 'primary DB · mysql2' },
  { name: 'Redis + Sidekiq', zhDesc: '缓存 + 后台任务',           enDesc: 'cache + background jobs' },
  { name: 'Puma',            zhDesc: 'app server',                enDesc: 'app server' },
  { name: 'Devise + 2FA',    zhDesc: '账号 · TOTP 两步验证',      enDesc: 'accounts · TOTP 2FA' },
  { name: 'Doorkeeper',      zhDesc: 'OAuth + OpenID Connect 提供方', enDesc: 'OAuth + OIDC provider' },
  { name: 'react_on_rails',  zhDesc: 'React 挂进 Rails 页面',     enDesc: 'React islands in Rails' },
  { name: 'Semantic UI',     zhDesc: '遗留前端组件库',            enDesc: 'legacy front-end UI kit' },
  { name: 'Shakapacker',     zhDesc: 'webpack 打包 app/webpacker', enDesc: 'webpack for app/webpacker' },
  { name: 'Next.js 16',      zhDesc: '新前端 · App Router',       enDesc: 'new frontend · App Router' },
  { name: 'React 19 + Chakra 3', zhDesc: '新前端 UI',             enDesc: 'new frontend UI' },
  { name: 'Payload CMS',     zhDesc: '新前端内容管理',            enDesc: 'CMS in the new frontend' },
  { name: 'next-auth',       zhDesc: 'Auth.js · 接 WCA OAuth',    enDesc: 'Auth.js · wraps WCA OAuth' },
  { name: 'openapi-fetch',   zhDesc: '类型化 API 客户端 (wcaCore.yaml)', enDesc: 'typed client from wcaCore.yaml' },
  { name: 'AnyCable',        zhDesc: 'WebSocket 直播成绩',         enDesc: 'WebSocket live results' },
  { name: 'Stripe',          zhDesc: '在线缴费',                  enDesc: 'online payments' },
  { name: 'AWS',             zhDesc: 'S3 / SQS / RDS / CloudFront', enDesc: 'S3 / SQS / RDS / CloudFront' },
  { name: 'HashiCorp Vault', zhDesc: '密钥管理',                  enDesc: 'secrets management' },
  { name: 'New Relic',       zhDesc: '生产监控',                  enDesc: 'production monitoring' },
  { name: 'RSpec + Playwright', zhDesc: '测试 · 单元 + 浏览器',   enDesc: 'tests · unit + browser' },
  { name: 'Docker Compose',  zhDesc: '本地一键起全栈',            enDesc: 'one-command dev stack' },
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
    tag: <>HOT · 2025→</>, hot: true, big: true,
    zh: {
      title: <>把一个 2008 年的单体, 拆出一个 Next.js 前端</>,
      body: (<>
        <p>2025 年 3 月起, WCA 官网最大的工程动作就是这件事: <strong>后端 Rails 单体继续当唯一真相源, 前端逐步搬进独立的 <code>next-frontend/</code></strong>(Next.js + React 19 + Chakra UI 3 + Payload CMS)。两边通过一份从 <code>openapi/wcaCore.yaml</code> 生成的<strong>类型化 API 客户端</strong>对话——契约漂了, <code>yarn types:openapi</code> 就得重跑。</p>
        <p>这是一次<strong>典型的"绞杀者"式迁移</strong>: 不推倒重来, 而是让新前端一块块接管 <code>app/webpacker/</code> 的老 React。有意思的是, <strong>cuberoot.me 走的正是新前端同款栈</strong>(Next.js + React 19), 所以这条迁移路我们格外能共情。</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label"><L zh="遗留前端" en="Legacy frontend" /></span><span className="bar-val">app/webpacker · React 18 + SUI</span></div>
          <div className="bar bar-new"><span className="bar-label"><L zh="新前端" en="New frontend" /></span><span className="bar-val">next-frontend · React 19 + Chakra</span></div>
        </div>
      </>),
    },
    en: {
      title: <>Carving a Next.js frontend out of a 2008 monolith</>,
      body: (<>
        <p>Since March 2025 the site's biggest engineering effort is exactly this: <strong>the Rails backend stays the source of truth while the frontend moves piece by piece into a standalone <code>next-frontend/</code></strong> (Next.js + React 19 + Chakra UI 3 + Payload CMS). The two talk through a <strong>typed API client</strong> generated from <code>openapi/wcaCore.yaml</code> — drift the contract and <code>yarn types:openapi</code> has to be re-run.</p>
        <p>It's a <strong>textbook "strangler-fig" migration</strong>: not a rewrite, but the new frontend taking over <code>app/webpacker/</code>'s old React one screen at a time. Notably, <strong>cuberoot.me runs the very same stack the new frontend targets</strong> (Next.js + React 19) — so we feel this migration keenly.</p>
        <div className="bar-compare">
          <div className="bar bar-old"><span className="bar-label">Legacy frontend</span><span className="bar-val">app/webpacker · React 18 + SUI</span></div>
          <div className="bar bar-new"><span className="bar-label">New frontend</span><span className="bar-val">next-frontend · React 19 + Chakra</span></div>
        </div>
      </>),
    },
  },
  {
    tag: 'CMS',
    zh: { title: <>Payload CMS 接管内容</>, body: <><p>新前端引入 <strong>Payload CMS</strong>(自带 collections / blocks / 富文本), 把过去散在 Rails 里的静态内容与页面块交给一个正经的内容层管理。<em>编辑和开发解耦, 是这次前端重构顺带收下的红利</em>。</p></> },
    en: { title: <>Payload CMS takes over content</>, body: <><p>The new frontend brings in <strong>Payload CMS</strong> (collections / blocks / rich text), handing content and page blocks that used to be scattered in Rails to a proper content layer. <em>Decoupling editors from developers is a bonus the frontend rebuild picks up along the way</em>.</p></> },
  },
  {
    tag: 'CONTRACT',
    zh: { title: <>类型化 API 作迁移骨架</>, body: <><p>Rails 与 Next 之间那份 <code>wcaCore.yaml</code> OpenAPI 规格, 是整场迁移的<strong>骨架</strong>: 它既生成 TypeScript 客户端, 也生成 <code>public/api.html</code> 文档。<em>API 契约成了单一事实来源, 前后端各自演进而不撕裂</em>。</p></> },
    en: { title: <>A typed API as the migration spine</>, body: <><p>The <code>wcaCore.yaml</code> OpenAPI spec between Rails and Next is the <strong>spine</strong> of the whole migration: it generates both the TypeScript client and the <code>public/api.html</code> docs. <em>The API contract becomes the single source of truth, letting front and back evolve without tearing</em>.</p></> },
  },
  {
    tag: 'STEADY',
    zh: { title: <>治理稳态: 成绩不动, 规则慢改</>, body: <><p>不管前端怎么翻新, 有两样东西是稳态: <strong>历史成绩神圣不可变</strong>, <strong>规则与 WCIF 只缓慢演进</strong>。<em>这是治理机构该有的样子——底层账本稳如磐石, 上层体验持续迭代</em>。</p></> },
    en: { title: <>Steady governance: results fixed, rules slow</>, body: <><p>However the frontend is renewed, two things stay in steady state: <strong>historical results are sacred and immutable</strong>, and <strong>the Regulations and WCIF evolve only slowly</strong>. <em>That's what a governing body should look like — a bedrock ledger underneath, a continuously iterated experience on top</em>.</p></> },
  },
];

export default function WcaSiteIntroPage() {
  const { i18n } = useTranslation();
  const isZhLang = i18n.language.startsWith('zh');
  const lang: Lang = isZhLang ? 'zh' : 'en';
  const rootRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(
    'WorldCubeAssociation.org : WCA 官网源码 — 2008 年起的 Rails 单体, 正迁往 Next.js',
    'WorldCubeAssociation.org : the WCA\'s codebase — a Rails monolith since 2008, migrating to Next.js'
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
      <div ref={rootRef} className="wca-intro-root">
        <div className="grid-bg" />
        <div className="glow glow-tl" />
        <div className="glow glow-br" />

        <nav className="nav">
          <a className="nav-logo" href="#top">
            <WcaLogo className="nav-logo-mark" />
            <span><L zh="WCA 官网" en="WCA Website" /></span>
            <span className="nav-tag"><L zh=": 技术侧写" en=": Profile" /></span>
          </a>
          <ul className="nav-links">
            <li><a href="#what"><L zh="何为" en="What" /></a></li>
            <li><a href="#history"><L zh="来路" en="History" /></a></li>
            <li><a href="#arch"><L zh="架构" en="Architecture" /></a></li>
            <li><a href="#why"><L zh="为何" en="Why" /></a></li>
            <li><a href="#eco"><L zh="生态" en="Ecosystem" /></a></li>
            <li><a href="#open"><L zh="开源" en="Open Source" /></a></li>
            <li><a href="#fe"><L zh="三前端" en="Frontends" /></a></li>
            <li><a href="#future"><L zh="前景" en="Outlook" /></a></li>
          </ul>
        </nav>

        <main id="top">
          {/* Hero */}
          <section className="hero">
            <div className="hero-tag">// 1982 Budapest · WCA est. 2004 · Rails since 2008 · Ruby 3.4 · GPL-3.0 · migrating to Next.js</div>
            <h1 className="hero-title">
              <span className="hero-name"><L zh="WCA 官网" en="WCA Website" /></span>
              <span className="hero-colon">:</span>
              <span className="hero-type">SourceOfTruth</span>
            </h1>
            <p className="hero-sub">
              <L
                zh={<>worldcubeassociation.org 是<strong>世界魔方协会</strong>的官网, 也是速拧运动<strong>官方成绩 / 排名 / 纪录的唯一真相源</strong>。它是一个 <strong>2008 年起的 Ruby on Rails 单体</strong>, 整站在 <strong>GPL-3.0</strong> 下开源, 由 <strong>WCA 软件团队 (WST)</strong> 领着 200 多位贡献者维护, 现正把前端<strong>迁往独立的 Next.js 应用</strong>。本页是下游数据消费者 cuberoot.me 对它的技术侧写。</>}
                en={<>worldcubeassociation.org is the site of the <strong>World Cube Association</strong> and the <strong>single source of truth for official speedcubing results / rankings / records</strong>. It's a <strong>Ruby on Rails monolith since 2008</strong>, fully open under <strong>GPL-3.0</strong>, maintained by the <strong>WCA Software Team (WST)</strong> and 200+ contributors, now <strong>migrating its frontend to a standalone Next.js app</strong>. This page is downstream consumer cuberoot.me's technical profile of it.</>}
              />
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-num">2004<small></small></span>
                <span className="stat-label"><L zh={<>WCA 成立<br /><em>Ron van Bruchem · Tyson Mao</em></>} en={<>WCA founded<br /><em>van Bruchem · Mao</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">GPL<small>-3.0</small></span>
                <span className="stat-label"><L zh={<>整站开源<br /><em>~16k commits</em></>} en={<>whole site open<br /><em>~16k commits</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">201<small></small></span>
                <span className="stat-label"><L zh={<>贡献者 · WST 领衔<br /><em>非单人 bus factor</em></>} en={<>contributors · WST-led<br /><em>no bus factor</em></>} /></span>
              </div>
              <div className="stat">
                <span className="stat-num">Rails<small></small></span>
                <span className="stat-label"><L zh={<>Ruby 3.4 · MySQL · Redis<br /><em>Sidekiq · 迁往 Next.js</em></>} en={<>Ruby 3.4 · MySQL · Redis<br /><em>Sidekiq · → Next.js</em></>} /></span>
              </div>
            </div>
            <div className="hero-cube">
              <WcaLogo />
            </div>
            <div className="hero-floats">
              <span className="float f1">results</span>
              <span className="float f2">rankings</span>
              <span className="float f3">/api/v0</span>
              <span className="float f4">WCIF</span>
              <span className="float f5">WCA OAuth</span>
              <span className="float f6">Sidekiq</span>
              <span className="float f7">AnyCable</span>
              <span className="float f8">Doorkeeper</span>
              <span className="float f9">Payload CMS</span>
              <span className="float f10">Chakra UI</span>
              <span className="float f11">react_on_rails</span>
              <span className="float f12">RSpec · Playwright</span>
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
              <h2 className="sec-title"><L zh="何为" en="What is" /> <code>the WCA site</code></h2>
              <p className="sec-desc">
                <L
                  zh={<>先分清两件事: <strong>WCA</strong> 是 2004 年由 Ron van Bruchem 与 Tyson Mao 创立的<strong>速拧运动全球治理机构</strong>(宗旨"更多国家、更多人、更多比赛、更多乐趣, 在公平平等的条件下"); <strong>worldcubeassociation.org</strong> 则是它的官网代码, 从 2008 年起就是一个 Rails 单体。<em>组织管治理与规则, 网站管数据与运营</em>。</>}
                  en={<>First, two things: the <strong>WCA</strong> is the <strong>global governing body of speedcubing</strong>, founded 2004 by Ron van Bruchem and Tyson Mao (mission: "more competitions in more countries with more people and more fun, under fair and equal conditions"); <strong>worldcubeassociation.org</strong> is its website's code, a Rails monolith since 2008. <em>The org handles governance and rules; the site handles data and operations</em>.</>}
                />
              </p>
            </header>

            <div className="def-grid">
              {[
                { h: <L zh="成绩 = 唯一真相源" en="Results = source of truth" />, tag: 'data', p: <L zh={<>1982 至今每一场比赛的<strong>成绩 / 排名 / 纪录</strong>都由它定义与保管。<em>历史数据被当作神圣的, 只增不改</em>。</>} en={<>Every comp's <strong>results / rankings / records</strong> since 1982 are defined and kept here. <em>Historical data is treated as sacred — appended, not rewritten</em>.</>} /> },
                { h: <L zh="比赛 = 运营中枢" en="Competitions = the hub" />, tag: 'operations', p: <L zh={<>代表与主办方在站上<strong>建赛、审批、导入成绩</strong>, 选手<strong>报名、缴费</strong>。<em>全球比赛的运营流程都过这里</em>。</>} en={<>Delegates and organizers <strong>create comps, approve, import results</strong>; competitors <strong>register and pay</strong>. <em>The world's competition operations flow through here</em>.</>} /> },
                { h: <L zh="规则 = 标准定义者" en="Rules = the standard" />, tag: 'governance', p: <L zh={<>WCA 制定<strong>规则 (Regulations)</strong> 与 <strong>WCIF</strong> 格式, 项目怎么算、纪录怎么判都以它为准。<em>整个行业照它走</em>。</>} en={<>The WCA authors the <strong>Regulations</strong> and <strong>WCIF</strong> format; how events score and records are judged follow it. <em>The whole field aligns to it</em>.</>} /> },
                { h: <L zh="开源 = 全套可读" en="Open = fully readable" />, tag: 'GPL-3.0', p: <L zh={<>"所有跑在官网上的代码"整套在 <strong>GPL-3.0</strong> 下, 配 <code>docs.worldcubeassociation.org</code>。<em>这也是本页能写出来的原因</em>。</>} en={<>"All the code that runs the site" is <strong>GPL-3.0</strong>, with <code>docs.worldcubeassociation.org</code>. <em>Which is why this page can exist at all</em>.</>} /> },
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
                zh={<>时间线分两条脉络: <strong>组织</strong>(1982 布达佩斯 → 2003 多伦多重启 → 2004 成立 → 2017 加州非营利)与<strong>代码</strong>(2008 首次提交 → React 进场 → 2025 Next.js 迁移)。<em>带具体日期的都可考据, React 那条起点标注为未逐条考据</em>。</>}
                en={<>Two threads: the <strong>organization</strong> (1982 Budapest → 2003 Toronto restart → 2004 founding → 2017 CA non-profit) and the <strong>code</strong> (2008 first commit → React arrives → 2025 Next.js migration). <em>Dated nodes are verifiable; the React node is flagged as not individually pinned</em>.</>}
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
                zh={<>下面 8 张卡是这套平台的骨架: Rails 单体、三套代码库、成绩校验、静态 JSON 数据、OAuth 提供方、AnyCable 直播、角色权限、后台任务 + 云基建。<em>技术细节来自对仓库源码与其自带 CLAUDE.md 的通读</em>。</>}
                en={<>The eight cards below are the platform's skeleton: the Rails monolith, three codebases, results validation, static JSON data, the OAuth provider, AnyCable live results, roles &amp; permissions, and background jobs + cloud infra. <em>Details come from reading the repo source and its own CLAUDE.md</em>.</>}
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
                <h3><L zh={<>为什么一个 2008 年的单体还这么能打?</>} en={<>Why does a 2008 monolith still hold up?</>} /></h3>
                <p><L
                  zh={<>因为它<strong>解决的问题边界极清晰</strong>: 记录成绩、办比赛、定规则。这些需求稳定了几十年, 底层账本几乎不变。Rails 单体让<strong>领域模型、校验、后台任务、API 集中在一处</strong>, 迭代成本低; 真正在变的是<strong>前端体验</strong>——于是团队只把前端解耦出去, 而不动那块稳如磐石的后端。<em>该稳的稳住, 该新的才新</em>。</>}
                  en={<>Because the <strong>problem it solves is sharply bounded</strong>: record results, run comps, set rules. Those needs have been stable for decades, and the underlying ledger barely changes. A Rails monolith keeps <strong>domain models, validation, jobs and the API in one place</strong>, cheap to iterate; what actually changes is the <strong>frontend experience</strong> — so the team decouples only the frontend and leaves the bedrock backend alone. <em>Keep stable what should be stable; renew only what should be new</em>.</>}
                /></p>
                <p className="ts-callout-quote">"<em><L
                  zh={<>把每一场比赛的成绩准确、永久地记下来的系统, 就是好系统——哪怕它的地基是十八年前的 Rails。</>}
                  en={<>A system that records every competition's results accurately and permanently is a good system — even if its foundation is eighteen-year-old Rails.</>}
                /></em>"</p>
              </div>
            </div>

            <div className="compare">
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-warn" /><span className="filename">app/models/result.rb</span><span className="lang-tag js">Rails</span></div>
                <pre className="code"><code>
                  <span className="cl-c"># frozen_string_literal: true</span>{'\n'}
                  <span className="cl-k">class</span> <span className="cl-type">Result</span> &lt; <span className="cl-type">ApplicationRecord</span>{'\n'}
                  {'  '}<span className="cl-fn">belongs_to</span> <span className="cl-s">:competition</span>{'\n'}
                  {'  '}<span className="cl-fn">belongs_to</span> <span className="cl-s">:person</span>{'\n\n'}
                  {'  '}<span className="cl-c"># DNF = -1, DNS = -2, else centiseconds</span>{'\n'}
                  {'  '}<span className="cl-k">def</span> <span className="cl-fn">to_solve_time</span>(attr){'\n'}
                  {'    '}<span className="cl-type">SolveTime</span>.<span className="cl-fn">new</span>(event_id, attr, <span className="cl-fn">send</span>(attr)){'\n'}
                  {'  '}<span className="cl-k">end</span>{'\n'}
                  {'  '}<span className="cl-c"># historical data is sacred — append only</span>{'\n'}
                  <span className="cl-k">end</span>
                </code></pre>
              </div>
              <div className="compare-col">
                <div className="compare-h"><span className="dot dot-ok" /><span className="filename">next-frontend/src/lib/api.ts</span><span className="lang-tag ts">Next.js</span></div>
                <pre className="code"><code>
                  <span className="cl-c">// typed client generated from wcaCore.yaml</span>{'\n'}
                  <span className="cl-k">import</span> createClient <span className="cl-k">from</span> <span className="cl-s">"openapi-fetch"</span>;{'\n'}
                  <span className="cl-k">import type</span> {'{ '}paths{' }'} <span className="cl-k">from</span> <span className="cl-s">"@/types/openapi"</span>;{'\n\n'}
                  <span className="cl-k">const</span> <span className="cl-v">api</span> = <span className="cl-fn">createClient</span>&lt;paths&gt;({'{'}{'\n'}
                  {'  '}baseUrl: <span className="cl-v">process</span>.env.WCA_API,{'\n'}
                  {'}'});{'\n\n'}
                  <span className="cl-k">const</span> {'{ '}data{' }'} = <span className="cl-k">await</span> <span className="cl-v">api</span>.<span className="cl-fn">GET</span>(<span className="cl-s">"/api/v0/competitions/{'{id}'}"</span>);
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
                zh={<>WCA 官网重要, 不在技术新, 而在它是<strong>整个速拧世界的地基</strong>: 官方成绩的唯一真相、生态的公共 API、标准的定义者、开放数据的源头, 还由一支团队而非一个人维护。<em>下面 6 条讲它为什么是基础设施</em>。</>}
                en={<>The WCA site matters not for novelty but because it's <strong>the foundation of the whole speedcubing world</strong>: the one truth for official results, the ecosystem's public API, the definer of standards, the source of open data — and maintained by a team, not one person. <em>The six cards below say why it's infrastructure</em>.</>}
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
                zh={<>WCA 官网是<strong>上游</strong>, 一整圈东西长在它下面: <strong>GitHub</strong> 仓库、<strong>Docs</strong> 生态总览、每日<strong>数据导出</strong>、<strong>WCIF</strong> 格式、<strong>非官方 REST API</strong>、下游镜像<strong>粗饼网</strong>, 以及本站 <strong>cuberoot.me</strong>。带"本站另有一页"的可点进 <code>/code</code> 里的对应专页。</>}
                en={<>The WCA site is <strong>upstream</strong>, with a whole ring growing beneath it: the <strong>GitHub</strong> repo, the <strong>Docs</strong> ecosystem overview, the daily <strong>data export</strong>, the <strong>WCIF</strong> format, the <strong>unofficial REST API</strong>, downstream mirror <strong>CubingChina</strong>, and this site <strong>cuberoot.me</strong>. Cards marked "own page here" link to the matching page under <code>/code</code>.</>}
              /></p>
            </header>

            <div className="logo-grid logo-grid-12">
              {ECO.map((p, i) => (
                <a key={i} className={`logo-card${p.highlight ? ' highlight' : ''}`} href={p.href} target={p.internal ? undefined : '_blank'} rel={p.internal ? undefined : 'noopener'}>
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
              <h2 className="sec-title"><L zh="开源" en="Open Source" /> <code>: thewca/worldcubeassociation.org</code></h2>
              <p className="sec-desc"><L
                zh={<>一个全球治理机构把运营官网的<strong>整套代码</strong>公开出来, 本身就是罕见的透明。下面是这个仓库的公开数字, 以及它和很多社区站最不一样的一点: <strong>贡献高度分散, 是一支团队而非一个人</strong>。</>}
                en={<>A global governing body open-sourcing the <strong>entire codebase</strong> that runs its official site is itself rare transparency. Below are the repo's public numbers, and the way it differs most from many community sites: <strong>contribution is broadly distributed — a team, not one person</strong>.</>}
              /></p>
            </header>

            <div className="spotlight">
              <div className="spotlight-tag">REPO</div>
              <div className="spotlight-grid">
                <div>
                  <h3>thewca/worldcubeassociation.org <span className="spotlight-meta">— <L zh="GPL-3.0 · 十八年维护" en="GPL-3.0 · eighteen years maintained" /></span></h3>
                  <p><L
                    zh={<>仓库首次提交 <strong>2008-02-28</strong>, 本地快照最近提交 <strong>2026-06-05</strong>。累计约 <strong>16,071 次提交、201 位贡献者</strong>, 默认分支 <code>main</code>, 带 <strong>Coveralls</strong> 覆盖率与 CI。<em>依赖更新高度自动化(dependabot 提交量居首), 人类提交由 WST 分担</em>。</>}
                    en={<>First commit <strong>2008-02-28</strong>, latest in this snapshot <strong>2026-06-05</strong>. About <strong>16,071 commits from 201 contributors</strong>, default branch <code>main</code>, with <strong>Coveralls</strong> coverage and CI. <em>Dependency updates are heavily automated (dependabot leads commit counts); human commits are shared across the WST</em>.</>}
                  /></p>
                  <ul className="spotlight-list">
                    <li><strong>Jeremy Fleischman</strong> (jfly) — <L zh="~2,011 提交" en="~2,011 commits" /></li>
                    <li><strong>Jonatan Kłosko</strong> — <L zh="~1,231 提交" en="~1,231 commits" /></li>
                    <li><strong>Gregor Billing · Philippe Virouleau</strong> — <L zh="千级提交" en="~1k commits each" /></li>
                    <li><strong>Lucas Garron · Stefan Pochmann</strong> — <L zh="cubing.js / BLD 名宿也在列" en="cubing.js / BLD names too" /></li>
                    <li><strong>License</strong> — GPL-3.0</li>
                    <li><strong><L zh="维护方" en="Maintained by" /></strong> — <L zh="WCA 软件团队 (WST)" en="WCA Software Team (WST)" /></li>
                  </ul>
                  <p><L
                    zh={<><strong>和单人站的对比</strong>: 同在 <code>/code</code> 里的<a href="/code/cubingchina">粗饼网</a>约 94% 提交出自一个人——那是巧劲, 也是 bus factor。WCA 官网走的是另一条路: <strong>一支持续轮换的团队 + 强 CI + 严格 lint(RuboCop / overcommit)+ 高测试覆盖</strong>, 用流程把"人"这个单点风险摊薄。</>}
                    en={<><strong>Versus one-person sites</strong>: <a href="/code/cubingchina">CubingChina</a>, also under <code>/code</code>, has ~94% of commits from a single person — efficient, but a bus factor. The WCA site takes the other road: <strong>a rotating team + strong CI + strict lint (RuboCop / overcommit) + high test coverage</strong>, using process to dilute the single-person risk.</>}
                  /></p>
                </div>
                <div className="spotlight-code">
                  <pre className="code"><code>
                    <span className="cl-c"># clone</span>{'\n'}
                    <span className="cl-v">$ </span>git clone \{'\n'}
                    {'    '}github.com/thewca/worldcubeassociation.org{'\n\n'}
                    <span className="cl-c"># full dev stack in one command</span>{'\n'}
                    <span className="cl-v">$ </span>docker compose up{'\n'}
                    <span className="cl-c"># → rails :3000 + next.js + mysql</span>{'\n'}
                    <span className="cl-c">#   + redis + sidekiq + mailcatcher</span>{'\n\n'}
                    <span className="cl-c"># tests</span>{'\n'}
                    <span className="cl-v">$ </span>bin/rspec              <span className="cl-c"># backend</span>{'\n'}
                    <span className="cl-v">$ </span>cd next-frontend && yarn test
                  </code></pre>
                </div>
              </div>
            </div>
          </section>

          {/* 07 Three frontends */}
          <section className="section" id="fe">
            <header className="sec-head">
              <span className="sec-num">07</span>
              <h2 className="sec-title"><L zh="三套前端" en="Three Frontends" /> <code>: ERB vs webpacker vs next</code></h2>
              <p className="sec-desc"><L
                zh={<>"迁移进行时"具体长什么样? 三套前端在同一个仓库里共存, 各管一摊。<strong>Rails + ERB</strong> 是最老的服务端渲染层; <strong><code>app/webpacker/</code></strong> 是现役主力的 React 岛; <strong><code>next-frontend/</code></strong> 是新代码的归宿。<em>下表把它们逐维度并排</em>。</>}
                en={<>What does "mid-migration" actually look like? Three frontends coexist in one repo, each owning a slice. <strong>Rails + ERB</strong> is the oldest server-rendered layer; <strong><code>app/webpacker/</code></strong> is the current workhorse React; <strong><code>next-frontend/</code></strong> is where new code goes. <em>The table below lines them up dimension by dimension</em>.</>}
              /></p>
            </header>

            <table className="cmp-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="th-sw"><L zh="Rails + ERB" en="Rails + ERB" /></th>
                  <th className="th-js"><L zh="app/webpacker" en="app/webpacker" /></th>
                  <th className="th-ts">next-frontend</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: <L zh="技术栈" en="Stack" />,
                    ts: <L zh="Rails · ERB · Sprockets" en="Rails · ERB · Sprockets" />,
                    js: <L zh="React 18 · Semantic UI" en="React 18 · Semantic UI" />,
                    sw: <L zh="Next.js 16 · React 19 · Chakra 3" en="Next.js 16 · React 19 · Chakra 3" /> },
                  { k: <L zh="挂载方式" en="Mount" />,
                    ts: <L zh="服务端渲染 HTML 视图" en="server-rendered HTML views" />,
                    js: <L zh={<>react_on_rails 岛嵌进 Rails 页</>} en={<>react_on_rails islands in Rails</>} />,
                    sw: <L zh="独立 Next.js 应用" en="standalone Next.js app" /> },
                  { k: <L zh="打包" en="Bundler" />,
                    ts: <L zh="Sprockets" en="Sprockets" />,
                    js: <L zh={<>Shakapacker(webpack 5)</>} en={<>Shakapacker (webpack 5)</>} />,
                    sw: <L zh="Next.js 自带" en="Next.js built-in" /> },
                  { k: <L zh="样式" en="Styling" />,
                    ts: <L zh="Bootstrap 3 · SCSS" en="Bootstrap 3 · SCSS" />,
                    js: <L zh="Semantic UI" en="Semantic UI" />,
                    sw: <L zh="Chakra UI 3" en="Chakra UI 3" /> },
                  { k: <L zh="取数据" en="Data" />,
                    ts: <L zh="直接查 ActiveRecord" en="direct ActiveRecord" />,
                    js: <L zh={<>fetch /api + TanStack Query</>} en={<>fetch /api + TanStack Query</>} />,
                    sw: <L zh={<>类型化 openapi-fetch</>} en={<>typed openapi-fetch</>} /> },
                  { k: <L zh="语言" en="Language" />,
                    ts: <L zh="Ruby + ERB" en="Ruby + ERB" />,
                    js: <L zh="纯 JS / JSX(无 TS)" en="plain JS / JSX (no TS)" />,
                    sw: <L zh="TypeScript 严格模式" en="TypeScript strict" /> },
                  { k: <L zh="现状" en="Status" />,
                    ts: <L zh="逐步退役" en="being retired" />,
                    js: <L zh="现役主力交互 UI" en="current workhorse UI" />,
                    sw: <L zh={<><strong>新 UI 的归宿</strong></>} en={<><strong>where new UI goes</strong></>} /> },
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
              <h2 className="sec-title"><L zh="前景" en="Outlook" /> <code>: TheStranglerFig</code></h2>
              <p className="sec-desc"><L
                zh={<>WCA 官网的未来 12 个月不是"重写", 而是<strong>持续把前端从 Rails 里绞杀式迁往 Next.js</strong>, 同时后端账本纹丝不动。看点: Next.js 迁移推进、Payload CMS 接管内容、类型化 API 当骨架, 以及"成绩不动、规则慢改"的治理稳态。</>}
                en={<>The WCA site's next 12 months aren't a rewrite but a <strong>continued strangler-fig migration of the frontend from Rails to Next.js</strong>, with the backend ledger untouched. Watch-items: the Next.js migration, Payload CMS taking over content, the typed API as the spine, and the "results fixed, rules slow" governance steady state.</>}
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
                <li><a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener">worldcubeassociation.org</a></li>
                <li><a href="https://www.worldcubeassociation.org/about" target="_blank" rel="noopener"><L zh="关于 WCA" en="About the WCA" /></a></li>
                <li><a href="https://docs.worldcubeassociation.org/" target="_blank" rel="noopener">docs · <L zh="软件生态" en="software ecosystem" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="代码" en="Code" /></h4>
              <ul>
                <li><a href="https://github.com/thewca/worldcubeassociation.org" target="_blank" rel="noopener">GitHub · repo</a></li>
                <li><a href="https://github.com/thewca" target="_blank" rel="noopener">GitHub · thewca org</a></li>
                <li><a href="https://docs.worldcubeassociation.org/contributing/quickstart" target="_blank" rel="noopener">Quickstart · <L zh="本地运行" en="run locally" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="接口" en="APIs" /></h4>
              <ul>
                <li><a href="https://docs.worldcubeassociation.org/knowledge_base/v0_api.html" target="_blank" rel="noopener">v0 API · OAuth</a></li>
                <li><a href="https://wca-rest-api.robiningelbrecht.be/" target="_blank" rel="noopener"><L zh="非官方 REST API" en="Unofficial REST API" /></a></li>
                <li><a href="https://www.worldcubeassociation.org/export/results" target="_blank" rel="noopener"><L zh="成绩导出" en="Results export" /></a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4><L zh="同站交叉" en="Cross-links" /></h4>
              <ul>
                <li><a href="/code/wca-export"><L zh="WST 数据导出" en="WST Export" /></a></li>
                <li><a href="/code/wcif"><L zh="WCIF 比赛格式" en="WCIF format" /></a></li>
                <li><a href="/code/cubingchina"><L zh="粗饼网 — 下游镜像" en="CubingChina — downstream" /></a></li>
                <li><a href="/code"><L zh="← 回 /code" en="← back to /code" /></a></li>
              </ul>
            </div>
            <div className="footer-col footer-sig">
              <div className="footer-logo"><WcaLogo /></div>
              <p className="footer-line"><L zh="中文 / English 双语 · 事实截至 2026-07 · 未考据项已标注" en="Bilingual zh / en · facts as of 2026-07 · unverified items flagged" /></p>
              <p className="footer-line dim"><code>{'// source of truth · GPL-3.0 · Rails → Next.js'}</code></p>
            </div>
          </div>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
