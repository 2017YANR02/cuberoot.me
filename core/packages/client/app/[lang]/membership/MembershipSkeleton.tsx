import { SkeletonBlock } from '@/components/ContentSkeleton';
import { tr } from '@/i18n/tr';

export default function MembershipSkeleton({ header, store }: { header?: boolean; store?: boolean }) {
  return <div className="mem-loading" role="status" aria-busy="true" aria-label={tr({ zh: '正在加载套餐', en: 'Loading plans' })}>
    {header && <div className="mem-loading-header"><SkeletonBlock /><SkeletonBlock /></div>}
    {store ? <div className="mem-loading-periods"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div> :
      <div className="mem-loading-plans">
        {['free', 'pro', 'enterprise'].map(tier => <div key={tier} className="mem-loading-card" data-tier={tier}>
          <SkeletonBlock className="mem-loading-title" />
          <div className="mem-loading-periods"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
          <div className="mem-loading-perks"><SkeletonBlock /><SkeletonBlock /><SkeletonBlock /></div>
        </div>)}
      </div>}
  </div>;
}
