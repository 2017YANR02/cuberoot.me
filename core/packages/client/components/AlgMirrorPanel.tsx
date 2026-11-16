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
 * NxN 公式集共用此预览及“不含 B 族”的结果筛选，y2 只用于 F2L。
 * MIRROR_SETS 只控制单槽关联和槽位链接，不限制预览入口，
 * 也不因预览而扩大数据库自动生成/同步范围。
 */
import { useMemo } from 'react';
import AppLink from '@/components/AppLink';
import { MIRROR_SETS, type AlgPuzzle } from '@cuberoot/shared';
import { applyMirrorGen, lrMirrorAlgHtml, mirrorGensFor, MIRROR_TARGET, MIRROR_VIEW, VIEWS, type MirrorGen } from '@cuberoot/shared/alg-mirror';
import { formatScrambleForEvent } from '@cuberoot/shared/sq1-notation';
import { displayCaseAlg, displayCaseAlgHtml } from '@/lib/alg_display';
import { tr } from '@/i18n/tr';
import { canonicalizeInitialU2 } from '@cuberoot/shared/alg-html';

/** 这个 puzzle/set 有没有镜像系统。 */
export const hasMirror = (puzzle: string, set: string) => MIRROR_SETS.has(`${puzzle}/${set}`);

/** 现有镜面变换适用于 NxN；其他魔方的同名字母不是同一种转动。 */
export const supportsAlgMirrorPreview = (puzzle: string) => /^([2-7])x\1$/.test(puzzle);

interface Variant {
  key: MirrorGen;
  label: string;
  /** 落在哪个 case 的哪个视角 */
  where: string;
  alg: string;
  html?: string;
}

function VariantRow({ v, puzzle, href, onSelect }: { v: Variant; puzzle: AlgPuzzle; href?: string; onSelect?: () => void }) {
  const text = formatScrambleForEvent(puzzle, v.alg);
  const content = <>
      <span className="alg-mirror-label">{v.label}</span>
      <code className="alg-mirror-alg">{v.html ? <span dangerouslySetInnerHTML={{ __html: v.html }} /> : text}</code>
    </>;
  return href
    ? <AppLink href={href} prefetch={false} className="alg-mirror-line" aria-label={`${v.label} ${v.where} ${text}`} onClick={event => event.stopPropagation()}>{content}</AppLink>
    : onSelect ? <button type="button" className="alg-mirror-line" aria-label={`${v.label} ${v.where} ${text}`} onClick={event => { event.stopPropagation(); onSelect(); }}>{content}</button>
    : <div className="alg-mirror-line">{content}</div>;
}

export default function AlgMirrorPanel({
  alg, algHtml, puzzle, set = '', mirrorName, selfName, ori = 0, mirrorHref, selfHref, onMirrorSelect, onSelfSelect,
}: {
  alg: string;
  algHtml?: string;
  set?: string;
  puzzle: AlgPuzzle;
  mirrorHref?: string;
  selfHref?: string;
  onMirrorSelect?: () => void;
  onSelfSelect?: () => void;
  /** 伙伴 case 的显示名;没建链时传 undefined,只标视角不标 case */
  mirrorName?: string | null;
  /** 本 case 的显示名(y² 那行落在自己身上) */
  selfName?: string | null;
  /** 这条公式所在的视角(0=FR 1=FL 2=BL 3=BR)。只影响「落到哪一栏」的说明。 */
  ori?: number;
}) {
  const singleSlot = hasMirror(puzzle, set);
  const variants = useMemo<Variant[]>(() => {
    if (!supportsAlgMirrorPreview(puzzle)) return [];
    // 所有套系复用同一结果筛选；背面转动隐藏整条，不删除公式中的步骤。
    const allowY2 = puzzle === '3x3' && (set === 'f2l' || set === 'adv-f2l');
    const allowedGens = new Set(mirrorGensFor(alg).filter(gen => gen !== 'y2' || allowY2));
    const partner = mirrorName ?? tr({ zh: '镜像 case', en: 'the mirror case' });
    const self = selfName ?? tr({ zh: '本 case', en: 'this case' });
    // 认不出来的记号会抛 —— 那条就不出行,不能让一条脏公式把整个面板打空
    const made = (gen: MirrorGen): string | null => {
      try { return applyMirrorGen(alg, gen); } catch { return null; }
    };
    const at = (gen: MirrorGen) => {
      const name = MIRROR_TARGET[gen] === 'self' ? self : partner;
      return singleSlot ? `${name} ${VIEWS[MIRROR_VIEW[gen][ori % 4]]}` : name;
    };
    const rows: Array<[MirrorGen, string]> = [
      ['lr', tr({ zh: 'LR镜像', en: 'LR-mirror' })],
      ['fb', tr({ zh: 'FB镜像', en: 'FB-mirror' })],
      ['y2', tr({ zh: 'y2旋转', en: 'y2-rot' })],
    ];
    return rows.flatMap(([key, label]) => {
      if (!allowedGens.has(key)) return [];
      const out = made(key);
      if (!out) return [];
      const html = key === 'lr' ? lrMirrorAlgHtml({ alg, algHtml }, out) : undefined;
      const entry = puzzle === '3x3' ? canonicalizeInitialU2({ alg: out, algHtml: html ?? undefined }) : { alg: out, algHtml: html ?? undefined };
      return [{ key, label, where: at(key), alg: displayCaseAlg(puzzle, set, entry.alg),
        html: entry.algHtml ? displayCaseAlgHtml(puzzle, set, entry.algHtml) : undefined }];
    });
  }, [alg, algHtml, puzzle, set, mirrorName, selfName, ori, singleSlot]);

  if (variants.length === 0) return null;

  return (
    <div className="alg-mirror-panel">
      {variants.map(v => {
        const base = MIRROR_TARGET[v.key] === 'self' ? selfHref : mirrorHref;
        const slot = VIEWS[MIRROR_VIEW[v.key][ori % 4]];
        const href = base && singleSlot ? `${base}${base.includes('?') ? '&' : '?'}slot=${slot}#slot-${slot}` : base;
        return <VariantRow key={v.key} v={v} puzzle={puzzle} href={href} onSelect={MIRROR_TARGET[v.key] === 'self' ? onSelfSelect : onMirrorSelect} />;
      })}
    </div>
  );
}
