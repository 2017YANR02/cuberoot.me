import type { CSSProperties } from 'react';
import type { EventId } from '../types';
import { formatMs } from '../stats';
import { getWcaRecord, WR_AS_OF } from '../wca_records/lookup';

interface Props {
  event: EventId;
  /** PB single in ms; null/undefined when user has no valid solve. */
  userPbSingleMs: number | null;
  /** Best ao5/mo3/etc. (whatever counts as user's "average PB"). */
  userPbAvgMs: number | null;
  isZh: boolean;
}

const labelStyle: CSSProperties = { color: '#888', fontSize: '0.85em' };
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

/**
 * Render one record row: WR value, holder + date if known, and the user's
 * PB with a "behind by" delta. Falls back gracefully when the user has no
 * PB or when the record is text-only (FMC, MBLD).
 */
function recordRow(opts: {
  label: string;
  yourLabel: string;
  wrMs: number | undefined;
  wrText: string | undefined;
  holder: string | undefined;
  date: string | undefined;
  userMs: number | null;
  isZh: boolean;
  gapLabel: string;
}) {
  const { label, yourLabel, wrMs, wrText, holder, date, userMs, isZh, gapLabel } = opts;
  if (wrMs === undefined && !wrText) return null;

  const wrDisplay = wrText !== undefined ? wrText : formatMs(wrMs ?? null);
  const userDisplay = userMs !== null && Number.isFinite(userMs) ? formatMs(userMs) : null;

  // Only compute a gap when both sides are concrete ms values.
  const gapMs =
    wrMs !== undefined && userMs !== null && Number.isFinite(userMs)
      ? userMs - wrMs
      : null;

  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={subRowStyle}>
        <span style={valueStyle}>{wrDisplay}</span>
        {(holder || date) && (
          <span style={{ opacity: 0.7, fontSize: '0.9em' }}>
            {holder ?? ''}{holder && date ? ', ' : ''}{date ?? ''}
          </span>
        )}
        {userDisplay !== null ? (
          <>
            <span style={{ opacity: 0.5 }}>—</span>
            <span style={labelStyle}>{yourLabel}</span>
            <span style={valueStyle}>{userDisplay}</span>
            {gapMs !== null && gapMs > 0 && (
              <span style={{ color: '#d04848', fontVariantNumeric: 'tabular-nums' }}>
                ({gapLabel} {formatMs(gapMs)})
              </span>
            )}
            {gapMs !== null && gapMs <= 0 && (
              <span style={{ color: '#3aa757' }}>
                ({isZh ? '已超 WR' : 'beat WR'})
              </span>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.55, fontSize: '0.9em' }}>
            ({isZh ? '暂无 PB' : 'no PB yet'})
          </span>
        )}
      </div>
    </div>
  );
}

export default function RecordsOverlay({
  event,
  userPbSingleMs,
  userPbAvgMs,
  isZh,
}: Props) {
  const rec = getWcaRecord(event);
  if (!rec) return null;

  const singleRow = recordRow({
    label: isZh ? 'WR 单次' : 'WR single',
    yourLabel: isZh ? '你的 PB' : 'your PB',
    wrMs: rec.wrSingleMs,
    wrText: rec.singleText,
    holder: rec.wrSingleHolder,
    date: rec.wrSingleDate,
    userMs: userPbSingleMs ?? null,
    isZh,
    gapLabel: isZh ? '差' : 'gap',
  });

  const avgRow = recordRow({
    label: isZh ? 'WR 平均' : 'WR average',
    yourLabel: isZh ? '你的最佳平均' : 'your best avg',
    wrMs: rec.wrAverageMs,
    wrText: rec.averageText,
    holder: rec.wrAverageHolder,
    date: rec.wrAverageDate,
    userMs: userPbAvgMs ?? null,
    isZh,
    gapLabel: isZh ? '差' : 'gap',
  });

  if (!singleRow && !avgRow) return null;

  return (
    <div className="modal-section">
      <h3 className="settings-h3">
        {isZh ? 'WCA 记录' : 'WCA records'}
        <span style={{ marginLeft: 8, opacity: 0.55, fontSize: '0.8em', fontWeight: 'normal' }}>
          ({isZh ? '截至' : 'as of'} {WR_AS_OF})
        </span>
      </h3>
      <div>
        {singleRow}
        {singleRow && avgRow && <div style={dividerStyle} />}
        {avgRow}
      </div>
    </div>
  );
}
