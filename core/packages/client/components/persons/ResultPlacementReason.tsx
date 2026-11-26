import Link from '@/components/AppLink';
import { tr } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { personHref } from '@/lib/person-link';
import { resultRowHash } from '@/lib/wca-result-anchor';
import { formatChangeFieldValue, type ResultChange } from '@/lib/result-watch-api';

export function ResultPlacementReason({ change, isZh, className, linkClassName }: {
  change: ResultChange;
  isZh: boolean;
  className: string;
  linkClassName: string;
}) {
  const { placementReason: reason, competitionId, eventId, roundTypeId } = change;
  if (!reason) return null;
  if (reason.kind === 'unknown') {
    return change.note ? null : <div className={className}>
      {tr({ zh: '本人成绩未变，名次调整的具体原因暂未确认。', en: 'Result unchanged; the reason for the placement adjustment is not yet confirmed.' })}
    </div>;
  }
  const official = reason.kind === 'round_comparison';
  const headToHead = reason.kind === 'head_to_head_single_order';
  const resultQuery = competitionId && eventId && roundTypeId
    ? `?tab=results&sub=event&event=${encodeURIComponent(eventId)}${resultRowHash(competitionId, eventId, roundTypeId)}`
    : '';
  const competitionPath = competitionId && `https://www.worldcubeassociation.org/competitions/${encodeURIComponent(competitionId)}/results/`;
  return <div className={className}>
    <span>{tr(headToHead ? {
      zh: 'WCA 成绩接口疑似按最快单次重排了一对一名次。',
      en: 'The WCA results API appears to have reordered Head to Head placements by best single.',
    } : official ? {
      zh: 'WCA 同轮成绩对比', en: 'WCA round comparison',
    } : { zh: '可能的变化原因', en: 'Possible reason for change' })}</span>
    {reason.causes.map(cause => {
      const event = eventId ?? '333';
      return <div key={cause.wcaId}>
        <Link className={linkClassName} prefetch={false} href={personHref(cause.wcaId) + resultQuery}>
          {displayCuberName(cause.personName || cause.wcaId, isZh)}
        </Link>{' '}
        {'best' in cause ? <>{tr({ zh: '单次', en: 'Single' })}{' '}
          {formatChangeFieldValue('best', cause.best, event)}</> : cause.changeType === 'removed'
          ? tr({ zh: '该轮成绩被移除', en: 'Result removed from this round' })
          : cause.changeType === 'added'
            ? tr({ zh: '该轮新增成绩', en: 'Result added to this round' })
            : <>{tr(cause.field === 'average' ? { zh: '平均', en: 'Average' } : { zh: '单次', en: 'Single' })}{' '}
              {formatChangeFieldValue(cause.field, cause.oldValue, event)} → {formatChangeFieldValue(cause.field, cause.newValue, event)}</>}
        {cause.newPlace != null && <>{' · '}{tr({ zh: '名次', en: 'Place' })}{' '}
          {cause.oldPlace != null && <>{cause.oldPlace} → </>}{cause.newPlace}</>}
      </div>;
    })}
    {competitionPath && (headToHead || official) && <a className={linkClassName}
      href={headToHead ? `${competitionPath}podiums` : `${competitionPath}all#e${eventId}_${roundTypeId}`}
      target="_blank" rel="noopener noreferrer">{tr(headToHead
        ? { zh: 'WCA 官方领奖台', en: 'Official WCA podiums' }
        : { zh: 'WCA 当前成绩', en: 'Current WCA results' })}</a>}
  </div>;
}
