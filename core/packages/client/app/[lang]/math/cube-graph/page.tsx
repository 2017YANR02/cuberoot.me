'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
import { MOVE_NAMES } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import CubeGraphCube from './CubeGraphCube';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';
import { CUBE_FILL } from '@/lib/cube-colors';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { GRAPH_SLOTS, RINGS, graphPosition, sectorPath, stickerPermutation } from './model';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const EXAMPLE = "R U F2 L' D B R2 U'".split(' ');
const inverse = (moves: string[]) => moves.slice().reverse().map(invertMoveString);
const TURN_MS = 500;
type View = 'rings' | 'sectors';

function locations(stickers: number[]) {
  const result = new Array<number>(54);
  stickers.forEach((id, slot) => { result[id] = slot; });
  return result;
}

function StickerGraph({ stickers, view, animate }: { stickers: number[]; view: View; animate: boolean }) {
  const t = useT();
  const targets = useMemo(() => locations(stickers), [stickers]);
  const previous = useRef(targets);
  const circles = useRef<(SVGCircleElement | null)[]>([]);
  useEffect(() => {
    const from = previous.current;
    previous.current = targets;
    const duration = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? TURN_MS : 0;
    const start = performance.now();
    let frame = 0;
    function draw(now: number) {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1;
      targets.forEach((slot, id) => {
        const p = graphPosition(from[id], slot, progress * progress * (3 - 2 * progress));
        circles.current[id]?.setAttribute('cx', String(p.x));
        circles.current[id]?.setAttribute('cy', String(p.y));
      });
      if (progress < 1) frame = requestAnimationFrame(draw);
    }
    draw(start);
    return () => cancelAnimationFrame(frame);
  }, [targets, animate, view]);

  return <svg className="cube-graph-svg" viewBox={view === 'rings' ? '-25 -45 490 490' : '0 0 440 440'} role="img"
    aria-label={t('54 枚贴纸的平面映射，与三维魔方同步', 'A planar map of all 54 stickers, synchronized with the cube')}>
    <title>{t('同一个魔方，两种画法', 'One cube, two drawings')}</title>
    {view === 'rings' ? <>
      {RINGS.map((ring, i) => <circle key={i} cx={ring.x} cy={ring.y} r={ring.r} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.6" strokeWidth="1.3" />)}
      {targets.map((slot, id) => <circle key={id} ref={node => { circles.current[id] = node; }}
        cx={GRAPH_SLOTS[slot].x} cy={GRAPH_SLOTS[slot].y} r="6.5" fill={CUBE_FILL[FACES[Math.floor(id / 9)]]}
        stroke="var(--foreground)" strokeWidth="0.8" data-sticker={id}>
        <title>{`${FACES[Math.floor(id / 9)]}${id % 9 + 1} → ${FACES[Math.floor(slot / 9)]}${slot % 9 + 1}`}</title>
      </circle>)}
    </> : <>
      {GRAPH_SLOTS.map((p, slot) => <path key={slot} d={sectorPath(p.face, p.row, p.col)} fill={CUBE_FILL[FACES[Math.floor(stickers[slot] / 9)]]}
        stroke="var(--border-strong)" strokeWidth="0.8" data-slot={slot}>
        <title>{`${FACES[p.face]}${slot % 9 + 1} ← ${FACES[Math.floor(stickers[slot] / 9)]}${stickers[slot] % 9 + 1}`}</title>
      </path>)}
      {FACES.map((face, index) => {
        const angle = -Math.PI / 2 + (index + 0.5) * Math.PI / 3;
        return <text key={face} x={220 + 191 * Math.cos(angle)} y={220 + 191 * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle" fill="var(--foreground)" fontSize="17">{face}</text>;
      })}
    </>}
  </svg>;
}

export default function CubeGraphPage() {
  const t = useT();
  const lang = useLang();
  const [setup, setSetup] = useState(EXAMPLE);
  const [steps, setSteps] = useState(() => inverse(EXAMPLE));
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>('rings');
  const moves = useMemo(() => [...setup, ...steps.slice(0, cursor)], [setup, steps, cursor]);
  const stickers = useMemo(() => stickerPermutation(moves), [moves]);
  const solved = stickers.every((id, slot) => Math.floor(id / 9) === Math.floor(stickers[Math.floor(slot / 9) * 9 + 4] / 9));
  const title = t('魔方与图论', 'Rubik’s Cube & Graph Theory');
  const description = t('把 54 枚贴纸画在圆环上。转动魔方，观察同一个置换如何在三维与平面中发生。', 'Draw all 54 stickers on circles. Turn the cube and watch the same permutation unfold in 3D and on a plane.');

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setBusy(false), TURN_MS + 100);
    return () => window.clearTimeout(timer);
  }, [busy]);
  useEffect(() => {
    if (!playing) return;
    if (cursor >= steps.length) { setPlaying(false); return; }
    const timer = window.setTimeout(() => {
      setAnimate(true); setBusy(true); setCursor(value => value + 1);
    }, 750);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, steps.length]);

  function seek(value: number) {
    setPlaying(false); setAnimate(false);
    setCursor(Math.max(0, Math.min(steps.length, value)));
  }
  function turn(move: string) {
    setPlaying(false); setAnimate(true); setBusy(true);
    setSteps([...steps.slice(0, cursor), move]); setCursor(cursor + 1);
  }
  function start(next: string[]) {
    setPlaying(false); setAnimate(false); setSetup(next);
    setSteps(inverse(next)); setCursor(0);
  }
  function scramble() {
    const next: number[] = [];
    while (next.length < 20) {
      const move = Math.floor(Math.random() * 18);
      if (Math.floor(move / 3) !== Math.floor((next.at(-1) ?? -3) / 3)) next.push(move);
    }
    start(next.map(move => MOVE_NAMES[move]));
  }

  return <main className="cube-graph-page">
    <style>{CSS}</style>
    <JsonLd data={articleJsonLd({ headline: title, description, lang, url: `https://cuberoot.me${lang === 'zh' ? '/zh' : ''}/math/cube-graph` })} />
    <header className="cube-graph-header">
      <div className="page-back-row"><BackHome /></div>
      <h1>{title}</h1><p className="cube-graph-lead">{description}</p>
    </header>
    <div className="cube-graph-toolbar">
      <button type="button" onClick={scramble} disabled={busy}><Shuffle size={16} />{t('打乱', 'Scramble')}</button>
      <button type="button" onClick={() => { start(moves); setPlaying(true); }} disabled={busy || solved}><RotateCcw size={16} />{t('沿原路还原', 'Retrace to solved')}</button>
      <button type="button" onClick={() => start([])} disabled={busy}>{t('重置', 'Reset')}</button>
      <CompactSelect label={view === 'rings' ? t('圆环', 'Rings') : t('扇形', 'Sectors')} ariaLabel={t('平面图布局', 'Map layout')} value={view} onChange={setView}
        items={[{ value: 'rings', label: t('圆环', 'Rings') }, { value: 'sectors', label: t('扇形', 'Sectors') }]} />
    </div>
    <div className="cube-graph-pair">
      <figure><CubeGraphCube moves={moves} animate={animate} locked={busy || playing} onMove={turn} />
        <figcaption>{t('三维魔方', '3D cube')}<span role="status" data-solved={solved}>{solved ? t('已还原', 'Solved') : t('未还原', 'Unsolved')}</span></figcaption>
      </figure>
      <figure><StickerGraph stickers={stickers} view={view} animate={animate} />
        <figcaption>{view === 'rings' ? t('9 条圆环，54 枚贴纸', '9 circles, 54 stickers') : t('6 个扇区，每区 3 × 3 格', '6 sectors, 3 × 3 cells each')}</figcaption>
      </figure>
    </div>
    <div className="cube-graph-moves" aria-label={t('面转操作', 'Face turns')}>
      {FACES.map((face, i) => <div key={face}>
        {[0, 2, 1].map(power => <button type="button" key={power} disabled={busy || playing} onClick={() => turn(MOVE_NAMES[i * 3 + power])}>{MOVE_NAMES[i * 3 + power]}</button>)}
      </div>)}
    </div>
    <p className="cube-graph-hint">{t('拖动贴纸转层，拖动空白处调整视角；手机上也可用手指操作。中层和宽层转动同样会记录并同步到平面图。', 'Drag a sticker to turn a layer, or drag the background to orbit. Touch gestures work on phones too. Slice and wide turns are also recorded and synchronized with the map.')}</p>
    <p className="cube-graph-hint">{t('U 上、R 右、F 前、D 下、L 左、B 后。正对该面看：字母为顺时针 90°，′ 为逆时针，2 为 180°。', 'U up, R right, F front, D down, L left, B back. Looking directly at that face: a letter turns 90° clockwise, ′ reverses it, and 2 turns 180°.')}</p>
    <div className="cube-graph-playback">
      <button type="button" aria-label={t('上一步', 'Previous step')} disabled={busy || cursor === 0} onClick={() => seek(cursor - 1)}><ChevronLeft size={18} /></button>
      <button type="button" aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')} disabled={steps.length === 0 || (!playing && busy)} onClick={() => {
        if (!playing && cursor === steps.length) seek(0);
        setPlaying(value => !value);
      }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
      <button type="button" aria-label={t('下一步', 'Next step')} disabled={busy || cursor === steps.length} onClick={() => {
        setPlaying(false); setAnimate(true); setBusy(true); setCursor(cursor + 1);
      }}><ChevronRight size={18} /></button>
      <input type="range" min="0" max={steps.length} value={cursor} disabled={busy || steps.length === 0} onChange={event => seek(Number(event.target.value))} aria-label={t('播放进度', 'Playback position')} />
      <output>{cursor} / {steps.length}</output>
    </div>
    <p className="cube-graph-sequence"><span>{t('起始打乱：', 'Starting moves: ')}</span><code>{setup.join(' ') || '—'}</code></p>
    <div className="cube-graph-sequence"><span>{t('播放序列：', 'Playback: ')}</span>{steps.length ? steps.map((move, i) => <button type="button" key={i} disabled={busy} aria-current={cursor === i + 1 ? 'step' : undefined} onClick={() => seek(i + 1)}>{move}</button>) : '—'}</div>

    <article className="cube-graph-article">
      <section><h2>{t('从立方体到平面', 'From a cube to a plane')}</h2>
        <p>{t('魔方外表有 54 个贴纸位置：8 个角块各 3 枚、12 个棱块各 2 枚，再加 6 枚中心贴纸。把位置固定在平面上，让颜色随转动迁移，就能用二维图完整记录三阶魔方的贴纸状态。', 'A cube has 54 sticker positions: three on each of 8 corners, two on each of 12 edges, and 6 centers. Fix these positions on a plane and let their colors move with each turn: a two-dimensional drawing can record the full sticker state of a 3×3 cube.')}</p>
        <p>{t('圆环图按三个空间轴分为三组，每组对应三层。每枚贴纸的位置由另外两个轴的层坐标决定，因此落在两条圆环的交点上；同一对圆环的两个交点分别表示相对的两个面。3 对圆环组 × 3 × 3 条圆环组合 × 2 个交点，恰好是 54 个位置。', 'The rings form three groups, one for each spatial axis, with three layers per group. A sticker’s position is set by its layer coordinates on the other two axes, so it sits at an intersection of two circles. Their two intersections represent opposite faces. There are 3 pairs of groups × 3 × 3 circle pairs × 2 intersections = 54 positions.')}</p>
      </section>
      <section><h2>{t('一次转动，就是一个置换', 'A turn is a permutation')}</h2>
        <p>{t('先点“重置”，再连续点四次 R：每枚贴纸都会回到原位。一次 90° 面转会移动 20 枚贴纸，其中 12 枚属于四个邻面上的三格条带，8 枚属于被转动面的外围；中心不动。它可以写成五个互不相交的四循环，因此四次同向四分之一转等于不转。R 接 R′ 也一样。', 'Reset, then press R four times: every sticker returns to its starting position. A 90° face turn moves 20 stickers: 12 in three-sticker strips on the four adjacent faces and 8 around the turned face, while its center stays fixed. This is five disjoint four-cycles, so four identical quarter turns give the identity. R followed by R′ does too.')}</p>
        <p>{t('邻面贴纸沿共同的层圆环运动，被转动面上的贴纸也必须一起换位，不能只转一条圆环。图中的圆弧与连线是转动的可视化插值，不是让贴纸任意交换的新规则。两个视图始终使用同一套合法魔方转动。', 'Adjacent-face stickers travel along their shared layer circle, while stickers on the turning face must also change positions. Rotating a circle alone is not a legal cube move. Arcs and connecting paths visualize a turn; they do not permit arbitrary sticker swaps. Both views use the same legal cube moves.')}</p>
        <p>{t('“沿原路还原”把已有动作倒序并逐个取逆。例如 R U F2 的逆序列是 F2 U′ R′。这里演示的是逆元，不是最短解搜索；随机打乱也不是比赛用的随机状态打乱。', '“Retrace to solved” reverses the recorded moves and inverts each one. For example, R U F2 is undone by F2 U′ R′. This demonstrates inverses, not a shortest-solution search; the random move sequence is not a competition random-state scramble.')}</p>
      </section>
      <section><h2>{t('扇形图改变了什么？', 'What does the sector diagram change?')}</h2>
        <p>{t('第二种布局把六个面排成六个扇区，每区用三层半径和三列角度放下 3 × 3 枚贴纸。切换布局不会改变魔方状态，只是换了一套位置坐标。它借鉴参考图的扇形表达；本页采用面、行、列的一一映射，图片未给出完整的转动约定。', 'The second layout arranges the six faces as six sectors. Three radial rows and three angular columns hold each face’s 3 × 3 stickers. Switching layouts changes only the coordinates, not the cube state. Inspired by the sector reference image, this page uses an explicit face/row/column mapping; the image does not specify a complete move convention.')}</p>
        <p>{t('平面表示能让结构更容易观察，但并没有减少状态数，也不能仅凭图形漂亮就证明还原更快。真正的简化还需要定义合法操作，并给出可验证的算法或数学证明。', 'A planar drawing can make structure easier to see, but it does not reduce the number of states or prove that solving is faster. Such a simplification requires defined legal operations and a verifiable algorithm or mathematical proof.')}</p>
      </section>
      <section><h2>{t('参考图里的记号', 'Notation in the reference image')}</h2>
        <p>{t('这些记号可以用来描述贴纸图，但不是一套通用的魔方记号。参考图未附完整定义；下面给出与贴纸模型一致的解释，无法确定的标注会单独说明。', 'These symbols can describe a sticker graph, but are not a universal cube notation. The reference image does not supply complete definitions. The following interpretation is consistent with a sticker model; uncertain labels are identified explicitly.')}</p>
        <dl className="cube-graph-notation">
          <dt><code>V = F × L</code></dt>
          <dd>{t('把每个顶点定义为一个贴纸位置。F 是六个面的集合，L 是一个面内的 n × n 个格子位置；× 是笛卡尔积，即“选一个面，再选一个格子”。这里的 L 是位置集合，不是左面转动。', 'Define each vertex as a sticker position. F is the set of six faces and L is the set of n × n cell positions on one face. The Cartesian product × means choosing a face and a cell. Here L denotes a set of positions, not a left-face turn.')}</dd>
          <dt><code>|V| = 6n²</code></dt>
          <dd>{t('竖线表示集合中元素的个数，n 是魔方阶数。三阶有 6 × 3² = 54 个贴纸位置。这不是整块小方块的数量，也不是贴纸格线交点的数量。', 'Vertical bars mean the number of elements in a set, and n is the cube order. A 3×3 cube has 6 × 3² = 54 sticker positions. This does not count cubies or the intersections of sticker grid lines.')}</dd>
          <dt><code>|E| = 12n²</code></dt>
          <dd>{t('若把共享一条边的两个贴纸位置连起来，且包含跨越立方体棱的相邻关系，每个位置都有 4 个邻居。一条无向边会被两端各数一次，所以边数是 54 × 4 ÷ 2 = 108。一般为 6n² × 4 ÷ 2 = 12n²。这是贴纸相邻图的边数，不是上方圆环的数量，也不是凯莱图的边数。', 'If two sticker positions are connected when their cells share a side, including adjacency across cube edges, every position has four neighbors. Each undirected edge is counted at both ends, giving 54 × 4 ÷ 2 = 108 edges, or 6n² × 4 ÷ 2 = 12n² in general. This counts edges in the sticker adjacency graph, not the circles above or edges in a Cayley graph.')}</dd>
          <dt><code>T<sub>f</sub> = B<sub>f</sub> ∘ R<sub>f</sub></code></dt>
          <dd>{t('一次面转 T 可以拆成两部分：R 旋转该面自己的贴纸，B 循环移动四个邻面的条带；下标 f 指被转动的面。按通常的函数复合约定，B ∘ R 表示先 R 后 B。三阶四分之一转中，这两部分分别移动 8 和 12 枚贴纸，共 20 枚；两者缺一不可。这里的 B、R 是操作名称，不是后面和右面的转动记号。', 'A face turn T can be split into R, rotating the stickers of that face, and B, cycling the strips on its four neighboring faces. The subscript f identifies the face. Under the usual function-composition convention, B ∘ R means R first, then B. For a 3×3 quarter turn they move 8 and 12 stickers respectively, totaling 20. Both are needed. Here B and R name operations, not back- and right-face turns.')}</dd>
          <dt><code>k(r, c)</code></dt>
          <dd>{t('可用来给面内的行 r、列 c 编号。例如本页从 0 起计数，取 k(r,c) = 3r + c，就得到 0～8；再加上面编号 f，可写成 9f + k(r,c)，得到 0～53 个位置编号。这是本页明确采用的约定，原图未给出 k 的具体公式。', 'This can index a cell by row r and column c. This page uses zero-based coordinates: k(r,c) = 3r + c gives indices 0–8. Adding face index f gives 9f + k(r,c), covering positions 0–53. This is our explicit convention; the image does not specify a formula for k.')}</dd>
          <dt><code>Φ {t('扇形极坐标映射', 'sector-polar mapping')}</code></dt>
          <dd>{t('Φ 可理解为把“面、行、列”映射到平面坐标的函数：面决定扇区，行决定半径，列决定角度。它改变画法，不改变魔方状态；上方切到“扇形”即可看到这种表达。', 'Φ can be read as a function mapping face, row and column to planar coordinates: the face selects a sector, the row sets a radius, and the column sets an angle. It changes the drawing, not the cube state. Select Sectors above to see this representation.')}</dd>
          <dt><code>e<sub>UF</sub></code></dt>
          <dd>{t('按下标推测，它指向 U（上面）与 F（前面）之间的连接或边界。但原图没有说明 e 代表一条图边、整条边界还是一组连接，因此这里不把它当作已定义的操作。', 'The subscript suggests a connection or boundary between U (up) and F (front). However, the image does not establish whether e denotes one graph edge, a whole boundary, or a family of connections, so we do not treat it as a defined operation.')}</dd>
        </dl>
      </section>
      <section><h2>{t('它和凯莱图有什么关系？', 'How does this relate to a Cayley graph?')}</h2>
        <p>{t('这里的 54 个点表示贴纸位置。凯莱图的每个顶点则代表整个魔方的一个状态，边代表一次允许的转动；求解是在状态之间找一条到还原态的路径。两者观察的是同一个置换群，但顶点的含义和图的规模完全不同。', 'The 54 dots here represent sticker positions. In a Cayley graph, each vertex represents an entire cube state and an edge represents an allowed turn. Solving means finding a path between states to the solved one. Both concern the same permutation group, but their vertices have different meanings and their sizes are vastly different.')}</p>
        <p className="cube-graph-links"><Link href="/math/group/cayley" prefetch={false}>{t('了解凯莱图', 'Explore Cayley graphs')}</Link><Link href="/math/god" prefetch={false}>{t('了解上帝之数', 'Explore God’s number')}</Link></p>
      </section>
      <section><h2>{t('图形来源', 'Visual references')}</h2>
        <p><a href="https://x.com/themathflow/status/2101154346583154801" target="_blank" rel="noreferrer">{t('The Math Flow 发布的圆环动画', 'Ring animation posted by The Math Flow')}</a>{t('是圆环布局的视觉参考；', ' inspired the ring layout; ')}<a href="https://github.com/2017YANR02/cuberoot.me/issues/81" target="_blank" rel="noreferrer">{t('需求中的第二张图', 'the second image in the request')}</a>{t('提供了扇形布局的参考。本页独立实现交互与位置映射。', ' inspired the sector layout. The interaction and coordinate mapping are independently implemented.')}</p>
      </section>
    </article>
  </main>;
}

const CSS = `
.cube-graph-page{max-width:1000px;margin:0 auto;padding:24px 16px 64px;color:var(--foreground)}
.cube-graph-page h1{font-size:clamp(26px,4vw,38px);margin:24px 0 12px;letter-spacing:-.025em}
.cube-graph-lead{color:var(--muted-foreground);max-width:720px;line-height:1.8;margin-bottom:24px}
.cube-graph-toolbar,.cube-graph-playback,.cube-graph-links{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.cube-graph-page button{font:inherit;color:var(--foreground);background:transparent;border:0;border-radius:6px;padding:8px 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;min-height:40px}
.cube-graph-page button:hover{background:var(--muted)}
.cube-graph-page button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.cube-graph-page button:disabled{opacity:.4;cursor:default}
.cube-graph-pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;margin:12px 0 24px}
.cube-graph-pair figure{margin:0;min-width:0}
.cube-graph-cube{width:100%;height:380px;max-height:55vw}
.cube-graph-cube .sim-stage-canvas{width:100%!important;height:100%!important}
.cube-graph-svg{display:block;width:100%;max-width:490px;height:auto;max-height:440px;margin:auto}
.cube-graph-pair figcaption{display:flex;gap:12px;justify-content:center;color:var(--muted-foreground);font-size:14px;margin-top:8px}
.cube-graph-pair [data-solved=true]{color:var(--signal-success)}
.cube-graph-moves{display:flex;flex-wrap:wrap;gap:8px 16px}
.cube-graph-moves>div{display:flex;gap:2px}
.cube-graph-moves button{font-family:monospace;min-width:42px;background:var(--muted)}
.cube-graph-hint,.cube-graph-sequence{font-size:13px;color:var(--muted-foreground);line-height:1.8}
.cube-graph-playback{margin:20px 0 12px}
.cube-graph-playback input{width:clamp(110px,35vw,360px);min-width:0;accent-color:var(--accent)}
.cube-graph-playback output{font-variant-numeric:tabular-nums;font-size:14px}
.cube-graph-sequence{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;margin:8px 0;overflow-wrap:anywhere}
.cube-graph-sequence button{font-family:monospace;padding:4px 7px;min-height:32px}
.cube-graph-sequence button[aria-current=step]{background:var(--accent-soft);color:var(--accent)}
.cube-graph-article{max-width:760px;margin-top:48px;line-height:1.9}
.cube-graph-article section{margin-top:36px}
.cube-graph-article h2{font-size:23px;line-height:1.4;margin-bottom:14px}
.cube-graph-article p{margin:12px 0}
.cube-graph-notation dt{margin-top:20px;font-weight:600}
.cube-graph-notation dd{margin:4px 0 0}
.cube-graph-article a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
@media(max-width:600px){.cube-graph-pair{grid-template-columns:1fr;gap:20px}.cube-graph-cube{height:240px;max-height:none}.cube-graph-svg{max-height:350px}.cube-graph-moves{gap:8px 10px}.cube-graph-playback{gap:4px}.cube-graph-page{padding-top:16px}}
`;
