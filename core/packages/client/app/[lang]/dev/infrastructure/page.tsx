'use client';

import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, Code2, Cpu, Database, FileCode2, GitCommitHorizontal, Globe2, HardDrive, Layers3, LockKeyhole, MemoryStick, Monitor, Network, Radio, RotateCcw, Server, ShieldCheck, Triangle, Upload, type LucideIcon } from 'lucide-react';
import AppLink from '@/components/AppLink';
import PageBackLink from '@/components/PageBackLink';
import HeaderToggles from '@/components/HeaderToggles';
import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import './infrastructure-overview.css';

// Public capacity figures retained from the existing infrastructure page.
const SPECS: { icon: LucideIcon; value: string; zh: string; en: string }[] = [
  { icon: Cpu, value: '4 vCPU', zh: '计算', en: 'Compute' },
  { icon: MemoryStick, value: '16 GiB', zh: '内存', en: 'Memory' },
  { icon: HardDrive, value: '80 GiB', zh: '系统盘', en: 'System disk' },
  { icon: Network, value: '200 Mbps', zh: '网络上限', en: 'Network ceiling' },
];

function WebReleaseFlow() {
  const t = useT();
  const repository = 'https://github.com/2017YANR02/cuberoot.me';
  const jobs = [
    {
      icon: Box,
      runner: 'GitHub Actions',
      title: t('构建阿里云产物', 'Build for Alibaba Cloud'),
      detail: t('打包 Next.js standalone、静态资源和运行依赖。', 'Package Next.js standalone, static assets, and runtime dependencies.'),
      source: 'deploy_next.yml',
      href: `${repository}/blob/main/.github/workflows/deploy_next.yml`,
    },
    {
      icon: ShieldCheck,
      runner: 'GitHub Actions',
      title: t('运行网页检查', 'Run web checks'),
      detail: t('汇总类型检查、网页回归测试和受影响的专项检查。', 'Combine type checks, web regression tests, and checks for affected modules.'),
      source: 'test.yml',
      href: `${repository}/blob/main/.github/workflows/test.yml`,
    },
    {
      icon: Triangle,
      runner: 'Vercel',
      title: t('按需构建生产版本', 'Build for production when needed'),
      detail: t('先核对网页变更和上一版本的检查结果，满足条件时跳过构建。', 'Compare web changes and verify the previous deployment’s checks to decide whether the build can be skipped.'),
      source: 'vercel-ignore-build.ts',
      href: `${repository}/blob/main/core/scripts/vercel-ignore-build.ts`,
    },
  ];

  return (
    <section className="ia-section" id="web-release" aria-labelledby="ia-web-release-title">
      <div className="ia-section-head">
        <h2 id="ia-web-release-title">{t('网页构建与发布', 'Web builds and releases')}</h2>
      </div>
      <figure className="ia-pipeline" aria-labelledby="ia-web-release-title">
        <div className="ia-pipeline-source">
          <GitCommitHorizontal size={21} aria-hidden="true" />
          <strong>{t('推送网页改动', 'Push web changes')}</strong>
          <code>main</code>
        </div>
        <div className="ia-pipeline-fork" aria-hidden="true"><i /><i /><i /></div>

        <ul className="ia-pipeline-jobs" aria-label={t('并行启动的任务', 'Jobs that start in parallel')}>
          {jobs.map(({ icon: Icon, runner, title, detail, source, href }) => (
            <li key={source} className="ia-pipeline-job">
              <div className="ia-pipeline-runner"><Icon size={18} aria-hidden="true" /><span>{runner}</span></div>
              <h3>{title}</h3>
              <p>{detail}</p>
              <a href={href} className="ia-text-link ia-pipeline-code-link"><code>{source}</code><ArrowUpRight size={13} aria-hidden="true" /></a>
            </li>
          ))}
        </ul>

        <div className="ia-pipeline-drop" aria-hidden="true"><ArrowDown size={15} /><ArrowDown size={15} /><ArrowDown size={15} /></div>
        <div className="ia-pipeline-releases">
          <div className="ia-pipeline-gate">
            <span className="ia-pipeline-gate-icon"><ShieldCheck size={24} aria-hidden="true" /></span>
            <strong>{t('同一提交通过 Web checks', 'Web checks pass for the same commit')}</strong>
            <p>{t('两条线路各自等到构建完成、检查通过，再上线。', 'Each route can release once its own build finishes and the checks pass.')}</p>
          </div>
          <article className="ia-pipeline-release ia-pipeline-alibaba">
            <div className="ia-pipeline-runner"><Server size={18} aria-hidden="true" /><span>{t('阿里云', 'Alibaba Cloud')}</span></div>
            <h3>{t('上传并重启 Next.js', 'Upload and restart Next.js')}</h3>
            <p>{t('切换服务后探测首页。健康检查失败时回退到上一版。', 'Probe the homepage after switching versions. A failed health check rolls back to the previous build.')}</p>
          </article>
          <article className="ia-pipeline-release ia-pipeline-vercel">
            <div className="ia-pipeline-runner"><Triangle size={18} aria-hidden="true" /><span>Vercel</span></div>
            <h3>{t('切换生产域名到新版', 'Assign production domains to the new build')}</h3>
            <p>{t('构建跳过、构建失败或网页检查未通过时，继续提供现有版本。', 'If the build is skipped, fails, or cannot pass web checks, the existing version stays live.')}</p>
          </article>
        </div>

        <figcaption className="ia-pipeline-caption">
          <span><Globe2 size={17} aria-hidden="true" /><code>cuberoot.me</code></span>
          <p>{t('构建与网页检查并行启动。阿里云和 Vercel 各自上线，同一个网址的两条线路可能先后更新。', 'Builds and web checks start in parallel. Alibaba Cloud and Vercel release independently, so the two routes behind the same domain can update at different times.')}</p>
        </figcaption>
      </figure>
    </section>
  );
}

export default function InfrastructurePage() {
  const t = useT();
  const [stage, setStage] = useState(1);
  const stages = [
    { icon: Code2, title: t('写代码', 'Write'), label: t('源码', 'Source'), detail: t('React 描述界面，TypeScript 写行为，CSS 定义外观。', 'React describes the interface, TypeScript defines behavior, and CSS controls appearance.') },
    { icon: Box, title: t('构建', 'Build'), label: t('构建产物', 'Build artifacts'), detail: t('Next.js 打包依赖、拆分并压缩文件，预渲染适合的页面，并生成服务器程序。', 'Next.js bundles dependencies, splits and compresses files, prerenders eligible pages, and generates the server program.') },
    { icon: Upload, title: t('部署', 'Deploy'), label: t('正式网站', 'Live website'), detail: t('将构建产物发布到生产环境，切换线上版本。', 'Publish the build artifacts to production and activate the new version.') },
  ];
  const operations = [
    { icon: RotateCcw, title: t('发布可回退', 'Releases can roll back'), body: t('先准备新版本，再切换。健康检查或关键页面验证失败，就回到上一版。', 'Stage the new version before switching. Failed health or key-route checks trigger a rollback.') },
    { icon: Radio, title: t('异常自动恢复', 'Automatic recovery'), body: t('进程异常退出会自动恢复；定期探测二次确认后，对持续故障告警。', 'Crashed processes restart automatically. Scheduled probes confirm persistent failures before alerting.') },
    { icon: ShieldCheck, title: t('数据有备份', 'Data has a backup'), body: t('不可重建的数据每日备份，并保留异地副本；可重建的大型数据按需再生成。', 'Irreplaceable data gets daily backups and an off-host copy. Large reproducible datasets can be regenerated.') },
  ];

  return (
    <main className="infra-atlas">
      <div className="ia-shell">
        <div className="ia-topbar">
          <PageBackLink fallback="/dev" />
          <HeaderToggles />
        </div>

        <header className="ia-hero">
          <h1>{t('基础设施与运维', 'Infrastructure & operations')}</h1>
          <AppLink href="/dev/architecture" prefetch={false} className="ia-text-link">{t('软件架构', 'Software architecture')}<ArrowUpRight size={16} aria-hidden="true" /></AppLink>
        </header>

        <section className="ia-section" id="build" aria-labelledby="ia-build-title">
          <div className="ia-section-head">
            <h2 id="ia-build-title">{t('构建演示', 'Build walkthrough')}</h2>
          </div>
          <div className="ia-workbench">
            <div className="ia-steps" aria-label={t('查看发布阶段', 'Explore release stages')}>
              {stages.map((item, index) => <button type="button" key={item.label} className="ia-step" aria-pressed={stage === index} aria-controls="ia-stage-preview" onClick={() => setStage(index)}>
                <span className="ia-step-icon"><item.icon size={21} aria-hidden="true" /></span>
                <span className="ia-step-title">{item.title}</span>
                {index < 2 && <ArrowDown className="ia-step-connector" size={15} aria-hidden="true" />}
              </button>)}
            </div>
            <div id="ia-stage-preview" className="ia-stage-preview" aria-live="polite" aria-atomic="true">
              <div className="ia-preview-label">{stages[stage].label}</div>
              <div className="ia-stage-art" key={stage}>
                {stage === 0 && <div className="ia-editor">
                  <div className="ia-editor-tab"><FileCode2 size={15} aria-hidden="true" />TimerButton.tsx</div>
                  <pre><code><span className="ia-code-muted">{'// '}{t('给计时器加一个按钮', 'Add a timer button')}{'\n'}</span><span className="ia-code-keyword">{'export function '}</span>{'TimerButton() {\n  return (\n    '}<span className="ia-code-tag">{'<button'}</span>{' onClick={start}'}<span className="ia-code-tag">{'>'}</span>{'\n      '}{t('开始计时', 'Start timer')}{'\n    '}<span className="ia-code-tag">{'</button>'}</span>{'\n  );\n}'}</code></pre>
                </div>}
                {stage === 1 && <div className="ia-artifacts">
                  <div className="ia-build-engine"><div className="ia-engine-mark"><Box size={42} strokeWidth={1.2} aria-hidden="true" /></div><strong>Next.js</strong><span>{t('编译 · 打包 · 预渲染', 'Compile · Bundle · Prerender')}</span></div>
                  <ArrowRight className="ia-artifact-arrow" size={22} aria-hidden="true" />
                  <div className="ia-output-files">
                    <div><FileCode2 size={17} aria-hidden="true" /><span>JavaScript<small>{t('交互行为', 'Interactions')}</small></span><Check size={14} aria-hidden="true" /></div>
                    <div><Layers3 size={17} aria-hidden="true" /><span>CSS<small>{t('页面样式', 'Styles')}</small></span><Check size={14} aria-hidden="true" /></div>
                    <div><Monitor size={17} aria-hidden="true" /><span>HTML<small>{t('预渲染页面', 'Prerendered pages')}</small></span><Check size={14} aria-hidden="true" /></div>
                    <div><Server size={17} aria-hidden="true" /><span>{t('服务器程序', 'Server program')}<small>{t('处理动态请求', 'Dynamic requests')}</small></span><Check size={14} aria-hidden="true" /></div>
                  </div>
                </div>}
                {stage === 2 && <div className="ia-browser-preview">
                  <div className="ia-browser-bar"><LockKeyhole size={13} aria-hidden="true" /><span>cuberoot.me/timer</span><Globe2 size={14} aria-hidden="true" /></div>
                  <div className="ia-timer-preview"><span>{t('计时器', 'TIMER')}</span><strong>0.00</strong><span className="ia-example-button">{t('开始计时', 'Start timer')}</span></div>
                </div>}
              </div>
              <p className="ia-stage-detail">{stages[stage].detail}</p>
            </div>
          </div>
        </section>

        <WebReleaseFlow />

        <section className="ia-section" aria-labelledby="ia-request-title">
          <div className="ia-section-head"><h2 id="ia-request-title">{t('网站请求路径', 'Web request routing')}</h2><AppLink href="/dev/dns-routing" className="ia-text-link" prefetch={false}>{t('域名与路由', 'DNS & routing')}<ArrowUpRight size={16} aria-hidden="true" /></AppLink></div>
          <div className="ia-network">
            <div className="ia-network-path">
              <div className="ia-network-node"><Monitor size={30} strokeWidth={1.4} aria-hidden="true" /><strong>{t('浏览器', 'Browser')}</strong></div>
              <div className="ia-network-edge"><span>HTTPS</span><ArrowRight size={21} aria-hidden="true" /></div>
              <div className="ia-network-node ia-network-entry"><Network size={30} strokeWidth={1.4} aria-hidden="true" /><strong>{t('网站入口', 'Site entry')}</strong><span>{t('路由 · 缓存', 'Routing · Cache')}</span></div>
              <div className="ia-network-edge"><ArrowRight size={21} aria-hidden="true" /></div>
              <div className="ia-network-destinations">
                <div><Monitor size={21} aria-hidden="true" /><span><strong>{t('网页', 'Web pages')}<small>Next.js</small></strong><span>{t('呈现页面与交互', 'Interface and interactions')}</span></span></div>
                <div><Server size={21} aria-hidden="true" /><span><strong>{t('数据接口', 'Data API')}<small>Hono</small></strong><span>{t('处理登录与查询', 'Sign-in and queries')}</span></span><ArrowRight size={16} aria-hidden="true" /><Database size={21} aria-hidden="true" /><span className="ia-database-name">PostgreSQL</span></div>
                <div><Layers3 size={21} aria-hidden="true" /><span><strong>{t('静态资源', 'Static assets')}</strong><span>{t('图片 · 字体 · 大型数据文件', 'Images · Fonts · Large datasets')}</span></span></div>
              </div>
            </div>
            <p className="ia-network-note">{t('网页与 API 独立构建和运行。命中缓存时可直接返回响应。', 'The web app and API are built and run independently. Cache hits can return a response directly.')}</p>
          </div>
          <div className="ia-server-specs"><div className="ia-specs-heading"><Server size={20} aria-hidden="true" /><span>{t('自有云服务器', 'Self-hosted cloud server')}<small>{t('容量规格，非实时负载', 'Capacity, not live load')}</small></span></div><dl>{SPECS.map(spec => <div key={spec.en}><dt><spec.icon size={14} aria-hidden="true" />{t(spec.zh, spec.en)}</dt><dd>{spec.value}</dd></div>)}</dl></div>
        </section>

        <section className="ia-section ia-recovery" aria-labelledby="ia-recovery-title">
          <div className="ia-section-head"><h2 id="ia-recovery-title">{t('故障恢复与备份', 'Recovery and backups')}</h2></div>
          <div className="ia-recovery-grid">{operations.map(item => <article key={item.title}><item.icon size={23} strokeWidth={1.5} aria-hidden="true" /><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
          <details className="ia-details"><MoreToggle as="summary">{t('运行细节与公开边界', 'Operational details & disclosure')}</MoreToggle><div className="ia-detail-copy"><p>{t('Web 与 API 先上传到带版本的目录，再切换 current 指针。Web 由系统服务守护，API 由进程管理器平滑重载；发布失败保留诊断日志。', 'Web and API are staged in versioned directories before the current pointer changes. A system service supervises the web runtime; a process manager reloads the API gracefully. Failed releases retain diagnostic logs.')}</p><p>{t('通过静态生成、缓存和独立任务降低常驻资源压力，按实际瓶颈扩容。可用资源还需扣除系统、数据库和运行时开销。实时音视频使用各自的协议与服务。', 'Static generation, caching, and independent jobs reduce steady-state resource use; capacity grows with measured bottlenecks. Available resources exclude operating-system, database, and runtime overhead. Real-time media uses its own protocols and services.')}</p><p>{t('这里公开容量与工作机制，不公开服务器地址、实例标识、管理入口、密钥、环境变量、备份位置、实时负载、告警阈值及敏感版本细节。', 'Capacity and mechanisms are public. Server addresses, instance identifiers, admin endpoints, keys, environment variables, backup locations, live load, alert thresholds, and sensitive version details remain private.')}</p></div></details>
        </section>
        <footer className="ia-footer"><AppLink href="/dev/expenses" className="ia-text-link" prefetch={false}>{t('支出与设备', 'Expenses & equipment')}<ArrowUpRight size={15} aria-hidden="true" /></AppLink></footer>
      </div>
    </main>
  );
}
