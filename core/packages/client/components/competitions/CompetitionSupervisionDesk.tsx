import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, ChevronRight } from '@app-foundation/icons/lucide';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { displayCuberName } from '@/lib/cuber-name-display';
import { eventDisplayName } from '@/lib/wca-events';
import type { CompetitionRegistration } from '@/lib/online-competition-api';
import { competitionDeviceName } from './CompetitionDraftForm';

type Entry = CompetitionRegistration;
const finished = (entry: Entry) => !!entry.resultRecordedAt || entry.status === 'attended';
const phases = [
  (entry: Entry) => !finished(entry) && !!entry.checkedInAt && !entry.attemptNumber,
  (entry: Entry) => !finished(entry) && !!entry.checkedInAt && !!entry.attemptNumber,
  (entry: Entry) => !finished(entry) && !entry.checkedInAt,
  finished,
];

export function CompetitionSupervisionDesk({ entries, activeId, onSelect, renderSeat }: {
  entries: Entry[]; activeId: string; onSelect: (id: string | null) => void;
  renderSeat: (entry: Entry) => ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const mobile = useIsMobile(859);
  const stage = useRef<HTMLElement>(null);
  const origin = useRef<HTMLButtonElement>(null);
  const labels = [t('已检录待开赛', 'Checked in · waiting to start'), t('进行中', 'In progress'),
    t('未检录', 'Awaiting check-in'), t('已完赛', 'Finished')];
  const groups = phases.map((match, index) => ({ label: labels[index], entries: entries.filter(match) }));
  const selected = entries.find(entry => entry.id === activeId) ??
    (!mobile ? groups.find(group => group.entries.length)?.entries[0] : undefined);
  const selectedId = selected?.id;
  useEffect(() => {
    if (!mobile) return;
    if (selectedId) {
      stage.current?.scrollIntoView?.({ block: 'start' });
      stage.current?.focus({ preventScroll: true });
    } else {
      origin.current?.focus();
      origin.current = null;
    }
  }, [mobile, selectedId]);

  return <div className="competition-supervision" data-selected={!!selected || undefined}>
    <aside className="competition-supervision-queue" aria-label={t('候场队列', 'Competitor queue')}>
      <h2>{t('候场队列', 'Competitor queue')}</h2>
      {!entries.length && <p className="competition-muted">{t('还没有报名记录。', 'No registrations yet.')}</p>}
      {groups.filter(group => group.entries.length).map(group => <section key={group.label}>
        <h3>{group.label}</h3>
        <ul>{group.entries.map(entry => <li key={entry.id}>
          <button type="button" className="competition-queue-entry" aria-current={entry.id === selected?.id ? 'true' : undefined} onClick={event => { origin.current = event.currentTarget; onSelect(entry.id); }}>
            <EventIcon event={entry.project} />
            <span><strong>{displayCuberName(entry.displayName, lang === 'zh')}</strong><small>{eventDisplayName(entry.project, lang === 'zh')} · {competitionDeviceName(entry.device, t)}</small></span>
            {entry.checkedInAt && !!entry.attemptNumber && !finished(entry) ? <span className="competition-queue-progress">{entry.attemptNumber}/5</span>
              : <ChevronRight size={15} aria-hidden />}
          </button>
        </li>)}</ul>
      </section>)}
    </aside>
    <section ref={stage} className="competition-supervision-stage" tabIndex={-1} aria-label={t('主监考席', 'Supervision desk')}>
      {selected ? <>
        <button type="button" className="competition-secondary competition-queue-back" aria-label={t('候场队列', 'Competitor queue')} onClick={() => onSelect(null)}><ArrowLeft size={18} aria-hidden /></button>
        {selected.checkedInAt || finished(selected) ? renderSeat(selected)
          : <div className="competition-supervision-empty" data-site-surface="panel">
            <h2>{displayCuberName(selected.displayName, lang === 'zh')}</h2>
            <p className="competition-muted">{t('等待选手检录', 'Waiting for competitor to check in')}</p>
          </div>}
      </> : <p className="competition-muted">{t('选择选手开始监督。', 'Choose a competitor to supervise.')}</p>}
    </section>
  </div>;
}
