import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alg } from 'cubing/alg';
import AlgPlayer, { type AlgPlayerHandle } from '@/components/AlgPlayer/AlgPlayer';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { tr } from '@/i18n/tr';
import { edgeDirectionObservation, wallScanPhases } from './complete-demo-state';
import { lblDemoView, LESSON_STICKERING, type LblExample } from './content';
import { usePlayerVisible } from './use-player-visible';

const NO_OUTLINES: string[] = [];

export default function EdgeObservation({ example, caseIndex, onDone }: {
  example: LblExample; caseIndex: number; onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [readyStep, setReadyStep] = useState<number | null>(null);
  const ready = readyStep === step;
  const [found, setFound] = useState(false);
  const [outlines, setOutlines] = useState<string[]>([]);
  const player = useRef<AlgPlayerHandle>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const visible = usePlayerVisible(player, example.alg);
  const yaw = useRef(0);
  const advanced = useRef(false);
  const plan = useMemo(() => {
    const setup = resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false);
    const scans = wallScanPhases(setup, 0, caseIndex);
    const preparation = new Alg(example.alg).expand().toString().split(/\s+/).filter(move => /^y/.test(move)).join(' ');
    const moves = preparation.split(/\s+/).filter(Boolean);
    const views: Record<string, number> = { home: 0, right: -Math.PI / 2, back: -Math.PI, left: Math.PI / 2 };
    return { setup, scans, moves, views, wall: scans.at(-1)!.act.outlines ?? [],
      direction: edgeDirectionObservation(`${setup} ${preparation}`, caseIndex === 0) };
  }, [example, caseIndex]);

  useEffect(() => {
    if (!visible) return;
    setReadyStep(null);
    setFound(false);
    advanced.current = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let started: number | undefined;
    let moveIndex = 0;
    let pending = false;
    const initialYaw = yaw.current;
    const setYaw = (value: number) => {
      player.current?.orbitView?.(value - yaw.current, 0);
      yaw.current = value;
    };
    const tick = (now: number) => {
      started ??= now;
      const elapsed = now - started;
      if (step === 0) {
        const scanCount = plan.scans.length - 1;
        const scanDuration = reduced ? 300 : 1600;
        const scanEnd = scanCount * scanDuration;
        if (elapsed < scanEnd) {
          const index = Math.min(scanCount - 1, Math.floor(elapsed / scanDuration));
          const from = index === 0 ? initialYaw : plan.views[plan.scans[index - 1].view ?? 'home'];
          const to = plan.views[plan.scans[index].view ?? 'home'];
          const progress = Math.min((elapsed % scanDuration) / (scanDuration * .7), 1);
          setYaw(from + (to - from) * progress * progress * (3 - 2 * progress));
          setOutlines(NO_OUTLINES);
        } else {
          setFound(true);
          setOutlines(reduced || Math.floor((elapsed - scanEnd) / 250) % 2 === 0 ? plan.wall : NO_OUTLINES);
          setReadyStep(step);
          if (caseIndex === 2) return;
        }
      } else if (step === 1) {
        setOutlines(plan.wall);
        const progress = Math.min(elapsed / 2200, 1);
        setYaw(initialYaw * (1 - progress * progress * (3 - 2 * progress)));
        if (pending && !player.current?.isUserMovePending?.()) { pending = false; moveIndex++; }
        if (!pending && moveIndex < plan.moves.length) { player.current?.playMove?.(moveIndex); pending = true; }
        if (moveIndex === plan.moves.length && !pending && elapsed >= 2200) { setOutlines(NO_OUTLINES); setReadyStep(step); return; }
      } else {
        // Inspect the other side first, then hold the target side in view.
        const lookingAtTarget = elapsed >= 2400;
        const progress = Math.min(lookingAtTarget ? (elapsed - 2400) / 3000 : elapsed / 1800, 1);
        const eased = progress * progress * (3 - 2 * progress);
        const direction = caseIndex === 0 ? 1 : -1;
        const firstYaw = caseIndex === 0 ? .6 : .85;
        const targetYaw = caseIndex === 0 ? 1.05 : .3;
        setYaw(reduced ? 0 : direction * (lookingAtTarget ? -firstYaw + (firstYaw + targetYaw) * eased : -firstYaw * eased));
        const arrived = elapsed >= 5400;
        setOutlines(arrived && (reduced || Math.floor((elapsed - 5400) / 300) % 2 === 0) ? plan.direction : NO_OUTLINES);
        if (arrived) setReadyStep(step);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, step, plan, caseIndex]);

  function advance() {
    if (!ready || advanced.current) return;
    advanced.current = true;
    if (caseIndex === 2 || step === 2) onDone();
    else setStep(value => value + 1);
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!ready || event.code !== 'Space' || event.repeat || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [contenteditable], [role="slider"]')) return;
      event.preventDefault();
      advance();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  const caption = step === 0 ? caseIndex === 2 && found
    ? { zh: '四面都没有墙，先做公式造墙。', en: 'No wall on any side. Create one with the algorithm.' }
    : { zh: '找“墙”：侧面顶层三个格同色。', en: 'Find a wall, three matching stickers in a side’s top row.' }
    : step === 1 ? { zh: '把“墙”放后面。', en: 'Put the wall at the back.' }
      : ready ? caseIndex === 0 ? { zh: '找“对色”，观察到对色在左边', en: 'Find the opposite color. It is on the left.' }
        : { zh: '找“对色”，观察到对色在右边', en: 'Find the opposite color. It is on the right.' }
        : { zh: '观察对色位置。', en: 'Observe the opposite color’s position.' };
  const learningArea = visible ? wrapper.current?.closest('.lbl-lesson-scroll') : null;
  const bubbleStage = visible && step === 2 && ready && caseIndex !== 2
    ? wrapper.current?.querySelector('.sim-stage') : null;
  return <div className="lbl-content lbl-content-example lbl-content-middle-ejection">
    <section className="lbl-demonstration">
      <div ref={wrapper} className="lbl-auto-player lbl-notation-player" data-visible={visible}>
        <AlgPlayer ref={player} puzzle="3x3" engine="sim" alg={plan.moves.join(' ')} setup={plan.setup}
          moveDurationMs={2200}
          set={LESSON_STICKERING['edge-position']} additionalStickering="F2L" orientation="z2"
          sceneRot={lblDemoView()} highlightedStickers={outlines}
          controlMode="none" hideResetView lockView interactionMode="none" fillPane />
      </div>
    </section>
    <section className="lbl-explanation"><p className="lbl-lead" aria-live="polite">{tr(caption)}</p></section>
    {bubbleStage && createPortal(
      <span className="lbl-left-thumb-overlay">
        <span className={`lbl-left-thumb-bubble${caseIndex === 1 ? ' lbl-edge-right-bubble' : ''}`} data-site-surface="panel" role="status">
          {tr({ zh: '红色和橙色是对色', en: 'Red and orange are opposite colors' })}
        </span>
      </span>, bubbleStage,
    )}
    {learningArea && createPortal(<>
      <button type="button" className="lbl-guide-continue" onClick={advance} aria-disabled={!ready} aria-label={tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })} />
      {ready && <span className="lbl-guide-continue-hint">{tr({ zh: '点击学习区继续', en: 'Click the lesson area to continue' })}</span>}
    </>, learningArea)}
  </div>;
}
