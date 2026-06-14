'use client';
/**
 * /wca/comp/sources — data flow diagram.
 * Ported from packages/client/src/pages/comp/CompSourcesPage.tsx.
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Database, Globe, Radio, FileText } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../comp.css';
import { tr } from '@/i18n/tr';

export default function CompSourcesPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('数据源', 'Sources');

  return (
    <div className="comp-sources-page">
      <div className="comp-sources-wrap">
        <Link href="/wca/comp" className="comp-back-link"><ArrowLeft size={14} /> {tr({ zh: '返回', en: 'Back' })}</Link>
        <h1 className="comp-page-title">{tr({ zh: '数据流', en: 'Data Flow'
        })}</h1>
        <p className="comp-page-subtitle">
          {tr({ zh: '从数据产生 → server 取数 → 渲染。同一份成绩,4 条上游渠道,server 按优先级挑一条。', en: 'From data origin → server fetch → render. Same result data, 4 upstream channels; server picks one by priority.'
        })}
        </p>

        <div className="comp-flow-top">
          <div className="comp-flow-top-left">
            <div className="comp-lineage-when">{tr({ zh: '比赛进行中', en: 'During comp'
            })}</div>
            <div className="comp-lineage-box">
              <div className="comp-lineage-box-head">
                <Radio size={14} />
                <span>WCA Live</span>
                <span className="comp-lineage-note">{tr({ zh: '裁判 / 计分员实时录入', en: 'live entry by judges'
                })}</span>
              </div>
              <div className="comp-lineage-server">
                <span className="comp-lineage-server-tag">server</span>
                <code>GraphQL + Phoenix Channels {tr({ zh: '订阅', en: 'subscription'
                })}</code>
              </div>
            </div>

            <div className="comp-lineage-arrow">
              <span>↓</span>
              <span className="comp-lineage-arrow-label">{tr({ zh: 'delegate 审核 + 锁定 (几小时~几天)', en: 'delegate reviews + submits (hours~days)'
            })}</span>
            </div>

            <div className="comp-lineage-when">{tr({ zh: '赛后锁定', en: 'After lock'
            })}</div>
            <div className="comp-lineage-box comp-lineage-box-canonical">
              <div className="comp-lineage-box-head">
                <Database size={14} />
                <span>{tr({ zh: 'WCA 中心 DB', en: 'WCA central DB' })}</span>
                <span className="comp-lineage-note">{tr({ zh: '唯一权威源 (server 不直接访问)', en: 'canonical source (server never queries directly)'
                })}</span>
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
                    <span className="comp-lineage-note">{tr({ zh: '一次性快照', en: 'snapshot' })}</span>
                  </div>
                  <div className="comp-lineage-server">
                    <span className="comp-lineage-server-tag">server</span>
                    <code>GET /api/v0/.../results</code>
                  </div>
                </div>
              </div>
              <div className="comp-lineage-branch">
                <div className="comp-lineage-branch-step">{tr({ zh: '周更 .sql dump', en: 'weekly .sql dump' })}</div>
                <div className="comp-lineage-arrow-small">↓</div>
                <div className="comp-lineage-box comp-lineage-box-fast">
                  <div className="comp-lineage-box-head">
                    <Database size={14} />
                    <span>wca_db</span>
                    <span className="comp-lineage-note">{tr({ zh: '本地 PG 镜像', en: 'local PG mirror'
                    })}</span>
                  </div>
                  <div className="comp-lineage-server">
                    <span className="comp-lineage-server-tag">server</span>
                    <code>{tr({ zh: '本地 PG 查询', en: 'local PG query'
                    })}</code>
                    <span className="comp-flow-pill comp-flow-pill-fast">{'< 50 ms'}</span>
                  </div>
                  <div className="comp-lineage-server">
                    <span className="comp-lineage-server-tag">+</span>
                    <code>{tr({ zh: '历史 PR 检测', en: 'historical PR detection'
                    })}</code>
                    <span className="comp-lineage-note">
                      {tr({ zh: '查比赛日期前累积 PB,叠加 NR/CR/WR badge', en: 'prior cumulative PB → PR badge alongside NR/CR/WR'
                    })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="comp-flow-top-right">
            <div className="comp-lineage-when">{tr({ zh: '独立链路 · CN', en: 'Independent · CN'
            })}</div>
            <div className="comp-lineage-box comp-lineage-box-side">
              <div className="comp-lineage-box-head">
                <Globe size={14} />
                <span>cubing.com</span>
                <span className="comp-lineage-note">{tr({ zh: '中国赛事主要计分系统', en: 'main CN scorekeeping'
                })}</span>
              </div>
              <div className="comp-lineage-server">
                <span className="comp-lineage-server-tag">server</span>
                <code>{tr({ zh: 'WebSocket · 4 段抓取', en: 'WebSocket · 4 phases' })}</code>
              </div>
            </div>
          </div>
        </div>

        <div className="comp-flow-merge-bar">
          <div className="comp-flow-merge-label">
            {tr({ zh: 'server 从这 4 个源挑一个', en: 'server picks one of these 4'
            })}
          </div>
          <div className="comp-flow-merge-arrow">↓</div>
        </div>

        <div className="comp-gate">
          <div className="comp-gate-input">
            <span className="comp-gate-input-label">{tr({ zh: '用户请求', en: 'User'
            })}</span>
            <code>GET /comp/&lt;WCA ID&gt;</code>
          </div>

          <div className="comp-gate-arrow">↓</div>

          <div className="comp-gate-rules">
            <div className="comp-gate-rules-title">{tr({ zh: '优先级', en: 'Priority'
            })}</div>
            <ol className="comp-gate-rule-list">
              <li>
                <span className="comp-gate-rule-num">1</span>
                <span className="comp-gate-rule-body">
                  {tr({ zh: '试 ', en: 'Try '
                })}
                  <code>wca_db</code>
                  {tr({ zh: ' 本地查 — 命中即独占,跳过其它源', en: ' locally — exclusive on hit, skip the rest'
                })}
                </span>
              </li>
              <li>
                <span className="comp-gate-rule-num">2</span>
                <span className="comp-gate-rule-body">
                  {tr({ zh: '未命中 → 并行 probe ', en: 'Miss → parallel probe '
                })}
                  <code>cubing.com</code> / <code>WCA Live</code> / <code>WCA REST</code>
                </span>
              </li>
              <li>
                <span className="comp-gate-rule-num">3</span>
                <span className="comp-gate-rule-body">
                  {tr({ zh: '默认源:', en: 'Default: '
                })}
                  <code>cubing + wca</code> → <code>wca</code> · <code>wca_live + wca</code> → <code>wca_live</code> · {tr({ zh: '单源 → 该源', en: 'single → that one'
                })}
                </span>
              </li>
            </ol>
            <div className="comp-gate-rules-note">
              {tr({ zh: '多源可用时,前端显示数据源切换器,用户可手动覆盖。', en: 'When multiple sources are available, UI shows a source toggle.'
            })}
            </div>
          </div>

          <div className="comp-gate-arrow">↓</div>

          <div className="comp-gate-output">{tr({ zh: '渲染比赛页面', en: 'Render comp page'
        })}</div>
        </div>
      </div>
    </div>
  );
}
