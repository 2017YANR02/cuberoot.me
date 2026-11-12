'use client';

import { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, Code2, Cpu, Database, FileCode2, Globe2, HardDrive, Layers3, LockKeyhole, MemoryStick, Monitor, Network, PackageCheck, Radio, RotateCcw, Server, ShieldCheck, Upload, type LucideIcon } from 'lucide-react';
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

export default function InfrastructurePage() {
  const t = useT();
  const [stage, setStage] = useState(1);
  const stages = [
    { icon: Code2, title: t('写代码', 'Write'), subtitle: t('描述它长什么样、怎么工作', 'Describe its appearance and behavior'), label: t('源码', 'SOURCE'), detail: t('比如给计时器加一个按钮。React 描述界面，TypeScript 写行为，CSS 定义外观。源码是方便人修改的原料。', 'For a new timer button, React describes the interface, TypeScript defines behavior, and CSS controls appearance. Source code is the raw material developers edit.') },
    { icon: Box, title: t('构建', 'Build'), subtitle: t('把源码加工成可运行的文件', 'Turn source into runnable files'), label: t('构建产物', 'BUILD ARTIFACTS'), detail: t('Next.js 转换代码、整理依赖、拆分与压缩文件，预先生成适合的页面，并准备服务器程序。这些成品就是「构建产物」。', 'Next.js transforms code, organizes dependencies, splits and compresses files, prerenders eligible pages, and prepares the server program. These files are the build artifacts.') },
    { icon: Upload, title: t('部署', 'Deploy'), subtitle: t('把新版本交到访客手里', 'Make the new version available'), label: t('正式网站', 'LIVE WEBSITE'), detail: t('发布流程把产物送到托管平台或服务器，切换新版本并检查访问。成功后，访客才会在正式网站上看到这个按钮。', 'The release process sends artifacts to the host, activates the new version, and checks access. Visitors can then see the new button on the live site.') },
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
          <span className="ia-wordmark">CUBEROOT <span>/</span> INFRASTRUCTURE</span>
          <HeaderToggles />
        </div>

        <header className="ia-hero">
          <div>
            <p className="ia-eyebrow">{t('网站的幕后', 'BEHIND THE WEBSITE')}</p>
            <h1>{t('基础设施与运维', 'Infrastructure & operations')}</h1>
            <p className="ia-intro">{t('从一行代码，到你眼前的页面。', 'From a line of code to the page in front of you.')}</p>
          </div>
          <AppLink href="/dev/architecture" prefetch={false} className="ia-text-link">{t('软件架构', 'Software architecture')}<ArrowUpRight size={16} aria-hidden="true" /></AppLink>
        </header>

        <section className="ia-section" id="build" aria-labelledby="ia-build-title">
          <div className="ia-section-head">
            <div><p className="ia-eyebrow">{t('从开发到上线', 'FROM SOURCE TO RELEASE')}</p><h2 id="ia-build-title">{t('构建，就是把源码做成成品。', 'A build turns source code into a finished version.')}</h2></div>
            <span className="ia-analogy">{t('食材 → 烹饪 → 上桌', 'Ingredients → Cook → Serve')}</span>
          </div>
          <div className="ia-workbench" data-site-surface="panel">
            <div className="ia-steps" aria-label={t('查看发布阶段', 'Explore release stages')}>
              {stages.map((item, index) => <button type="button" key={item.label} className="ia-step" aria-pressed={stage === index} aria-controls="ia-stage-preview" onClick={() => setStage(index)}>
                <span className="ia-step-icon"><item.icon size={21} aria-hidden="true" /></span>
                <span><span className="ia-step-title">{item.title}<span className="ia-step-number">0{index + 1}</span></span><span className="ia-step-subtitle">{item.subtitle}</span></span>
                {index < 2 && <ArrowDown className="ia-step-connector" size={15} aria-hidden="true" />}
              </button>)}
            </div>
            <div id="ia-stage-preview" className="ia-stage-preview" aria-live="polite" aria-atomic="true">
              <div className="ia-preview-top"><span className="ia-preview-label">{stages[stage].label}</span><span>{t('计时器按钮 · 示意', 'TIMER BUTTON · EXAMPLE')}</span></div>
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
                  <div className="ia-release-label"><PackageCheck size={16} aria-hidden="true" />{t('部署后，访客看到新版本', 'Visitors see the deployed version')}</div>
                </div>}
              </div>
              <p className="ia-stage-detail">{stages[stage].detail}</p>
            </div>
          </div>
          <div className="ia-build-notes"><p><Code2 size={16} aria-hidden="true" /><span>{t('本地预览：边改边看。正式构建：准备可发布的版本。', 'Local preview updates as you edit. A production build prepares a releasable version.')}</span></p><p><PackageCheck size={16} aria-hidden="true" /><span>{t('构建成功 ≠ 已上线，也不代表功能都正确。', 'Build success does not mean deployed or bug-free.')}</span></p></div>
        </section>

        <section className="ia-section" aria-labelledby="ia-request-title">
          <div className="ia-section-head"><div><p className="ia-eyebrow">{t('上线之后', 'ONCE IT IS LIVE')}</p><h2 id="ia-request-title">{t('你打开网站时，发生了什么？', 'What happens when you visit?')}</h2></div><AppLink href="/dev/dns-routing" className="ia-text-link" prefetch={false}>{t('域名与路由', 'DNS & routing')}<ArrowUpRight size={16} aria-hidden="true" /></AppLink></div>
          <div className="ia-network" data-site-surface="panel">
            <div className="ia-network-path">
              <div className="ia-network-node"><Monitor size={30} strokeWidth={1.4} aria-hidden="true" /><strong>{t('你的浏览器', 'Your browser')}</strong><span>{t('发出请求', 'Sends a request')}</span></div>
              <div className="ia-network-edge"><span>HTTPS</span><ArrowRight size={21} aria-hidden="true" /></div>
              <div className="ia-network-node ia-network-entry"><Network size={30} strokeWidth={1.4} aria-hidden="true" /><strong>{t('网站入口', 'Site entry')}</strong><span>{t('路由 · 缓存', 'Routing · Cache')}</span></div>
              <div className="ia-network-edge"><span>{t('分发', 'Routes')}</span><ArrowRight size={21} aria-hidden="true" /></div>
              <div className="ia-network-destinations">
                <div><Monitor size={21} aria-hidden="true" /><span><strong>{t('网页', 'Web pages')}<small>Next.js</small></strong><span>{t('呈现页面与交互', 'Interface and interactions')}</span></span></div>
                <div><Server size={21} aria-hidden="true" /><span><strong>{t('数据接口', 'Data API')}<small>Hono</small></strong><span>{t('处理登录与查询', 'Sign-in and queries')}</span></span><ArrowRight size={16} aria-hidden="true" /><Database size={21} aria-hidden="true" /><span className="ia-database-name">PostgreSQL</span></div>
                <div><Layers3 size={21} aria-hidden="true" /><span><strong>{t('静态资源', 'Static assets')}</strong><span>{t('图片 · 字体 · 大型数据文件', 'Images · Fonts · Large datasets')}</span></span></div>
              </div>
            </div>
            <p className="ia-network-note">{t('这是职责示意：网页与 API 独立构建、独立运行。缓存命中可直接返回；登录与查询等动态功能仍在访问时处理。', 'A map of responsibilities: web and API are built and run independently. Cache hits can return immediately; dynamic features such as sign-in and queries run when requested.')}</p>
          </div>
          <div className="ia-server-specs"><div className="ia-specs-heading"><Server size={20} aria-hidden="true" /><span>{t('自有云服务器', 'Self-hosted cloud server')}<small>{t('容量规格，非实时负载', 'Capacity, not live load')}</small></span></div><dl>{SPECS.map(spec => <div key={spec.en}><dt><spec.icon size={14} aria-hidden="true" />{t(spec.zh, spec.en)}</dt><dd>{spec.value}</dd></div>)}</dl></div>
        </section>

        <section className="ia-section ia-recovery" aria-labelledby="ia-recovery-title">
          <div className="ia-section-head"><div><p className="ia-eyebrow">{t('出现问题时', 'WHEN SOMETHING GOES WRONG')}</p><h2 id="ia-recovery-title">{t('能恢复，才算运行得稳。', 'Reliability includes a way back.')}</h2></div></div>
          <div className="ia-recovery-grid">{operations.map(item => <article key={item.title}><item.icon size={23} strokeWidth={1.5} aria-hidden="true" /><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
          <details className="ia-details"><MoreToggle as="summary">{t('运行细节与公开边界', 'Operational details & disclosure')}</MoreToggle><div className="ia-detail-copy"><p>{t('Web 与 API 先上传到带版本的目录，再切换 current 指针。Web 由系统服务守护，API 由进程管理器平滑重载；发布失败保留诊断日志。', 'Web and API are staged in versioned directories before the current pointer changes. A system service supervises the web runtime; a process manager reloads the API gracefully. Failed releases retain diagnostic logs.')}</p><p>{t('通过静态生成、缓存和独立任务降低常驻资源压力，按实际瓶颈扩容。可用资源还需扣除系统、数据库和运行时开销。实时音视频使用各自的协议与服务。', 'Static generation, caching, and independent jobs reduce steady-state resource use; capacity grows with measured bottlenecks. Available resources exclude operating-system, database, and runtime overhead. Real-time media uses its own protocols and services.')}</p><p>{t('这里公开容量与工作机制，不公开服务器地址、实例标识、管理入口、密钥、环境变量、备份位置、实时负载、告警阈值及敏感版本细节。', 'Capacity and mechanisms are public. Server addresses, instance identifiers, admin endpoints, keys, environment variables, backup locations, live load, alert thresholds, and sensitive version details remain private.')}</p></div></details>
        </section>
        <footer className="ia-footer"><span>CUBEROOT / {t('基础设施', 'INFRASTRUCTURE')}</span><AppLink href="/dev/expenses" className="ia-text-link" prefetch={false}>{t('支出与设备', 'Expenses & equipment')}<ArrowUpRight size={15} aria-hidden="true" /></AppLink></footer>
      </div>
    </main>
  );
}
