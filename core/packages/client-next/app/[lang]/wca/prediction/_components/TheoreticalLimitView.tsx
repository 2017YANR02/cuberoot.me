// 单事件的"方法 + 硬件演进 + 物理极限分解"章节
// 嵌在 EventSection 内部, 在 WR 走势图之后, Top-N 之前
import type * as React from 'react';
import { type TheoreticalLimit } from './theoretical_limits';
import { formatVal, type EventMeta } from './events';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

/** 轻量 inline markdown: **bold** + `code` + escape HTML */
function renderInline(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/** block-level: 段落 split by \n\n; 若段落每行 `- ` 起头则渲染为 ul */
function renderBlocks(text: string): React.ReactNode[] {
  return text.split(/\n\n+/).map((para, i) => {
    const lines = para.split('\n');
    const allBullets = lines.length > 1 && lines.every((l) => /^\s*-\s+/.test(l));
    if (allBullets) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j} dangerouslySetInnerHTML={{ __html: renderInline(l.replace(/^\s*-\s+/, '')) }} />
          ))}
        </ul>
      );
    }
    return <p key={i} dangerouslySetInnerHTML={{ __html: renderInline(para) }} />;
  });
}

interface Props {
  event: EventMeta;
  limit: TheoreticalLimit;
  fittedL: number | null;        // 曲线拟合的 L (转成显示单位)
  isZh: boolean;
}

export default function TheoreticalLimitView({ event, limit, fittedL, isZh }: Props) {
  return (
    <div className="pred-tlimit">
      <h3>{tr({ zh: '方法 + 硬件演进 + 物理极限', en: 'Method, Hardware Evolution & Physical Floor',
          zhHant: "方法 + 硬體演進 + 物理極限"
    })}</h3>

      <p>{isZh ? limit.current_method_zh : limit.current_method_en}</p>

      {/* 方法演进 */}
      <h4>{tr({ zh: '方法演进时间线', en: 'Method Evolution Timeline',
          zhHant: "方法演進時間線"
    })}</h4>
      <table className="pred-tlimit-table">
        <thead>
          <tr>
            <th>{tr({ zh: '起始年', en: 'From' })}</th>
            <th>{tr({ zh: '方法', en: 'Method' })}</th>
            <th>{tr({ zh: '算法数', en: 'Alg count',
                zhHant: "演算法數"
            })}</th>
            <th>{tr({ zh: '平均步数', en: 'Avg STM',
                zhHant: "平均步數"
            })}</th>
            <th>{tr({ zh: '备注', en: 'Notes',
                zhHant: "備註"
            })}</th>
          </tr>
        </thead>
        <tbody>
          {limit.method_eras.map((m) => (
            <tr key={`${m.start_year}-${m.method}`}>
              <td>{m.start_year}</td>
              <td><strong>{isZh ? m.method_zh : m.method}</strong></td>
              <td>{m.alg_count ?? '–'}</td>
              <td>{m.avg_stm ?? '–'}</td>
              <td>{isZh ? (m.notes_zh ?? '') : (m.notes_en ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 硬件演进 */}
      {limit.hardware_eras.length > 0 && (
        <>
          <h4>{tr({ zh: '硬件里程碑', en: 'Hardware Milestones',
              zhHant: "硬體里程碑"
        })}</h4>
          <table className="pred-tlimit-table">
            <thead>
              <tr>
                <th>{tr({ zh: '年份', en: 'Year' })}</th>
                <th>{tr({ zh: '里程碑', en: 'Milestone' })}</th>
              </tr>
            </thead>
            <tbody>
              {limit.hardware_eras.map((h) => (
                <tr key={`${h.year}-${h.milestone_en}`}>
                  <td>{h.year}</td>
                  <td>{isZh ? h.milestone_zh : h.milestone_en}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* 步数法分解 */}
      <h4>{tr({ zh: '步数法分解 T = M / TPS + R', en: 'Step-Count Decomposition T = M / TPS + R',
          zhHant: "步數法分解 T = M / TPS + R"
    })}</h4>
      <table className="pred-tlimit-table pred-tlimit-decomp">
        <thead>
          <tr>
            <th>{tr({ zh: '场景', en: 'Scenario',
                zhHant: "場景"
            })}</th>
            <th>M (STM)</th>
            <th>TPS</th>
            <th>R (s)</th>
            <th>T = M/TPS + R</th>
          </tr>
        </thead>
        <tbody>
          {limit.decomp.map((d) => {
            const T = d.T ?? d.M / d.TPS + d.R;
            return (
              <tr key={d.scenario_en}>
                <td>{isZh ? d.scenario_zh : d.scenario_en}</td>
                <td>{d.M}</td>
                <td>{d.TPS.toFixed(1)}</td>
                <td>{d.R.toFixed(2)}</td>
                <td><strong>{formatVal(T, event.scale)}</strong></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 已验证 reconstructions */}
      {limit.best_reconstructions && limit.best_reconstructions.length > 0 && (
        <>
          <h4>{tr({ zh: '已验证复盘', en: 'Verified Reconstructions',
              zhHant: "已驗證覆盤"
        })}</h4>
          <table className="pred-tlimit-table">
            <thead>
              <tr>
                <th>{tr({ zh: '日期', en: 'Date' })}</th>
                <th>{tr({ zh: '选手', en: 'Person',
                    zhHant: "選手"
                })}</th>
                <th>{tr({ zh: '成绩', en: 'Time',
                    zhHant: "成績"
                })}</th>
                <th>M (STM)</th>
                <th>TPS</th>
                <th>{tr({ zh: '方法', en: 'Method' })}</th>
              </tr>
            </thead>
            <tbody>
              {limit.best_reconstructions.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.person}</td>
                  <td><strong>{r.time}</strong></td>
                  <td>{r.M}</td>
                  <td>{r.TPS.toFixed(1)}</td>
                  <td>
                    {r.source_url
                      ? <a href={r.source_url} target="_blank" rel="noopener noreferrer">{r.method}</a>
                      : r.method}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* 论证段 */}
      <h4>{tr({ zh: '物理下界论证', en: 'Physical Floor Reasoning',
          zhHant: "物理下界論證"
    })}</h4>
      {(isZh ? limit.reasoning_zh : limit.reasoning_en).split(/\n\n+/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {/* 深度章节: 里程碑 / 顶级 cuber / 训练阶梯 / 项目特性 / 预测 */}
      {limit.extended_sections && limit.extended_sections.length > 0 && (
        <div className="pred-tlimit-extended">
          {limit.extended_sections.map((s, i) => (
            <div key={i} className="pred-tlimit-extended-section">
              <h4>{isZh ? s.title_zh : s.title_en}</h4>
              {renderBlocks(isZh ? s.body_zh : s.body_en)}
            </div>
          ))}
        </div>
      )}

      {/* 拟合 L 与 T_phys 对比 */}
      {fittedL !== null && limit.why_fit_differs_zh && (
        <div className="pred-tlimit-contrast">
          <strong>{tr({ zh: '曲线拟合 L vs 物理下界 T_phys', en: 'Curve-fit L vs Physical Floor T_phys',
              zhHant: "曲線擬合 L vs 物理下界 T_phys"
        })}</strong>
          <p className="pred-note">
            {i18n.language === 'zh-Hant' ? (`曲線擬合給出 L = ${formatVal(fittedL, event.scale)},但這只是歷史軌跡的漸近值,不是物理極限。`) : (isZh ? `曲线拟合给出 L = ${formatVal(fittedL, event.scale)},但这只是历史轨迹的渐近值,不是物理极限。` : `Curve fit yields L = ${formatVal(fittedL, event.scale)}, but this is the asymptote of the observed trajectory, not the physical floor. `)}
            {isZh ? limit.why_fit_differs_zh : limit.why_fit_differs_en}
          </p>
        </div>
      )}
    </div>
  );
}
