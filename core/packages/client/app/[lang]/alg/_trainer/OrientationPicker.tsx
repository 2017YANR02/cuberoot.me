'use client';

/**
 * 顶层朝向偏好 —— 训练设置里 post-AUF 的细化版。
 *
 * post-AUF 开着时,同一个 case 每次朝哪边是随机的(练识别)。有人要反过来:先把
 * 「黄条朝上」那一种练熟再换下一种。这里按**形状**把本场的 case 分组(ZBLL 正好 7 组:
 * U / T / L / Pi / S+ / S- 各 4 个朝向,H 高对称只有 2 个),每组摆出它的几种朝向让人挑。
 *
 * 图走 OLL 识别图那一版(`view=oll` + 删灰格:只剩黄格与黄条),不是库里那张全彩 case 图 ——
 * 这里挑的是「形状指向哪边」,一整组几十条 case 共用一个选择;全彩图会把某一条 case 的
 * 角块 / 棱块排列也画进去,看着像在选那一条。翻色形状恰恰是全组共有的那部分。
 * 分组判据见 `lib/alg_ll_orientation`。
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { VisualCube } from '@/components/VisualCube';
import { caseBaseAlg } from '@/lib/trainer-scramble';
import {
  ORI_AUF, orientationCycle, oriCornersOnly, type OrientationSel,
} from '@/lib/alg_ll_orientation';
import { primaryCaseName, ZBLL_GROUP_RENAME } from '@/lib/alg_case_display';
import { tr } from '@/i18n/tr';

interface OriOption {
  /** 相对本组规范朝向转了几次 U —— 落盘存的就是它 */
  off: number;
  /** 摆出这个朝向的打乱(代表 case 的 setup + 对应 AUF) */
  setup: string;
}

interface OriGroup {
  key: string;
  label: string;
  rep: AlgCase;
  set: string;
  options: OriOption[];
}

/** 本地渲染的上限:再多就交给 `<img loading="lazy">`(见 `VisualCube` 的 local 注释)。 */
const LOCAL_THUMB_BUDGET = 40;
const THUMB = 40;

function groupsOf(puzzle: AlgPuzzle, setSlug: string, cases: readonly AlgCase[]): OriGroup[] {
  const size = puzzle === '2x2' ? 2 : 3;
  const draft = new Map<string, {
    g: OriGroup; olls: Set<string>; names: Set<string>; subs: Set<string>;
  }>();

  for (const c of cases) {
    const set = c.srcSet ?? setSlug;
    const base = caseBaseAlg(c);
    if (!base) continue; // 虚拟集的 setup 还没算出来 —— 等算出来了自然进组
    const cyc = orientationCycle(base, size, oriCornersOnly(puzzle, set));
    if (!cyc || cyc.distinct < 2) continue; // 顶层全同色(PLL 一类):没有朝向可言
    let d = draft.get(cyc.key);
    if (!d) {
      const seen = new Set<number>();
      const options: OriOption[] = [];
      for (let k = 0; k < ORI_AUF.length; k++) {
        if (seen.has(cyc.masks[k])) continue; // 2 重对称:后一半是重复的相位
        seen.add(cyc.masks[k]);
        options.push({ off: cyc.offs[k], setup: `${base} ${ORI_AUF[k]}`.trim() });
      }
      // 按相位排(不是按代表 case 的书写相位)—— 顺序于是只由形状决定:换一批勾选、
      // 换一套公式集,同一个形状的四格还在原位,钉住的那格不会跳到别的列去。
      options.sort((a, b) => a.off - b.off);
      d = {
        g: { key: cyc.key, label: '', rep: c, set, options },
        olls: new Set(), names: new Set(), subs: new Set(),
      };
      draft.set(cyc.key, d);
    }
    if (c.meta?.oll) d.olls.add(c.meta.oll);
    d.names.add(c.name);
    const sub = String(c.subgroup ?? '').split('/')[0].trim();
    if (sub) d.subs.add(sub);
  }

  // 组名:能一句话说清就写,说不清就不写 —— 图本身已经是最准的标识。
  const rename = (s: string) => ZBLL_GROUP_RENAME[s] ?? s;
  for (const d of draft.values()) {
    if (d.olls.size === 1) d.g.label = rename([...d.olls][0]);
    else if (d.names.size === 1) d.g.label = primaryCaseName(puzzle, d.g.set, d.g.rep);
    else if (d.subs.size === 1) d.g.label = rename([...d.subs][0]);
  }
  // 重名了就全都不写:一列里两个「Pi」比没有名字更难认。
  const seen = new Map<string, number>();
  for (const d of draft.values()) if (d.g.label) seen.set(d.g.label, (seen.get(d.g.label) ?? 0) + 1);
  for (const d of draft.values()) if (d.g.label && (seen.get(d.g.label) ?? 0) > 1) d.g.label = '';

  return [...draft.values()].map(d => d.g);
}

export default function OrientationPicker({
  puzzle, setSlug, cases, postAuf, sel, onChange, onReset,
}: {
  puzzle: AlgPuzzle;
  setSlug: string;
  /** 本场真正会出的 case(勾选 ∩ 范围),不是整套 */
  cases: readonly AlgCase[];
  /** 没钉朝向时的默认行为:开 = 每次随机换一个方向,关 = 恒等于库里那张图 */
  postAuf: boolean;
  sel: OrientationSel;
  onChange: (key: string, offs: number[]) => void;
  onReset: () => void;
}) {
  const groups = useMemo(() => groupsOf(puzzle, setSlug, cases), [puzzle, setSlug, cases]);
  const [openRaw, setOpen] = useState<boolean | null>(null);
  if (groups.length === 0) return null;

  // 一两组直接摊开(点进来就能挑);多了先收起来,免得把设置面板顶成一屏。
  const open = openRaw ?? groups.length <= 2;
  const pinned = groups.filter(g => (sel[g.key]?.length ?? 0) > 0).length;
  const thumbs = groups.reduce((n, g) => n + g.options.length, 0);
  const local = thumbs <= LOCAL_THUMB_BUDGET;

  const toggle = (g: OriGroup, off: number) => {
    const cur = sel[g.key] ?? [];
    const free = cur.length === 0 || cur.length >= g.options.length;
    // 全放开时点一格 = 「只出这个」(想固定朝向的人一下就到位);否则按加减处理。
    if (free) { onChange(g.key, [off]); return; }
    const next = cur.includes(off) ? cur.filter(o => o !== off) : [...cur, off];
    onChange(g.key, next.length >= g.options.length ? [] : next);
  };

  return (
    <>
      <div className="trainer-opts-row">
        <span className="trainer-opts-label">{tr({ zh: '朝向', en: 'Orientation' })}</span>
        <button
          type="button"
          className="trainer-ori-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={tr({ zh: '朝向', en: 'Orientation' })}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {/* 没钉朝向、post-AUF 又关着 = 默认状态,不写字:一行里「朝向 ›」后面跟一句
              解释默认行为的话,读起来像是个选中的选项。 */}
          {pinned > 0
            ? tr({ zh: '已固定', en: 'Pinned' })
            : postAuf
              ? tr({ zh: '随机', en: 'Random' })
              : null}
        </button>
        {pinned > 0 && (
          <button type="button" className="trainer-opts-btn is-ghost" onClick={onReset}>
            {tr({ zh: '全放开', en: 'Release all' })}
          </button>
        )}
      </div>
      {open && (
        <>
          <div className="trainer-ori-list">
            {groups.map(g => {
              const cur = sel[g.key] ?? [];
              const free = cur.length === 0 || cur.length >= g.options.length;
              return (
                <div className="trainer-ori-group" key={g.key}>
                  <span className="trainer-ori-name">{g.label}</span>
                  <div className="trainer-ori-cells">
                    {g.options.map((o, i) => {
                      const on = free || cur.includes(o.off);
                      return (
                        <button
                          key={o.off}
                          type="button"
                          className={`trainer-ori-cell${on ? ' is-on' : ''}`}
                          aria-pressed={!free && on}
                          aria-label={[g.label, tr({ zh: '朝向', en: 'orientation' }), i + 1].filter(Boolean).join(' ')}
                          onClick={() => toggle(g, o.off)}
                        >
                          <VisualCube
                            view="oll"
                            hideGreySides
                            setup={o.setup}
                            size={THUMB}
                            puzzleSize={puzzle === '2x2' ? 2 : 3}
                            local={local}
                            loading={local ? undefined : 'lazy'}
                            alt=""
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="trainer-opts-hint">
            {tr({
              zh: '点一格 = 这个形状只按那个朝向出题,再点一下放开;可以多选。分组按形状算,所以在 ZBLL 里固定的朝向,练 COLL / OLL 碰到同一个形状也跟着固定',
              en: 'Tap a tile to serve that shape only in that orientation; tap again to release, and multi-select works. Groups are keyed by the shape itself, so an orientation pinned in ZBLL stays pinned for the same shape in COLL / OLL',
            })}
          </div>
        </>
      )}
    </>
  );
}
