'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  PB_EVENT_IDS,
  PB_RECORD_OPTIONS,
  pbRecordOptionLabel,
  type PbRecordOption,
} from '@cuberoot/shared/pb';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { fetchMyPbs, fetchPbPerson, type PbCollection, type PbRecord } from '@/lib/pb-api';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';

interface Props {
  wcaId: string;
  isZh: boolean;
}

function optionKey(option: PbRecordOption): string {
  return `${option.recordType}:${option.setSize}`;
}

function formatRecord(record: PbRecord): string {
  return formatWcaResult(
    record.resultValue,
    record.eventId,
    record.recordType === 'single' ? 'single' : 'average',
  );
}

export default function PersonPbTable({ wcaId, isZh }: Props) {
  const t = useT();
  const authUser = useAuthUser();
  const viewerWcaId = authUser?.wcaId ?? '';
  const [collection, setCollection] = useState<PbCollection | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCollection(null);
    const request = viewerWcaId === wcaId
      ? fetchMyPbs(controller.signal).catch(() => fetchPbPerson(wcaId, controller.signal))
      : fetchPbPerson(wcaId, controller.signal);
    request
      .then((data) => setCollection(data.profile.isPublic ? data : null))
      .catch(() => { /* private, missing, or unavailable: omit the optional section */ });
    return () => controller.abort();
  }, [viewerWcaId, wcaId]);

  const recordsByEvent = useMemo(() => {
    const grouped = new Map<string, Map<string, PbRecord>>();
    for (const record of collection?.records ?? []) {
      if (!record.isCurrent) continue;
      const eventRecords = grouped.get(record.eventId) ?? new Map<string, PbRecord>();
      eventRecords.set(`${record.recordType}:${record.setSize}`, record);
      grouped.set(record.eventId, eventRecords);
    }
    return grouped;
  }, [collection]);

  if (!collection) return null;

  const title = t('个人 PB', 'Personal Bests');
  const singleLabel = t('单次', 'Single');

  return (
    <section className="wp-card wp-pr-card wp-pb-card" aria-label={title}>
      <h2 className="wp-pb-title">{title}</h2>
      <div className="wp-table-scroll">
        <table className="wp-pr-table wp-pb-table">
          <thead>
            <tr>
              <th className="wp-th-event" scope="col">{t('项目', 'Event')}</th>
              {PB_RECORD_OPTIONS.map((option) => (
                <th key={optionKey(option)} scope="col">
                  {pbRecordOptionLabel(option.recordType, option.setSize, singleLabel)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PB_EVENT_IDS.map((eventId) => {
              const eventRecords = recordsByEvent.get(eventId);
              return (
                <tr key={eventId}>
                  <th className="wp-cell-event" scope="row">
                    <span className="wp-event-inner">
                      <EventIcon event={eventId} />
                      <span>{eventDisplayName(eventId, isZh)}</span>
                    </span>
                  </th>
                  {PB_RECORD_OPTIONS.map((option) => {
                    const record = eventRecords?.get(optionKey(option));
                    return (
                      <td className="wp-cell-result" key={optionKey(option)}>
                        {record ? formatRecord(record) : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
