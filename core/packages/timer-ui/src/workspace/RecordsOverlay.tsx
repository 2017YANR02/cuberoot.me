'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { compareTimerWcaRecord, hasTimerWcaRecords, selectTimerWcaRecords, type EventId, type Solve } from '@cuberoot/shared/timer';
import { parseWcaRecordsBundle, WCA_WORLD_RECORDS_PATH, type WcaRecordRow, type WcaRecordsBundle } from '@cuberoot/shared/wca-records';
import { statsUrl } from '@cuberoot/shared/stats-base';
import { displayCuberName } from '@cuberoot/shared/cuber-name-display';
import { useWorkspaceText } from './localization';

interface Props {
  event: EventId;
  solves: Solve[];
  isZh: boolean;
}

const labelStyle: CSSProperties = { color: 'var(--muted-foreground)', fontSize: '0.85em' };
const valueStyle: CSSProperties = { fontWeight: 600, fontVariantNumeric: 'tabular-nums' };
const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '90px 1fr',
  rowGap: 4,
  columnGap: 12,
  alignItems: 'baseline',
  padding: '6px 0',
};
const subRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 12px',
  alignItems: 'baseline',
  fontSize: '0.9em',
};
const dividerStyle: CSSProperties = {
  borderTop: '1px solid currentColor',
  opacity: 0.15,
  margin: '4px 0',
};

function recordRow(tr: (copy: {en:string;zh:string}) => string, opts: {
  label: string;
  yourLabel: string;
  records: WcaRecordRow[];
  solves: Solve[];
  isZh: boolean;
  gapLabel: string;
}) {
  const { label, yourLabel, records, solves, isZh, gapLabel } = opts;
  const record = records[0];
  if (!record) return null;
  const { recordText, pbText, gap, gapText } = compareTimerWcaRecord(record, solves);

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={subRowStyle}>
        <span style={valueStyle}>{recordText}</span>
        {records.map((row) => (
          <span key={`${row.p}:${row.c}:${row.d}`} style={{ opacity: 0.7, fontSize: '0.9em' }}>
            {displayCuberName(row.pn, isZh)}, {row.d}
          </span>
        ))}
        {pbText !== null ? (
          <>
            <span style={{ opacity: 0.5 }}>—</span>
            <span style={labelStyle}>{yourLabel}</span>
            <span style={valueStyle}>{pbText}</span>
            {gap !== null && gap > 0 && (
              <span style={{ color: 'var(--destructive)', fontVariantNumeric: 'tabular-nums' }}>
                ({gapLabel} {gapText})
              </span>
            )}
            {gap !== null && gap <= 0 && (
              <span style={{ color: 'var(--signal-success)' }}>
                ({gap === 0 ? tr({ zh: '持平 WR', en: 'equal to WR' }) : tr({ zh: '已超 WR', en: 'beat WR' })})
              </span>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.55, fontSize: '0.9em' }}>
            ({tr({ zh: '暂无 PB', en: 'no PB yet'
            })})
          </span>
        )}
      </div>
    </div>
  );
}

export default function RecordsOverlay({
  event,
  solves,
  isZh,
}: Props) {
  const tr = useWorkspaceText();
  const supported = hasTimerWcaRecords(event);
  const [bundle, setBundle] = useState<WcaRecordsBundle | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!supported) return;
    const controller = new AbortController();
    setBundle(null);
    setFailed(false);
    fetch(statsUrl(WCA_WORLD_RECORDS_PATH), { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(value => {
        const data = parseWcaRecordsBundle(value);
        if (!data) throw new Error('Invalid WCA record history');
        if (!controller.signal.aborted) setBundle(data);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [supported, retry]);
  const records = useMemo(() => selectTimerWcaRecords(event, bundle?.rows ?? []), [event, bundle]);
  if (!supported) return null;

  const singleRow = recordRow(tr, {
    label: tr({ zh: 'WR 单次', en: 'WR single'
    }),
    yourLabel: tr({ zh: '你的 PB', en: 'your PB' }),
    records: records.filter(row => row.t === 's'),
    solves,
    isZh,
    gapLabel: tr({ zh: '差', en: 'gap' }),
  });

  const avgRow = recordRow(tr, {
    label: tr({ zh: 'WR 平均', en: 'WR average' }),
    yourLabel: tr({ zh: '你的最佳平均', en: 'your best avg' }),
    records: records.filter(row => row.t === 'a'),
    solves,
    isZh,
    gapLabel: tr({ zh: '差', en: 'gap' }),
  });

  return (
    <div className="modal-section">
      <h3 className="settings-h3">
        {tr({ zh: 'WCA 纪录', en: 'WCA records'
        })}
        {bundle && <span style={{ marginLeft: 8, opacity: 0.55, fontSize: '0.8em', fontWeight: 'normal' }}>
          ({tr({ zh: '数据更新', en: 'updated' })} {bundle.updated})
        </span>}
      </h3>
      {!bundle && <div role="status">
        {failed ? <>
          {tr({ zh: 'WCA 纪录加载失败', en: 'Could not load WCA records' })}{' '}
          <button type="button" onClick={() => setRetry(value => value + 1)}>{tr({ zh: '重试', en: 'Retry' })}</button>
        </> : tr({ zh: '加载中…', en: 'Loading…' })}
      </div>}
      {bundle && !records.length && <div>{tr({ zh: '暂无 WCA 纪录', en: 'No WCA records available' })}</div>}
      <div>
        {singleRow}
        {singleRow && avgRow && <div style={dividerStyle} />}
        {avgRow}
      </div>
    </div>
  );
}
