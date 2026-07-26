'use client';

/**
 * 一条公式的**三份镜像**,行内展开(issue #40 T5 的 U1)。
 *
 * 槽统一在 FR 之后,左右镜和前后镜给出的是**同一个伙伴 case** —— 区别只在公式落到它的哪个
 * y 视角。所以这里三行不是三个 case,是同一件事的三种握法(下面写的是源在 FR 时的落点):
 *
 *   左右镜(M 平面) → 伙伴 case 的 **FL 视角**   R↔L 反向,F 仍是 F,**不会冒出 B**
 *   前后镜(S 平面) → 伙伴 case 的 **BR 视角**   F↔B 反向,含 F 的公式会**变出 B**
 *   y²(纯旋转)     → **本 case 自己**的 BL 视角  不是镜像,只是换个朝向做同一件事
 *
 * 源不在 FR 时落点跟着换,查 `MIRROR_VIEW`(那三个置换构成克莱因四元群,自己就是自己的逆)。
 * 公式重写本身与视角无关 —— 换视角只换「落到谁的哪一栏」这句话。
 *
 * 重写走 `@cuberoot/shared/alg-mirror` 的 `applyMirrorGen` —— **和 server 入库同步用的是同一个
 * 函数**,所以这里看到的字符串就是同步会写进库的那条,一字不差。规则本身在
 * `@cuberoot/shared/alg-notation`(`M`/`m`/`x` 落在镜面法向轴上,**不取反**,那条豁免栽过两次)。
 *
 * 只对 `MIRROR_SETS` 里的 set 显示 —— 别的 set 要么不是单槽、要么伙伴不在库里,详见
 * docs/issue-40-alg-mirror-plan.md §5.7。
 */
import { useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { MIRROR_SETS, type AlgPuzzle } from '@cuberoot/shared';
import { applyMirrorGen, MIRROR_TARGET, MIRROR_VIEW, VIEWS, type MirrorGen } from '@cuberoot/shared/alg-mirror';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { displayAlg } from '@/lib/alg_display';
import { useCopy } from '@/hooks/useCopy';
import { tr } from '@/i18n/tr';

/** 这个 puzzle/set 有没有镜像系统。 */
export const hasMirror = (puzzle: string, set: string) => MIRROR_SETS.has(`${puzzle}/${set}`);

interface Variant {
  key: MirrorGen;
  label: string;
  /** 落在哪个 case 的哪个视角 */
  where: string;
  alg: string;
}

function VariantRow({ v, puzzle }: { v: Variant; puzzle: AlgPuzzle }) {
  const { copied, copy } = useCopy();
  const text = formatScrambleForEvent(puzzle, v.alg);
  return (
    <div className="alg-mirror-line">
      <span className="alg-mirror-label">{v.label}</span>
      <span className="alg-mirror-where">{v.where}</span>
      <code className="alg-mirror-alg">{text}</code>
      <button
        type="button"
        className="alg-alg-copy-btn"
        onClick={(e) => { e.stopPropagation(); copy(text); }}
        title={tr({ zh: '复制', en: 'Copy' })}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

export default function AlgMirrorPanel({
  alg, puzzle, mirrorName, selfName, ori = 0,
}: {
  alg: string;
  puzzle: AlgPuzzle;
  /** 伙伴 case 的显示名;没建链时传 undefined,只标视角不标 case */
  mirrorName?: string | null;
  /** 本 case 的显示名(y² 那行落在自己身上) */
  selfName?: string | null;
  /** 这条公式所在的视角(0=FR 1=FL 2=BL 3=BR)。只影响「落到哪一栏」的说明。 */
  ori?: number;
}) {
  const variants = useMemo<Variant[]>(() => {
    const body = displayAlg(alg);
    const partner = mirrorName ?? tr({ zh: '镜像 case', en: 'the mirror case' });
    const self = selfName ?? tr({ zh: '本 case', en: 'this case' });
    // 认不出来的记号会抛 —— 那条就不出行,不能让一条脏公式把整个面板打空
    const made = (gen: MirrorGen): string | null => {
      try { return applyMirrorGen(body, gen); } catch { return null; }
    };
    const at = (gen: MirrorGen) =>
      `${MIRROR_TARGET[gen] === 'self' ? self : partner} ${VIEWS[MIRROR_VIEW[gen][ori % 4]]}`;
    const rows: Array<[MirrorGen, string]> = [
      ['lr', tr({ zh: '左右镜', en: 'Left-right' })],
      ['fb', tr({ zh: '前后镜', en: 'Front-back' })],
      ['y2', 'y²'],
    ];
    return rows.flatMap(([key, label]) => {
      const out = made(key);
      return out ? [{ key, label, where: at(key), alg: out }] : [];
    });
  }, [alg, mirrorName, selfName, ori]);

  if (variants.length === 0) return null;

  return (
    <div className="alg-mirror-panel">
      {variants.map(v => <VariantRow key={v.key} v={v} puzzle={puzzle} />)}
    </div>
  );
}
