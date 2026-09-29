'use client';

import { useEffect, useState } from 'react';
import { MapPin, Plane, TrainFront, Copy, ExternalLink } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { ClearButton } from '@/components/ClearButton';
import { DateRangeInput } from '@/components/DateRangeInput';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { useCopy } from '@/hooks/useCopy';
import { fetchCompInfo, type CompInfo } from '@/lib/comp-wcif';
import { localizeCompName } from '@/lib/comp-localize';
import { localizeCity } from '@/lib/city-localize';
import { formatDateRangeIso } from '@/lib/wca-date';
import { tr, useLang } from '@/i18n/tr';
import { addDaysToKey } from '../_lib/format';
import { COMPETITION_SOURCE_LABELS, type CalendarCompetition } from '../_lib/competitions';

export default function CompetitionDialog({ competition: c, onClose }: { competition: CalendarCompetition; onClose: () => void }) {
  const isZh = useLang() === 'zh';
  const backdropProps = useModalDismiss(onClose);
  const [info, setInfo] = useState<CompInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [departure, setDeparture] = useState(addDaysToKey(c.start_date, -1));
  const [returnDate, setReturnDate] = useState(c.end_date);
  const { copied, copy } = useCopy();
  useEffect(() => {
    let active = true;
    void fetchCompInfo(c.id).then((data) => { if (active) { setInfo(data); setLoading(false); } });
    return () => { active = false; };
  }, [c.id]);
  const name = localizeCompName(c.id, info?.name || c.name, isZh, { date: c.start_date });
  const city = localizeCity(info?.city || c.city || '', isZh);
  const address = info?.venue_address || '';
  const destination = address ? [address, info?.city || c.city, info?.country_iso2 || c.country].filter(Boolean).join(', ') : (Number.isFinite(c.latitude_degrees) && Number.isFinite(c.longitude_degrees)
    ? `${c.latitude_degrees},${c.longitude_degrees}` : `${c.city || ''} ${c.country}`);
  const mapQuery = new URLSearchParams({ api: '1', destination, travelmode: 'transit' });
  if (origin.trim()) mapQuery.set('origin', origin.trim());
  const itinerary = tr({
    zh: `${name}\n比赛：${formatDateRangeIso(c.start_date, c.end_date)}\n地点：${city}${address ? ` · ${address}` : ''}\n出发地：${origin}\n出发：${departure}\n返程：${returnDate}`,
    en: `${name}\nCompetition: ${formatDateRangeIso(c.start_date, c.end_date)}\nLocation: ${city}${address ? ` · ${address}` : ''}\nFrom: ${origin}\nDeparture: ${departure}\nReturn: ${returnDate}`,
  });
  return (
    <div className="cal-modal-backdrop" {...backdropProps}>
      <section className="cal-modal cal-competition-dialog" data-site-surface="popover" role="dialog" aria-modal="true" aria-label={name}>
        <header className="cal-settings-head">
          <h2>{name}</h2>
          <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭比赛', en: 'Close competition' })} onClick={onClose} />
        </header>
        <div className="cal-settings-content">
          <span className="cal-field-label">{tr(COMPETITION_SOURCE_LABELS[c.source])}</span>
          {info?.cancelled_at && <p role="status">{tr({ zh: '这场比赛已取消。', en: 'This competition has been cancelled.' })}</p>}
          <strong>{formatDateRangeIso(c.start_date, c.end_date)}</strong>
          <p className="cal-hint">{tr({ zh: '日期按比赛当地日期显示；具体轮次时间以比赛赛程为准。', en: 'Dates follow the competition’s local calendar. See its schedule for round times.' })}</p>
          <div className="cal-competition-location"><MapPin size={18} aria-hidden /><span>{city}{address && <><br />{address}</>}</span></div>
          {loading && <p className="cal-hint" role="status">{tr({ zh: '正在加载场馆地址…', en: 'Loading venue address…' })}</p>}
          {!loading && !address && <p className="cal-hint">{tr({ zh: '暂未取得详细地址，请在比赛官网核对场馆。', en: 'The detailed address is unavailable. Check the venue on the official competition page.' })}</p>}
          <div className="cal-pop-actions">
            <AppLink className="cal-btn" href={`/wca/comp/${c.id}`} prefetch={false}>{tr({ zh: '比赛详情与赛程', en: 'Details & schedule' })}</AppLink>
            <a className="cal-btn" href={`https://www.worldcubeassociation.org/competitions/${encodeURIComponent(c.id)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} aria-hidden />{tr({ zh: '比赛官网', en: 'Official website' })}</a>
          </div>
          <h3>{tr({ zh: '交通查询', en: 'Plan travel' })}</h3>
          <label className="cal-settings-field">
            <span>{tr({ zh: '出发城市', en: 'Departure city' })}</span>
            <span className="cal-travel-origin"><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={tr({ zh: '例如：上海', en: 'e.g. Shanghai' })} />{origin && <ClearButton variant="standalone" onClick={() => setOrigin('')} />}</span>
          </label>
          <DateRangeInput from={departure} to={returnDate} onChange={(from, to) => { setDeparture(from); setReturnDate(to); }} fromLabel={tr({ zh: '出发日期', en: 'Departure date' })} toLabel={tr({ zh: '返程日期', en: 'Return date' })} clearable={false} />
          <div className="cal-pop-actions">
            <a className="cal-btn" href={`https://www.google.com/maps/dir/?${mapQuery}`} target="_blank" rel="noopener noreferrer"><MapPin size={15} aria-hidden />{tr({ zh: '到场馆的路线', en: 'Directions to venue' })}</a>
            <a className="cal-btn" href="https://www.google.com/travel/flights" target="_blank" rel="noopener noreferrer"><Plane size={15} aria-hidden />{tr({ zh: '查询机票', en: 'Find flights' })}</a>
            <a className="cal-btn" href="https://www.12306.cn/index/" target="_blank" rel="noopener noreferrer"><TrainFront size={15} aria-hidden />{tr({ zh: '中国铁路 12306', en: 'China Railway 12306' })}</a>
            <button type="button" className="cal-btn" onClick={() => copy(itinerary)}><Copy size={15} aria-hidden />{copied ? tr({ zh: '已复制', en: 'Copied' }) : tr({ zh: '复制行程信息', en: 'Copy trip details' })}</button>
          </div>
          <p className="cal-hint">{tr({ zh: '默认提前一天出发，可自行调整。地图会带上出发地与场馆；机票、火车票页面需填写城市和日期，可先复制行程信息。', en: 'Departure defaults to the day before the competition and can be changed. Maps includes your origin and venue; enter cities and dates on the flight or train site, using the copied trip details.' })}</p>
        </div>
      </section>
    </div>
  );
}
