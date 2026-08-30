'use client';

import AppLink from '@/components/AppLink';
import HomeLink from '@/components/HomeLink';
import { useLang } from '@/i18n/tr';
import './infrastructure.css';

type Lang = 'zh' | 'en';

type LocalizedText = { zh: string; en: string };

type EquipmentGroup = {
  category: LocalizedText;
  items: readonly {
    name: LocalizedText;
    detail: LocalizedText;
    amount: LocalizedText;
    href?: string;
  }[];
};

const LAYERS = [
  {
    index: '01',
    zh: {
      role: '入口与静态资源',
      detail: '规范域名统一入口，静态文件使用独立资源域；非规范入口只负责跳转。',
    },
    en: {
      role: 'Ingress and static assets',
      detail: 'One canonical web origin fronts the product, while static assets use a dedicated origin. Alternate hosts only redirect.',
    },
  },
  {
    index: '02',
    zh: {
      role: '反向代理',
      detail: 'TLS、路由、缓存与安全响应头在统一边界处理，再把请求交给对应运行时。',
    },
    en: {
      role: 'Reverse proxy',
      detail: 'TLS, routing, caching, and security headers are handled at one boundary before traffic reaches each runtime.',
    },
  },
  {
    index: '03',
    zh: {
      role: 'Web 与 API',
      detail: 'Next.js Web 与 Hono API 独立构建和运行，避免把前后端故障绑成一个部署单元。',
    },
    en: {
      role: 'Web and API runtimes',
      detail: 'The Next.js web app and Hono API are built and run independently, keeping frontend and backend failures isolated.',
    },
  },
  {
    index: '04',
    zh: {
      role: '数据与媒体',
      detail: 'PostgreSQL 保存产品数据；实时音视频与大体积静态数据按各自协议和缓存策略服务。',
    },
    en: {
      role: 'Data and media',
      detail: 'PostgreSQL stores product data, while real-time media and large static datasets use purpose-specific protocols and cache policies.',
    },
  },
  {
    index: '05',
    zh: {
      role: '恢复与观测',
      detail: '健康检查、进程守护、部署回滚、日志与备份共同构成恢复闭环。',
    },
    en: {
      role: 'Recovery and observability',
      detail: 'Health checks, process supervision, deployment rollback, logs, and backups form the recovery loop.',
    },
  },
] as const;

const PUBLIC_SPECS = [
  { label: { zh: '计算', en: 'Compute' }, value: { zh: '4 vCPU', en: '4 vCPU' } },
  { label: { zh: '内存', en: 'Memory' }, value: { zh: '16 GiB', en: '16 GiB' } },
  { label: { zh: '系统盘', en: 'System disk' }, value: { zh: '80 GiB', en: '80 GiB' } },
  { label: { zh: '网络上限', en: 'Network ceiling' }, value: { zh: '200 Mbps', en: '200 Mbps' } },
] as const;

const EXPENSES = [
  {
    name: { zh: '阿里云服务器', en: 'Alibaba Cloud server' },
    amount: { zh: '¥300/月', en: 'CN¥300/month' },
    purpose: { zh: '主站、API 与数据服务', en: 'Primary web, API, and data services' },
  },
  {
    name: { zh: 'Codex Pro', en: 'Codex Pro' },
    amount: { zh: 'US$200/月', en: 'US$200/month' },
    purpose: { zh: 'AI 开发工具', en: 'AI development tooling' },
  },
  {
    name: { zh: 'Apple 开发者计划', en: 'Apple Developer Program' },
    amount: { zh: '¥688/年', en: 'CN¥688/year' },
    purpose: { zh: 'iOS App 签名与发布', en: 'iOS app signing and distribution' },
  },
  {
    name: { zh: 'Vercel Pro', en: 'Vercel Pro' },
    amount: { zh: 'US$20/月', en: 'US$20/month' },
    purpose: { zh: 'Web 构建与托管', en: 'Web builds and hosting' },
  },
  {
    name: { zh: '微信开放平台认证', en: 'WeChat Open Platform verification' },
    amount: { zh: '¥300/年', en: 'CN¥300/year' },
    purpose: {
      zh: '维持网站应用的微信扫码登录与电脑端直发微信能力',
      en: 'Maintains WeChat QR sign-in and direct desktop sharing for the Website App',
    },
  },
  {
    name: { zh: '剪映', en: 'CapCut Chinese version' },
    amount: { zh: '¥208/年', en: 'CN¥208/year' },
    purpose: { zh: '视频剪辑软件', en: 'Video editing software' },
  },
] as const;

const EQUIPMENT_GROUPS: readonly EquipmentGroup[] = [
  {
    category: { zh: '影像设备', en: 'Imaging' },
    items: [
      {
        name: { zh: 'Canon EOS R5 Mark II', en: 'Canon EOS R5 Mark II' },
        detail: { zh: '当前相机机身', en: 'Current camera body' },
        amount: { zh: '¥24,000', en: 'CN¥24,000' },
      },
      {
        name: { zh: 'Canon EOS R6', en: 'Canon EOS R6' },
        detail: { zh: '曾用相机机身，由 Yihong 的妈妈提供', en: "Former camera body, provided by Yihong's mom" },
        amount: { zh: '¥14,000', en: 'CN¥14,000' },
      },
      {
        name: { zh: 'Canon EF 100–400mm f/4.5–5.6L IS II USM', en: 'Canon EF 100–400mm f/4.5–5.6L IS II USM' },
        detail: { zh: '长焦镜头', en: 'Telephoto lens' },
        amount: { zh: '约 ¥16,000', en: 'Approx. CN¥16,000' },
      },
      {
        name: { zh: '丛林迷彩炮衣', en: 'Jungle-camouflage lens cover' },
        detail: { zh: '镜头保护与伪装', en: 'Lens protection and camouflage' },
        amount: { zh: '¥300', en: 'CN¥300' },
      },
      {
        name: { zh: 'Canon EF–EOS R 卡口适配器', en: 'Canon EF–EOS R mount adapter' },
        detail: { zh: 'EF 镜头转 RF 卡口', en: 'Adapts EF lenses to the RF mount' },
        amount: { zh: '¥600', en: 'CN¥600' },
      },
      {
        name: { zh: 'Canon BR-E1 无线遥控快门', en: 'Canon BR-E1 wireless remote control' },
        detail: { zh: '无线相机快门控制', en: 'Wireless camera shutter control' },
        amount: { zh: '¥278', en: 'CN¥278' },
      },
      {
        name: { zh: 'SmallRig 斯莫格 CT210', en: 'SmallRig CT210' },
        detail: { zh: '三脚架', en: 'Tripod' },
        amount: { zh: '¥677', en: 'CN¥677' },
      },
    ],
  },
  {
    category: { zh: '收音与监听', en: 'Audio and monitoring' },
    items: [
      {
        name: { zh: 'DJI Mic 3', en: 'DJI Mic 3' },
        detail: { zh: '两收一发', en: 'Two receivers and one transmitter' },
        amount: { zh: '¥2,299', en: 'CN¥2,299' },
      },
      {
        name: { zh: 'DJI Mic Mini', en: 'DJI Mic Mini' },
        detail: { zh: '两发一收', en: 'Two transmitters and one receiver' },
        amount: { zh: '¥1,096.5', en: 'CN¥1,096.5' },
      },
      {
        name: { zh: 'DJI Mic 2', en: 'DJI Mic 2' },
        detail: { zh: '一收一发', en: 'One receiver and one transmitter' },
        amount: { zh: '¥1,499', en: 'CN¥1,499' },
      },
      {
        name: { zh: 'Newmine 无线监听耳机', en: 'Newmine wireless monitoring headphones' },
        detail: { zh: '无线音频监听', en: 'Wireless audio monitoring' },
        amount: { zh: '¥399', en: 'CN¥399' },
      },
    ],
  },
  {
    category: { zh: '手机与电脑', en: 'Phones and computers' },
    items: [
      {
        name: { zh: 'iPhone 15 Pro Max 512 GB', en: 'iPhone 15 Pro Max 512 GB' },
        detail: { zh: '手机', en: 'Phone' },
        amount: { zh: '未标价', en: 'Price not listed' },
      },
      {
        name: { zh: 'iPhone 12 Pro Max 512 GB', en: 'iPhone 12 Pro Max 512 GB' },
        detail: { zh: '手机', en: 'Phone' },
        amount: { zh: '未标价', en: 'Price not listed' },
      },
      {
        name: { zh: 'LEAPLIGHT 力普莱多功能手机夹', en: 'LEAPLIGHT multifunction phone holder' },
        detail: { zh: '双冷靴口', en: 'Dual cold-shoe mounts' },
        amount: { zh: '¥57.5', en: 'CN¥57.5' },
      },
      {
        name: { zh: 'Alienware M17 R4', en: 'Alienware M17 R4' },
        detail: { zh: 'Windows 11 笔记本电脑', en: 'Windows 11 laptop' },
        amount: { zh: '¥25,000', en: 'CN¥25,000' },
      },
    ],
  },
  {
    category: { zh: '播放与剪辑软件', en: 'Playback and editing software' },
    items: [
      {
        name: { zh: 'K-Lite Codec Pack', en: 'K-Lite Codec Pack' },
        detail: { zh: '媒体播放解码包', en: 'Media playback codec bundle' },
        amount: { zh: '未标价', en: 'Price not listed' },
        href: 'https://codecguide.com/download_kl.htm',
      },
      {
        name: { zh: '剪映', en: 'CapCut Chinese version' },
        detail: { zh: '视频剪辑软件，费用已计入固定支出', en: 'Video editing software; cost included in recurring expenses' },
        amount: { zh: '¥208/年', en: 'CN¥208/year' },
      },
    ],
  },
] as const;

const OPERATIONS = [
  {
    zh: {
      title: '原子发布',
      body: 'Web 与 API 都先上传到带版本的发布目录，再切换 current 指针。发布失败时保留上一版本用于回滚。',
    },
    en: {
      title: 'Atomic releases',
      body: 'Web and API artifacts are staged in versioned release directories before the current pointer changes. The previous release remains available for rollback.',
    },
  },
  {
    zh: {
      title: '进程恢复',
      body: 'Web 由系统服务守护，API 由进程管理器平滑重载；异常退出会自动恢复，而不是依赖人工重启。',
    },
    en: {
      title: 'Process recovery',
      body: 'The web runtime is supervised as a system service and the API reloads gracefully under a process manager. Unexpected exits recover without manual restarts.',
    },
  },
  {
    zh: {
      title: '部署验证',
      body: '流水线在切换后执行本机健康检查和关键路由冒烟测试；未通过即回滚并保留诊断日志。',
    },
    en: {
      title: 'Deployment verification',
      body: 'After activation, the pipeline runs local health checks and key-route smoke tests. Failed releases roll back and retain diagnostic logs.',
    },
  },
  {
    zh: {
      title: '持续探测',
      body: '独立计划任务定期检查 Web 与 API，可疑结果会二次确认，持续失败才触发告警。',
    },
    en: {
      title: 'Continuous probes',
      body: 'A separate schedule checks the web and API, confirms suspicious results with a second attempt, and alerts only on persistent failure.',
    },
  },
  {
    zh: {
      title: '备份边界',
      body: '不可重建的用户与业务数据每天逻辑备份，并保留异地副本；可从公开来源重建的大型派生数据不重复占用备份空间。',
    },
    en: {
      title: 'Backup boundary',
      body: 'Irreplaceable user and product data receives daily logical backups with an off-host copy. Large derived datasets that can be rebuilt from public sources are excluded.',
    },
  },
] as const;

const PRIVATE_ITEMS = [
  { zh: '公网与内网地址、实例标识和管理入口', en: 'Public or private addresses, instance identifiers, and admin endpoints' },
  { zh: '凭据、密钥、环境变量和备份位置', en: 'Credentials, keys, environment variables, and backup locations' },
  { zh: '实时负载、告警阈值和可用于攻击面的版本细节', en: 'Live load, alert thresholds, and version details that increase attack surface' },
] as const;

function localize<T>(lang: Lang, value: { zh: T; en: T }): T {
  return value[lang];
}

export default function InfrastructurePage() {
  const lang = useLang();

  return (
    <main className="infra-page">
      <div className="infra-shell">
        <HomeLink />

        <header className="infra-hero">
          <p className="infra-kicker">CubeRoot / Infrastructure</p>
          <h1>{localize(lang, { zh: '生产基础设施', en: 'Production Infrastructure' })}</h1>
          <p className="infra-lead">
            {localize(lang, {
              zh: 'CubeRoot 目前运行在一台克制配置的通用计算实例上。这里公开它承载什么、怎样发布和恢复，以及出于安全不会公开什么。',
              en: 'CubeRoot currently runs on a modest general-purpose compute instance. This page documents what it carries, how releases recover, and what remains private for security.',
            })}
          </p>
          <div className="infra-hero-links">
            <AppLink href="/dev/architecture">
              {localize(lang, { zh: '查看软件架构', en: 'View software architecture' })}
            </AppLink>
          </div>
        </header>

        <section className="infra-section infra-overview" aria-labelledby="infra-overview-title">
          <div className="infra-section-heading">
            <span>01</span>
            <div>
              <h2 id="infra-overview-title">{localize(lang, { zh: '公开规格', en: 'Public profile' })}</h2>
              <p>
                {localize(lang, {
                  zh: '这是容量说明，不是实时监控。实际可用资源还要扣除系统、数据库和运行时开销。',
                  en: 'These are capacity figures, not live telemetry. The operating system, database, and runtimes consume part of the total.',
                })}
              </p>
            </div>
          </div>
          <dl className="infra-specs">
            {PUBLIC_SPECS.map((spec) => (
              <div key={spec.label.en}>
                <dt>{localize(lang, spec.label)}</dt>
                <dd>{localize(lang, spec.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="infra-capacity-note">
            {localize(lang, {
              zh: '单机边界是有意公开的工程约束：优先靠静态生成、缓存、独立任务和可回滚发布降低常驻资源压力，再按真实瓶颈扩容。',
              en: 'The single-instance boundary is an intentional public engineering constraint: static generation, caching, independent jobs, and reversible releases reduce steady-state pressure before capacity grows with measured bottlenecks.',
            })}
          </p>
        </section>

        <section className="infra-section" aria-labelledby="infra-expenses-title">
          <div className="infra-section-heading">
            <span>02</span>
            <div>
              <h2 id="infra-expenses-title">{localize(lang, { zh: '固定支出', en: 'Recurring expenses' })}</h2>
              <p>
                {localize(lang, {
                  zh: '当前已知的服务器、开发工具、应用发布与平台认证费用。',
                  en: 'Known recurring costs for servers, development tooling, app distribution, and platform verification.',
                })}
              </p>
            </div>
          </div>
          <dl className="infra-expenses">
            {EXPENSES.map((expense) => (
              <div key={expense.name.en}>
                <dt>
                  <span>{localize(lang, expense.name)}</span>
                  <small>{localize(lang, expense.purpose)}</small>
                </dt>
                <dd>{localize(lang, expense.amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="infra-expense-total">
            <span>{localize(lang, { zh: '年度固定支出', en: 'Annual recurring total' })}</span>
            <strong>
              {localize(lang, { zh: '约 ¥22,706/年', en: 'Approx. US$3,347/year' })}
            </strong>
          </div>
          <p className="infra-expense-note">
            {localize(lang, {
              zh: '美元支出按 2026-08-27 人民币汇率中间价 1 美元 = 6.7840 元换算；实际支出会随汇率变动，不含用量计费、税费与一次性支出。',
              en: 'CNY costs use the 2026-08-27 RMB central parity rate of US$1 = CN¥6.7840. Actual costs vary with exchange rates; usage charges, taxes, and one-time costs are excluded.',
            })}
          </p>
        </section>

        <section className="infra-section" aria-labelledby="infra-equipment-title">
          <div className="infra-section-heading">
            <span>03</span>
            <div>
              <h2 id="infra-equipment-title">{localize(lang, { zh: '创作设备与软件', en: 'Production equipment and software' })}</h2>
              <p>
                {localize(lang, {
                  zh: 'CubeRoot 用于拍摄、收音、剪辑与日常开发的设备。价格按现有记录展示；“约”表示近似金额，未标价项目不据此推算。',
                  en: 'Equipment used for CubeRoot filming, audio capture, editing, and day-to-day development. Prices follow the available records; “approx.” marks estimates, and missing prices are not inferred.',
                })}
              </p>
            </div>
          </div>
          <div className="infra-equipment-groups">
            {EQUIPMENT_GROUPS.map((group) => (
              <section className="infra-equipment-group" key={group.category.en} aria-label={localize(lang, group.category)}>
                <h3>{localize(lang, group.category)}</h3>
                <dl className="infra-expenses infra-equipment-list">
                  {group.items.map((item) => (
                    <div key={item.name.en}>
                      <dt>
                        <span>
                          {item.href ? (
                            <a href={item.href} target="_blank" rel="noreferrer">
                              {localize(lang, item.name)}
                            </a>
                          ) : (
                            localize(lang, item.name)
                          )}
                        </span>
                        <small>{localize(lang, item.detail)}</small>
                      </dt>
                      <dd>{localize(lang, item.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </section>

        <section className="infra-section" aria-labelledby="infra-path-title">
          <div className="infra-section-heading">
            <span>04</span>
            <div>
              <h2 id="infra-path-title">{localize(lang, { zh: '一次请求经过哪里', en: 'The request path' })}</h2>
              <p>
                {localize(lang, {
                  zh: '从公共入口到恢复闭环，职责沿一条路径分层。',
                  en: 'Responsibilities are layered along one path from public ingress to recovery.',
                })}
              </p>
            </div>
          </div>
          <ol className="infra-flow">
            {LAYERS.map((layer) => {
              const copy = layer[lang];
              return (
                <li key={layer.index}>
                  <span className="infra-flow-index">{layer.index}</span>
                  <div>
                    <h3>{copy.role}</h3>
                    <p>{copy.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="infra-section" aria-labelledby="infra-ops-title">
          <div className="infra-section-heading">
            <span>05</span>
            <div>
              <h2 id="infra-ops-title">{localize(lang, { zh: '怎样保持可恢复', en: 'How recovery works' })}</h2>
              <p>
                {localize(lang, {
                  zh: '公开的是机制和边界，不是敏感配置。',
                  en: 'The mechanisms and boundaries are public; sensitive configuration is not.',
                })}
              </p>
            </div>
          </div>
          <div className="infra-operations">
            {OPERATIONS.map((item, index) => {
              const copy = item[lang];
              return (
                <article key={item.en.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{copy.title}</h3>
                    <p>{copy.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="infra-section infra-disclosure" aria-labelledby="infra-disclosure-title">
          <div className="infra-section-heading">
            <span>06</span>
            <div>
              <h2 id="infra-disclosure-title">{localize(lang, { zh: '公开边界', en: 'Disclosure boundary' })}</h2>
              <p>
                {localize(lang, {
                  zh: '透明应帮助理解系统，而不是增加攻击面。以下信息不会进入公开页面。',
                  en: 'Transparency should improve understanding without expanding the attack surface. The following stays off public pages.',
                })}
              </p>
            </div>
          </div>
          <ul>
            {PRIVATE_ITEMS.map((item) => (
              <li key={item.en}>{localize(lang, item)}</li>
            ))}
          </ul>
          <p className="infra-source-note">
            {localize(lang, {
              zh: '本页描述由仓库内的部署工作流、服务定义、代理配置与备份脚本共同约束；软件模块和依赖关系仍以架构页为准。',
              en: 'This page is constrained by deployment workflows, service definitions, proxy configuration, and backup scripts in the repository. Software modules and dependencies remain documented on the architecture page.',
            })}
          </p>
        </section>
      </div>
    </main>
  );
}
