'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Lightbulb, RotateCcw, Workflow, X } from '@app-foundation/icons/lucide';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import TrainingFeedbackOverlay from '@/components/TrainingFeedbackOverlay';
import BoolToggle from '@/components/BoolToggle';
import { tr, T } from '@/i18n/tr';
import { practiceNextMove } from '../../lib/practice-next-move';
import { isF2lPracticeSolved } from '../lib/algorithm-practice';
import { buildPracticeFlow, practiceFlowProgress, flowEdgeId, type PracticeFlowRoute } from '../lib/practice-flow';
import PracticeFlowGraph, { LinearPracticeFlow } from '../components/PracticeFlowGraph';
import PracticeReferenceSheet from '../../components/PracticeReferenceSheet';
import ReadingFit from '../../components/ReadingFit';
import useReferenceFitFallback from '../../components/useReferenceFitFallback';
import type { f2lTeachingPaths } from '../lib/curriculum';
import './algorithm-practice.css';

type TeachingCase = ReturnType<typeof f2lTeachingPaths>[number];

export default function AlgorithmPractice({ lesson, chapter, orientation, onPrevious, onNext, onClose }: {
  lesson: TeachingCase; chapter: 4 | 5 | 'classified'; orientation: string;
  onPrevious?: () => void; onNext?: () => void; onClose: () => void;
}) {
  const player = useRef<AlgPlayerHandle>(null);
  const [history, setHistory] = useState('');
  const [settledHistory, setSettledHistory] = useState('');
  const [generation, setGeneration] = useState(0);
  const [hints, setHints] = useState(false);
  const [solved, setSolved] = useState(false);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [guidedMove, setGuidedMove] = useState<string>();
  const flow = useMemo(() => buildPracticeFlow(lesson.name, lesson.setup, lesson.alg), [lesson.name, lesson.setup, lesson.alg]);
  const [desktopFixedRoute, setDesktopFixedRoute] = useState(false);
  const [routeIndex, setRouteIndex] = useState(0);
  const [layout, setLayout] = useState<'desktop' | 'portrait' | 'landscape'>('desktop');
  const [reference, setReference] = useState<'sheet' | 'flow' | 'full'>('sheet');
  const [flowOpen, setFlowOpen] = useState(false);
  const mobile = layout !== 'desktop';
  const { compactFallback, onReferenceFit } = useReferenceFitFallback();
  const fixedRoute = !mobile && desktopFixedRoute;
  const selectedRoute = flow.routes[routeIndex] ?? flow.routes[0];
  const activeFlow = useMemo(() => {
    if (!fixedRoute) return flow;
    const names = new Set(selectedRoute.points.map(point => point.name));
    const edges = new Set(selectedRoute.points.slice(1).map((point, i) => flowEdgeId(selectedRoute.points[i].name, point.name)));
    return { ...flow, routes: [selectedRoute], nodes: flow.nodes.filter(node => names.has(node.name)), edges: flow.edges.filter(edge => edges.has(edge.id)) };
  }, [flow, fixedRoute, selectedRoute]);
  const progress = useMemo(() => practiceFlowProgress(activeFlow, settledHistory), [activeFlow, settledHistory]);
  const matchedRoute = progress.match?.route;
  const [lastRoute, setLastRoute] = useState<PracticeFlowRoute>();
  useEffect(() => {
    if (!fixedRoute && matchedRoute) setLastRoute(matchedRoute);
  }, [fixedRoute, matchedRoute]);
  const route = matchedRoute ?? (mobile && !fixedRoute ? lastRoute : undefined) ?? activeFlow.routes[0];
  const completed = progress.match?.step ?? 0;
  const sections = route.points.slice(1).map((point, i) => ({ start: route.points[i].step, end: point.step, name: point.name }));
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!player.current || player.current.isUserMovePending?.()) return;
      window.clearInterval(timer);
      const reached = isF2lPracticeSolved(`${lesson.setup} ${history}`);
      setSolved(reached);
      setSettledHistory(history);
    }, 100);
    return () => window.clearInterval(timer);
  }, [history, lesson.setup, generation]);
  useEffect(() => {
    setGuidedMove(hints && !solved && history === settledHistory && progress.match
      ? practiceNextMove(`${history} ${progress.match.remaining}`, history) : undefined);
  }, [hints, solved, history, settledHistory, progress]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!['Space', 'ArrowLeft', 'ArrowRight'].includes(event.code) || event.repeat || event.defaultPrevented
        || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, [contenteditable], [role="slider"], dialog, [role="dialog"], [aria-haspopup], .f2l-practice-graph-viewport')) return;
      if (document.querySelector('[aria-modal="true"], [role="listbox"], [role="menu"]')) return;
      event.preventDefault();
      if (event.code === 'ArrowLeft') onPrevious?.();
      else onNext?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onPrevious, onNext]);
  const practiceContent = useRef<HTMLDivElement>(null);
  const flowTrigger = useRef<HTMLButtonElement>(null);
  const flowViewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = practiceContent.current;
    if (!body) return;
    const portrait = window.matchMedia('(orientation: portrait) and (max-width: 700px)');
    const landscape = window.matchMedia(
      '(orientation: landscape) and (max-width: 1100px) and (any-pointer: coarse), '
      + '(orientation: landscape) and (max-width: 1100px) and (max-height: 500px)',
    );
    const update = () => {
      const inLandscape = landscape.matches || (compactFallback && innerWidth > innerHeight);
      const inPortrait = portrait.matches || (compactFallback && !inLandscape);
      setLayout(inLandscape ? 'landscape' : inPortrait ? 'portrait' : 'desktop');
      const height = body.clientHeight;
      const width = body.clientWidth;
      const spare = inPortrait ? height - Math.min(width, 380) - 68 : height - 52;
      const flowFits = spare >= 144 && (inPortrait || width >= 520);
      const next = !flowFits ? 'sheet' : spare >= 264 ? 'full' : 'flow';
      setReference(next);
      if ((!inLandscape && !inPortrait) || next !== 'sheet') setFlowOpen(false);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    portrait.addEventListener('change', update);
    landscape.addEventListener('change', update);
    return () => {
      observer.disconnect();
      portrait.removeEventListener('change', update);
      landscape.removeEventListener('change', update);
    };
  }, [compactFallback]);
  useLayoutEffect(() => {
    const viewport = flowViewport.current;
    const current = viewport?.querySelector('.f2l-flow-node[aria-current="step"]');
    if (!mobile || !viewport || !current) return;
    const visible = viewport.getBoundingClientRect();
    const node = current.getBoundingClientRect();
    if (node.left < visible.left || node.right > visible.right) {
      viewport.scrollLeft += (node.left + node.right - visible.left - visible.right) / 2;
    }
  }, [mobile, reference, flowOpen, route]);
  const reset = () => {
    setCompletionDismissed(false);
    setLastRoute(undefined);
    setHistory(''); setSettledHistory(''); setSolved(false); setGuidedMove(undefined); setGeneration(value => value + 1);
  };
  const title = <>{tr(chapter === 'classified' ? { zh: '标态公式', en: 'Standard-case algorithms' } : chapter === 4 ? { zh: '学习 F2L 公式（一）', en: 'F2L algorithms I' } : { zh: '学习 F2L 公式（二）', en: 'F2L algorithms II' })} · {lesson.name}</>;
  const routeControl = (
    <div className="f2l-practice-route-controls">
      <BoolToggle value={fixedRoute} label={tr({ zh: '指定路线', en: 'Fixed route' })} onChange={value => {
        if (value && progress.match) setRouteIndex(flow.routes.indexOf(progress.match.route));
        setGuidedMove(undefined);
        setDesktopFixedRoute(value);
      }} />
    </div>
  );
  const flowReference = (
    <div className="f2l-practice-graph">
      <div ref={flowViewport} className="f2l-practice-graph-viewport" tabIndex={mobile ? 0 : undefined}
        role={mobile ? 'region' : undefined} aria-label={mobile ? tr({ zh: '练习转化路径', en: 'Practice transformation paths' }) : undefined}>
        {mobile ? <LinearPracticeFlow route={route} progress={progress} orientation={orientation} /> : <PracticeFlowGraph flow={flow} progress={progress} orientation={orientation}
          selectedRoute={fixedRoute ? selectedRoute : undefined}
          onSelectEdge={fixedRoute ? id => {
            const contains = (item: typeof selectedRoute) => item.points.slice(1).some((point, i) => flowEdgeId(item.points[i].name, point.name) === id);
            if (contains(selectedRoute)) return;
            const next = flow.routes.findIndex(contains);
            if (next >= 0) { setGuidedMove(undefined); setRouteIndex(next); }
          } : undefined} />}
      </div>
    </div>
  );
  const practiceTools = (
    <div className="f2l-practice-tools">
      <button type="button" className="f2l-restart" onClick={reset}><RotateCcw size={16} aria-hidden="true" /><T zh="重来" en="Restart" /></button>
      {mobile && reference === 'sheet' && <button type="button" className="f2l-restart" ref={flowTrigger} aria-haspopup="dialog" onClick={() => setFlowOpen(true)}>
        <Workflow size={16} aria-hidden="true" /><T zh="流程图" en="Flowchart" />
      </button>}
      {mobile && <button type="button" className="f2l-restart" aria-pressed={hints} onClick={() => setHints(!hints)}>
        <Lightbulb size={16} aria-hidden="true" /><T zh="转动提示" en="Turn hints" />
      </button>}
    </div>
  );
  const steps = (
    <div key={generation} className="f2l-practice-hint" data-site-surface="panel">
      {!mobile && !hints && <button type="button" className="f2l-practice-hint-toggle f2l-practice-hint-trigger" onClick={() => setHints(true)}>
        <Lightbulb size={22} aria-hidden="true" /><T zh="点击此处获取提示" en="Click here for a hint" />
      </button>}
      <div className="f2l-practice-hint-content" aria-hidden={!mobile && !hints}>
        <div className="f2l-practice-hint-stage">
          <div className="f2l-practice-segments" data-recovering={!solved && !progress.match}>
            {sections.map(section => <div className="f2l-practice-segment" key={section.start}>
              <code>{route.moves.slice(section.start, section.end).map((move, j) => <span key={j}
                data-complete={solved || completed > section.start + j}
                aria-current={!solved && Math.floor(completed) === section.start + j ? 'step' : undefined}>{move}</span>)}</code>
              <span data-complete={solved || completed >= section.end} data-active={!solved && completed > section.start && completed < section.end}>
                {section.name === 'solved' ? <T zh="完成还原" en="Solve the pair" /> : tr({ zh: `转化为 ${section.name}`, en: `Reach ${section.name}` })}
                <span className="f2l-practice-segment-progress" aria-hidden="true" style={{ width: `${solved ? 100 : Math.max(0, Math.min(1, (completed - section.start) / (section.end - section.start))) * 100}%` }} />
              </span>
            </div>)}
          </div>
          <div className="f2l-practice-status" data-site-surface="popover" role="status"
            hidden={!hints || (solved ? completionDismissed : !!progress.match)}>
            {solved ? <button type="button" className="f2l-practice-completion" onClick={() => setCompletionDismissed(true)}><T zh="已完成" en="Completed" /></button>
              : fixedRoute ? <T zh="当前状态偏离所选路线，可退回或重来" en="The current state is off the selected route. Undo your turns or restart." />
              : <T zh="当前转化未收录，可继续尝试或重来" en="This transition is not in the saved paths. Keep trying or restart." />}
          </div>
        </div>
        {!mobile && <button type="button" className="f2l-practice-hint-toggle" onClick={() => { setHints(false); setGuidedMove(undefined); }}>
          <span className="f2l-practice-hint-close-icon" aria-hidden="true"><Lightbulb size={22} strokeWidth={1.5} /><X size={10} strokeWidth={2} /></span><T zh="关闭提示" en="Hide hint" />
        </button>}
      </div>
    </div>
  );
  return <section className="f2l-alg-practice" data-practice-layout={mobile ? layout : undefined}
    data-inline-reference={mobile && reference !== 'sheet' || undefined}>
    <header className="f2l-practice-heading">
      {mobile ? <h1><button type="button" className="f2l-practice-back" onClick={onClose} aria-describedby="f2l-practice-review">
        <ChevronLeft size={17} aria-hidden="true" />{title}
      </button></h1> : <><h2>{title}</h2>{routeControl}</>}
    </header>
    <div ref={practiceContent} className="f2l-practice-content">
      <div className="f2l-practice-demo">
        <div className="f2l-cube f2l-practice-cube">
          <AlgPlayer ref={player} key={generation} puzzle="3x3" engine="sim" set="f2l-overview" alg="" setup={lesson.setup}
            orientation={orientation} controlMode="none" hideResetView fillPane moveDurationMs={525}
            interactionMode={solved ? 'view' : 'turn'} moveHint={guidedMove}
            onUserMove={move => { setGuidedMove(undefined); setSolved(false); setHistory(previous => `${previous} ${move}`.trim()); }} />
          <TrainingFeedbackOverlay kind={solved ? 'correct' : null} correctLabel={tr({ zh: '已达到本题目标', en: 'Target reached' })} wrongLabel="" />
        </div>
        {layout !== 'landscape' && practiceTools}
      </div>
      {(!mobile || layout === 'landscape' || reference !== 'sheet') && <div className="f2l-practice-copy">
        {layout === 'landscape' && practiceTools}
        {!mobile ? <ReadingFit layout="F" onFit={onReferenceFit}>
          <div className="f2l-practice-reference">{flowReference}{steps}</div>
        </ReadingFit> : reference !== 'sheet' && <div className="f2l-practice-reference">
          {flowReference}
          {reference === 'full' && steps}
        </div>}
      </div>}
    </div>
    <footer className="f2l-practice-footer">
      <button type="button" className="f2l-footer-button f2l-footer-next" disabled={!onPrevious} onClick={onPrevious}><T zh="上一个练习" en="Previous exercise" /></button>
      <button type="button" id="f2l-practice-review" className="f2l-practice-review" onClick={onClose}><T zh="回看本节教程" en="Review this lesson" /></button>
      <button type="button" className="f2l-footer-button f2l-footer-next" disabled={!onNext} onClick={onNext}><T zh="下一个练习" en="Next exercise" /></button>
    </footer>
    {mobile && reference === 'sheet' && flowOpen && <PracticeReferenceSheet title={<T zh="流程图" en="Flowchart" />} onClose={() => {
      setFlowOpen(false);
      requestAnimationFrame(() => flowTrigger.current?.focus({ preventScroll: true }));
    }}>
      {flowReference}
      {hints && steps}
    </PracticeReferenceSheet>}
  </section>;
}
