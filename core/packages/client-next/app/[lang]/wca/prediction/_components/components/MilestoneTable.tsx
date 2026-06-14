// 16 项目 × (2030 / 2040 / 2050) 综合预测表
import { EVENTS } from '../events';
import { MILESTONE_FORECASTS } from '../theory_data';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

interface Props { isZh: boolean }

export function MilestoneTableSection({ isZh }: Props) {
  return (
    <section className="pred-section" id="milestones">
      <h2>{tr({ zh: '综合预测 (Ensemble × 物理下界 × Regime shift)', en: 'Ensemble Forecasts × Physical Floor × Regime Shifts'
    })}</h2>
      <p>
        {(isZh ? (
                        <>
                          本表把<strong>曲线拟合 (Exp+floor / Gompertz / 幂律 / 纯指数 加权集成)</strong> + <strong>物理下界 T_phys (M/TPS+R)</strong> + <strong>方法 / 硬件 regime shift 调整</strong> 三类信号合并,给出未来 5 / 25 / 50 年的 WR 预测 (单次,单位与各项目页面一致)。
                          <strong>不要把这些数字当作预言</strong> — 5 年这种短期预测的历史偏差 ±10%,25 年 ±30%,50 年的误差量级与当前数值相当。
                          实际值之所以经常比预测低,是因为<em>下一次方法 / 硬件革命</em>不会被历史轨迹捕捉到。Geng 的 ZB 革命 (2026) 一次就把 Ao5 砍掉了 ~5%,但单点拟合看不到这种跳跃。
                        </>
                      ) : (
                        <>
                          This table combines three signals: <strong>curve fits (Exp+floor / Gompertz / power / pure-exp, R²-weighted ensemble)</strong>, <strong>physical floor T_phys (M/TPS+R)</strong>, and <strong>method/hardware regime shift adjustments</strong>. Predictions are single-attempt WRs at +5 / +25 / +50 year horizons (units match the per-event chapters).
                          <strong>Do not treat numbers as an oracle</strong> — historical 5-year horizons drift ±10%, 25-year ±30%, 50-year ~order-of-magnitude.
                          Actuals usually beat forecasts because <em>the next method/hardware revolution</em> never sits in the historical trajectory. Geng's 2026 ZB shift alone took ~5% off the Ao5 in a single step — invisible to any pre-shift fit.
                        </>
                      ))}
      </p>
      <div className="pred-method-table-wrap">
        <table className="pred-fit-table pred-milestone-table">
          <thead>
            <tr>
              <th>{tr({ zh: '项目', en: 'Event'
            })}</th>
              <th>{tr({ zh: '现 WR', en: 'Current WR'
            })}</th>
              <th>2030</th>
              <th>2040</th>
              <th>2050</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((ev) => {
              const f = MILESTONE_FORECASTS[ev.id];
              if (!f) return null;
              return (
                <tr key={ev.id}>
                  <td>
                    <a href={`#event-${ev.id}`}><strong>{isZh ? ev.name_zh : ev.name_en}</strong></a>
                    <span className="pred-mile-id"> {ev.id}</span>
                  </td>
                  <td className="pred-num">{f.current_wr} <span className="pred-mile-year">({f.current_year})</span></td>
                  <td className="pred-num">{isZh ? f.forecast_2030_zh : f.forecast_2030_en}</td>
                  <td className="pred-num">{isZh ? f.forecast_2040_zh : f.forecast_2040_en}</td>
                  <td className="pred-num">{isZh ? f.forecast_2050_zh : f.forecast_2050_en}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pred-note">
        {tr({ zh: '区间 [a-b] = 95% 集成预测区间。「floor」标记表示已抵达物理下界,后续只能靠打乱的幸运抽样。', en: 'Interval [a–b] = 95% ensemble prediction band. "floor" = already at the physical wall, further gains hinge on scramble luck only.'
        })}
      </p>
    </section>
  );
}
