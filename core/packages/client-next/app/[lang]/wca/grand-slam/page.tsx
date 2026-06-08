'use client';

/**
 * 大满贯 - WC + Continental + National 领奖台 + WR(任一类型)的人.
 * /wca/grand-slam
 * Ported from packages/client/src/pages/wca_stats/GrandSlamPage.tsx.
 */
import { Suspense, useEffect, useState } from 'react';
import Link from '@/components/AppLink';
import { useQueryStates, parseAsString } from 'nuqs';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import WcaEventSelector from '@/components/WcaEventSelector';
import PillToggle from '@/components/PillToggle/PillToggle';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { CompCell } from '@/components/CompCell/CompCell';
import { Flag } from '@/components/Flag';
import { loadFlagData } from '@/lib/country-flags';
import { formatWcaResult } from '@/lib/wca-format-result';
import { displayCuberName } from '@/lib/cuber-name-display';
import { apiUrl } from '@/lib/api-base';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import '../_wca_stats_extra.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const EVENTS = [
  '333','222','444','555','666','777',
  '333bf','333fm','333oh',
  'minx','pyram','clock','skewb','sq1',
  '444bf','555bf','333mbf',
];
const EVENTS_SET = new Set(EVENTS);

interface ChampInfo { compId: string; name: string | null; pos: number | null }
interface GsRow {
  wcaId: string; name: string; eventId: string;
  single: number | null; average: number | null;
  countryId: string; iso2: string | null;
  hasWr: boolean; isOnlyFirst: boolean;
  worldChamp: ChampInfo | null;
  continentalChamp: ChampInfo | null;
  nationalChamp: ChampInfo | null;
}

function GrandSlamPageInner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  useDocumentTitle('大满贯', 'Grand Slam');
  const [q, setQ] = useQueryStates(
    {
      event: parseAsString,
      onlyFirst: parseAsString,
      hasWr: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const event = q.event ?? '';
  const onlyFirst = q.onlyFirst === '1';
  const hasWr = q.hasWr === '1';

  const setParam = (k: string, v: string) => {
    setQ({ [k]: v || null } as Parameters<typeof setQ>[0]);
  };

  const [rows, setRows] = useState<GsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFlagBust] = useState(0);

  useEffect(() => { loadFlagData().then(v => setFlagBust(v)); }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (event) qs.set('event', event);
    if (onlyFirst) qs.set('onlyFirst', '1');
    if (hasWr) qs.set('hasWr', '1');
    const url = apiUrl(`/v1/wca/grand-slam${qs.toString() ? `?${qs.toString()}` : ''}`);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: { rows: GsRow[] }) => setRows(j.rows))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [event, onlyFirst, hasWr]);

  return (
    <div className="wse-page">
      <header className="wse-header">
        <div className="wse-header-row">
          <Link href={`/wca?lang=${i18n.language}`} className="wse-back">
            <ChevronLeft size={16} /> {tr({ zh: '返回', en: 'Back' })}
          </Link>
        </div>
        <h1 className="wse-title-row">
          {tr({ zh: '大满贯', en: 'Grand Slam',
              zhHant: "大滿貫"
        })}
          <Link
            href="/wca/about/grand-slam"
            className="wse-title-help"
            title={tr({ zh: '这页是干啥的?', en: 'What is this page?',
                zhHant: "這頁是幹啥的?"
            })}
            aria-label={tr({ zh: '查看说明', en: 'About this page',
                zhHant: "檢視說明"
            })}
          >
            <HelpCircle size={18} strokeWidth={1.75} />
          </Link>
        </h1>
        <p className="wse-subtitle">
          {tr({ zh: '单个项目里,某位选手同时获得世锦赛领奖台、所属洲际赛领奖台、所属国家赛领奖台,且打破过该项目 WR,即达成该项目大满贯。默认采用领奖台最佳且最早的比赛。注意:部分世锦赛 / 洲际赛可能同时被算作举办国的国家锦标赛。', en: 'For a single event, a cuber achieves Grand Slam by podium at Worlds + their Continental + their National championship AND having broken WR. Defaults to the best & earliest podium. Note: some World/Continental championships also count as the host country’s nationals.',
              zhHant: "單個專案裡,某位選手同時獲得世錦賽領獎臺、所屬洲際賽領獎臺、所屬國家賽領獎臺,且打破過該專案 WR,即達成該專案大滿貫。預設採用領獎臺最佳且最早的比賽。注意:部分世錦賽 / 洲際賽可能同時被算作舉辦國的國家錦標賽。"
        })}
        </p>
      </header>

      <WcaEventSelector
        availableEvents={EVENTS_SET}
        selectedEvent={event}
        onSelect={v => setParam('event', v)}
        isZh={isZh}
        allowAll
      />

      <div className="wse-filters">
        <div className="wse-filter">
          <label>{tr({ zh: '筛选', en: 'Filter',
              zhHant: "篩選"
        })}</label>
          <PillToggle
            value={onlyFirst}
            onChange={v => setParam('onlyFirst', v ? '1' : '')}
            offLabel={tr({ zh: '全部', en: 'All' })}
            onLabel={tr({ zh: '仅全部第一', en: 'Only all gold',
                zhHant: "僅全部第一"
            })}
          />
        </div>
        <div className="wse-filter">
          <label>{tr({ zh: '破 WR', en: 'Broke WR' })}</label>
          <PillToggle
            value={hasWr}
            onChange={v => setParam('hasWr', v ? '1' : '')}
            offLabel={tr({ zh: '全部', en: 'All' })}
            onLabel={tr({ zh: '是', en: 'Yes' })}
          />
        </div>
      </div>

      <div className="wse-table-wrapper">
        {loading && <div className="wse-state">{tr({ zh: '加载中...', en: 'Loading...',
            zhHant: "載入中..."
        })}</div>}
        {error && <div className="wse-state wse-state-error">Error: {error}</div>}
        {!loading && !error && (
          <>
            <div className="wse-result-meta">
              {isZh ? `共 ${rows.length} 项达成` : `${rows.length} achievements`}
            </div>
            <table className="wse-table">
              <thead>
                <tr>
                  <th className="wse-rank-col">#</th>
                  <th>{tr({ zh: '选手', en: 'Person',
                      zhHant: "選手"
                })}</th>
                  <th>{tr({ zh: '项目', en: 'Event',
                      zhHant: "專案"
                })}</th>
                  <th className="wse-value-col">{tr({ zh: '单次', en: 'Single',
                      zhHant: "單次"
                })}</th>
                  <th className="wse-value-col">{tr({ zh: '平均', en: 'Average' })}</th>
                  <th>WR</th>
                  <th>{tr({ zh: '世锦赛', en: 'World',
                      zhHant: "世錦賽"
                })}</th>
                  <th>{tr({ zh: '洲际赛', en: 'Continental',
                      zhHant: "洲際賽"
                })}</th>
                  <th>{tr({ zh: '国家赛', en: 'National',
                      zhHant: "國家賽"
                })}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.wcaId}-${r.eventId}`}>
                    <td className="wse-rank-col">{i + 1}</td>
                    <td>
                      {r.iso2 && <Flag iso2={r.iso2} spanClassName="country-flag" imgClassName="country-flag-ct" />}{' '}
                      <Link prefetch={false} href={`/${(i18n.language.startsWith('zh') ? 'zh' : 'en')}/wca/persons/${r.wcaId}`}>
                        {displayCuberName(r.name, isZh)}
                      </Link>
                    </td>
                    <td>{r.eventId}</td>
                    <td className="wse-value-col">{r.single != null ? formatWcaResult(r.single, r.eventId, 'single') : '—'}</td>
                    <td className="wse-value-col">{r.average != null ? formatWcaResult(r.average, r.eventId, 'average') : '—'}</td>
                    <td>{r.hasWr ? <RecordBadge record="WR" /> : ''}</td>
                    <td className="wse-detail-cell">{champCell(r.worldChamp, isZh)}</td>
                    <td className="wse-detail-cell">{champCell(r.continentalChamp, isZh)}</td>
                    <td className="wse-detail-cell">{champCell(r.nationalChamp, isZh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function champCell(c: { compId: string; name: string | null; pos: number | null } | null, isZh: boolean) {
  if (!c) return '';
  const medal = c.pos === 1 ? '🥇' : c.pos === 2 ? '🥈' : c.pos === 3 ? '🥉' : '';
  return (
    <span><CompCell compId={c.compId} compName={c.name} isZh={isZh} /> {medal}</span>
  );
}

export default function GrandSlamPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>}>
      <GrandSlamPageInner />
    </Suspense>
  );
}
