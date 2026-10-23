'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Repeat2, ScanLine, X } from 'lucide-react';
import { useT } from '@/hooks/useT';

export default function SopLoadingDemo() {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => {
      setReducedMotion(media.matches);
      setPlaying(visible && !document.hidden && !media.matches);
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      update();
    });
    if (observer) observer.observe(element);
    else visible = true;
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer?.disconnect();
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setLoading(value => !value), loading ? 1600 : 2600);
    return () => window.clearTimeout(timer);
  }, [loading, playing]);

  // A still loading frame preserves the comparison for reduced-motion users.
  const showingLoading = reducedMotion || loading;
  return <article ref={ref} className="staff-sop-card sop-loading-rule" data-site-surface="panel" data-playing={playing} aria-labelledby="sop-loading-title">
    <div className="sop-loading-heading">
      <h4 id="sop-loading-title">{t('加载时保持布局稳定', 'Keep layouts stable while loading')}</h4>
      <span className="quality-loading-priority"><ScanLine size={13} aria-hidden="true" />{t('重点检查', 'Priority check')}</span>
    </div>
    <p className="sop-ui-description">{t('点击下一步、继续或刷新时，保留内容区域和按钮的尺寸，在原位显示加载状态；新内容就绪后再替换，避免页面闪空、元素跳动后回弹。', 'When proceeding or refreshing, preserve content and button dimensions and show loading in place. Replace content when ready, without blank flashes or elements jumping and snapping back.')}</p>
    <div className="sop-ui-comparison sop-loading-comparison">
      {[false, true].map(stable => <figure key={String(stable)}>
        <div className={`quality-verdict ${stable ? 'is-good' : 'is-bad'}`}>{stable ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}{stable ? t('原位加载', 'Loads in place') : t('加载时跳动', 'Jumps while loading')}</div>
        <div className={`sop-loading-stage ${stable ? 'is-stable' : 'is-unstable'} ${showingLoading ? 'is-loading' : ''}`} aria-hidden="true">
          <div className="sop-loading-content">
            <div className="sop-loading-lines"><span /><span /><span /></div>
            {showingLoading && <span className="sop-loading-indicator"><LoaderCircle className="quality-loading-spinner" size={14} />{t('加载中', 'Loading')}</span>}
          </div>
          <span className="sop-demo-button sop-loading-button">{showingLoading ? t('加载中', 'Loading') : t('继续下一步', 'Continue')}</span>
          <div className="sop-loading-footer">{t('下方内容', 'Content below')}</div>
        </div>
        <figcaption>{stable ? t('保留内容位置，按钮和下方内容保持不动。', 'Preserve the content area so controls and surrounding content stay put.') : t('内容收起，按钮和下方内容上移，再弹回。', 'Content collapses, pulling the button and footer up before they snap back.')}</figcaption>
      </figure>)}
    </div>
    <div className="quality-loading-cycle" aria-hidden="true"><Repeat2 size={13} /><span>{reducedMotion ? t('已按系统偏好显示静态对比', 'Still comparison shown for reduced motion') : t('自动演示：就绪 → 加载 → 就绪', 'Auto demo: ready → loading → ready')}</span></div>
  </article>;
}
