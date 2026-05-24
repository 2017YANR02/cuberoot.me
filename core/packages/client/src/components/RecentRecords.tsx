// 落地页右下:WCA Live 近 10 天 WR/CR/NR 列表(60s 同步)
// 数据走 /v1/wca/recent-records,Hono 后台 60s 轮询 WCA Live GraphQL
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip/InfoTooltip';
import { apiUrl } from '../utils/api_base';
import { compLinkProps } from '../utils/comp_link';
import { Flag } from '../utils/flag';
import { displayCuberName } from '../utils/name_utils';
import { eventDisplayName } from '../utils/wca_events';
import { formatWcaResult } from '../utils/wca_format_result';
import { RecordBadge } from './RecordBadge/RecordBadge';
import './recent_records.css';

interface RecentRecord {
  id: string;
  tag: string;
  type: string;
  attemptResult: number;
  eventId: string;
  eventName: string;
  personName: string;
  countryIso2: string;
  countryName: string;
  competitionId: string;
}

interface ApiResponse {
  fetchedAt: number;
  records: RecentRecord[];
}

interface Props { lang: 'zh' | 'en' }

export default function RecentRecords({ lang }: Props) {
  const isZh = lang === 'zh';
  const [records, setRecords] = useState<RecentRecord[] | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pull = () => {
      fetch(apiUrl('/v1/wca/recent-records'))
        .then(r => r.ok ? r.json() as Promise<ApiResponse> : Promise.reject(r.status))
        .then(j => { if (mounted) setRecords(j.records ?? []); })
        .catch(() => { if (mounted && records === null) setRecords([]); });
    };

    pull();
    // 长开页面也要保持 1 分钟同步:走同一端点,nginx 命中缓存,零上游压力
    timer = setInterval(pull, 60_000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 占位最小高度避免 CLS;还在 loading 时不渲染列表但保留高度
  if (records === null) {
    return (
      <div className="recent-records recent-records--loading">
        <div className="recent-records-header">
          <Trophy size={14} strokeWidth={1.75} />
          <span className="recent-records-title">{isZh ? '近期纪录' : 'Recent records'}</span>
        </div>
      </div>
    );
  }

  if (records.length === 0) return null;

  // 视口高度 = max(WR+CR 条数, 5),NR 默认折叠在滚动条下,拖动才看得到
  const wrCrCount = records.filter(r => r.tag === 'WR' || r.tag === 'CR').length;
  const visibleRows = Math.max(wrCrCount, 5);
  // 单行实际高度 ≈ 1.85rem(padding 0.6rem + line-height 1.3 × 0.88rem + gap 0.1rem)。
  // +0.3rem buffer 让 WR+CR 边界行不被字体回流的 1-2px slop 切半。
  const listStyle = { maxHeight: `calc(${visibleRows * 1.85}rem + 0.3rem)` };

  return (
    <div className="recent-records">
      <div className="recent-records-header">
        <Trophy size={14} strokeWidth={1.75} />
        <span className="recent-records-title">{isZh ? '近期纪录' : 'Recent records'}</span>
        <span className="recent-records-count">{records.length}</span>
        <InfoTooltip
          iconSize={13}
          content={isZh
            ? '数据源自 WCA Live\n近 10 天开赛比赛的 WR / CR / NR\n服务器每分钟同步'
            : 'From WCA Live\nWR / CR / NR from comps started within the last 10 days\nSynced every minute'}
        />
      </div>
      <ul className="recent-records-list" style={listStyle}>
        {records.map(r => (
          <li key={r.id} className="recent-records-row">
            <span className="recent-records-badge">
              <RecordBadge record={r.tag} iso2={r.countryIso2.toLowerCase()} />
            </span>
            <Link
              {...compLinkProps(r.competitionId)}
              className="recent-records-body"
            >
              <span className="recent-records-value">
                {formatWcaResult(r.attemptResult, r.eventId, r.type === 'average' ? 'average' : 'single')}
              </span>
              <span className="recent-records-event-type">
                <span className="recent-records-event">
                  {eventDisplayName(r.eventId, isZh)}
                </span>
                {!isZh && ' '}
                <span className="recent-records-type">
                  {isZh ? (r.type === 'single' ? '单次' : '平均') : (r.type === 'average' ? 'avg' : r.type)}
                </span>
              </span>
              <span className="recent-records-person">{displayCuberName(r.personName, isZh)}</span>
              <Flag iso2={r.countryIso2.toLowerCase()} className="recent-records-flag" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
