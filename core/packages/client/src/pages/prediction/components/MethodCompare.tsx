// 方法对比段 (CFOP / Roux / ZZ / ...)
import { METHOD_TABLE } from '../theory_data';

interface Props { isZh: boolean }

export function MethodCompareSection({ isZh }: Props) {
  return (
    <section className="pred-section" id="methods-compare">
      <h2>{isZh ? '方法演进: STM 步数与极限' : 'Method Evolution: STM Cost & Ceilings'}</h2>
      <p>
        {isZh ? (
          <>速拧 3x3 不止 CFOP 一种。每个方法都把「打乱 → 还原」拆成不同阶段,阶段数 × 阶段长度一起决定 STM。元数据来自 cubeskills (Zemdegs), speedsolving.com wiki, ZBLL 统计页 (Chris Hardwick), Devagio 的 Mehta 模拟。经验值取现役顶级选手的复盘均值,不是新手或中阶水平。</>
        ) : (
          <>3x3 isn't just CFOP. Each method partitions "scramble→solved" into stages; stage-count × stage-length give STM. Numbers below are elite-execution averages (not beginner/intermediate) — sourced from cubeskills (Zemdegs), speedsolving.com wiki, Chris Hardwick's ZBLL stats, and Devagio's Mehta simulator.</>
        )}
      </p>
      <div className="pred-method-table-wrap">
        <table className="pred-fit-table pred-method-table">
          <thead>
            <tr>
              <th>{isZh ? '方法' : 'Method'}</th>
              <th>{isZh ? '现役顶级 STM' : 'Elite STM'}</th>
              <th>{isZh ? '理论下界' : 'Floor STM'}</th>
              <th>{isZh ? 'Alg 数' : 'Algs'}</th>
              <th>{isZh ? '优势' : 'Pros'}</th>
              <th>{isZh ? '代价' : 'Cons'}</th>
              <th>{isZh ? '代表选手' : 'Top user'}</th>
            </tr>
          </thead>
          <tbody>
            {METHOD_TABLE.map((m) => (
              <tr key={m.method}>
                <td>
                  {m.source_url ? (
                    <a href={m.source_url} target="_blank" rel="noopener noreferrer"><strong>{m.method}</strong></a>
                  ) : <strong>{m.method}</strong>}
                </td>
                <td className="pred-num">{m.avg_stm_low}–{m.avg_stm_high}</td>
                <td className="pred-num">{m.theoretical_floor_stm}</td>
                <td className="pred-num">{m.alg_count}</td>
                <td>{isZh ? m.pros_zh : m.pros_en}</td>
                <td>{isZh ? m.cons_zh : m.cons_en}</td>
                <td className="pred-num-small">{m.top_user ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pred-note">
        {isZh ? (
          <><strong>解读。</strong> CFOP 的现役顶级 55-58 STM 跟理论下界 45 STM 之间还有约 13 步空间;
          ZB, Roux, Petrus 的理论下界都在 40-43 之间,但步数越短对识别和 lookahead 的要求越高,
          所以实际 WR 多数还是 CFOP 走出来的 (Zajder 2.76 / Wang 3.08 均 CFOP)。Roux 至今没破 4 秒单次 (Tsvetkov 3.95 是 Roux 唯一一次)。
          1LLL 全 3915 个算法只有 Damasceno 一个人学完,几乎不可能在 sub-3 速度下识别。
          <strong>历史规律: TPS 连续演化,方法阶跃式演化</strong> — 大跳几年才出一次 (CFOP 2007, 磁铁 2017, ZB 2026)。</>
        ) : (
          <><strong>Reading.</strong> CFOP elites sit at 55–58 STM with a ~13-step gap to the theoretical 45.
          ZB / Roux / Petrus all floor in the 40–43 range, but lower-STM methods demand harder recognition and lookahead,
          so most WRs are still CFOP-pulled (Zajder 2.76 and Wang 3.08 both CFOP). Roux has never gone sub-4 single (Tsvetkov 3.95 is the only sub-4 ever).
          1LLL's 3915 cases have only ever been fully learned by Damasceno — at sub-3 speeds, recognition is the binding wall.
          <strong>The pattern: TPS evolves continuously, methods evolve in jumps</strong> — once every several years (CFOP 2007, magnets 2017, ZB 2026).</>
        )}
      </p>
    </section>
  );
}
