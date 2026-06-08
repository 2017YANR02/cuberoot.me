// 跨运动 / 跨技能 极限对比
import { CROSS_SPORT_TABLE } from '../theory_data';
import { tr } from '@/i18n/tr';

interface Props { isZh: boolean }

export function CrossSportSection({ isZh }: Props) {
  const sorted = [...CROSS_SPORT_TABLE].sort((a, b) => b.ratio_pct - a.ratio_pct);
  return (
    <section className="pred-section" id="cross-sport">
      <h2>{tr({ zh: '跨运动锚定: WR 离物理墙多远', en: 'Cross-Sport Anchoring: How Close Is the WR to the Wall',
          zhHant: "跨運動錨定: WR 離物理牆多遠"
    })}</h2>
      <p>
        {isZh ? (
          <>「WR 占理论极限的百分比」是判断「一项运动成不成熟, 还剩多少空间」的最直接指标。速拧两项放到一起看: 2x2 已经接近反应时间墙,3x3 还有近一半空间。跟传统竞技项目对比一下,3x3 现在的位置更接近 1990 年代的马拉松,而不是今天的马拉松。</>
        ) : (
          <>"WR / theoretical-floor %" is the cleanest measure of "has this sport matured, and how much room remains." Putting 2x2 and 3x3 alongside running and other skill sports: 2x2 is already up against the reaction-time wall; 3x3 still has nearly half its headroom. 3x3 today is closer to where the marathon stood in the 1990s than where it stands now.</>
        )}
      </p>
      <div className="pred-method-table-wrap">
        <table className="pred-fit-table pred-method-table">
          <thead>
            <tr>
              <th>{tr({ zh: '项目', en: 'Sport',
                  zhHant: "專案"
            })}</th>
              <th>{tr({ zh: '现 WR', en: 'WR',
                  zhHant: "現 WR"
            })}</th>
              <th>{tr({ zh: '持有 / 年份', en: 'Holder / year' })}</th>
              <th>{tr({ zh: '理论极限', en: 'Theoretical limit',
                  zhHant: "理論極限"
            })}</th>
              <th>WR / Limit</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.sport_en} className={r.ratio_pct >= 95 ? 'pred-cross-hot' : r.ratio_pct >= 80 ? 'pred-cross-warm' : ''}>
                <td>
                  {r.source_url
                    ? <a href={r.source_url} target="_blank" rel="noopener noreferrer">{isZh ? r.sport_zh : r.sport_en}</a>
                    : (isZh ? r.sport_zh : r.sport_en)}
                </td>
                <td className="pred-num"><strong>{r.wr}</strong></td>
                <td className="pred-num-small">{r.wr_holder} · {r.wr_year}</td>
                <td>{isZh ? r.theoretical_limit_zh : r.theoretical_limit_en}</td>
                <td className="pred-num">
                  {r.ratio_pct > 0 ? (
                    <>
                      <span className="pred-cross-pct" data-level={r.ratio_pct >= 95 ? 'hot' : r.ratio_pct >= 80 ? 'warm' : r.ratio_pct >= 60 ? 'mid' : 'cool'}>
                        {r.ratio_pct}%
                      </span>
                    </>
                  ) : (tr({ zh: '墙已被推翻', en: 'wall moved',
                      zhHant: "牆已被推翻"
                }))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pred-note">
        {isZh ? (
          <>
            <strong>反例 (NES Tetris)。</strong> 2020 之前社区普遍认为 999,999 maxout 即「硬墙」,直到 CheeZ「rolling」技法 (2020) +
            Blue Scuti 撞穿 kill screen (2023) + rebirth wraparound (2024) 把上限完全打掉。
            这是一个典型的「以为是天花板的墙被技术革命推翻」的例子 — 给速拧 sub-2 / sub-1 留了想象空间 (智能魔方 + AI 教练 + 新方法并非完全没戏)。
            <strong>但跑步, 打字这种「撞到解剖学硬墙」的项目,25-30 年零进展是常态。</strong> 速拧 3x3 目前位置 (54%) 夹在两种轨迹之间,没有定论。
          </>
        ) : (
          <>
            <strong>The counter-example (NES Tetris).</strong> Prior to 2020 the community treated the 999,999 maxout as the absolute ceiling.
            CheeZ's rolling technique (2020), then Blue Scuti hitting the kill screen (2023) and the rebirth wraparound (2024) erased the wall entirely.
            This is the "prior wall toppled by technique revolution" pattern — leaves the door open for sub-2 / sub-1 speedcubing
            (smart cubes + AI coaches + new methods not impossible).
            <strong>But running and typing have hit anatomical walls — 25-30 years of zero progress is the norm there.</strong>
            3x3 speedcubing at 54 % currently sits between the two trajectories, undecided.
          </>
        )}
      </p>
    </section>
  );
}
