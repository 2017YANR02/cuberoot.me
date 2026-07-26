'use client';

/**
 * 一条公式的**三份镜像**,行内展开(issue #40 T5 的 U1)。
 *
 * 槽统一在 FR 之后,左右镜和前后镜给出的是**同一个伙伴 case** —— 区别只在公式落到它的哪个
 * y 视角。所以这里三行不是三个 case,是同一件事的三种握法:
 *
 *   左右镜(M 平面) → 伙伴 case 的 **FL 视角**   R↔L 反向,F 仍是 F,**不会冒出 B**
 *   前后镜(S 平面) → 伙伴 case 的 **BR 视角**   F↔B 反向,含 F 的公式会**变出 B**
 *   y²(纯旋转)     → **本 case 自己**的 BL 视角  不是镜像,只是换个朝向做同一件事
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
import { applyMirrorGen, type MirrorGen } from '@cuberoot/shared/alg-mirror';
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
  alg, puzzle, mirrorName, selfName,
}: {
  alg: string;
  puzzle: AlgPuzzle;
  /** 伙伴 case 的显示名;没建链时传 undefined,只标视角不标 case */
  mirrorName?: string | null;
  /** 本 case 的显示名(y² 那行落在自己身上) */
  selfName?: string | null;
}) {
  const variants = useMemo<Variant[]>(() => {
    const body = displayAlg(alg);
    const partner = mirrorName ?? tr({ zh: '镜像 case', en: 'the mirror case' });
    const self = selfName ?? tr({ zh: '本 case', en: 'this case' });
    // 认不出来的记号会抛 —— 那条就不出行,不能让一条脏公式把整个面板打空
    const made = (gen: MirrorGen): string | null => {
      try { return applyMirrorGen(body, gen); } catch { return null; }
    };
    const rows: Array<[MirrorGen, string, string]> = [
      ['lr', tr({ zh: '左右镜', en: 'Left-right' }), `${partner} · FL`],
      ['fb', tr({ zh: '前后镜', en: 'Front-back' }), `${partner} · BR`],
      ['y2', 'y²', `${self} · BL`],
    ];
    return rows.flatMap(([key, label, where]) => {
      const out = made(key);
      return out ? [{ key, label, where, alg: out }] : [];
    });
  }, [alg, mirrorName, selfName]);

  if (variants.length === 0) return null;

  return (
    <div className="alg-mirror-panel">
      {variants.map(v => <VariantRow key={v.key} v={v} puzzle={puzzle} />)}
    </div>
  );
}
