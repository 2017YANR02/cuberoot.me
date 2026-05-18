// 单事件的"方法 + 硬件演进 + 物理极限分解"章节
// 嵌在 EventSection 内部, 在 WR 走势图之后, Top-N 之前
import { type TheoreticalLimit } from './theoretical_limits';
import { formatVal, type EventMeta } from './events';

interface Props {
  event: EventMeta;
  limit: TheoreticalLimit;
  fittedL: number | null;        // 曲线拟合的 L (转成显示单位)
  isZh: boolean;
}

export default function TheoreticalLimitView({ event, limit, fittedL, isZh }: Props) {
  return (
    <div className="pred-tlimit">
      <h3>{isZh ? '方法 + 硬件演进 + 物理极限' : 'Method, Hardware Evolution & Physical Floor'}</h3>

      <p>{isZh ? limit.current_method_zh : limit.current_method_en}</p>

      {/* 方法演进 */}
      <h4>{isZh ? '方法演进时间线' : 'Method Evolution Timeline'}</h4>
      <table className="pred-tlimit-table">
        <thead>
          <tr>
            <th>{isZh ? '起始年' : 'From'}</th>
            <th>{isZh ? '方法' : 'Method'}</th>
            <th>{isZh ? '算法数' : 'Alg count'}</th>
            <th>{isZh ? '平均步数' : 'Avg STM'}</th>
            <th>{isZh ? '备注' : 'Notes'}</th>
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
          <h4>{isZh ? '硬件里程碑' : 'Hardware Milestones'}</h4>
          <table className="pred-tlimit-table">
            <thead>
              <tr>
                <th>{isZh ? '年份' : 'Year'}</th>
                <th>{isZh ? '里程碑' : 'Milestone'}</th>
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
      <h4>{isZh ? '步数法分解 T = M / TPS + R' : 'Step-Count Decomposition T = M / TPS + R'}</h4>
      <table className="pred-tlimit-table pred-tlimit-decomp">
        <thead>
          <tr>
            <th>{isZh ? '场景' : 'Scenario'}</th>
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
          <h4>{isZh ? '已验证 reconstruction' : 'Verified Reconstructions'}</h4>
          <table className="pred-tlimit-table">
            <thead>
              <tr>
                <th>{isZh ? '日期' : 'Date'}</th>
                <th>{isZh ? '选手' : 'Person'}</th>
                <th>{isZh ? '成绩' : 'Time'}</th>
                <th>M (STM)</th>
                <th>TPS</th>
                <th>{isZh ? '方法' : 'Method'}</th>
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
      <h4>{isZh ? '物理下界论证' : 'Physical Floor Reasoning'}</h4>
      {(isZh ? limit.reasoning_zh : limit.reasoning_en).split(/\n\n+/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {/* 拟合 L 与 T_phys 对比 */}
      {fittedL !== null && limit.why_fit_differs_zh && (
        <div className="pred-tlimit-contrast">
          <strong>{isZh ? '曲线拟合 L vs 物理下界 T_phys' : 'Curve-fit L vs Physical Floor T_phys'}</strong>
          <p className="pred-note">
            {isZh ? `曲线拟合给出 L = ${formatVal(fittedL, event.scale)},但这只是历史轨迹的渐近值,不是物理极限。 ` : `Curve fit yields L = ${formatVal(fittedL, event.scale)}, but this is the asymptote of the observed trajectory, not the physical floor. `}
            {isZh ? limit.why_fit_differs_zh : limit.why_fit_differs_en}
          </p>
        </div>
      )}
    </div>
  );
}
