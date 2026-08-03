'use client';

/*
 * 精确穷举集的「点柱看状态」—— 这一档到底是哪些棱块状态,逐个列出来。
 *
 * 与 WCA 数据集的示例面板是两回事,虽然长得一样:那边从真题池里抽 5 条**样本**,这边把一整档
 * **列全**。所以标题写「全部 40 个」而不是「示例」,也没有比赛/国家/日期那套筛选 —— 这些状态
 * 不来自任何比赛,它们就是全空间里满足该步数的那一撮。
 *
 * 能列的只有小到能列的那几档(见 page.tsx 的 EXACT_CASE_CAP / exactCaseDepths):
 *   单色底  任意步数 —— 度量只读那一面的四条棱,某深度的类就是该面这一层(白底 8 步 = 102 个);
 *   多色底  只有最深那一档 —— 那里「最好的颜色是 8」与「每个颜色都是 8」是同一句话,于是六个面
 *           各自的 8 步层一交就出来了(六色底 40 个、四色底 591 个、双色底 3,672 个)。
 * 中间各档动辄上亿,没有「列全」这一说,那些柱子不可点。
 *
 * 每行显示的打乱是该状态的一个**代表**:度量读到的棱块被钉死,其余棱块与全部角块由 fill.ts
 * 均匀随机补齐(种子固定,所以刷新后同一行还是同一条)。十字口径本来就不看角块,补出来的角块
 * 长什么样都不改变这一行的步数 —— tests/scramble_exact_cases.test.ts 逐个复测锁住这点。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cubieToFacelet } from '@/lib/cube-facelet';
import { m2pScrambleForFacelets, prewarmM2p } from '@/lib/m2p-scramble';
import { facesOfSubset } from '@/lib/cross-trainer';
import { enumerateCrossTop, type CorpusMember } from '@/lib/cross-trainer/corpus';
import { fillState } from '@/lib/cross-trainer/fill';
import { groupDigits } from '@/lib/group-digits';
import { tr } from '@/i18n/tr';

/** 一页多少行 —— 与真题全量列表(BY_DIFFICULTY_PAGE_SIZE)同一个数量级。 */
const PAGE = 50;

/** 固定种子的 rng:同一行每次渲染补出同一个代表(否则每次重绘换一条打乱,像在乱跳)。 */
function seeded(seed: number): () => number {
  let a = (seed + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Props {
  /** 子集 key(SubsetColorPicker 产出,如 'W' / 'BGORWY')。 */
  subsetKey: string;
  depth: number;
  /** 该档的金标状态数(exact_dist 的 counts[depth]);枚举必须复现它,否则整段不显示。 */
  goldenCount: number;
  lang: 'zh' | 'en';
}

export default function ExactCaseList({ subsetKey, depth, goldenCount, lang }: Props) {
  const [shown, setShown] = useState(PAGE);
  const [scrambles, setScrambles] = useState<Record<number, string>>({});
  const runId = useRef(0);

  // 枚举:同步、毫秒级(最大的一档 3,672 个)。金标对不上就整段不显示 —— 宁可空着,
  // 也不摆一份数不对的「全部」。
  const members = useMemo<CorpusMember[] | null>(() => {
    const faces = facesOfSubset(subsetKey);
    if (!faces.length) return null;
    const list = enumerateCrossTop(faces, depth);
    return list.length === goldenCount ? list : null;
  }, [subsetKey, depth, goldenCount]);

  useEffect(() => { setShown(PAGE); setScrambles({}); }, [subsetKey, depth]);
  useEffect(() => { prewarmM2p(); }, []);

  // 打乱由 min2phase(WASM)现算,只算看得见的那几行。换档/翻页都会重进,runId 挡住旧批次。
  useEffect(() => {
    if (!members) return;
    const mine = ++runId.current;
    let alive = true;
    void (async () => {
      for (let i = 0; i < Math.min(shown, members.length); i++) {
        if (!alive || runId.current !== mine) return;
        const state = fillState(members[i].edgePins, members[i].cornerPins, seeded(i));
        const scr = await m2pScrambleForFacelets(cubieToFacelet(state)).catch(() => '');
        if (!alive || runId.current !== mine) return;
        setScrambles((m) => (m[i] === undefined ? { ...m, [i]: scr } : m));
      }
    })();
    return () => { alive = false; };
    // scrambles 不进依赖:它由本 effect 自己写,进依赖会每写一行就重跑一轮。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, shown]);

  if (!members) return null;

  const visible = members.slice(0, shown);
  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {tr({ zh: `${depth} 步状态`, en: `${depth}-move states` })}
          <span className="scramble-stats-examples-allcount">
            {tr({ zh: '全部 {n} 个', en: 'all {n}' }).replace('{n}', groupDigits(String(members.length)))}
          </span>
        </div>
      </div>
      <p className="scramble-stats-exact-note">
        {tr({
          zh: '十字口径只读棱块,所以每行的角块与用不上的棱块是随机补的 —— 换一批补法,还是这一档。',
          en: 'The cross metric reads edges only, so each row’s corners and untouched edges are filled at random — a different filling is still the same bin.',
        })}
      </p>
      <ul className="scramble-stats-examples-list">
        {visible.map((_, i) => {
          const scr = scrambles[i];
          if (scr === undefined) {
            return (
              <li key={i}>
                <span className="scramble-stats-exact-case-no">#{i + 1}</span>
                <span className="scramble-stats-examples-hint">{tr({ zh: '生成中…', en: 'Generating…' })}</span>
              </li>
            );
          }
          const href = `/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: scr.replace(/ /g, '_') })}`;
          return (
            <li key={i}>
              <span className="scramble-stats-exact-case-no">#{i + 1}</span>
              <Link
                className="scramble-stats-examples-cube"
                href={href}
                prefetch={false}
                aria-label={tr({ zh: '打乱图', en: 'Scramble image' })}
              >
                <ScramblePreview2D event="333" scramble={scr} size={26} />
              </Link>
              <div className="scramble-stats-examples-body">
                <Link className="scramble-stats-examples-scramble" href={href} prefetch={false}>{scr}</Link>
              </div>
            </li>
          );
        })}
      </ul>
      {shown < members.length && (
        <div className="scramble-stats-fulllist-foot">
          <button
            type="button"
            className="scramble-stats-fulllist-more"
            onClick={() => setShown((n) => n + PAGE)}
          >
            {tr({ zh: '加载更多', en: 'Load more' })}
          </button>
        </div>
      )}
    </div>
  );
}
