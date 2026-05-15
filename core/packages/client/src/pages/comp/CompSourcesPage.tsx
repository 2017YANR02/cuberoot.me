/**
 * /comp/sources — /comp 数据源决策流程的可视化说明.
 * 解释 server 如何按优先级:本地 PG dump → cubing.com / WCA Live / WCA REST.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Database, Globe, Radio, FileText } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import './comp.css';

interface SourceInfo {
  id: 'wca_db' | 'cubing' | 'wca_live' | 'wca';
  icon: typeof Database;
  titleEn: string;
  titleZh: string;
  taglineEn: string;
  taglineZh: string;
  techEn: string;
  techZh: string;
}

const SOURCES: SourceInfo[] = [
  {
    id: 'cubing',
    icon: Globe,
    titleEn: 'cubing.com',
    titleZh: 'cubing.com',
    taglineEn: 'CN comps · live results',
    taglineZh: '中国赛主源 · 实时成绩',
    techEn: 'WebSocket · 4 phases (all / females / children / newcomers)',
    techZh: 'WebSocket · 4 段抓取 (全部 / 女选手 / 儿童 / 新人)',
  },
  {
    id: 'wca_live',
    icon: Radio,
    titleEn: 'WCA Live',
    titleZh: 'WCA Live',
    taglineEn: 'Foreign live comps · hot-reload',
    taglineZh: '国外活赛事 · 热加载',
    techEn: 'GraphQL + Phoenix Channels subscription',
    techZh: 'GraphQL + Phoenix Channels 订阅',
  },
  {
    id: 'wca',
    icon: FileText,
    titleEn: 'WCA REST API',
    titleZh: 'WCA REST API',
    taglineEn: 'Official snapshot · finished comps',
    taglineZh: '官方快照 · 已结束比赛',
    techEn: 'GET /api/v0/competitions/:id/results',
    techZh: 'GET /api/v0/competitions/:id/results',
  },
];

export default function CompSourcesPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="comp-sources-page">
      <div className="comp-top-bar">
        <LangToggle variant="fixed" />
        <ThemeToggle />
      </div>

      <div className="comp-sources-wrap">
        <Link to="/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
        <h1 className="comp-page-title">{isZh ? '数据源流程' : 'Data Source Flow'}</h1>
        <p className="comp-page-subtitle">
          {isZh ? '同一份比赛成绩,经不同时序与渠道呈现给下面 4 个数据源。' : 'The same result data surfaces through 4 sources via different stages and channels.'}
        </p>

        <h2 className="comp-flow-section-title comp-flow-section-title-first">{isZh ? '数据上游' : 'Data Lineage'}</h2>

        <div className="comp-lineage">
          <div className="comp-lineage-stage">
            <div className="comp-lineage-when">{isZh ? '比赛进行中' : 'During comp'}</div>
            <div className="comp-lineage-box">
              <Radio size={14} />
              <span>WCA Live</span>
              <span className="comp-lineage-note">{isZh ? '裁判 / 计分员实时录入' : 'live entry by judges'}</span>
            </div>
          </div>

          <div className="comp-lineage-arrow">
            <span>↓</span>
            <span className="comp-lineage-arrow-label">{isZh ? 'delegate 审核 + 锁定 (几小时~几天)' : 'delegate reviews + submits (hours~days)'}</span>
          </div>

          <div className="comp-lineage-stage">
            <div className="comp-lineage-when">{isZh ? '赛后锁定' : 'After lock'}</div>
            <div className="comp-lineage-box comp-lineage-box-canonical">
              <Database size={14} />
              <span>{isZh ? 'WCA 中心 DB' : 'WCA central DB'}</span>
              <span className="comp-lineage-note">{isZh ? '唯一权威源' : 'canonical source'}</span>
            </div>
          </div>

          <div className="comp-lineage-fan-arrows" aria-hidden="true">
            <span>↙</span>
            <span>↘</span>
          </div>

          <div className="comp-lineage-fan">
            <div className="comp-lineage-branch">
              <div className="comp-lineage-box">
                <FileText size={14} />
                <span>WCA REST API</span>
              </div>
              <div className="comp-lineage-branch-note">{isZh ? '读接口,一次性快照' : 'read endpoint, snapshot'}</div>
            </div>
            <div className="comp-lineage-branch">
              <div className="comp-lineage-branch-step">{isZh ? '周更 .sql dump' : 'weekly .sql dump'}</div>
              <div className="comp-lineage-arrow-small">↓</div>
              <div className="comp-lineage-box comp-lineage-box-fast">
                <Database size={14} />
                <span>wca_db</span>
                <span className="comp-lineage-note">{isZh ? '本地 PG 镜像' : 'local PG mirror'}</span>
              </div>
            </div>
          </div>

          <div className="comp-lineage-sidebar">
            <div className="comp-lineage-box comp-lineage-box-side">
              <Globe size={14} />
              <span>cubing.com</span>
              <span className="comp-lineage-note">{isZh ? '独立运营,中国赛事主要计分系统' : 'independent; main scorekeeping for CN comps'}</span>
            </div>
          </div>
        </div>

        <h2 className="comp-flow-section-title">{isZh ? '服务端选源逻辑' : 'Server Source Selection'}</h2>
        <p className="comp-flow-section-sub">
          {isZh ? '收到 /comp 请求时,服务端按优先级依次尝试,命中即返回。' : 'On /comp request, server tries sources in priority order; first hit wins.'}
        </p>

        <div className="comp-flow">
          <div className="comp-flow-input">
            <span className="comp-flow-input-label">{isZh ? '输入' : 'Input'}</span>
            <code>WCA ID</code>
            <span className="comp-flow-input-eg">e.g. XianCherryBlossom2026</span>
          </div>

          <div className="comp-flow-arrow">↓</div>

          <div className="comp-flow-step comp-flow-step-fast">
            <div className="comp-flow-step-num">1</div>
            <div className="comp-flow-step-body">
              <div className="comp-flow-step-title">
                <Database size={16} />
                <span>{isZh ? '本地 PG dump' : 'Local PG dump'}</span>
                <code>wca_results_top</code>
              </div>
              <div className="comp-flow-step-desc">
                {isZh
                  ? '已结束 & 已入 WCA 周更 dump 的比赛。命中即独占,跳过下方所有源。'
                  : 'Finished comps that are already in the weekly WCA dump. Exclusive on hit — skip all sources below.'}
              </div>
              <div className="comp-flow-step-meta">
                <span className="comp-flow-pill comp-flow-pill-fast">{isZh ? '< 50 ms' : '< 50 ms'}</span>
                <span className="comp-flow-pill">{isZh ? '单查询' : '1 PG query'}</span>
              </div>
            </div>
          </div>

          <div className="comp-flow-arrow comp-flow-arrow-miss">
            <span>{isZh ? 'miss → 继续' : 'miss → continue'}</span>
            ↓
          </div>

          <div className="comp-flow-step">
            <div className="comp-flow-step-num">2</div>
            <div className="comp-flow-step-body">
              <div className="comp-flow-step-title">
                <span>{isZh ? '并行 probe 3 个外部源' : 'Probe 3 external sources in parallel'}</span>
              </div>
              <div className="comp-flow-step-desc">
                {isZh ? 'HEAD / HTML 抓取 / GraphQL 各发一发,看谁有这场比赛。' : 'Send HEAD / HTML scrape / GraphQL concurrently to see who has this comp.'}
              </div>
            </div>
          </div>

          <div className="comp-flow-arrow">↓</div>

          <div className="comp-flow-fork">
            {SOURCES.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.id} className={`comp-flow-source comp-flow-source-${s.id}`}>
                  <div className="comp-flow-source-head">
                    <Icon size={16} />
                    <span>{isZh ? s.titleZh : s.titleEn}</span>
                  </div>
                  <div className="comp-flow-source-tagline">{isZh ? s.taglineZh : s.taglineEn}</div>
                  <div className="comp-flow-source-tech">{isZh ? s.techZh : s.techEn}</div>
                </div>
              );
            })}
          </div>

          <div className="comp-flow-arrow">↓</div>

          <div className="comp-flow-step">
            <div className="comp-flow-step-num">3</div>
            <div className="comp-flow-step-body">
              <div className="comp-flow-step-title">
                <span>{isZh ? '默认源选择' : 'Default source picker'}</span>
              </div>
              <div className="comp-flow-rules">
                <div className="comp-flow-rule">
                  <code>cubing + wca</code>
                  <span className="comp-flow-rule-arrow">→</span>
                  <code>wca</code>
                  <span className="comp-flow-rule-note">{isZh ? 'WCA 数据更权威' : 'WCA more canonical'}</span>
                </div>
                <div className="comp-flow-rule">
                  <code>wca_live + wca</code>
                  <span className="comp-flow-rule-arrow">→</span>
                  <code>wca_live</code>
                  <span className="comp-flow-rule-note">{isZh ? '保留实时性' : 'preserve liveness'}</span>
                </div>
                <div className="comp-flow-rule">
                  <code>{isZh ? '单一源' : 'single source'}</code>
                  <span className="comp-flow-rule-arrow">→</span>
                  <code>{isZh ? '该源' : 'that one'}</code>
                </div>
              </div>
              <div className="comp-flow-step-desc comp-flow-step-desc-muted">
                {isZh ? '当多个源可用时,前端显示数据源切换器,用户可手动选择。' : 'When multiple sources are available, UI shows a source toggle for manual override.'}
              </div>
            </div>
          </div>

          <div className="comp-flow-arrow">↓</div>

          <div className="comp-flow-output">
            <span>{isZh ? '渲染比赛页面' : 'Render comp page'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
