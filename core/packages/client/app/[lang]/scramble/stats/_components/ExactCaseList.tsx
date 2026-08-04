'use client';

/*
 * 精确穷举集的「点柱看状态」—— 这一档到底是哪些状态,逐个列出来。
 *
 * 与 WCA 数据集的示例面板是两回事,虽然长得一样:那边从真题池里抽 5 条**样本**,这边把一整档
 * **列全**。所以标题写「全部 40 个」而不是「示例」,也没有比赛/国家/日期那套筛选 —— 这些状态
 * 不来自任何比赛,它们就是全空间里满足该步数的那一撮。
 *
 * 能列哪几档由 lib/cross-trainer/exact-cases 定(上限见 page.tsx 的 EXACT_CASE_CAP):
 *   定帧      每一档 —— 定了帧就没有底色可取最优,一档就是那张穷举表的一层
 *             (2×2×2 的 8 步 = 561 个,1×2×2 的 7 步 = 24 个);
 *   单色底    任意步数 —— 度量只读那一面的四条棱,某深度的类就是该面这一层(白底 8 步 = 102 个);
 *   多色底    只有最深那一档 —— 那里「最好的颜色是 8」与「每个颜色都是 8」是同一句话,于是六个面
 *             各自的 8 步层一交就出来了(六色底 40 个、四色底 591 个、双色底 3,672 个)。
 * 剩下各档太大,没有「列全」这一说(十字中间几档上亿,2×2×2 中间几档也有十几万),那些柱子不可点。
 *
 * 每行显示的打乱是该状态的一个**代表**:度量读到的那几块被钉死,其余的由 fill.ts 均匀随机补齐
 * (种子固定,所以刷新后同一行还是同一条)。补出来的部分长什么样都不改变这一行的步数 ——
 * tests/scramble_exact_cases.test.ts 逐个复测锁住这点。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import PillToggle from '@/components/PillToggle/PillToggle';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { cubieToFacelet } from '@/lib/cube-facelet';
import { m2pScrambleForFacelets, prewarmM2p } from '@/lib/m2p-scramble';
import { facesOfSubset } from '@/lib/cross-trainer';
import type { CorpusMember } from '@/lib/cross-trainer/corpus';
import { exactCaseSource } from '@/lib/cross-trainer/exact-cases';
import { fillState } from '@/lib/cross-trainer/fill';
import { symmetryClasses, type CaseClass } from '@/lib/cross-trainer/symmetry';
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
  /** 站内阶段键(cross / block222 / rouxs1 …)。 */
  stage: string;
  /** 帧档(unfixed / fixed1 …)。 */
  slot: string;
  /** 子集 key(SubsetColorPicker 产出,如 'W' / 'BGORWY');定帧的格子用不上。 */
  subsetKey: string;
  depth: number;
  /** 该档的金标状态数(exact_dist 的 counts[depth]);枚举必须复现它,否则整段不显示。 */
  goldenCount: number;
  lang: 'zh' | 'en';
}

export default function ExactCaseList({ stage, slot, subsetKey, depth, goldenCount, lang }: Props) {
  const [essential, setEssential] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const [scrambles, setScrambles] = useState<Record<number, string>>({});
  const runId = useRef(0);

  // 枚举:同步。十字单色/双色底几毫秒,六色底约 0.3 秒(约束越多,交出来的候选越少但层数越深),
  // 首次还要建那一格自己的 BFS 表(十字 6 张 190,080 项约 0.8 秒;1×2×3 是 5,322,240 项约 1 秒),
  // 之后全站共享缓存。都在点柱之后才发生。
  // 金标对不上就整段不显示 —— 宁可空着,也不摆一份数不对的「全部」。
  const source = useMemo(
    () => exactCaseSource(stage, slot, subsetKey, facesOfSubset(subsetKey)),
    [stage, slot, subsetKey],
  );
  const members = useMemo<CorpusMember[] | null>(() => {
    if (!source) return null;
    const list = source.members(depth);
    return list.length === goldenCount ? list : null;
  }, [source, depth, goldenCount]);

  // 「去除同构」用的群得**保住这道题**(六色底 48 个、白底 8 个、2×2×2 定帧 6 个 …… 见 symmetry.ts)。
  const symmetries = source?.symmetries ?? [];
  const classes = useMemo(
    () => (members && source ? symmetryClasses(members, source.symmetries, source.key) : []),
    [members, source],
  );

  useEffect(() => { setShown(PAGE); setScrambles({}); setEssential(true); }, [source, depth]);
  useEffect(() => { setShown(PAGE); }, [essential]);
  useEffect(() => { prewarmM2p(); }, []);

  /** 当前视图的行:本质 = 每类一个代表,全部 = 逐个。值是 members 的下标(打乱按它缓存)。 */
  const rows = useMemo<number[]>(() => {
    if (!members) return [];
    return essential
      ? classes.map((c) => c.rep)
      : Array.from({ length: members.length }, (_, i) => i);
  }, [members, classes, essential]);

  const classOf = useMemo(() => {
    const m = new Map<number, CaseClass>();
    for (const c of classes) m.set(c.rep, c);
    return m;
  }, [classes]);

  // 打乱由 min2phase(WASM)现算,只算看得见的那几行。换档/翻页都会重进,runId 挡住旧批次。
  useEffect(() => {
    if (!members) return;
    const mine = ++runId.current;
    let alive = true;
    void (async () => {
      for (const i of rows.slice(0, shown)) {
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
  }, [members, rows, shown]);

  if (!members) return null;

  const visible = rows.slice(0, shown);
  // 说明文案要具体到这一档:拿第一类的大小当例子,类少时把整个拆分写出来(类一多就成一串噪音)。
  const total = groupDigits(String(members.length));
  const nClasses = groupDigits(String(classes.length));
  const first = classes[0]?.size ?? 0;
  const decomp = classes.length > 1 && classes.length <= 8 ? classes.map((c) => c.size).join(' + ') : '';
  const hasFixed = classes.some((c) => c.size === 1);
  return (
    <div className="scramble-stats-panel scramble-stats-examples-panel">
      <div className="scramble-stats-examples-header">
        <div className="scramble-stats-panel-title">
          {tr({ zh: `${depth} 步状态`, en: `${depth}-move states` })}
          <span className="scramble-stats-examples-allcount">
            {essential
              ? tr({ zh: '本质 {n} 个', en: '{n} essentially different' })
                .replace('{n}', nClasses)
              : tr({ zh: '全部 {n} 个', en: 'all {n}' })
                .replace('{n}', total)}
          </span>
        </div>
        <PillToggle
          value={essential}
          onChange={setEssential}
          offLabel={tr({ zh: '全部', en: 'All' })}
          onLabel={tr({ zh: '本质', en: 'Essential' })}
          ariaLabel={tr({ zh: '列全部状态或去除同构后的本质状态', en: 'All states, or one per symmetry class' })}
        />
      </div>
      {/* 帧是任选的,但列出来的打乱只对这一帧是那个步数 —— 写清楚才核对得了。 */}
      {source?.frame && (
        <p className="scramble-stats-exact-note">
          {tr({
            zh: `这一帧 = ${source.frame.corners.join(' / ')} 角 + ${source.frame.edges.join(' / ')} 棱`
              + `(24 个帧互相共轭,分布逐档相同,挑哪一个都行;下面这些打乱是对这一帧的 ${depth} 步)。`,
            en: `This frame = corner ${source.frame.corners.join(' / ')} + edges ${source.frame.edges.join(' / ')} `
              + `(the 24 frames are conjugate, so every one has this same histogram; the scrambles below are ${depth} moves for THIS frame).`,
          })}
        </p>
      )}
      {essential && <p className="scramble-stats-exact-note">
        {tr({
          zh: `${total} 个状态在保住这道题的 ${symmetries.length} 个对称(转体与镜像)下并成 ${nClasses} 类,这里每类摆一个代表。`
            + `每行前面的 ${first}/${total} 是这一类的大小:把这个状态用那 ${symmetries.length} 个对称各作用一遍,只得到 ${first} 个不同的状态,它们算同一个情况`
            + (decomp ? `(${decomp} = ${total})` : '')
            + `。大小 = ${symmetries.length} ÷ 该状态自身对称的个数,所以状态越对称、它那一类越小`
            + (hasFixed ? ` —— 大小 1 的那个自身就有全部 ${symmetries.length} 个对称,怎么转、怎么照镜子都还是它。` : '。'),
          en: `The ${total} states fall into ${nClasses} classes under the ${symmetries.length} symmetries that preserve this question (rotations and mirror); one representative each. `
            + `The ${first}/${total} on each row is that class's size: pushing the state through all ${symmetries.length} symmetries yields only ${first} distinct states, and those count as one case`
            + (decomp ? ` (${decomp} = ${total})` : '')
            + `. A size is ${symmetries.length} ÷ how many symmetries the state has itself, so the more symmetric the state, the smaller its class`
            + (hasFixed ? ` — the size-1 one has all ${symmetries.length} itself: every rotation and the mirror leave it alone.` : '.'),
        })}
      </p>}
      <ul className="scramble-stats-examples-list">
        {visible.map((idx, row) => {
          const scr = scrambles[idx];
          const cls = classOf.get(idx);
          if (scr === undefined) {
            return (
              <li key={idx}>
                <span className="scramble-stats-exact-case-no">#{row + 1}</span>
                <span className="scramble-stats-examples-hint">{tr({ zh: '生成中…', en: 'Generating…' })}</span>
              </li>
            );
          }
          const href = `/${lang}/scramble/analyzer?${new URLSearchParams({ scramble: scr.replace(/ /g, '_') })}`;
          return (
            <li key={idx}>
              <span className="scramble-stats-exact-case-no">#{row + 1}</span>
              {essential && cls && (
                <span
                  className="scramble-stats-exact-case-orbit"
                  title={tr({
                    zh: `这一类共 ${cls.size} 个状态(全部 ${total} 个里的 ${cls.size} 个)`
                      + `:该状态自身有 ${cls.stab} 个对称,${symmetries.length} ÷ ${cls.stab} = ${cls.size}。`,
                    en: `${cls.size} of the ${total} states are this case: it has ${cls.stab} symmetries of its own, `
                      + `and ${symmetries.length} ÷ ${cls.stab} = ${cls.size}.`,
                  })}
                >
                  {cls.size}/{total}
                </span>
              )}
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
      {shown < rows.length && (
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
