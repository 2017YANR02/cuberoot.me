// 落地页右下:WCA Live 近 10 天 WR/CR/NR 列表(60s 同步)
// 文案直接复用 /v1/wca/format-record 同款 Python 模板(server 端 spawn,按 id 缓存)
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip/InfoTooltip';
import { apiUrl } from '../utils/api_base';
import { compLinkProps } from '../utils/comp_link';
import './recent_records.css';

interface RecentRecord {
  id: string;
  tag: string;
  type: string;
  competitionId: string;
  formattedCn: string;
  formattedEn: string;
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
    timer = setInterval(pull, 60_000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // 服务器首次冷启 ~7s 内 formattedCn/En 还在 fill;过滤掉空文案兜底
  const filled = records.filter(r => (isZh ? r.formattedCn : r.formattedEn));
  if (filled.length === 0) return null;

  const wrCrCount = filled.filter(r => r.tag === 'WR' || r.tag === 'CR').length;
  const visibleRows = Math.max(wrCrCount, 5);
  const listStyle = { maxHeight: `calc(${visibleRows * 1.85}rem + 0.3rem)` };

  return (
    <div className="recent-records">
      <div className="recent-records-header">
        <Trophy size={14} strokeWidth={1.75} />
        <span className="recent-records-title">{isZh ? '近期纪录' : 'Recent records'}</span>
        <span className="recent-records-count">{filled.length}</span>
        <InfoTooltip
          iconSize={13}
          content={isZh
            ? '数据源自 WCA Live\n近 10 天开赛比赛的 WR / CR / NR\n服务器每分钟同步\n文案与详情弹窗复制按钮同模板'
            : 'From WCA Live\nWR / CR / NR from comps started within the last 10 days\nSynced every minute\nText uses same template as the comp modal copy button'}
        />
      </div>
      <ul className="recent-records-list" style={listStyle}>
        {filled.map(r => (
          <li key={r.id} className="recent-records-row">
            <Link {...compLinkProps(r.competitionId)} className="recent-records-body">
              {isZh ? r.formattedCn : r.formattedEn}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
