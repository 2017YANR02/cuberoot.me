'use client';

/**
 * case 富元数据的**正文**(顶部关联缩略图 + 公式 + 编号 / 对称性 / 概率 / 最优解 …)。
 *
 * 同一份正文喂两个外壳:
 *   - {@link AlgCaseMetaModal} —— 训练页里的弹窗,点关联缩略图是**切弹窗**(`jump.onJump`)
 *   - `AlgCaseDetailClient` —— 独立详情页,点关联缩略图是**跳到那个 case 的详情页**(`jump.href`,真 <a>)
 *
 * 镜像 / 逆 / 镜像逆存的是**表编号**(`meta.no`),不是 DB id;三者关联全落在本 set 内,
 * 所以 `byNo` 一定查得到(查不到只显示编号,不猜)。背景见 AlgCaseMetaModal 顶部注释。
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Star } from 'lucide-react';
import Link from '@/components/AppLink';
import type { AlgCase, AlgCaseMeta, AlgPuzzle } from '@cuberoot/shared';
import { stm } from '@cuberoot/shared/alg-notation';
import { CaseThumb } from '@/components/CaseThumb';
import AlgPlayer from '@/components/AlgPlayer';
import { useCopy } from '@/hooks/useCopy';
import { ALG_SET_UNIVERSE, LL_UNIVERSE_TOTAL, caseOrbit, probabilityFraction } from '@/lib/alg_probability';
import { alignScrambleToSetup, caseScramble } from '@/lib/alg_scramble';
import {
  availableKinds,
  cstimerStyleScramble,
  SCRAMBLE_KINDS,
  type ScrambleKind,
} from '@/lib/trainer-scramble';
import { ALG_TAG_LABEL } from '@/lib/alg_tags';
import { primaryCaseName } from '@/lib/alg_case_display';
import {
  caseViewAlg,
  caseViewSetup,
  displayAlg,
  type CaseViewAngle,
} from '@/lib/alg_display';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { tr } from '@/i18n/tr';
import {
  findPreferredAlg,
  preferredAlgRef,
  preferredAlgSlot,
  sortPreferredAlgs,
  usePreferredAlgs,
} from '@/lib/alg-preferred-algs';

const METRIC_LABEL: Record<string, string> = { stm: 'STM', sqtm: 'SQTM', htm: 'HTM', qtm: 'QTM' };

/** 一行「标签 + 可复制的公式」(`len` 给了就在右边挂步数徽章)。 */
function AlgLine({
  label, alg, len, playable = false, expanded = false, onToggle, preferred = false, onPreferredToggle,
}: {
  label: string;
  alg: string;
  len?: number;
  playable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  preferred?: boolean;
  onPreferredToggle?: () => void;
}) {
  const { copied, copy } = useCopy();
  return (
    <div
      className={`alg-meta-algline${playable ? ' is-playable' : ''}${expanded ? ' is-expanded' : ''}`}
      role={playable ? 'button' : undefined}
      tabIndex={playable ? 0 : undefined}
      aria-expanded={playable ? expanded : undefined}
      onClick={playable ? onToggle : undefined}
      onKeyDown={playable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle?.();
        }
      } : undefined}
      title={playable
        ? (expanded ? tr({ zh: '收起动画', en: 'Collapse animation' }) : tr({ zh: '播放动画', en: 'Play animation' }))
        : undefined}
    >
      {label && <span className="alg-meta-algline-label">{label}</span>}
      <code className="alg-meta-algline-code">{alg}</code>
      {len != null && <span className="alg-meta-algline-len" title="STM">{len}</span>}
      {onPreferredToggle && (
        <button
          type="button"
          className="alg-meta-copy alg-meta-primary"
          onClick={(event) => { event.stopPropagation(); onPreferredToggle(); }}
          title={preferred
            ? tr({ zh: '取消主公式', en: 'Clear primary algorithm' })
            : tr({ zh: '设为主公式', en: 'Set as primary algorithm' })}
          aria-pressed={preferred}
        >
          <Star size={13} fill={preferred ? 'currentColor' : 'none'} />
        </button>
      )}
      <button
        type="button"
        className="alg-meta-copy"
        onClick={(event) => { event.stopPropagation(); copy(alg); }}
        title={tr({ zh: '复制', en: 'Copy' })}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

/** 一条「键 + 值」。`wide`:值挂了一串 chip,在三列网格里独占一行。 */
function Row({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`alg-meta-row${wide ? ' is-wide' : ''}`}>
      <span className="alg-meta-key">{label}</span>
      <span className="alg-meta-val">{children}</span>
    </div>
  );
}

/** 关联缩略图点击后怎么走:弹窗切换(callback)还是跳详情页(link,真 <a>) */
export type RelatedJump =
  | { kind: 'callback'; onJump: (c: AlgCase) => void }
  | { kind: 'link'; href: (c: AlgCase) => string };

interface Props {
  caseObj: AlgCase;
  puzzle: AlgPuzzle;
  set: string;
  /** 同一个 set 里的 `meta.no` → case,用来把镜像/逆做成链接 */
  byNo: Map<number, AlgCase>;
  jump: RelatedJump;
  /**
   * 公式列表的外壳 / 每一行的外壳。默认原样返回 —— 只有 case 详情页的 admin 会传:
   * 它拿这两个口子把公式行包进 dnd-kit(DndContext + SortableAlgRow),好拖顺序。
   * 展示逻辑仍在这里,不在外面复制一份 AlgLine。
   */
  algsWrap?: (rows: React.ReactNode) => React.ReactNode;
  algRowWrap?: (row: React.ReactNode, index: number) => React.ReactNode;
  /** 详情页才传:选择状态由页级 nuqs 持有;训练弹窗仍只显示默认打乱。 */
  scrambleKind?: ScrambleKind;
  onScrambleKindChange?: (kind: ScrambleKind) => void;
  /** 顶层 case 的观察角度；详情页传入，训练弹窗沿用库里的默认角度。 */
  viewAngle?: CaseViewAngle;
  /** 详情页选择的魔方拿法；训练弹窗沿用公式库默认拿法。 */
  orientation?: string;
  /** 详情页启用；训练弹窗保持紧凑静态正文。 */
  playable?: boolean;
  /** 管理员拖拽时保持数据库原始顺序，避免个人置顶改变拖拽索引。 */
  preserveAlgOrder?: boolean;
}

export default function AlgCaseMetaContent({
  caseObj, puzzle, set, byNo, jump,
  algsWrap = (rows) => rows,
  algRowWrap = (row) => row,
  scrambleKind = 'inv',
  onScrambleKindChange,
  viewAngle = 'default',
  orientation,
  playable = false,
  preserveAlgOrder = false,
}: Props) {
  /**
   * 没有 meta 的集(虚拟集 LSLL、库里还没补元数据的集)一样要能看:空对象兜底后
   * 下面每个字段各自 `&&` / `??` 保护,整块整块地自动消失,剩下图 + 公式 + 打乱那几样。
   * 不能让 `caseObj.meta` 直接是 undefined —— `m.no` / `m.sym` 会当场抛。
   */
  const m = (caseObj.meta ?? {}) as AlgCaseMeta;
  const [expandedAlgKey, setExpandedAlgKey] = useState<string | null>(null);
  const preferenceSet = caseObj.srcSet ?? set;
  const preferenceKey = `${puzzle}/${preferenceSet}`;
  const preferredSnapshot = usePreferredAlgs(state => state.snapshots[preferenceKey]);
  const loadPreferred = usePreferredAlgs(state => state.load);
  const setPreferred = usePreferredAlgs(state => state.setPreferred);
  const preferredSlot = preferredAlgSlot(caseObj);
  const preferredRef = preferredSnapshot?.items[preferredSlot];

  useEffect(() => { loadPreferred(puzzle, preferenceSet); }, [loadPreferred, preferenceSet, puzzle]);

  /** 首个朝向的公式(1lll / zbll / pll / ell 都只有一个朝向)。显示 / 步数都剥掉收尾 AUF。 */
  const algs = useMemo(() => {
    const entries = preserveAlgOrder
      ? (caseObj.algs[0] ?? []).map((entry, originalIndex) => ({ entry, originalIndex }))
      : sortPreferredAlgs(caseObj.algs[0] ?? [], preferredRef);
    return entries.map(({ entry: a, originalIndex }) => {
    const playbackAlg = caseViewAlg(a.alg, viewAngle);
    const shown = displayAlg(playbackAlg);
    return {
      key: a.altId ?? shown,
      entry: a,
      originalIndex,
      ref: preferredAlgRef(a),
      playbackAlg,
      text: formatScrambleForEvent(puzzle, shown),
      len: a.stm == null ? undefined : stm(shown),
      tags: a.tags ?? [],
    };
    });
  }, [caseObj.algs, preferredRef, preserveAlgOrder, puzzle, viewAngle]);

  /**
   * 这一族:镜像 / 逆 / 镜像逆 连起来的那一小撮 case(含当前这张),拆成三堆。
   *   `family`    有图可贴的。基准那张排头标「原始」,其余按 `meta.no` 排。
   *   `selfNotes` 基准的某条关系指回它自己(自镜像 / 自逆),只标一句话。
   *   `missing`   编号在本 set 里查不到对应 case(数据缺口),只报编号。
   *
   * **基准不是「你正在看的那张」,是全族编号最小的那张。** 三条关系是一个交换群
   * ({镜像, 逆, 镜像逆} 两两复合还在族内)在这一小撮 case 上的作用,所以从族里任何一张
   * 算出来的成员集合完全相同 —— 「编号最小」于是是全族公认的同一张。基准固定,这排图的
   * 位置和标签就都固定了:点来点去图一张不动,只有「你在看这张」的那个框在移动。
   * 代价是当前这张的标签不一定是「原始」,可能是「逆」—— 那正是它相对基准的关系。
   *
   * 两个关系指到同一个编号是常事(PLL-L 的镜像和镜像逆都是 J):它们是**同一个 case**,
   * 贴两张一模一样的图只会让人以为有两个目标。合成一张,标签并列写(「镜像, 镜像逆」)。
   */
  const { family, selfNotes, missing } = useMemo(() => {
    /** 一个 case 的三条关系,相对它自己说的。 */
    const relsOf = (x: AlgCaseMeta) => ([
      { key: 'mirror', label: tr({ zh: '镜像', en: 'Mirror' }), self: tr({ zh: '自镜像', en: 'self-mirror' }), no: x.mirror },
      { key: 'inv', label: tr({ zh: '逆', en: 'Inverse' }), self: tr({ zh: '自逆', en: 'self-inverse' }), no: x.inv },
      { key: 'im', label: tr({ zh: '镜像逆', en: 'Inv. mirror' }), self: tr({ zh: '自镜像逆', en: 'self-inv-mirror' }), no: x.im },
    ].filter(r => r.no != null) as Array<{ key: string; label: string; self: string; no: number }>);

    const selfNo = m.no ?? -1;
    /** 编号 → case。先按当前这张的关系凑出成员,再用基准的关系补齐。 */
    const members = new Map<number, AlgCase>([[selfNo, caseObj]]);
    for (const r of relsOf(m)) {
      const t = byNo.get(r.no);
      if (t) members.set(r.no, t);
    }

    const originNo = Math.min(...members.keys());
    const origin = members.get(originNo)!;

    const labels = new Map<number, string[]>();
    const notes: Array<{ key: string; text: string }> = [];
    const gone = new Map<number, { key: string; labels: string[]; no: number }>();
    for (const r of relsOf((origin.meta ?? {}) as AlgCaseMeta)) {
      if (r.no === originNo) { notes.push({ key: r.key, text: r.self }); continue; }
      const t = byNo.get(r.no);
      if (!t) {
        const g = gone.get(r.no);
        if (g) g.labels.push(r.label);
        else gone.set(r.no, { key: r.key, labels: [r.label], no: r.no });
        continue;
      }
      members.set(r.no, t);
      const l = labels.get(r.no);
      if (l) l.push(r.label);
      else labels.set(r.no, [r.label]);
    }

    const fam = [...members]
      .filter(([no]) => no !== originNo)
      .sort((a, b) => a[0] - b[0])
      // 拿不到标签只可能是数据两头对不上(A 说 B 是它的镜像,B 不认),退回报编号。
      .map(([no, c]) => ({ key: `no${no}`, labels: labels.get(no) ?? [`#${no}`], case: c, no, current: no === selfNo }));
    fam.unshift({
      key: `no${originNo}`,
      labels: [tr({ zh: '原始', en: 'Origin' })],
      case: origin,
      no: originNo,
      current: originNo === selfNo,
    });
    return { family: fam, selfNotes: notes, missing: [...gone.values()] };
  }, [m, byNo, caseObj]);

  const scrambleKinds = useMemo(() => {
    const ids = new Set(availableKinds(caseObj));
    if (puzzle === '3x3') ids.add('cstimer');
    return SCRAMBLE_KINDS.filter(kind => ids.has(kind.id));
  }, [caseObj, puzzle]);
  const selectedScrambleKind = scrambleKinds.some(kind => kind.id === scrambleKind) ? scrambleKind : 'inv';
  const inverseScramble = useMemo(
    () => caseScramble(caseObj, byNo, puzzle, 'inv'),
    [caseObj, byNo, puzzle],
  );
  const storedScramble = useMemo(
    () => selectedScrambleKind === 'cstimer'
      ? null
      : caseScramble(caseObj, byNo, puzzle, selectedScrambleKind),
    [caseObj, byNo, puzzle, selectedScrambleKind],
  );
  const [cstimerScramble, setCstimerScramble] = useState<{ text: string; fallback: boolean } | null>(null);

  useEffect(() => {
    if (selectedScrambleKind !== 'cstimer' || !inverseScramble) {
      setCstimerScramble(null);
      return;
    }
    let live = true;
    setCstimerScramble(null);
    void cstimerStyleScramble(inverseScramble.text).then(generated => {
      if (!live) return;
      const aligned = generated
        ? alignScrambleToSetup(puzzle, generated, caseObj.setup)
        : null;
      setCstimerScramble({
        text: aligned ?? inverseScramble.text,
        fallback: !aligned,
      });
    });
    return () => { live = false; };
  }, [caseObj.setup, inverseScramble, puzzle, selectedScrambleKind]);

  const rawScramble = selectedScrambleKind === 'cstimer'
    ? cstimerScramble && { text: cstimerScramble.text, fromInvCase: cstimerScramble.fallback }
    : storedScramble;
  const scramble = rawScramble && {
    ...rawScramble,
    text: caseViewSetup(rawScramble.text, viewAngle),
  };

  const sym = m.sym ?? {};
  const symFlags = [
    sym.selfMirror && tr({ zh: '自镜像', en: 'self-mirror' }),
    sym.selfInv && tr({ zh: '自逆', en: 'self-inverse' }),
    sym.full && tr({ zh: '全对称', en: 'full' }),
    sym.anti && tr({ zh: '反对称', en: 'anti' }),
  ].filter(Boolean) as string[];

  const optimal = Object.entries(m.optimal ?? {}) as Array<[string, { len: number; scramble?: string }]>;

  return (
    <>
      {/* 顶部一排缩略图:这一族(镜像 / 逆 / 镜像逆 连起来的那几张)并排对比。
          点其中一张:弹窗里切成那个 case,详情页里跳到那个 case 的详情页。

          排头恒定是全族基准(标「原始」),其余按 `meta.no` 排 —— 全族共用同一份排布,
          所以点来点去图一张不动。加框的那张是「你正在看的」,它的标签未必是「原始」。 */}
      <div className="alg-meta-related-grid alg-meta-top-grid">
        {family.map(f => {
          const labelText = f.labels.join(', ');
          const familySlot = preferredAlgSlot(f.case);
          const familyPreferred = findPreferredAlg(f.case.algs[0] ?? [], preferredSnapshot?.items[familySlot]);
          const inner = (
            <>
              <CaseThumb
                puzzle={puzzle}
                set={set}
                sticker={f.case.sticker}
                alg={familyPreferred?.alg || f.case.algs[0]?.[0]?.alg || f.case.setup || ''}
                setup={f.case.setup}
                size={76}
                viewAngle={viewAngle}
                orientation={orientation}
              />
              <span className="alg-meta-related-label">{labelText}</span>
              <span className="alg-meta-related-name">{primaryCaseName(puzzle, set, f.case)}</span>
            </>
          );
          // 当前这张不是跳转目标,只是参照 —— 不给 hover、不可点。
          if (f.current) {
            return (
              <div key={f.key} className="alg-meta-related-card is-self is-current">{inner}</div>
            );
          }
          const title = tr({ zh: `跳到${labelText}`, en: `Go to ${labelText.toLowerCase()}` });
          if (jump.kind === 'link') {
            return (
              <Link key={f.key} href={jump.href(f.case)} className="alg-meta-related-card" prefetch={false} title={title}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={f.key} type="button" className="alg-meta-related-card" onClick={() => jump.onJump(f.case)} title={title}>
              {inner}
            </button>
          );
        })}
        {/* 自镜像 / 自逆:那一项就是当前 case 本身,不重复贴一张一样的图,只标一句。
            上面的空占位把这行文字压到与带图卡片的 label 行同一条水平线上。 */}
        {selfNotes.map(n => (
          <div key={n.key} className="alg-meta-related-card is-plain">
            <span className="alg-meta-related-thumb-gap" aria-hidden="true" />
            <span className="alg-meta-related-label">{n.text}</span>
          </div>
        ))}
        {/* 关联编号在本 set 里找不到对应 case(数据缺口),只报编号。 */}
        {missing.map(x => (
          <div key={x.key} className="alg-meta-related-card is-plain">
            <span className="alg-meta-related-thumb-gap" aria-hidden="true" />
            <span className="alg-meta-related-label">{x.labels.join(', ')}</span>
            <span className="alg-meta-related-name">#{x.no}</span>
          </div>
        ))}
      </div>

      {/* 打乱紧跟着图 —— 图画的就是打乱之后的样子,两者一起看才对得上;公式是「怎么解开它」,
          排在后面。取值的三档(逆 case 的公式 / 现推 / setup 保底)见 {@link caseScramble}。 */}
      {(scramble || (selectedScrambleKind === 'cstimer' && inverseScramble)) && (
        <div className="alg-meta-section">
          <div className="alg-meta-scramble-row">
            <h3>{tr({ zh: '打乱', en: 'Scramble' })}</h3>
            {onScrambleKindChange && scrambleKinds.length > 1 && (
              <select
                className="alg-meta-scramble-kind"
                value={selectedScrambleKind}
                onChange={event => onScrambleKindChange(event.target.value as ScrambleKind)}
                aria-label={tr({ zh: '打乱类型', en: 'Scramble type' })}
              >
                {scrambleKinds.map(kind => (
                  <option key={kind.id} value={kind.id}>{kind.label()}</option>
                ))}
              </select>
            )}
            {scramble ? (
              <AlgLine
                label={scramble.fromInvCase && (!onScrambleKindChange || selectedScrambleKind === 'cstimer')
                  ? tr({ zh: '逆 case', en: 'Inv case' })
                  : ''}
                alg={scramble.text}
              />
            ) : (
              <span className="alg-meta-scramble-loading">
                {tr({ zh: '正在生成…', en: 'Generating…' })}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="alg-meta-case">
        <div className="alg-meta-case-algs">
          {algsWrap(algs.map((a) => {
            const rowKey = `${a.key}:${a.originalIndex}`;
            const expanded = playable && expandedAlgKey === rowKey;
            const isPreferred = a.ref === preferredRef;
            const label = [
              isPreferred ? tr({ zh: '主公式', en: 'Primary' }) : '',
              a.tags.map(t => ALG_TAG_LABEL[t]()).join(' '),
            ].filter(Boolean).join(' ');
            const togglePreferred = () => setPreferred(
              puzzle,
              preferenceSet,
              preferredSlot,
              isPreferred ? null : a.ref,
            );
            if (!playable) {
              return algRowWrap(
                <AlgLine
                  key={rowKey}
                  label={label}
                  alg={a.text}
                  len={a.len}
                  preferred={isPreferred}
                  onPreferredToggle={togglePreferred}
                />,
                a.originalIndex,
              );
            }
            const playerSetup = a.entry.setup ?? caseObj.setup;
            return algRowWrap(
              <div key={rowKey} className="alg-meta-playable-row">
                <AlgLine
                  label={label}
                  alg={a.text}
                  len={a.len}
                  preferred={isPreferred}
                  onPreferredToggle={togglePreferred}
                  playable
                  expanded={expanded}
                  onToggle={() => setExpandedAlgKey(current => current === rowKey ? null : rowKey)}
                />
                {expanded && (
                  <AlgPlayer
                    alg={a.playbackAlg}
                    puzzle={puzzle}
                    set={set}
                    setup={playerSetup === undefined ? undefined : caseViewSetup(playerSetup, viewAngle)}
                    orientation={orientation}
                  />
                )}
              </div>,
              a.originalIndex,
            );
          }))}
        </div>
      </div>

      {/* 编号 / 子集 / OLL … 每条都只有几个字符,一行一条右边全是空的 —— 三列铺开(窄了自动退档)。
          每条都是「有才出」:没有 meta 的集不该摆一排空值。 */}
      <div className="alg-meta-facts">
        {m.no != null && <Row label={tr({ zh: '编号', en: 'No.' })}>{m.no}</Row>}
        {m.subset && <Row label={tr({ zh: '子集', en: 'Subset' })}>{m.subset}</Row>}
        {m.oll && <Row label="OLL">{m.oll}</Row>}
        {m.cp && <Row label={tr({ zh: '角换', en: 'CP' })}>{m.cp}</Row>}
        {m.type && <Row label={tr({ zh: '叠加类型', en: 'Type' })}>{m.type}</Row>}
        {m.gen && <Row label={tr({ zh: '生成元', en: 'Generators' })}><code>{m.gen}</code></Row>}

        {(sym.cn || symFlags.length > 0) && (
          <Row label={tr({ zh: '对称性', en: 'Symmetry' })}>
            {sym.cn && <span className="alg-meta-chip">C{sym.cn}</span>}
            {symFlags.map(f => <span key={f} className="alg-meta-chip">{f}</span>)}
          </Row>
        )}

        {/* 出现概率:轨道大小(16/cn)÷ 全集状态数。非 1LLL set 同时给 1LLL 全集下的概率 ——
            练 ZBLL 的人想知道「ZZ 到了顶层抽到它多大概率」,练 1LLL 的人想知道全局概率。
            数学原理(轨道-稳定子)见 /math/probability。
            两个 chip + 「原理」挤不进三分之一列,这一条独占一行。 */}
        {(() => {
          const orbit = caseOrbit(caseObj);
          const uni = ALG_SET_UNIVERSE[set];
          if (orbit == null || !uni) return null;
          return (
            <Row label={tr({ zh: '出现概率', en: 'Probability' })} wide>
              <span
                className="alg-meta-chip"
                title={tr({
                  zh: `${uni.label} 全集 ${uni.total} 个状态中占 ${orbit} 个`,
                  en: `${orbit} of ${uni.total} states in the ${uni.label} universe`,
                })}
              >
                {uni.label} {probabilityFraction(orbit, uni.total)}
              </span>
              {set !== '1lll' && (
                <span
                  className="alg-meta-chip"
                  title={tr({
                    zh: `1LLL 全集 ${LL_UNIVERSE_TOTAL} 个状态中占 ${orbit} 个`,
                    en: `${orbit} of ${LL_UNIVERSE_TOTAL} states in the 1LLL universe`,
                  })}
                >
                  1LLL {probabilityFraction(orbit, LL_UNIVERSE_TOTAL)}
                </span>
              )}
              <Link href="/math/probability" className="alg-meta-prob-why" prefetch={false}>
                {tr({ zh: '原理', en: 'Why?' })}
              </Link>
            </Row>
          );
        })()}
      </div>

      {optimal.length > 0 && (
        <div className="alg-meta-section">
          <h3>{tr({ zh: '最优解', en: 'Optimal' })}</h3>
          {optimal.map(([metric, o]) => (
            <div key={metric} className="alg-meta-optimal">
              <span className="alg-meta-optimal-len">
                {METRIC_LABEL[metric] ?? metric} <strong>{o.len}</strong>
              </span>
              {o.scramble && <AlgLine label="" alg={caseViewSetup(o.scramble, viewAngle)} />}
            </div>
          ))}
        </div>
      )}

      {(m.coep?.alg || m.coep?.scramble) && (
        <div className="alg-meta-section">
          <h3>COEP</h3>
          {m.coep.alg && <AlgLine label={tr({ zh: '公式', en: 'Alg' })} alg={displayAlg(caseViewAlg(m.coep.alg, viewAngle))} />}
          {m.coep.scramble && <AlgLine label={tr({ zh: '打乱', en: 'Scramble' })} alg={caseViewSetup(m.coep.scramble, viewAngle)} />}
        </div>
      )}

      {(m.sdbNo || m.docNo || m.oldNo) && (
        <div className="alg-meta-section alg-meta-refs">
          {m.sdbNo && <Row label="speedcubedb">{m.sdbNo}</Row>}
          {m.docNo && <Row label={tr({ zh: '旧编号 (doc)', en: 'Old no. (doc)' })}>{m.docNo}</Row>}
          {m.oldNo && <Row label={tr({ zh: '旧编号', en: 'Old no.' })}>{m.oldNo}</Row>}
        </div>
      )}
    </>
  );
}
