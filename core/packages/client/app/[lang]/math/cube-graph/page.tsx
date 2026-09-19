'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Shuffle } from 'lucide-react';
import NxNOrderInput from '@/components/NxNOrderInput';
import { randomMoveScrambleNxN } from '@/lib/cubing-scramble';
import StickerGraph from './StickerGraph';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import { ClearButton } from '@/components/ClearButton';
import { TeX } from '@/components/math/Tex';
import BackHome from '@/components/BackHome';
import { CompactSelect } from '@/components/CompactSelect';
import CubeGraphCube from './CubeGraphCube';
import CayleyLesson from './CayleyLesson';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';
import { CUBE_FILL } from '@/lib/cube-colors';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { GRAPH_ORDER_MAX, createGraphLayout, stickerPermutation, parseGraphMoves, turnCycles } from './model';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const EXAMPLE = "R U F2 L' D B R2 U'".split(' ');
const inverse = (moves: string[]) => moves.slice().reverse().map(invertMoveString);
const TURN_MS = 500;
export default function CubeGraphPage() {
  const t = useT();
  const lang = useLang();
  const [order, setOrder] = useState(3);
  const layout = useMemo(() => createGraphLayout(order), [order]);
  const [setup, setSetup] = useState(EXAMPLE);
  const [steps, setSteps] = useState(() => inverse(EXAMPLE));
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number>();
  const selectSticker = (id: number) => setSelected(previous => previous === id ? undefined : id);
  const setupInput = useRef<AlgInputHandle>(null);
  const solutionInput = useRef<AlgInputHandle>(null);
  const [setupDraft, setSetupDraft] = useState(EXAMPLE.join(' '));
  const [solutionDraft, setSolutionDraft] = useState(inverse(EXAMPLE).join(' '));
  // Internally generated histories are already valid and may exceed the paste limit.
  const parsedSetup = useMemo(() => setupDraft === setup.join(' ') ? setup : parseGraphMoves(setupDraft, order), [setupDraft, setup, order]);
  const parsedSolution = useMemo(() => solutionDraft === steps.join(' ') ? steps : parseGraphMoves(solutionDraft, order), [solutionDraft, steps, order]);
  const pending = parsedSetup === null || parsedSolution === null
    || parsedSetup.join(' ') !== setup.join(' ') || parsedSolution.join(' ') !== steps.join(' ');
  useEffect(() => {
    if (!pending || !parsedSetup || !parsedSolution) return;
    const timer = window.setTimeout(() => {
      setSetup(parsedSetup); setSteps(parsedSolution); setAnimate(false); setCursor(0);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [pending, parsedSetup, parsedSolution]);
  const moves = useMemo(() => [...setup, ...steps.slice(0, cursor)], [setup, steps, cursor]);
  // Append only new turns; a long manual session must not replay its full history.
  const stateCache = useRef<{ order: number; moves: string[]; stickers: number[] } | null>(null);
  const stickers = useMemo(() => {
    const previous = stateCache.current;
    const append = previous?.order === order && previous.moves.length <= moves.length
      && previous.moves.every((move, i) => move === moves[i]);
    return stickerPermutation(append ? moves.slice(previous.moves.length) : moves, order, append ? previous.stickers : undefined);
  }, [moves, order]);
  useEffect(() => { stateCache.current = { order, moves, stickers }; }, [order, moves, stickers]);
  const title = t('魔方与图论', 'Rubik’s Cube & Graph Theory');
  const description = t('交互探索一至七阶魔方：三维魔方、圆环和圆盘同步呈现贴纸置换，并介绍魔方与凯莱图的关系。', 'Explore cubes from 1×1 to 7×7 through synchronized 3D, ring and sector views of sticker permutations, and learn how cubes relate to Cayley graphs.');

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
    const next = [...steps.slice(0, cursor), move];
    setSteps(next); setSolutionDraft(next.join(' ')); solutionInput.current?.setText(next.join(' ')); setCursor(cursor + 1);
  }
  function start(next: string[]) {
    setPlaying(false); setAnimate(false); setBusy(false); setSetup(next);
    const solution = inverse(next).join(' ');
    setSteps(inverse(next)); setCursor(0);
    setSetupDraft(next.join(' ')); setupInput.current?.setText(next.join(' '));
    setSolutionDraft(solution); solutionInput.current?.setText(solution);
  }
  function scramble() {
    // A short random-move demonstration, not a competition random-state scramble.
    start(randomMoveScrambleNxN(order).split(' ').filter(Boolean).slice(0, 20));
  }

  return <main className="cube-graph-page">
    <style>{CSS}</style>
    <JsonLd data={articleJsonLd({ headline: title, description, lang, url: `https://cuberoot.me${lang === 'zh' ? '/zh' : ''}/math/cube-graph` })} />
    <header className="cube-graph-header">
      <div className="page-back-row"><BackHome /></div>
      <h1>{title}</h1>
    </header>
    <div className="cube-graph-toolbar">
      <label className="cube-graph-order">{t('阶数', 'Order')}<NxNOrderInput value={order} max={GRAPH_ORDER_MAX} aria-label={t('魔方阶数', 'Cube order')} onCommit={next => {
        if (next === order) return;
        start([]); setSelected(undefined); setOrder(next);
      }} /></label>
      <button type="button" onClick={scramble} disabled={busy || order === 1}><Shuffle size={16} />{t('打乱', 'Scramble')}</button>
      <button type="button" onClick={() => start([])} disabled={busy}>{t('重置', 'Reset')}</button>
      <StickerTracking selected={selected} onSelect={setSelected} />
    </div>
    <div className="cube-graph-views">
      {/* Controller.lock cancels a dragged turn on release. The graph animation
          may still be busy while the user starts the next legitimate turn. */}
      <figure><CubeGraphCube key={order} order={order} moves={moves} animate={animate} locked={playing || pending} onMove={turn} selected={selected} onSelect={selectSticker} />
      </figure>
      <figure><StickerGraph key={order} layout={layout} stickers={stickers} view="rings" animate={animate} selected={selected} onSelect={selectSticker} /></figure>
      <figure><StickerGraph key={order} layout={layout} stickers={stickers} view="sectors" animate={animate} selected={selected} onSelect={selectSticker} /></figure>
    </div>
    <div className="cube-graph-inputs">
      {(['setup', 'solution'] as const).map(kind => {
        const isSetup = kind === 'setup';
        const draft = isSetup ? setupDraft : solutionDraft;
        const ref = isSetup ? setupInput : solutionInput;
        const valid = isSetup ? parsedSetup : parsedSolution;
        const label = isSetup ? t('打乱', 'Scramble') : t('解法', 'Solution');
        const change = (text: string) => {
          setPlaying(false);
          if (isSetup) setSetupDraft(text); else setSolutionDraft(text);
        };
        return <div key={kind}>
          <div className="cube-graph-input-row">
            <label className="cube-graph-input-label"><span>{label}</span>
            <AlgInput ref={ref} initialText={draft} title={label} placeholder={label} inputMode="text" autoResize
              className="cube-graph-input" onChange={change}
              onCaretChange={(text, caret) => {
                if (isSetup || pending || busy || text !== solutionDraft) return;
                const prefix = parseGraphMoves(text.slice(0, caret), order);
                if (prefix) seek(prefix.length);
              }} />
            </label>
            {draft && <ClearButton variant="standalone" ariaLabel={isSetup ? t('清除打乱', 'Clear scramble') : t('清除解法', 'Clear solution')} onClick={() => { ref.current?.setText(''); change(''); }} />}
          </div>
          {!valid && <p className="cube-graph-input-error" role="alert">{t('层数不能超过当前阶数。支持 R、2R、Rw、3Rw、2-3Rw、x 等记号；M/E/S 仅用于至少三阶的奇数阶，m/e/s 表示全部内层。最多 500 步，不支持括号或换位子。', 'Layer numbers must fit the cube order. Use R, 2R, Rw, 3Rw, 2-3Rw or x. M/E/S require odd orders of at least 3; m/e/s turn all inner layers. Up to 500 moves; groups and commutators are not supported.')}</p>}
        </div>;
      })}
    </div>
    <div className="cube-graph-playback">
      <button type="button" aria-label={t('上一步', 'Previous step')} disabled={busy || pending || cursor === 0} onClick={() => seek(cursor - 1)}><ChevronLeft size={18} /></button>
      <button type="button" aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')} disabled={pending || steps.length === 0 || (!playing && busy)} onClick={() => {
        if (!playing && cursor === steps.length) seek(0);
        setPlaying(value => !value);
      }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
      <button type="button" aria-label={t('下一步', 'Next step')} disabled={busy || pending || cursor === steps.length} onClick={() => {
        setPlaying(false); setAnimate(true); setBusy(true); setCursor(cursor + 1);
      }}><ChevronRight size={18} /></button>
      <input type="range" min="0" max={steps.length} value={cursor} disabled={busy || pending || steps.length === 0} onChange={event => seek(Number(event.target.value))} aria-label={t('播放进度', 'Playback position')} />
      <output>{cursor} / {steps.length}</output>
    </div>
    <article className="cube-graph-article">
      <section>
        <h2>{t('贴纸与位置', 'Stickers and positions')}</h2>
        <p className="cube-graph-formula"><TeX src={String.raw`|V|=6N^2=6\times${order}^2=${6 * order * order},\qquad 3N=${3 * order}`} /></p>
        <p>{t('每个点代表一个贴纸位置。布局改变坐标，转动改变贴纸所在的位置。', 'Each point is a sticker position. A layout changes coordinates; a turn moves stickers between positions.')}</p>
        <p>{t('圆环按三个坐标轴分成三组，每组 N 条；每两组共有 N² 对圆，每对交于两点，对应两个相对面的 2N² 枚贴纸。三组配对合计 6N² 个位置。圆盘把六个面各分成 N 行、N 列，两种布局记录同一个贴纸置换。', 'The rings form three families, one per coordinate axis, with N circles each. Two families give N² pairs of circles, each meeting twice: 2N² stickers on opposite faces. The three family pairs yield 6N² positions. The disc divides each face into N rows and N columns. Both layouts record the same sticker permutation.')}</p>
        <p>{t('内层转动沿对应层移动贴纸，宽层转动同时转动连续多层。一阶只有整体转向；偶数阶没有唯一的正中层。下方的循环与凯莱图说明以三阶为例。', 'Inner turns move one layer; wide turns move a consecutive block of layers. A 1×1 only changes its orientation, and even orders have no single middle layer. The cycle and Cayley-graph explanations below use the 3×3 as their example.')}</p>
      </section>
      <CycleLesson />
      <CayleyLesson />
      <section><h2>{t('图形来源', 'Visual references')}</h2>
        <p><a href="https://x.com/themathflow/status/2101154346583154801" target="_blank" rel="noreferrer">{t('The Math Flow 发布的圆环动画', 'Ring animation posted by The Math Flow')}</a>{t('是圆环布局的视觉参考；', ' inspired the ring layout; ')}<a href="https://github.com/2017YANR02/cuberoot.me/issues/81" target="_blank" rel="noreferrer">{t('需求中的第二张图', 'the second image in the request')}</a>{t('提供了扇形布局的参考。本页独立实现交互与位置映射。', ' inspired the sector layout. The interaction and coordinate mapping are independently implemented.')}</p>
      </section>
    </article>
  </main>;
}

function StickerTracking({ selected, onSelect }: { selected?: number; onSelect: (id: number | undefined) => void }) {
  const t = useT();
  return <div className="cube-graph-lesson-controls cube-graph-tracking">
    <span>{t('点击贴纸来跟踪', 'Click a sticker to track it')}</span>
    {selected !== undefined &&
      <ClearButton variant="standalone" ariaLabel={t('取消跟踪', 'Clear selection')} onClick={() => onSelect(undefined)} />
    }
  </div>;
}

function CycleLesson() {
  const t = useT();
  const [face, setFace] = useState('R');
  const [turns, setTurns] = useState(0);
  const cycles = useMemo(() => turnCycles(face), [face]);
  const positions = [[35, 35], [145, 35], [145, 145], [35, 145]];
  const name = (id: number) => `${FACES[Math.floor(id / 9)]}${id % 9 + 1}`;
  return <section>
    <h2>{t('三阶：一次转动，五个循环', '3×3: one turn, five cycles')}</h2>
    <p>{t('每转一次，贴纸沿箭头前进一格。试着转四次，看每枚贴纸回到起点。', 'Each quarter turn moves stickers one arrow forward. Try four turns to bring every sticker home.')}</p>
    <div className="cube-graph-lesson-controls">
      <CompactSelect label={face} ariaLabel={t('循环演示的转动面', 'Face for the cycle demonstration')} value={face} onChange={value => { setFace(value); setTurns(0); }}
        items={FACES.map(value => ({ value, label: value }))} />
      <label>{t('转动次数', 'Quarter turns')}<input type="range" min="0" max="4" value={turns} onChange={event => setTurns(Number(event.target.value))} /><output>{turns}</output></label>
      <button type="button" onClick={() => setTurns(value => (value + 1) % 5)}>{t('走一步', 'Step')}</button>
    </div>
    <div className="cube-graph-cycles">
      {cycles.map((cycle, index) => <figure key={`${face}-${index}`} className="cube-graph-cycle">
        <svg viewBox="0 0 180 185" role="img" aria-label={`${t('循环', 'Cycle')} ${index + 1}: ${cycle.map(name).join(' → ')}`}>
          {positions.map(([x, y], i) => {
            const id = cycle[(i - turns % 4 + 4) % 4];
            return <g key={i}>
              <path d="M 59 35 H 116 M 110 30 L 116 35 L 110 40" transform={`rotate(${i * 90} 90 90)`} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="23" fill="var(--input)" stroke={CUBE_FILL[FACES[Math.floor(id / 9)]]} strokeWidth="4" />
              <text x={x} y={y - 4} textAnchor="middle" dominantBaseline="central" fill="var(--foreground)" fontSize="14">{name(id)}</text>
              <text x={x} y={y + 13} textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">{name(cycle[i])}</text>
            </g>;
          })}
        </svg>
        <figcaption>{Math.floor(cycle[0] / 9) === FACES.indexOf(face as typeof FACES[number]) ? t('本面', 'Turning face') : t('邻面条带', 'Adjacent strips')}</figcaption>
      </figure>)}
    </div>
    <p className="cube-graph-hint">{t('大字是贴纸编号，小字是固定位置；没有画出的贴纸保持不动。', 'Large labels: sticker identity. Small labels: fixed position. Stickers outside these cycles stay still.')}</p>
    <p className="cube-graph-formula"><TeX src={String.raw`T_{${face}}^{${turns}}${turns === 0 || turns === 4 ? String.raw`=\mathrm{id}` : String.raw`\ne\mathrm{id}`},\qquad 5\times4=20`} /></p>
  </section>;
}

const CSS = `
.cube-graph-page{max-width:1000px;margin:0 auto;padding:24px 16px 64px;color:var(--foreground)}
.cube-graph-page h1{font-size:clamp(26px,4vw,38px);margin:24px 0 12px;letter-spacing:-.025em}
.cube-graph-toolbar,.cube-graph-playback,.cube-graph-links{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.cube-graph-toolbar{flex-wrap:nowrap;overflow-x:auto}
.cube-graph-toolbar>*{flex-shrink:0;white-space:nowrap}
.cube-graph-order{display:flex;align-items:center;gap:8px}
.cube-graph-page button:not(.clear-btn){font:inherit;color:var(--foreground);background:transparent;border:0;border-radius:6px;padding:8px 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;min-height:40px}
.cube-graph-page button:hover{background:var(--muted)}
.cube-graph-page button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.cube-graph-page button:disabled{opacity:.4;cursor:default}
.cube-graph-views{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:center;margin:12px 0 24px}
.cube-graph-views figure{margin:0;min-width:0}
.cube-graph-cube{width:100%;aspect-ratio:1;height:auto}
.cube-graph-cube .sim-stage-canvas{width:100%!important;height:100%!important}
.cube-graph-svg{display:block;width:100%;max-width:490px;height:auto;max-height:440px;margin:auto;overflow:hidden;touch-action:none;user-select:none;cursor:grab}
.cube-graph-svg.is-panning,.cube-graph-svg.is-panning [role="button"]{cursor:grabbing}
.cube-graph-svg [role="button"]{cursor:pointer;touch-action:manipulation}
.cube-graph-svg [role="button"]:focus{outline:none}
.cube-graph-svg path[role="button"]:focus-visible,.cube-graph-svg g[role="button"]:focus-visible [data-sticker]{stroke-width:3}
.cube-graph-hint{font-size:13px;color:var(--muted-foreground);line-height:1.8}
.cube-graph-playback{margin:20px 0 12px}
.cube-graph-playback input{width:clamp(110px,35vw,360px);min-width:0;accent-color:var(--accent)}
.cube-graph-playback output{font-variant-numeric:tabular-nums;font-size:14px}
.cube-graph-article{margin-top:48px;line-height:1.9}
.cube-graph-article section{margin-top:36px}
.cube-graph-article h2{font-size:23px;line-height:1.4;margin-bottom:14px}
.cube-graph-article p{margin:12px 0}
.cube-graph-inputs{display:grid;gap:10px;margin-top:20px}
.cube-graph-input-row{display:flex;align-items:center;gap:6px}
.cube-graph-input-label{display:flex;align-items:center;gap:10px;width:100%;min-width:0}
.cube-graph-input-label>span{white-space:nowrap;font-size:14px;color:var(--muted-foreground)}
.cube-graph-input{box-sizing:border-box;width:100%;min-width:0;resize:none;overflow-y:hidden;font:inherit;line-height:1.7;color:var(--foreground);background:var(--input);border:1px solid var(--border-default);border-radius:8px;padding:10px 12px}
.cube-graph-input:focus{outline:2px solid var(--ring);outline-offset:2px}
.cube-graph-input-error{color:var(--signal-danger);font-size:13px}
.cube-graph-lesson-controls{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.cube-graph-lesson-controls label{display:flex;align-items:center;gap:8px}
.cube-graph-lesson-controls input{width:120px;accent-color:var(--accent)}
.cube-graph-tracking{flex-wrap:nowrap;font-size:14px}
.cube-graph-cycles{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}
.cube-graph-cycle{flex:1 1 145px;max-width:180px;margin:0}
.cube-graph-cycle svg{display:block;width:100%;max-width:180px;height:auto}
.cube-graph-cycle figcaption{text-align:center;font-size:13px;color:var(--muted-foreground)}
.cube-graph-formula{overflow-x:auto;padding:8px 0}

.cube-graph-article a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
@media(max-width:700px){.cube-graph-views{grid-template-columns:1fr;gap:20px}.cube-graph-cube{height:240px;aspect-ratio:auto}.cube-graph-svg{max-height:350px}.cube-graph-cycle{flex-basis:125px}.cube-graph-playback{gap:4px}.cube-graph-page{padding-top:16px}}
`;
