'use client';

// /regulation/notation — WCA Regulations Article 12 (Notation).
//
// The visual showcase of the guide: every move symbol for every puzzle is shown
// as a small 3D cube that continuously loops that single move (NotationMove).
// Square-1 and Clock are explained with bespoke diagrams + tables instead of 3D
// (sq1 3D in cubing.js is unreliable; clock notation reads better as a diagram).
//
// Content paraphrases the official Article 12; canonical symbols verified against
// worldcubeassociation.org/regulations/full/#12 (2025 revision).

import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { useT } from '../../../../hooks/useT';
import RegArticleLayout from '../_components/RegArticleLayout';
import { RegSection, Callout, RegList } from '../_components/primitives';
import NotationMove from './NotationMove';
import './notation.css';
import { T } from '@/i18n/tr';

/** Inline mono token for prose (e.g. <K>R'</K>). */
function K({ children }: { children: ReactNode }) {
  return <code className="nt-k">{children}</code>;
}

export default function NotationPage() {
  const t = useT();

  return (
    <RegArticleLayout slug="notation">
      {/* ── Intro ──────────────────────────────────────────── */}
      <RegSection
        eyebrow={t('为什么需要记号', 'Why notation exists')}
        title={t('一套写下转动的通用语言', 'A shared language for writing down moves')}
        lede={t(
          '记号(notation)是把每一步转动写成文字的办法。打乱用它生成、解法用它记录、裁判用它核对 —— 同一个打乱在世界任何地方都能被一模一样地还原出来。',
          'Notation is how a single move is written as text. Scrambles are generated in it, solutions are recorded in it, and judges check against it — so the same scramble can be reproduced identically anywhere in the world.'
        )}
      >
        <p className="reg-sec-lede" style={{ marginTop: 0 }}>
          {<T zh={<>每种魔方都有自己的一套字母,但思路是统一的:<b>一个大写字母代表转动哪一层或哪个面</b>,后面可以跟修饰符表示方向和角度。下面按魔方种类逐一演示 —— 每个方块都在<b>循环播放那一步转动</b>,点一下可以立即重播。</>} en={<>Each puzzle has its own letters, but the idea is the same: <b>one capital letter says which face or layer turns</b>, and an optional suffix says how far and which way. Below, every puzzle is demonstrated move by move — each cube <b>loops that one turn on repeat</b>; tap any tile to replay it now.</>} />}
        </p>
      </RegSection>

      {/* ── 3×3×3 ──────────────────────────────────────────── */}
      <RegSection
        eyebrow={t('12a · 三阶与 NxN', '12a · 3×3×3 and NxN')}
        title={t('面转、宽层与整体旋转', 'Face turns, wide turns and rotations')}
        lede={
          <T zh={<>三阶的六个面各有一个字母:<K>F</K> 前、<K>B</K> 后、<K>R</K> 右、<K>L</K> 左、<K>U</K> 顶、<K>D</K> 底。单独一个字母 = 把那个面<b>顺时针转 90°</b>(以正对该面的视角为准)。</>} en={<>Each of the six faces has a letter: <K>F</K> front, <K>B</K> back, <K>R</K> right, <K>L</K> left, <K>U</K> up, <K>D</K> down. A bare letter means turn that face <b>90° clockwise</b>, as seen looking straight at it.</>} />
        }
      >
        <div className="nt-grid">
          <NotationMove puzzle="3x3x3" move="R" caption={t('右面顺时针 90°', 'Right face, 90° clockwise')} />
          <NotationMove puzzle="3x3x3" move="R'" symbol="R'" caption={t('加 撇号 = 逆时针', "Add ' for counter-clockwise")} />
          <NotationMove puzzle="3x3x3" move="R2" caption={t('加 2 = 转半圈 180°', 'Add 2 for a 180° half turn')} />
          <NotationMove puzzle="3x3x3" move="U" caption={t('顶面顺时针 90°', 'Up face, 90° clockwise')} />
          <NotationMove puzzle="3x3x3" move="F" caption={t('前面顺时针 90°', 'Front face, 90° clockwise')} />
          <NotationMove puzzle="3x3x3" move="L" caption={t('左面顺时针 90°', 'Left face, 90° clockwise')} />
        </div>

        <h3 className="reg-sub-title">{t('宽层转动:带两层一起', 'Wide turns: two layers at once')}</h3>
        <p className="reg-sec-lede" style={{ marginTop: 0 }}>
          {<T zh={<>字母后加 <K>w</K>(wide,“宽”)表示连<b>外侧两层</b>一起转,比如 <K>Rw</K>、<K>Uw</K>。常见的小写写法 <K>r</K> <K>u</K> 与之等价。</>} en={<>A <K>w</K> suffix (“wide”) turns the <b>outer two layers</b> together, e.g. <K>Rw</K>, <K>Uw</K>. The lowercase forms <K>r</K> <K>u</K> mean the same thing.</>} />}
        </p>
        <div className="nt-grid">
          <NotationMove puzzle="3x3x3" move="Rw" caption={t('右侧两层一起顺时针', 'Right two layers, clockwise')} />
          <NotationMove puzzle="3x3x3" move="Uw" caption={t('顶部两层一起顺时针', 'Top two layers, clockwise')} />
          <NotationMove puzzle="3x3x3" move="Fw" caption={t('前侧两层一起顺时针', 'Front two layers, clockwise')} />
        </div>

        <h3 className="reg-sub-title">{t('整体旋转:转的是整个魔方', 'Rotations: turning the whole puzzle')}</h3>
        <p className="reg-sec-lede" style={{ marginTop: 0 }}>
          {<T zh={<>小写 <K>x</K> <K>y</K> <K>z</K> 不动任何一层,而是把<b>整个魔方</b>转一下,用来换观察角度。<K>x</K> 跟 <K>R</K> 同向、<K>y</K> 跟 <K>U</K> 同向、<K>z</K> 跟 <K>F</K> 同向。它们不计入步数。</>} en={<>Lowercase <K>x</K> <K>y</K> <K>z</K> turn the <b>whole puzzle</b> without moving any single layer — used to re-orient your view. <K>x</K> follows <K>R</K>, <K>y</K> follows <K>U</K>, <K>z</K> follows <K>F</K>. They don't count as moves.</>} />}
        </p>
        <div className="nt-grid">
          <NotationMove puzzle="3x3x3" move="x" caption={t('整体绕 R 轴翻', 'Whole cube, around the R axis')} />
          <NotationMove puzzle="3x3x3" move="y" caption={t('整体绕 U 轴转', 'Whole cube, around the U axis')} />
          <NotationMove puzzle="3x3x3" move="z" caption={t('整体绕 F 轴转', 'Whole cube, around the F axis')} />
        </div>
      </RegSection>

      {/* ── Big cubes ──────────────────────────────────────── */}
      <RegSection
        eyebrow={t('12a · 大方块', '12a · Big cubes')}
        title={t('用数字前缀指定层数', 'A numeric prefix names the layer')}
        lede={
          <T zh={<>四阶以上有了内层,记号在字母前加一个数字来指明<b>从外往里数到第几层</b>。下面用四阶演示。</>} en={<>From 4×4 up there are inner layers, so a number in front of the letter says <b>which layer, counting inward from the outside</b>. Shown here on a 4×4.</>} />
        }
      >
        <Callout tone="info" label={t('数字前缀怎么读', 'Reading the numeric prefix')}>
          {<T zh={<>
                                                                      <K>2R</K> = 只转<b>右起第 2 层</b>(单独一片内层),外层不动。<br />
                                                                      <K>3Rw</K> = 从右往里<b>一次带 3 层</b>一起转(w 表示“宽”,数字是层数)。<br />
                                                                      所以 <K>Rw</K> 其实就是 <K>2Rw</K> 的简写 —— 默认带 2 层。
                                                                    </>} en={<>
                                                                                  <K>2R</K> = turn <b>only the 2nd layer from the right</b> (a single inner slice); the outer face stays put.<br />
                                                                                  <K>3Rw</K> = turn <b>3 layers at once</b>, counting in from the right (the w means “wide”, the number is how many layers).<br />
                                                                                  So <K>Rw</K> is just shorthand for <K>2Rw</K> — wide defaults to 2 layers.
                                                                                </>} />}
        </Callout>
        <div className="nt-grid nt-grid-lg" style={{ marginTop: 22 }}>
          <NotationMove puzzle="4x4x4" move="R" caption={t('R:只转最外右层', 'R: outer right layer only')} />
          <NotationMove puzzle="4x4x4" move="2R" caption={t('2R:右起第 2 层', '2R: the 2nd layer from the right')} />
          <NotationMove puzzle="4x4x4" move="Rw" caption={t('Rw:外侧 2 层', 'Rw: outer 2 layers')} />
          <NotationMove puzzle="4x4x4" move="3Rw" caption={t('3Rw:外侧 3 层', '3Rw: outer 3 layers')} />
        </div>
        <p className="reg-foot-note">
          {t(
            '同一套规则适用于 5×5、6×6、7×7 等所有 NxN —— 数字越大、层数越多,字母含义不变。',
            'The same rules apply to 5×5, 6×6, 7×7 and every NxN — bigger numbers reach deeper layers; the letters never change meaning.'
          )}
        </p>
      </RegSection>

      {/* ── Megaminx ───────────────────────────────────────── */}
      <RegSection
        eyebrow={t('12d · 五魔方', '12d · Megaminx')}
        title={t('正十二面体的特殊记号', 'The dodecahedron’s own notation')}
        lede={
          <T zh={<>五魔方的官方打乱记号只用三种动作。<K>R++</K> / <K>R--</K> 表示<b>右侧一组竖排面</b>转 144°(两格),<K>D++</K> / <K>D--</K> 表示<b>底部一组横排面</b>转 144°;<K>U</K> / <K>U'</K> 只转<b>顶面</b>一格(72°)。<code className="nt-k">++</code> 为顺时针、<code className="nt-k">--</code> 为逆时针。</>} en={<>Megaminx scrambles use just three kinds of move. <K>R++</K> / <K>R--</K> turn a <b>vertical column of faces</b> by 144° (two notches), <K>D++</K> / <K>D--</K> turn a <b>horizontal row</b> by 144°, and <K>U</K> / <K>U'</K> turn only the <b>top face</b> by one notch (72°). <code className="nt-k">++</code> is clockwise, <code className="nt-k">--</code> counter-clockwise.</>} />
        }
      >
        <div className="nt-grid nt-grid-lg">
          <NotationMove puzzle="megaminx" move="R++" symbol="R++" caption={t('竖排面顺时针 144°', 'Vertical column, 144° CW')} />
          <NotationMove puzzle="megaminx" move="R--" symbol="R--" caption={t('竖排面逆时针 144°', 'Vertical column, 144° CCW')} />
          <NotationMove puzzle="megaminx" move="D++" symbol="D++" caption={t('横排面顺时针 144°', 'Horizontal row, 144° CW')} />
          <NotationMove puzzle="megaminx" move="D--" symbol="D--" caption={t('横排面逆时针 144°', 'Horizontal row, 144° CCW')} />
          <NotationMove puzzle="megaminx" move="U" caption={t('顶面顺时针 72°', 'Top face, 72° CW')} />
          <NotationMove puzzle="megaminx" move="U'" symbol="U'" caption={t('顶面逆时针 72°', 'Top face, 72° CCW')} />
        </div>
      </RegSection>

      {/* ── Pyraminx ───────────────────────────────────────── */}
      <RegSection
        eyebrow={t('12e · 金字塔', '12e · Pyraminx')}
        title={t('大写转两层,小写只转角', 'Capitals turn two layers, lowercase just the tip')}
        lede={
          <T zh={<>金字塔有四个顶点。<b>大写</b> <K>U</K> <K>L</K> <K>R</K> <K>B</K> 表示绕某个顶点把<b>外侧两层</b>一起转 120°;<b>小写</b> <K>u</K> <K>l</K> <K>r</K> <K>b</K> 只转那个<b>顶角的尖块</b>。加撇号即逆时针。</>} en={<>The Pyraminx has four corners. <b>Capitals</b> <K>U</K> <K>L</K> <K>R</K> <K>B</K> turn the <b>outer two layers</b> around a corner by 120°; <b>lowercase</b> <K>u</K> <K>l</K> <K>r</K> <K>b</K> turn only that <b>corner tip</b>. A prime makes it counter-clockwise.</>} />
        }
      >
        <div className="nt-grid">
          <NotationMove puzzle="pyraminx" move="U" caption={t('上顶点:两层', 'Up corner: two layers')} />
          <NotationMove puzzle="pyraminx" move="u" caption={t('上顶点:只转尖', 'Up corner: tip only')} />
          <NotationMove puzzle="pyraminx" move="R" caption={t('右顶点:两层', 'Right corner: two layers')} />
          <NotationMove puzzle="pyraminx" move="L" caption={t('左顶点:两层', 'Left corner: two layers')} />
          <NotationMove puzzle="pyraminx" move="B" caption={t('后顶点:两层', 'Back corner: two layers')} />
          <NotationMove puzzle="pyraminx" move="r" caption={t('右顶点:只转尖', 'Right corner: tip only')} />
        </div>
      </RegSection>

      {/* ── Skewb ──────────────────────────────────────────── */}
      <RegSection
        eyebrow={t('12h · 斜转', '12h · Skewb')}
        title={t('绕顶点的斜切转动', 'Corner-axis turns')}
        lede={
          <T zh={<>斜转沿着<b>对角顶点轴</b>切开。四个字母各指一个顶点附近的那一块:<K>U</K> 上、<K>R</K> 右下、<K>L</K> 左下、<K>B</K> 后,顺时针转 120°;加撇号即逆时针。</>} en={<>The Skewb cuts along <b>diagonal corner axes</b>. Each letter names the layer around one corner: <K>U</K> upper, <K>R</K> bottom-right, <K>L</K> bottom-left, <K>B</K> back, turned 120° clockwise; a prime reverses it.</>} />
        }
      >
        <div className="nt-grid">
          <NotationMove puzzle="skewb" move="R" caption={t('右下顶点 120°', 'Bottom-right corner, 120°')} />
          <NotationMove puzzle="skewb" move="U" caption={t('上顶点 120°', 'Upper corner, 120°')} />
          <NotationMove puzzle="skewb" move="L" caption={t('左下顶点 120°', 'Bottom-left corner, 120°')} />
          <NotationMove puzzle="skewb" move="B" caption={t('后顶点 120°', 'Back corner, 120°')} />
        </div>
      </RegSection>

      {/* ── Square-1 (diagram, not 3D) ─────────────────────── */}
      <RegSection
        eyebrow={t('12c · Square-1', '12c · Square-1')}
        title={t('用 (上, 下) 数对加斜线', 'Counted top/bottom pairs and the slash')}
        lede={
          <T zh={<>Square-1 的层会变成不规则形状,所以记号不用面字母,而是数<b>30° 为一格</b>。每一步写成一个数对 <K>(x, y)</K>:上层顺时针转 <b>x</b> 格、下层顺时针转 <b>y</b> 格(负数即逆时针)。斜线 <K>/</K> 表示把<b>右半个魔方翻 180°</b>。</>} en={<>Square-1 layers turn into irregular shapes, so it counts in <b>30° units</b> rather than face letters. Each step is a pair <K>(x, y)</K>: turn the top layer <b>x</b> notches clockwise and the bottom <b>y</b> notches clockwise (negatives go counter-clockwise). A slash <K>/</K> <b>flips the right half of the puzzle by 180°</b>.</>} />
        }
      >
        <div className="nt-sq1">
          <div className="nt-sq1-figs">
          {/* (x, y): top / bottom layer rotations */}
          <svg viewBox="0 0 128 172" className="nt-sq1-fig" aria-hidden="true">
            {[{ cy: 44, acc: '', lbl: 'x' }, { cy: 130, acc: ' warm', lbl: 'y' }].map(({ cy, acc, lbl }) => {
              const cx = 60, r = 34;
              // clockwise direction arrow hugging the upper-right rim (12 → ~2 o'clock)
              const ar = 40, a0 = (-85 * Math.PI) / 180, a1 = (-25 * Math.PI) / 180;
              const sx = cx + ar * Math.cos(a0), sy = cy + ar * Math.sin(a0);
              const ex = cx + ar * Math.cos(a1), ey = cy + ar * Math.sin(a1);
              const tvx = -Math.sin(a1), tvy = Math.cos(a1); // tangent (motion) dir
              return (
                <g key={cy}>
                  <circle cx={cx} cy={cy} r={r} className="nt-sq1-face" />
                  {[...Array(12)].map((_, i) => {
                    const a = ((i * 30 - 90) * Math.PI) / 180;
                    return <line key={i} x1={cx} y1={cy} x2={(cx + r * Math.cos(a)).toFixed(1)} y2={(cy + r * Math.sin(a)).toFixed(1)} className="nt-sq1-spoke" />;
                  })}
                  {/* highlight one 30° notch */}
                  <path d={`M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 0 1 77 ${(cy - 29.4).toFixed(1)} Z`} className={`nt-sq1-hi${acc}`} />
                  <circle cx={cx} cy={cy} r="2.3" className="nt-sq1-hub" />
                  <path d={`M${sx.toFixed(1)} ${sy.toFixed(1)} A${ar} ${ar} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`} className={`nt-sq1-arrow${acc}`} fill="none" />
                  <polygon
                    points={`${(ex + tvx * 6).toFixed(1)},${(ey + tvy * 6).toFixed(1)} ${(ex - tvy * 3.2).toFixed(1)},${(ey + tvx * 3.2).toFixed(1)} ${(ex + tvy * 3.2).toFixed(1)},${(ey - tvx * 3.2).toFixed(1)}`}
                    className={`nt-sq1-arrowhead${acc}`}
                  />
                  <text x="106" y={cy + 4} className="nt-sq1-lbl">{lbl}</text>
                </g>
              );
            })}
          </svg>
          {/* / : flip the right half 180° */}
          <svg viewBox="0 0 152 120" className="nt-sl-fig" aria-hidden="true">
            <defs><clipPath id="nt-sl-clip"><rect x="24" y="30" width="80" height="62" rx="7" /></clipPath></defs>
            <g clipPath="url(#nt-sl-clip)"><rect x="64" y="30" width="40" height="62" className="nt-sl-right" /></g>
            <rect x="24" y="30" width="80" height="62" rx="7" className="nt-sl-body" />
            <line x1="24" y1="61" x2="104" y2="61" className="nt-sl-layer" />
            <line x1="64" y1="20" x2="64" y2="102" className="nt-sq1-slice" />
            <text x="55" y="16" className="nt-sq1-lbl">/</text>
            <path d="M84 32 A 29 29 0 0 1 84 90" className="nt-sl-arrow" fill="none" />
            <polygon points="77,90 84,86 84,94" className="nt-sl-arrowhead" />
            <text x="115" y="65" className="nt-sl-deg">180°</text>
          </svg>
          </div>
          <div>
            <RegList items={[
              (<T zh={<><K>(1, 0)</K> — 上层顺时针 30°,下层不动。</>} en={<><K>(1, 0)</K> — top layer 30° clockwise, bottom still.</>} />),
              (<T zh={<><K>(0, -1)</K> — 下层逆时针 30°,上层不动。</>} en={<><K>(0, -1)</K> — bottom layer 30° counter-clockwise.</>} />),
              (<T zh={<><K>(3, 3)</K> — 上下各转 90°(三格)。</>} en={<><K>(3, 3)</K> — both layers 90° (three notches each).</>} />),
              (<T zh={<><K>/</K> — 右半翻面,通常和数对交替出现,如 <K>(3,0) / (−2,1) /</K>。</>} en={<><K>/</K> — flip the right half; usually alternates with pairs, e.g. <K>(3,0) / (−2,1) /</K>.</>} />),
            ]} />
          </div>
        </div>
      </RegSection>

      {/* ── Clock (diagram, not 3D) ────────────────────────── */}
      <RegSection
        eyebrow={t('12g · 魔表', '12g · Clock')}
        title={t('拨针、转钟与翻面', 'Pins, dials and the flip')}
        lede={
          <T zh={<>魔表的记号分三部分:先用<b>四角的针</b>名指出哪些针拨上去,再写转动量,最后可能翻面。针的位置:<K>UR</K> 右上、<K>DR</K> 右下、<K>DL</K> 左下、<K>UL</K> 左上;<K>U</K> 上两针、<K>R</K> 右两针、<K>D</K> 下两针、<K>L</K> 左两针、<K>ALL</K> 全部。</>} en={<>Clock notation has three parts: name which corner <b>pins</b> are pushed up, write the turn amount, then optionally flip. Pin positions: <K>UR</K> top-right, <K>DR</K> bottom-right, <K>DL</K> bottom-left, <K>UL</K> top-left; <K>U</K> both top, <K>R</K> both right, <K>D</K> both bottom, <K>L</K> both left, <K>ALL</K> all four.</>} />
        }
      >
        <div className="nt-clock">
          <svg viewBox="0 0 140 140" className="nt-clock-fig" aria-hidden="true">
            <rect x="6" y="6" width="128" height="128" rx="16" className="nt-clock-body" />
            {/* four dials */}
            {[[44, 44], [96, 44], [44, 96], [96, 96]].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="22" className="nt-clock-dial" />
                <line x1={cx} y1={cy} x2={cx} y2={cy - 17} stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            ))}
            {/* four corner pins — top two "up" (ok colour), bottom two down */}
            <circle cx="22" cy="22" r="5.5" className="nt-clock-pin-up" />
            <circle cx="118" cy="22" r="5.5" className="nt-clock-pin-up" />
            <circle cx="22" cy="118" r="5.5" className="nt-clock-pin" />
            <circle cx="118" cy="118" r="5.5" className="nt-clock-pin" />
            <text x="22" y="13" className="nt-clock-lbl">UL</text>
            <text x="118" y="13" className="nt-clock-lbl">UR</text>
            <text x="22" y="135" className="nt-clock-lbl">DL</text>
            <text x="118" y="135" className="nt-clock-lbl">DR</text>
          </svg>
          <div>
            <p className="reg-sec-lede" style={{ marginTop: 0 }}>
              {<T zh={<>在拨上去的针旁边转动表盘:<K>X+</K> 顺时针转 X 小时、<K>X-</K> 逆时针转 X 小时(每步过后把所有针压回);<K>y2</K> 表示把整个魔表翻到背面(12 点仍朝上)继续打乱。</>} en={<>Turn the wheel next to an up pin: <K>X+</K> is X hours clockwise, <K>X-</K> X hours counter-clockwise (all pins drop after each step); <K>y2</K> flips the whole clock to its back face (12 stays on top).</>} />}
            </p>
            <ul className="nt-dial-list">
              <li><b>UR</b>{t('右上', 'top-right')}</li>
              <li><b>DR</b>{t('右下', 'bottom-right')}</li>
              <li><b>DL</b>{t('左下', 'bottom-left')}</li>
              <li><b>UL</b>{t('左上', 'top-left')}</li>
              <li><b>U</b>{t('上两针', 'both top')}</li>
              <li><b>R</b>{t('右两针', 'both right')}</li>
              <li><b>D</b>{t('下两针', 'both bottom')}</li>
              <li><b>L</b>{t('左两针', 'both left')}</li>
              <li><b>ALL</b>{t('全部', 'all four')}</li>
            </ul>
          </div>
        </div>
      </RegSection>

      {/* ── Universal modifiers summary ────────────────────── */}
      <RegSection
        eyebrow={t('通用修饰符', 'Universal modifiers')}
        title={t('记住这三个后缀,就能读懂大半', 'Three suffixes get you most of the way')}
      >
        <div className="nt-mods">
          <div className="nt-mod">
            <div className="nt-mod-key">{'X'}</div>
            <div className="nt-mod-desc">{t('单独字母 = 那一面/层顺时针转一格(三阶为 90°)。', 'A bare letter = that face/layer, one notch clockwise (90° on a 3×3).')}</div>
          </div>
          <div className="nt-mod">
            <div className="nt-mod-key">{"X'"}</div>
            <div className="nt-mod-desc">{t('撇号 = 逆时针,方向相反、角度相同。', "A prime = counter-clockwise; same angle, opposite way.")}</div>
          </div>
          <div className="nt-mod">
            <div className="nt-mod-key">{'X2'}</div>
            <div className="nt-mod-desc">{t('数字 2 = 转半圈 180°,顺逆等价。', 'A 2 = a 180° half turn; direction doesn’t matter.')}</div>
          </div>
          <div className="nt-mod">
            <div className="nt-mod-key">{'Xw / x'}</div>
            <div className="nt-mod-desc">{t('w 或小写 = 宽层(带多层一起转)或整体旋转。', 'w or lowercase = wide (extra layers) or a whole-puzzle rotation.')}</div>
          </div>
        </div>
        <Callout tone="success" label={t('一句话总结', 'In one line')} icon={<Sparkles size={17} />} style={{ marginTop: 26 }}>
          {<T zh={<><b>字母选层、撇号反向、数字 2 翻倍、w/小写加宽</b>。掌握这四点,任何 WCA 项目的打乱你都读得懂。</>} en={<><b>Letter picks the layer, a prime reverses it, a 2 doubles it, w/lowercase widens it.</b> With those four, you can read the scramble for any WCA event.</>} />}
        </Callout>
      </RegSection>

    </RegArticleLayout>
  );
}
