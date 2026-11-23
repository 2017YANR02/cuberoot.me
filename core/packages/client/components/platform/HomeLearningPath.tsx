'use client';

import { Suspense, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { flushSync } from 'react-dom';
import { ArrowRight, ChevronRight } from '@app-foundation/icons/lucide';
import { SkeletonBlock } from '@/components/ContentSkeleton';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { animateLearningPath, measureLearningPath } from './learning-path-motion';
import { learningStages as stages } from '@/lib/platform-learning-path';
import { accountLearningStage } from '@/lib/platform-stage-preference';
import { persistItem } from '@/lib/safe-storage';
import './learning-path.css';

type StageNavigation = { open: (index: number) => Promise<URLSearchParams>; close: () => boolean };

function MobileStageNavigation({ navigation, selected, busy, ready, active, change }: {
  navigation: RefObject<StageNavigation | null>; selected: number | null; busy: boolean; ready: boolean; active: boolean;
  change: (index: number, opening: boolean, persist: boolean) => Promise<void>;
}) {
  const [stage, setStage] = useQueryState('stage', parseAsStringEnum(stages.map(item => item.id)).withOptions({ history: 'push' }));
  const pushed = useRef(false);
  const tracking = useRef(false);
  const closing = useRef(false);
  useLayoutEffect(() => {
    navigation.current = {
      open: index => { pushed.current = true; return setStage(stages[index]!.id); },
      close: () => {
        if (!stage) return false;
        if (!closing.current) {
          closing.current = true;
          if (pushed.current) window.history.back();
          else void setStage(null, {history: 'replace'});
        }
        return true;
      },
    };
    return () => { navigation.current = null; };
  }, [navigation, setStage, stage]);
  useEffect(() => {
    if (!active) return;
    if (stage) tracking.current = true;
    else closing.current = false;
    if (!ready || busy || !tracking.current) return;
    if (stage === null && selected === null) { tracking.current = false; pushed.current = false; return; }
    const index = stages.findIndex(item => item.id === stage);
    let live = true;
    // Start after React commits so the animation may synchronously measure its two layouts.
    queueMicrotask(() => {
      if (!live) return;
      if (selected !== null && selected !== index) void change(selected, false, false);
      else if (selected === null && index >= 0) void change(index, true, false);
    });
    return () => { live = false; };
  }, [active, ready, busy, selected, stage, change]);
  return null;
}

export function HomeLearningPath({ owner }: { owner: string }) {
  const t = useT();
  const key = `cuberoot-platform-home-milestone:${owner}`;
  const [current, setCurrent] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sync, setSync] = useState<'idle' | 'saving' | 'load-error' | 'save-error'>('idle');
  const [restoring, setRestoring] = useState(true);
  const [reload, setReload] = useState(0);
  const navigation = useRef<StageNavigation | null>(null);
  const [mobileSelection, setMobileSelection] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(width < 700px)');
    if (!query) return;
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    let cached: number | null = null;
    try {
      const value = localStorage.getItem(key);
      if (value !== null && /^[0-5]$/.test(value)) cached = Number(value);
    } catch { /* Browser storage is optional. */ }
    function restore(index: number | null) {
      setRestoring(false);
      setCurrent(index);
      const show = index !== null && !window.matchMedia?.('(width < 700px)').matches;
      setSelected(show ? index : null);
      setExpanded(show);
    }
    async function suggest(signal: AbortSignal) {
      try {
        const { readTimerStage } = await import('@/lib/platform-timer-stage');
        const suggestion = await readTimerStage(owner, signal);
        if (!signal.aborted) setSuggested(suggestion);
      } catch { /* Missing timer history leaves the picker available. */ }
    }
    async function load() {
      if (owner === 'guest') {
        restore(cached);
        if (cached === null) await suggest(controller.signal);
        return;
      }
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
      try {
        let id = await accountLearningStage(signal);
        if (controller.signal.aborted) return;
        if (id === null && cached !== null) id = await accountLearningStage(signal, stages[cached]!.id, true);
        if (controller.signal.aborted) return;
        const index = stages.findIndex(stage => stage.id === id);
        restore(index < 0 ? null : index);
        if (index >= 0) persistItem(key, String(index));
        setSync('idle');
        if (id === null && cached === null) await suggest(signal);
      } catch {
        if (!controller.signal.aborted) { restore(cached); setSync('load-error'); }
      }
    }
    void load();
    return () => { controller.abort(); request.current?.abort(); };
  }, [key, owner, reload]);

  async function save(index: number) {
    request.current?.abort();
    if (owner === 'guest') { persistItem(key, String(index)); return; }
    const controller = new AbortController();
    request.current = controller;
    setSync('saving');
    try {
      await accountLearningStage(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), stages[index]!.id);
      if (!controller.signal.aborted) { persistItem(key, String(index)); setSync('idle'); }
    } catch {
      if (!controller.signal.aborted) setSync('save-error');
    }
  }
  const [busy, setBusy] = useState(false);
  const [announcement, announce] = useState('');
  const gridRef = useRef<HTMLOListElement>(null);
  const transition = useRef<AbortController | null>(null);
  useEffect(() => () => transition.current?.abort(), []);

  async function change(index: number, opening: boolean, persist = true) {
    const grid = gridRef.current;
    const onMobile = window.matchMedia('(width < 700px)').matches;
    if (!grid || transition.current || (!onMobile && !mobileSelection && sync === 'saving') || opening === expanded) return;
    const controller = new AbortController();
    transition.current = controller;
    const stage = stages[index]!;
    const name = t(stage.name.zh, stage.name.en);
    const before = measureLearningPath(grid);
    const urlUpdate = opening && persist && onMobile ? navigation.current?.open(index) : undefined;
    if (opening && persist) {
      setSuggested(null);
      void save(index);
    } else if (!opening && !onMobile && !mobileSelection) request.current?.abort();
    flushSync(() => {
      setBusy(true);
      if (opening && onMobile) setMobileSelection(true);
      setSelected(index);
      if (opening) announce(t(`已选择「${name}」阶段。`, `Selected stage: ${name}.`));
    });
    const [animated] = await Promise.all([
      animateLearningPath(grid, index, opening, controller.signal, before),
      urlUpdate,
    ]);
    if (controller.signal.aborted) return;
    flushSync(() => {
      setExpanded(opening);
      setSelected(opening ? index : null);
      if (opening && persist) setCurrent(index);
      setBusy(false);
      if (!opening) setMobileSelection(false);
      if (!opening) announce('');
      else if (animated) announce(t(`已定位到「${name}」阶段。`, `Showing recommendations for ${name}.`));
      else announce(t(`已选择「${name}」，已定位到该阶段的推荐内容。`, `Selected ${name}. Showing its recommendations.`));
    });
    transition.current = null;
    const target = grid.children[index]?.querySelector<HTMLElement>(opening ? 'a' : 'button');
    if (target) {
      target.focus({ preventScroll: true });
      const bounds = target.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        target.scrollIntoView({ block: 'nearest', behavior: animated ? 'smooth' : 'instant' });
      }
    }
  }

  useEffect(() => {
    if (!expanded || selected === null || busy) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        closeStage(selected);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  });

  function closeStage(index: number) {
    if (!(mobile || mobileSelection) || !navigation.current?.close()) void change(index, false);
  }

  return <section className="platform-home-path" aria-labelledby="platform-home-path-title">
    <Suspense fallback={null}><MobileStageNavigation navigation={navigation} selected={expanded ? selected : null}
      busy={busy} ready={!restoring} active={mobile || mobileSelection} change={change} /></Suspense>
    <div className="platform-home-section-heading">
      <h2 id="platform-home-path-title">{t('学习路径', 'Learning path')}</h2>
      <AppLink className="platform-home-secondary" href="/platform/paths" prefetch={false}>{t('全部路径', 'All paths')}<ArrowRight aria-hidden /></AppLink>
    </div>
    {restoring && <div className="path-restore" aria-busy="true"><SkeletonBlock /></div>}
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    <div className="path-viewport">
    {!restoring && <p className="path-prompt sr-only" hidden={expanded}>{t('选择一个阶段，查看推荐课程和练习。', 'Choose a stage to explore courses and practice.')}</p>}
    <ol className="path-grid" data-layout={expanded ? 'expanded' : 'compact'} ref={gridRef} hidden={restoring} inert={busy || restoring}>
      {stages.map((stage, i) => {
        const chosen = i === selected;
        const recommended = current === null && suggested === stage.id;
        return <li key={stage.name.en} data-selected={chosen || undefined} data-recommended={recommended || undefined} data-site-surface="panel">
          <button className="path-stage" type="button" disabled={expanded && chosen} aria-expanded={expanded && chosen}
            aria-current={i === current || (expanded && chosen) ? 'step' : undefined} onClick={() => void change(i, true)}>
            <span className="platform-home-milestone-heading">
              <span className="platform-home-milestone-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="path-status" data-pending={chosen && i !== current || undefined}>{i === current || chosen ? t('你在这里', 'You are here') : recommended ? t('计时推荐', 'Timer recommendation') : ''}</span>
            </span>
            <strong className="path-title">{t(stage.name.zh, stage.name.en)}</strong>
            <span className="path-description">{t(stage.description.zh, stage.description.en)}</span>
            <small>{t(`建议每次 ${stage.minutes} 分钟`, `${stage.minutes} min / session`)}</small>
            <span className="path-hint">{t('查看重点', 'View focus')} <ArrowRight size={14} aria-hidden /></span>
          </button>
          {chosen && <button type="button" className="platform-home-secondary path-change" disabled={busy || (!mobile && !mobileSelection && sync === 'saving')} onClick={() => closeStage(i)}>{t('换一个阶段', 'Change stage')}</button>}
          {chosen && <div className="path-details">
            <div className="path-columns">
              {(['courses', 'practice'] as const).map(group => <div key={group}>
                <h3>{group === 'courses' ? t('推荐课程', 'Recommended courses') : t('推荐练习', 'Recommended practice')}</h3>
                {stage[group].map((item, j) => <AppLink key={item.href} href={item.href} prefetch={false}>
                  <strong>{t(item.title.zh, item.title.en)}</strong>
                  {stage[group].length > 1 && j === 0 && <small className="path-priority">{group === 'courses' ? t('先看这个', 'Watch first') : t('先做这个', 'Try first')}</small>}
                  <span>{t(item.description.zh, item.description.en)}</span>
                  <ChevronRight aria-hidden size={15} />
                </AppLink>)}
              </div>)}
            </div>
            <small className="path-recommendation-note">{t('仅用于推荐，不影响课程访问', 'For recommendations only. Course access stays the same.')}</small>
          </div>}
        </li>;
      })}
    </ol>

    </div>
    {(sync === 'load-error' || sync === 'save-error') && <div className="path-sync-feedback" role="status">
      <span>{sync === 'save-error' ? t('所选阶段尚未保存到账号。', 'Your stage has not been saved to your account.') : (current === null ? t('暂时无法读取账号阶段。', 'Your account stage could not be loaded.') : t('正在显示本机记录。', 'Showing the stage saved on this device.'))}</span>
      <button type="button" className="platform-home-secondary" disabled={busy} onClick={() => {
        if (sync === 'save-error' && current !== null) void save(current);
        else setReload(value => value + 1);
      }}>{t('重试同步', 'Retry sync')}</button>
    </div>}
  </section>;
}
