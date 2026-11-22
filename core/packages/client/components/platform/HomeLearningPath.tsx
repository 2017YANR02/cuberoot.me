'use client';

import { useEffect, useRef, useState } from 'react';
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

export function HomeLearningPath({ owner }: { owner: string }) {
  const t = useT();
  const key = `cuberoot-platform-home-milestone:${owner}`;
  const [current, setCurrent] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sync, setSync] = useState<'idle' | 'saving' | 'load-error' | 'save-error'>('idle');
  const [restoring, setRestoring] = useState(owner !== 'guest');
  const [reload, setReload] = useState(0);
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
      setSelected(index);
      setExpanded(index !== null);
    }
    async function load() {
      if (owner === 'guest') { restore(cached); return; }
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

  async function change(index: number, opening: boolean) {
    const grid = gridRef.current;
    if (!grid || transition.current || sync === 'saving' || opening === expanded) return;
    const controller = new AbortController();
    transition.current = controller;
    const stage = stages[index]!;
    const name = t(stage.name.zh, stage.name.en);
    const before = measureLearningPath(grid);
    if (opening) void save(index);
    else request.current?.abort();
    flushSync(() => {
      setBusy(true);
      setSelected(index);
      if (opening) announce(t(`已选择「${name}」阶段。`, `Selected stage: ${name}.`));
    });
    const animated = await animateLearningPath(grid, index, opening, controller.signal, before);
    if (controller.signal.aborted) return;
    flushSync(() => {
      setExpanded(opening);
      setSelected(opening ? index : null);
      if (opening) setCurrent(index);
      setBusy(false);
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
        void change(selected, false);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  });

  return <section className="platform-home-path" aria-labelledby="platform-home-path-title">
    <div className="platform-home-section-heading">
      <h2 id="platform-home-path-title">{t('学习路径', 'Learning path')}</h2>
      <AppLink className="platform-home-secondary" href="/platform/paths" prefetch={false}>{t('全部路径', 'All paths')}<ArrowRight aria-hidden /></AppLink>
    </div>
    {restoring && <div className="path-restore" aria-busy="true"><SkeletonBlock /></div>}
    <p className="sr-only" hidden={restoring || expanded}>{t('选择一个阶段，查看推荐课程和练习。', 'Choose a stage to explore courses and practice.')}</p>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    <div className="path-viewport">
    <ol className="path-grid" data-layout={expanded ? 'expanded' : 'compact'} ref={gridRef} hidden={restoring} inert={busy || restoring}>
      {stages.map((stage, i) => {
        const chosen = i === selected;
        return <li key={stage.name.en} data-selected={chosen || undefined} data-site-surface="panel">
          <button className="path-stage" type="button" disabled={expanded && chosen} aria-expanded={expanded && chosen}
            aria-current={i === current || (expanded && chosen) ? 'step' : undefined} onClick={() => void change(i, true)}>
            <span className="platform-home-milestone-heading">
              <span className="platform-home-milestone-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="path-status" data-pending={chosen && i !== current || undefined}>{i === current || chosen ? t('你在这里', 'You are here') : ''}</span>
            </span>
            <strong className="path-title">{t(stage.name.zh, stage.name.en)}</strong>
            <span className="path-description">{t(stage.description.zh, stage.description.en)}</span>
            <small>{t(`建议每次 ${stage.minutes} 分钟`, `${stage.minutes} min / session`)}</small>
            <span className="path-hint">{t('查看重点', 'View focus')} <ArrowRight size={14} aria-hidden /></span>
          </button>
          {chosen && <button type="button" className="platform-home-secondary path-change" disabled={busy || sync === 'saving'} onClick={() => void change(i, false)}>{t('换一个阶段', 'Change stage')}</button>}
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
    {sync === 'saving' && <small role="status">{t('正在保存到账号…', 'Saving to your account…')}</small>}
    {(sync === 'load-error' || sync === 'save-error') && <div className="path-sync-feedback" role="status">
      <span>{sync === 'save-error' ? t('所选阶段尚未保存到账号。', 'Your stage has not been saved to your account.') : (current === null ? t('暂时无法读取账号阶段。', 'Your account stage could not be loaded.') : t('正在显示本机记录。', 'Showing the stage saved on this device.'))}</span>
      <button type="button" className="platform-home-secondary" disabled={busy} onClick={() => {
        if (sync === 'save-error' && current !== null) void save(current);
        else setReload(value => value + 1);
      }}>{t('重试同步', 'Retry sync')}</button>
    </div>}
  </section>;
}
