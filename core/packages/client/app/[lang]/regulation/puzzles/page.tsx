'use client';

// /regulation/puzzles — Article 3 (Puzzles).
// Illustrated guide to what puzzle a competitor may bring to the mat: the
// one-colour-per-face colour scheme, the single-logo rule (and the no-marking
// rule for blindfolded events), allowed vs disallowed modifications, and brand
// neutrality. Shared shell + primitives provide the chrome.

import { useTranslation } from 'react-i18next';
import { Palette, BadgeCheck, Wrench, EyeOff, Tag } from 'lucide-react';
import { useT } from '../../../../hooks/useT';
import { CUBE_FILL, CUBE_ON_FILL, type CubeFace } from '@/lib/cube-colors';
import RegArticleLayout from '../_components/RegArticleLayout';
import { RegSection, Callout, RegQuote, RegList } from '../_components/primitives';
import './puzzles.css';

// The six standard cube faces with their canonical name. Colours come from the
// single source lib/cube-colors.ts (real cube colours — fine to render literally
// in the SVG swatches; the rest of the page stays on theme tokens).
const FACES: { face: CubeFace; zh: string; en: string }[] = [
  { face: 'U', zh: '白', en: 'White' },
  { face: 'D', zh: '黄', en: 'Yellow' },
  { face: 'F', zh: '绿', en: 'Green' },
  { face: 'B', zh: '蓝', en: 'Blue' },
  { face: 'L', zh: '橙', en: 'Orange' },
  { face: 'R', zh: '红', en: 'Red' },
];

export default function PuzzlesChapter() {
  useTranslation();
  const t = useT();

  return (
    <RegArticleLayout slug="puzzles">
      {/* ── 1. Colour scheme: one solid colour per face ─────────── */}
      <RegSection
        eyebrow={t('看脸认色', 'How it must look')}
        title={t('一面一色,六面各异', 'One solid colour per face, all six distinct')}
        lede={t(
          '正多面体魔方(三阶、二阶等)必须一面一色:同一个面整面只用一种纯色,六个面的颜色要能清晰区分。这样裁判和选手才能一眼判断有没有还原。',
          'A polyhedral puzzle (3×3×3, 2×2×2, and the like) must wear one colour per face: each face is a single solid colour, and the colours on different faces must be clearly distinguishable. That is what lets a judge or competitor tell at a glance whether it is solved.'
        )}
      >
        <figure className="pz-scheme">
          <div className="pz-swatches" role="img" aria-label={t('六面标准配色', 'The six standard face colours')}>
            {FACES.map(({ face, zh, en }) => (
              <div key={face} className="pz-swatch">
                <svg viewBox="0 0 100 100" className="pz-swatch-svg" aria-hidden="true">
                  <rect
                    x="6" y="6" width="88" height="88" rx="14"
                    fill={CUBE_FILL[face]}
                    className="pz-swatch-rect"
                  />
                  <text
                    x="50" y="50" className="pz-swatch-letter"
                    fill={CUBE_ON_FILL[face]}
                    dominantBaseline="central" textAnchor="middle"
                  >
                    {face}
                  </text>
                </svg>
                <span className="pz-swatch-name">{t(zh, en)}</span>
              </div>
            ))}
          </div>
          <figcaption className="pz-scheme-cap">
            {t(
              '示意:三阶的标准配色 —— 白对黄、绿对蓝、橙对红,六色互不相同。具体用哪六种颜色没有强制规定,但每面必须纯色、各面必须可区分。',
              'A standard 3×3×3 colour scheme — white opposite yellow, green opposite blue, orange opposite red, all six distinct. The exact colours are not mandated, but each face must be a single solid colour and the faces must be tellable apart.'
            )}
          </figcaption>
        </figure>

        <RegQuote num="3d2">
          {t(
            '魔方的有色部分必须是纯色的,同一个面上的颜色必须一致,不同面的颜色必须可清晰区分。',
            'The coloured parts of a puzzle must be a solid colour; the colour on any one face must be uniform, and the colours of different faces must be clearly distinguishable.'
          )}
        </RegQuote>

        <Callout tone="info" label={t('配色靠什么实现', 'How the colour gets there')} icon={<Palette size={17} />}>
          {t(
            '颜色可以来自贴纸、贴片(tile)、有色塑料(无贴纸的“六色”魔方),或喷漆/印刷 —— 但同一个魔方上各有色部分的材质必须一致。魔表是例外,它没有“有色部分”。视觉障碍选手另有例外(盲人可用纹理面,色盲经批准可加颜色或图案)。',
            'The colour may come from stickers, tiles, coloured plastic (a stickerless puzzle), or paint/print — but all the coloured parts on one puzzle must use the same kind of material. Clock is the exception: it has no coloured parts. There are also exceptions for documented visual disabilities (a blind competitor may use textured faces; a colour-blind competitor may, if approved, add colours or patterns).'
          )}
        </Callout>
      </RegSection>

      {/* ── 2. The one-logo rule + BLD no markings ──────────────── */}
      <RegSection
        eyebrow={t('身份与记号', 'Markings and identity')}
        title={t('Logo 只能集中在一个块上,盲拧一个都不行', 'Logos on at most one piece — none for blindfolded')}
        lede={t(
          '魔方必须干净、看不出任何能区分两个相似块的记号、凸起或损伤。唯一获准的“记号”是 logo,而且数量被严格限制。',
          'A puzzle must be clean, with no marking, raised piece, damage or other feature that could tell two otherwise-similar pieces apart. The only marking allowed is a logo — and even that is tightly limited.'
        )}
      >
        <Callout tone="warn" label={t('带 Logo 的块最多一个', 'At most one logo-bearing piece')} icon={<Tag size={17} />}>
          {t(
            '一个块上可以有多个 logo,但整个魔方只能有一个带 logo 的有色部分(规则 3l)。换句话说,限制的是“带 logo 的块最多一个”,而不是 logo 的总数。这个带 logo 的块通常是中心块;logo 可以是凹凸、雕刻或贴上去的覆盖贴纸。无中心块的魔方有例外:金字塔和二阶可放任意块,Square-1 须放在中层块上。',
            'A single piece may carry several logos, but the whole puzzle may have only one logo-bearing coloured part (Regulation 3l). In other words, the limit is on the number of logo-bearing pieces (at most one), not on the number of logos. That piece is normally a centre piece, and the logo may be embossed, engraved, or an overlay sticker. Puzzles without centre pieces are excepted: on a Pyraminx or 2×2×2 it may sit on any piece, and on a Square-1 it must sit on an equatorial-slice piece.'
          )}
        </Callout>

        <Callout tone="danger" label={t('盲拧:零记号', 'Blindfolded: zero markings')} icon={<EyeOff size={17} />}>
          {t(
            '四阶盲拧、五阶盲拧和三阶多盲完全禁止 logo —— 任何能凭手感或视觉透露块的朝向/身份的东西都会给蒙眼选手不公平的优势。出于同样的理由,盲拧项目也禁止用带纹理、靠触摸就能区分方向的贴纸或贴片。(三阶盲拧仍可保留单个 logo。)',
            'Logos are forbidden entirely on 4×4×4 Blindfolded, 5×5×5 Blindfolded and 3×3×3 Multi-Blind — anything that betrays a piece’s orientation or identity by touch or sight would give a blindfolded solver an unfair edge. For the same reason, textured stickers or tiles whose orientation can be felt are banned in blindfolded events. (3×3×3 Blindfolded may still keep its single logo.)'
          )}
        </Callout>

        <RegQuote num="3j">
          {t(
            '魔方必须干净清洁,且不得有任何记号、不平整的块、损伤,或其他使得可以分辨两个相似的块的特别之处。例外:一个 logo。',
            'A puzzle must be clean, with no marking, raised piece, damage or other feature that could distinguish two similar pieces. Exception: a single logo.'
          )}
        </RegQuote>
      </RegSection>

      {/* ── 3. Modifications: allowed vs not ────────────────────── */}
      <RegSection
        eyebrow={t('能改到什么程度', 'How far you may modify')}
        title={t('可以改手感,不能改本质', 'You may tune the feel, not the puzzle’s nature')}
        lede={t(
          '判断一个改装合不合法,就看一条原则:相比未改装的同款,它有没有泄露关于块的朝向或身份的额外信息。改善稳定性和手感的随便改,泄露信息或简化解法的一律不行。',
          'One principle decides whether a modification is legal: compared with the unmodified version, does it reveal any extra information about a piece’s orientation or identity? Anything that only improves stability or feel is fine; anything that leaks information — or makes the solve easier — is not.'
        )}
      >
        <div className="pz-cmp">
          <div className="pz-cmp-col pz-cmp-ok">
            <div className="pz-cmp-head">
              <BadgeCheck size={18} />
              {t('允许的改装', 'Allowed')}
            </div>
            <RegList
              items={[
                t('内部精心打磨,让转动更顺', 'Sanding the internals smoother'),
                t('润滑(上油 / 硅油)', 'Lubrication'),
                t('加磁,改善定位与手感', 'Adding magnets for positioning and feel'),
                t('换弹簧 / 调松紧', 'Swapping springs or adjusting tension'),
                t('“面包”(pillowed)外形', '“Pillowed” shapes'),
                t('无贴纸的六色塑料魔方', 'Stickerless coloured-plastic puzzles'),
              ]}
            />
          </div>
          <div className="pz-cmp-col pz-cmp-bad">
            <div className="pz-cmp-head">
              <Wrench size={18} />
              {t('不允许的改装', 'Not allowed')}
            </div>
            <RegList
              items={[
                t('改变魔方的基本玩法 / 难度本质', 'Changing the puzzle’s fundamental concept'),
                t('透露块朝向或身份的额外记号', 'Markings that reveal piece orientation or identity'),
                t('能看穿魔方状态的透明件', 'Transparent parts that reveal the state'),
                t('含电子元件(蓝牙 / 电机 / 传感器 / 灯)', 'Electronic components (Bluetooth, motors, sensors, lights)'),
                t('盲拧用的可触摸纹理贴纸 / 贴片', 'Feel-able textured stickers/tiles in blindfolded events'),
              ]}
            />
          </div>
        </div>

        <Callout tone="success" label={t('两条兜底要求', 'Two backstops')} icon={<BadgeCheck size={17} />}>
          {t(
            '不论怎么改:魔方必须能被正常打乱、完全可转动(规则 3a2),并保持干净无损。改装导致的失常发挥不能作为额外还原机会的理由(规则 3h3)。只要符合规则,任何品牌的魔方和零件都能用 —— WCA 对品牌完全中立(规则 3m)。',
            'Whatever you change, the puzzle must still be fully operational and scrambleable (Regulation 3a2) and stay clean and undamaged. Poor performance caused by a modification is never grounds for an extra attempt (Regulation 3h3). And as long as it complies with the rules, any brand of puzzle or part is allowed — the WCA is completely brand-neutral (Regulation 3m).'
          )}
        </Callout>

        <Callout tone="info" label={t('上场前先过检', 'Cleared before it competes')}>
          {t(
            '魔方在使用前应经 WCA 代表检查(规则 3k)。轮次中发现不被允许的魔方必须更换;用不被允许的魔方完成的还原判为 DNF —— 除非在该轮结束前发现,代表可酌情给额外还原替代(规则 3k2)。',
            'A puzzle should be checked by the WCA Delegate before use (Regulation 3k). A non-permitted puzzle found mid-round must be replaced; an attempt made with one is a DNF — unless it is caught before the round ends, in which case the Delegate may grant an extra attempt instead (Regulation 3k2).'
          )}
        </Callout>
      </RegSection>
    </RegArticleLayout>
  );
}
