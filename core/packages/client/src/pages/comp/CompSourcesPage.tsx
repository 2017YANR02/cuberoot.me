/**
 * /comp/sources — /comp 数据全流程图.
 * 真正单一 vertical 流:左列 WCA 链,右列 cubing.com 平行,底部汇聚到 server gate → render.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Database, Globe, Radio, FileText } from 'lucide-react';
import HeaderToggles from '../../components/HeaderToggles';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import './comp.css';

export default function CompSourcesPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('数据源', 'Sources');

  return (
    <div className="comp-sources-page">
      <HeaderToggles className="comp-top-bar" />

      <div className="comp-sources-wrap">
        <Link to="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {isZh ? '返回' : 'Back'}</Link>
        <h1 className="comp-page-title">{isZh ? '数据流' : 'Data Flow'}</h1>
        <p className="comp-page-subtitle">
          {isZh
            ? '从数据产生 → server 取数 → 渲染。同一份成绩,4 条上游渠道,server 按优先级挑一条。'
            : 'From data origin → server fetch → render. Same result data, 4 upstream channels; server picks one by priority.'}
        </p>

        <div className="comp-flow-top">
          <div className="comp-flow-top-left">
            <div className="comp-lineage-when">{isZh ? '比赛进行中' : 'During comp'}</div>
            <div className="comp-lineage-box">
              <div className="comp-lineage-box-head">
                <Radio size={14} />
                <span>WCA Live</span>
                <span className="comp-lineage-note">{isZh ? '裁判 / 计分员实时录入' : 'live entry by judges'}</span>
              </div>
              <div className="comp-lineage-server">
                <span className="comp-lineage-server-tag">server</span>
                <code>GraphQL + Phoenix Channels {isZh ? '订阅' : 'subscription'}</code>
              </div>
            </div>

            <div className="comp-lineage-arrow">
              <span>↓</span>
              <span className="comp-lineage-arrow-label">{isZh ? 'delegate 审核 + 锁定 (几小时~几天)' : 'delegate reviews + submits (hours~days)'}</span>
            </div>

            <div className="comp-lineage-when">{isZh ? '赛后锁定' : 'After lock'}</div>
            <div className="comp-lineage-box comp-lineage-box-canonical">
              <div className="comp-lineage-box-head">
                <Database size={14} />
                <span>{isZh ? 'WCA 中心 DB' : 'WCA central DB'}</span>
                <span className="comp-lineage-note">{isZh ? '唯一权威源 (server 不直接访问)' : 'canonical source (server never queries directly)'}</span>
              </div>
            </div>

            <div className="comp-lineage-fan-arrows" aria-hidden="true">
              <span>↙</span>
              <span>↘</span>
            </div>

            <div className="comp-lineage-fan">
              <div className="comp-lineage-branch">
                <div className="comp-lineage-box">
                  <div className="comp-lineage-box-head">
                    <FileText size={14} />
                    <span>WCA REST API</span>
                    <span className="comp-lineage-note">{isZh ? '一次性快照' : 'snapshot'}</span>
                  </div>
                  <div className="comp-lineage-server">
                    <span className="comp-lineage-server-tag">server</span>
                    <code>GET /api/v0/.../results</code>
                  </div>
                </div>
              </div>
              <div className="comp-lineage-branch">
                <div className="comp-lineage-branch-step">{isZh ? '周更 .sql dump' : 'weekly .sql dump'}</div>
                <div className="comp-lineage-arrow-small">↓</div>
                <div className="comp-lineage-box comp-lineage-box-fast">
                  <div className="comp-lineage-box-head">
                    <Database size={14} />
                    <span>wca_db</span>
                    <span className="comp-lineage-note">{isZh ? '本地 PG 镜像' : 'local PG mirror'}</span>
                  </div>
                  <div className="comp-lineage-server">
                    <span className="comp-lineage-server-tag">server</span>
                    <code>{isZh ? '本地 PG 查询' : 'local PG query'}</code>
                    <span className="comp-flow-pill comp-flow-pill-fast">{'< 50 ms'}</span>
                  </div>
                  <div className="comp-lineage-server">
                    <span className="comp-lineage-server-tag">+</span>
                    <code>{isZh ? '历史 PR 检测' : 'historical PR detection'}</code>
                    <span className="comp-lineage-note">
                      {isZh ? '查比赛日期前累积 PB,叠加 NR/CR/WR badge' : 'prior cumulative PB → PR badge alongside NR/CR/WR'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="comp-flow-top-right">
            <div className="comp-lineage-when">{isZh ? '独立链路 · CN' : 'Independent · CN'}</div>
            <div className="comp-lineage-box comp-lineage-box-side">
              <div className="comp-lineage-box-head">
                <Globe size={14} />
                <span>cubing.com</span>
                <span className="comp-lineage-note">{isZh ? '中国赛事主要计分系统' : 'main CN scorekeeping'}</span>
              </div>
              <div className="comp-lineage-server">
                <span className="comp-lineage-server-tag">server</span>
                <code>{isZh ? 'WebSocket · 4 段抓取' : 'WebSocket · 4 phases'}</code>
              </div>
            </div>
          </div>
        </div>

        <div className="comp-flow-merge-bar">
          <div className="comp-flow-merge-label">
            {isZh ? 'server 从这 4 个源挑一个' : 'server picks one of these 4'}
          </div>
          <div className="comp-flow-merge-arrow">↓</div>
        </div>

        <div className="comp-gate">
          <div className="comp-gate-input">
            <span className="comp-gate-input-label">{isZh ? '用户请求' : 'User'}</span>
            <code>GET /comp/&lt;WCA ID&gt;</code>
          </div>

          <div className="comp-gate-arrow">↓</div>

          <div className="comp-gate-rules">
            <div className="comp-gate-rules-title">{isZh ? '优先级' : 'Priority'}</div>
            <ol className="comp-gate-rule-list">
              <li>
                <span className="comp-gate-rule-num">1</span>
                <span className="comp-gate-rule-body">
                  {isZh ? '试 ' : 'Try '}
                  <code>wca_db</code>
                  {isZh ? ' 本地查 — 命中即独占,跳过其它源' : ' locally — exclusive on hit, skip the rest'}
                </span>
              </li>
              <li>
                <span className="comp-gate-rule-num">2</span>
                <span className="comp-gate-rule-body">
                  {isZh ? '未命中 → 并行 probe ' : 'Miss → parallel probe '}
                  <code>cubing.com</code> / <code>WCA Live</code> / <code>WCA REST</code>
                </span>
              </li>
              <li>
                <span className="comp-gate-rule-num">3</span>
                <span className="comp-gate-rule-body">
                  {isZh ? '默认源:' : 'Default: '}
                  <code>cubing + wca</code> → <code>wca</code> · <code>wca_live + wca</code> → <code>wca_live</code> · {isZh ? '单源 → 该源' : 'single → that one'}
                </span>
              </li>
            </ol>
            <div className="comp-gate-rules-note">
              {isZh ? '多源可用时,前端显示数据源切换器,用户可手动覆盖。' : 'When multiple sources are available, UI shows a source toggle.'}
            </div>
          </div>

          <div className="comp-gate-arrow">↓</div>

          <div className="comp-gate-output">{isZh ? '渲染比赛页面' : 'Render comp page'}</div>
        </div>
      </div>
    </div>
  );
}
