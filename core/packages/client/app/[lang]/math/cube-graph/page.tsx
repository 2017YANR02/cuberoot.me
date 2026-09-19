'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
import { MOVE_NAMES } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import AlgInput, { type AlgInputHandle } from '@/components/AlgInput';
import { ClearButton } from '@/components/ClearButton';
import { TeX } from '@/components/math/Tex';
import BackHome from '@/components/BackHome';
import Link from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import CubeGraphCube from './CubeGraphCube';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';
import { CUBE_FILL } from '@/lib/cube-colors';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { GRAPH_SLOTS, RINGS, graphPosition, sectorPath, stickerPermutation, parseGraphMoves, turnCycles } from './model';

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

function StickerGraph({ stickers, view, animate, selected }: { stickers: number[]; view: View; animate: boolean; selected?: number }) {
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
        cx={GRAPH_SLOTS[slot].x} cy={GRAPH_SLOTS[slot].y} r={selected === id ? 10 : 6.5} opacity={selected === undefined || selected === id ? 1 : 0.2} fill={CUBE_FILL[FACES[Math.floor(id / 9)]]}
        stroke="var(--foreground)" strokeWidth="0.8" data-sticker={id}>
        <title>{`${FACES[Math.floor(id / 9)]}${id % 9 + 1} → ${FACES[Math.floor(slot / 9)]}${slot % 9 + 1}`}</title>
      </circle>)}
    </> : <>
      {GRAPH_SLOTS.map((p, slot) => <path key={slot} d={sectorPath(p.face, p.row, p.col)} fill={CUBE_FILL[FACES[Math.floor(stickers[slot] / 9)]]}
        opacity={selected === undefined || stickers[slot] === selected ? 1 : 0.15} stroke="var(--foreground)" strokeWidth={stickers[slot] === selected ? 2 : 0.8} data-slot={slot}>
        <title>{`${FACES[p.face]}${slot % 9 + 1} ← ${FACES[Math.floor(stickers[slot] / 9)]}${stickers[slot] % 9 + 1}`}</title>
      </path>)}
      {FACES.map((face, index) => {
        const angle = -Math.PI / 2 + (index + 0.5) * Math.PI / 3;
        return <text key={face} x={(220 + 191 * Math.cos(angle)).toFixed(3)} y={(220 + 191 * Math.sin(angle)).toFixed(3)} textAnchor="middle" dominantBaseline="middle" fill="var(--foreground)" fontSize="17">{face}</text>;
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
  const setupInput = useRef<AlgInputHandle>(null);
  const solutionInput = useRef<AlgInputHandle>(null);
  const [setupDraft, setSetupDraft] = useState(EXAMPLE.join(' '));
  const [solutionDraft, setSolutionDraft] = useState(inverse(EXAMPLE).join(' '));
  // Internally generated histories are already valid and may exceed the paste limit.
  const parsedSetup = useMemo(() => setupDraft === setup.join(' ') ? setup : parseGraphMoves(setupDraft), [setupDraft, setup]);
  const parsedSolution = useMemo(() => solutionDraft === steps.join(' ') ? steps : parseGraphMoves(solutionDraft), [solutionDraft, steps]);
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
    const next = [...steps.slice(0, cursor), move];
    setSteps(next); setSolutionDraft(next.join(' ')); solutionInput.current?.setText(next.join(' ')); setCursor(cursor + 1);
  }
  function start(next: string[]) {
    setPlaying(false); setAnimate(false); setSetup(next);
    const solution = inverse(next).join(' ');
    setSteps(inverse(next)); setCursor(0);
    setSetupDraft(next.join(' ')); setupInput.current?.setText(next.join(' '));
    setSolutionDraft(solution); solutionInput.current?.setText(solution);
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
      <button type="button" onClick={() => { start(moves); setPlaying(true); }} disabled={busy || solved || pending}><RotateCcw size={16} />{t('沿原路还原', 'Retrace to solved')}</button>
      <button type="button" onClick={() => start([])} disabled={busy}>{t('重置', 'Reset')}</button>
      <CompactSelect label={view === 'rings' ? t('圆环', 'Rings') : t('扇形', 'Sectors')} ariaLabel={t('平面图布局', 'Map layout')} value={view} onChange={setView}
        items={[{ value: 'rings', label: t('圆环', 'Rings') }, { value: 'sectors', label: t('扇形', 'Sectors') }]} />
    </div>
    <div className="cube-graph-pair">
      <figure><CubeGraphCube moves={moves} animate={animate} locked={busy || playing || pending} onMove={turn} />
        <figcaption>{t('三维魔方', '3D cube')}<span role="status" data-solved={solved}>{solved ? t('已还原', 'Solved') : t('未还原', 'Unsolved')}</span></figcaption>
      </figure>
      <figure><StickerGraph stickers={stickers} view={view} animate={animate} />
        <figcaption>{view === 'rings' ? t('9 条圆环，54 枚贴纸', '9 circles, 54 stickers') : t('6 个扇区，每区 3 × 3 格', '6 sectors, 3 × 3 cells each')}</figcaption>
      </figure>
    </div>
    <p className="cube-graph-hint">{t('拖动贴纸转层，拖动空白调整视角。', 'Drag stickers to turn; drag the background to orbit.')}</p>
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
                const prefix = parseGraphMoves(text.slice(0, caret));
                if (prefix) seek(prefix.length);
              }} />
            </label>
            {draft && <ClearButton variant="standalone" ariaLabel={isSetup ? t('清除打乱', 'Clear scramble') : t('清除解法', 'Clear solution')} onClick={() => { ref.current?.setText(''); change(''); }} />}
          </div>
          {!valid && <p className="cube-graph-input-error" role="alert">{t('请输入面转、中层、宽层或转体（如 R U2 M′ Rw x），最多 500 步；暂不支持括号或交换子。', 'Use face, slice, wide or rotation moves (e.g. R U2 M′ Rw x), up to 500 moves. Groups and commutators are not supported here.')}</p>}
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
    <p className="cube-graph-hint">{t('点击解法中的位置可跳步；“沿原路还原”生成逆序列，不搜索最短解。', 'Click within the solution to seek. Retrace generates the inverse sequence, not a shortest solution.')}</p>
    <article className="cube-graph-article">
      <MappingLesson stickers={stickers} />
      <CycleLesson />
      <p className="cube-graph-links"><Link href="/math/group/cayley" prefetch={false}>{t('凯莱图：把整个魔方状态作为一个顶点', 'Cayley graphs: one vertex per cube state')}</Link><Link href="/math/god" prefetch={false}>{t('上帝之数', 'God’s number')}</Link></p>
      <section><h2>{t('图形来源', 'Visual references')}</h2>
        <p><a href="https://x.com/themathflow/status/2101154346583154801" target="_blank" rel="noreferrer">{t('The Math Flow 发布的圆环动画', 'Ring animation posted by The Math Flow')}</a>{t('是圆环布局的视觉参考；', ' inspired the ring layout; ')}<a href="https://github.com/2017YANR02/cuberoot.me/issues/81" target="_blank" rel="noreferrer">{t('需求中的第二张图', 'the second image in the request')}</a>{t('提供了扇形布局的参考。本页独立实现交互与位置映射。', ' inspired the sector layout. The interaction and coordinate mapping are independently implemented.')}</p>
      </section>
    </article>
  </main>;
}

function MappingLesson({ stickers }: { stickers: number[] }) {
  const t = useT();
  const [face, setFace] = useState('U');
  const [cell, setCell] = useState(0);
  const selected = FACES.indexOf(face as typeof FACES[number]) * 9 + cell;
  const slot = stickers.indexOf(selected);
  const position = GRAPH_SLOTS[slot];
  return <section>
    <h2>{t('跟踪一枚贴纸', 'Follow one sticker')}</h2>
    <p>{t('选一枚贴纸，再转动上面的魔方。两种画法始终指向同一枚贴纸。', 'Choose a sticker, then turn the cube above. Both drawings track the same sticker.')}</p>
    <div className="cube-graph-lesson-controls">
      <CompactSelect label={face} ariaLabel={t('贴纸原属面', 'Sticker’s original face')} value={face} onChange={setFace}
        items={FACES.map(value => ({ value, label: value }))} />
      <label>{t('格子', 'Cell')}<input type="range" min="0" max="8" value={cell} onChange={event => setCell(Number(event.target.value))} /><output>{cell + 1}</output></label>
      <output>{`${face}${cell + 1} → ${FACES[position.face]}${slot % 9 + 1}`}</output>
    </div>
    <div className="cube-graph-mapping">
      <figure><StickerGraph stickers={stickers} view="rings" animate={false} selected={selected} /><figcaption>{t('圆环交点', 'Ring intersection')}</figcaption></figure>
      <figure><StickerGraph stickers={stickers} view="sectors" animate={false} selected={selected} /><figcaption>{t('扇区格子', 'Sector cell')}</figcaption></figure>
    </div>
    <p className="cube-graph-formula"><TeX src={String.raw`|V|=6\times3^2=54`} /></p>
    <p>{t('每个点代表一个贴纸位置。布局改变坐标，转动改变贴纸所在的位置。', 'Each point is a sticker position. A layout changes coordinates; a turn moves stickers between positions.')}</p>
  </section>;
}

function CycleLesson() {
  const t = useT();
  const [face, setFace] = useState('R');
  const [turns, setTurns] = useState(0);
  const cycles = useMemo(() => turnCycles(face), [face]);
  const positions = [[35, 35], [145, 35], [145, 145], [35, 145]];
  const name = (id: number) => `${FACES[Math.floor(id / 9)]}${id % 9 + 1}`;
  return <section>
    <h2>{t('一次转动，五个循环', 'One turn, five cycles')}</h2>
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
.cube-graph-lead{color:var(--muted-foreground);max-width:720px;line-height:1.8;margin-bottom:24px}
.cube-graph-toolbar,.cube-graph-playback,.cube-graph-links{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.cube-graph-page button:not(.clear-btn){font:inherit;color:var(--foreground);background:transparent;border:0;border-radius:6px;padding:8px 10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;min-height:40px}
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
.cube-graph-mapping{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
.cube-graph-mapping figure{margin:0;min-width:0}
.cube-graph-mapping .cube-graph-svg{max-height:300px}
.cube-graph-mapping figcaption{text-align:center;color:var(--muted-foreground);font-size:14px}
.cube-graph-cycles{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}
.cube-graph-cycle{flex:1 1 145px;max-width:180px;margin:0}
.cube-graph-cycle svg{display:block;width:100%;max-width:180px;height:auto}
.cube-graph-cycle figcaption{text-align:center;font-size:13px;color:var(--muted-foreground)}
.cube-graph-formula{overflow-x:auto;padding:8px 0}

.cube-graph-article a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
@media(max-width:600px){.cube-graph-pair{grid-template-columns:1fr;gap:20px}.cube-graph-cube{height:240px;max-height:none}.cube-graph-svg{max-height:350px}.cube-graph-mapping{grid-template-columns:1fr}.cube-graph-cycle{flex-basis:125px}.cube-graph-playback{gap:4px}.cube-graph-page{padding-top:16px}}
`;
