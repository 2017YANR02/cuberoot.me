// 落地页右下:WCA Live 近 10 天 WR/CR/NR 列表(60s 同步)
// 数据走 /v1/wca/recent-records,Hono 后台 60s 轮询 WCA Live GraphQL
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { apiUrl } from '../utils/api_base';
import { compLinkProps } from '../utils/comp_link';
import { Flag } from '../utils/flag';
import { displayCuberName } from '../utils/name_utils';
import { eventDisplayName } from '../utils/wca_events';
import { formatWcaResult } from '../utils/wca_format_result';
import { countryName } from '../utils/country_name';
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

  return (
    <div className="recent-records">
      <div className="recent-records-header">
        <Trophy size={14} strokeWidth={1.75} />
        <span className="recent-records-title">{isZh ? '近期纪录' : 'Recent records'}</span>
        <span className="recent-records-count">{records.length}</span>
      </div>
      <ul className="recent-records-list">
        {records.map(r => (
          <li key={r.id} className="recent-records-row">
            <span className="recent-records-badge">
              <RecordBadge record={r.tag} iso2={r.countryIso2.toLowerCase()} />
            </span>
            <Link
              {...compLinkProps(r.competitionId)}
              className="recent-records-body"
            >
              <span className="recent-records-line1">
                <span className="recent-records-event">{isZh ? eventDisplayName(r.eventId, true) : r.eventName}</span>
                <span className="recent-records-type">
                  {' '}{isZh ? (r.type === 'single' ? '单次' : '平均') : r.type}{' '}
                  {isZh ? '成绩' : 'of'}{' '}
                </span>
                <span className="recent-records-value">
                  {formatWcaResult(r.attemptResult, r.eventId, r.type === 'average' ? 'average' : 'single')}
                </span>
              </span>
              <span className="recent-records-line2">
                <Flag iso2={r.countryIso2.toLowerCase()} className="recent-records-flag" />
                <span className="recent-records-person">{displayCuberName(r.personName, isZh)}</span>
                <span className="recent-records-country">
                  {isZh ? '来自 ' : 'from '}{countryName(r.countryIso2.toLowerCase(), isZh) || r.countryName}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
