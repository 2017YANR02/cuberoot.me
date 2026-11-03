import { LoadingIndicator } from '@/components/LoadingIndicator';
import { tr } from '@/i18n/tr';

/** One continuous placeholder across image preparation, detection and lookup. */
export default function PhotoLoading() {
  return <div className="cube-photo-loading">
    <LoadingIndicator>{tr({ zh: '正在识别并查找公式…', en: 'Identifying the cube and finding algorithms…' })}</LoadingIndicator>
    <div className="cube-photo-skeletons" aria-hidden="true">
      {[0, 1, 2].map(index => <div className="cube-photo-skeleton" key={index}>
        <span /><span /><span />
      </div>)}
    </div>
  </div>;
}
