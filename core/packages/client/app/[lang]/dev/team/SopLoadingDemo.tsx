'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';

export default function SopLoadingDemo() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(!loading), loading ? 1400 : 2400);
    return () => window.clearTimeout(timer);
  }, [loading]);
  return <article className="staff-sop-card sop-loading-rule" data-site-surface="panel" aria-labelledby="sop-loading-title">
    <div className="sop-loading-heading">
      <h4 id="sop-loading-title">{t('加载时保持布局稳定', 'Keep layouts stable while loading')}</h4>
    </div>
    <p className="sop-ui-description">{t('点击下一步、继续或刷新时，保留内容区域和按钮的尺寸，在原位显示加载状态；新内容就绪后再替换，避免页面闪空、元素跳动后回弹。', 'When proceeding or refreshing, preserve content and button dimensions and show loading in place. Replace content when ready, without blank flashes or elements jumping and snapping back.')}</p>
    <div className="sop-ui-comparison sop-loading-comparison" aria-hidden="true">
      {[false, true].map(stable => <figure key={String(stable)}>
        <div className="sop-ui-verdict">{stable ? t('✓ 原位加载', '✓ Loads in place') : t('× 加载时跳动', '× Jumps while loading')}</div>
        <div className={`sop-loading-stage ${stable ? 'is-stable' : 'is-unstable'} ${loading ? 'is-loading' : ''}`}>
          <div className="sop-loading-content">
            <div className="sop-loading-lines"><span /><span /><span /></div>
            {loading && <span className="sop-loading-indicator">{t('加载中', 'Loading')}</span>}
          </div>
          <span className="sop-demo-button sop-loading-button">{loading ? t('加载中', 'Loading') : t('继续下一步', 'Continue to next step')}</span>
          <div className="sop-loading-footer">{t('下方内容', 'Content below')}</div>
        </div>
        <figcaption>{stable ? t('内容区域保留，按钮和下方内容不移动。', 'Space is preserved; the button and content below stay put.') : t('内容区域收起，按钮和下方内容先上移，再弹回。', 'Content collapses, pulling the button and footer up before they snap back.')}</figcaption>
      </figure>)}
    </div>
  </article>;
}
