'use client';

import { useId } from 'react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { RecordBadge } from '@/components/RecordBadge';
import './person-achievements.css';

export const ACHIEVEMENT_TITLES = {
  champion: { zh: '世界冠军', en: 'World champion' },
  wr: { zh: '当前世界纪录保持者', en: 'Current world record holder' },
  historicalWR: { zh: '曾获世界纪录', en: 'Historical world record' },
  historicalCR: { zh: '曾获洲际纪录', en: 'Historical continental record' },
  historicalNR: { zh: '曾获国家纪录', en: 'Historical national record' },
  slam: { zh: '大满贯', en: 'Grand Slam' },
  gold: { zh: '金牌大满贯', en: 'Gold Medal Grand Slam' },
  hundred: { zh: '百赛选手', en: 'Century competitor' },
  allEvents: { zh: '全项目选手', en: 'All-event explorer' },
};
export type AchievementKind = keyof typeof ACHIEVEMENT_TITLES;

export const RECORD_ACHIEVEMENT_TIERS = [
  { count: 1, zh: '基础', en: 'Base', rim: '#e9daff' },
  { count: 10, zh: '青铜', en: 'Bronze', rim: '#ce925c' },
  { count: 50, zh: '白银', en: 'Silver', rim: '#c7deef' },
  { count: 100, zh: '黄金', en: 'Gold', rim: '#ffd27d' },
  { count: 200, zh: '水晶', en: 'Crystal', rim: '#a9f4ff' },
] as const;

export function recordAchievementTier(count?: number) {
  if (count === undefined || !Number.isSafeInteger(count) || count < 1) return undefined;
  return RECORD_ACHIEVEMENT_TIERS.findLast(tier => count >= tier.count);
}

// Original enamel-pin artwork. Illustration pigments are independent of UI theme tokens.
const ART = {
  hundred: { light: '#ffd4a0', dark: '#964568', rim: '#ffe8b5', shape: 'M49 12H151L185 48V152L151 188H49L15 152V48Z' },
  allEvents: { light: '#b4f2e3', dark: '#305a98', rim: '#d9fff5', shape: 'M100 8 166 29 191 94 169 156 100 192 31 156 9 94 34 29Z' },
  champion: { light: '#ffbb96', dark: '#862d56', rim: '#ffd27d', shape: 'M100 9 173 35V98Q171 153 100 190Q29 153 27 98V35Z' },
  wr: { light: '#9eeaff', dark: '#3153b7', rim: '#d0f6ff', shape: 'M100 6 123 26 154 20 162 51 190 67 178 98 190 130 160 147 151 179 120 174 100 195 78 174 47 179 39 148 10 131 23 100 10 69 39 52 46 21 78 26Z' },
  historicalWR: { light: '#ad9cf4', dark: '#392278', rim: '#e9daff', shape: 'M100 10A90 90 0 1 1 99.99 10Z' },
  historicalCR: { light: '#8cf0d2', dark: '#135c65', rim: '#d4ffe5', shape: 'M100 8 179 53V147L100 192 21 147V53Z' },
  historicalNR: { light: '#ffc593', dark: '#a23e55', rim: '#ffefd4', shape: 'M39 15H161Q178 15 178 32V108Q175 152 100 189Q25 152 22 108V32Q22 15 39 15Z' },
  slam: { light: '#abacff', dark: '#3b326f', rim: '#dacbff', shape: 'M100 7 173 44 183 119 138 181H62L17 119 27 44Z' },
  gold: { light: '#ffe6a6', dark: '#9a4727', rim: '#fff1b5', shape: 'M100 5 119 22 147 13 155 42 182 51 174 79 195 100 175 121 183 149 155 158 147 187 120 178 100 195 80 178 52 187 44 158 17 149 25 120 5 100 25 80 17 51 45 42 53 13 80 22Z' },
};

export function AchievementMedal({ kind, event, recordCount }: { kind: AchievementKind; event?: string; recordCount?: number }) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  const art = ART[kind];
  const tier = kind.startsWith('historical') ? recordAchievementTier(recordCount) : undefined;
  const rim = tier && tier.count > 1 ? tier.rim : art.rim;
  const record = kind === 'wr' ? 'WR' : kind.startsWith('historical') ? kind.slice(10) : null;
  return (
    <span className={`wp-achievement-medal wp-achievement-art-${kind}`} data-tier={tier?.count} aria-hidden="true">
      <svg className="wp-achievement-illustration" viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id={`${id}-enamel`} x1="40" y1="20" x2="150" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor={art.light} /><stop offset=".55" stopColor={art.dark} /><stop offset="1" stopColor="#172343" /></linearGradient>
          <linearGradient id={`${id}-metal`} x1="35" y1="15" x2="161" y2="185" gradientUnits="userSpaceOnUse"><stop stopColor="#ffffff" /><stop offset=".26" stopColor={art.rim} /><stop offset=".48" stopColor="#ffffff" /><stop offset=".72" stopColor={art.rim} /><stop offset="1" stopColor="#ab775c" /></linearGradient>
          <linearGradient id={`${id}-gold`} x1="70" y1="47" x2="126" y2="142" gradientUnits="userSpaceOnUse"><stop stopColor="#fff7c2" /><stop offset=".38" stopColor="#ffd27d" /><stop offset=".72" stopColor="#df882f" /><stop offset="1" stopColor="#9c481f" /></linearGradient>
          <linearGradient id={`${id}-ocean`} x1="64" y1="46" x2="132" y2="130" gradientUnits="userSpaceOnUse"><stop stopColor="#b5f4ff" /><stop offset=".42" stopColor="#50bdf0" /><stop offset="1" stopColor="#3254b6" /></linearGradient>
          <linearGradient id={`${id}-jade`} x1="55" y1="60" x2="139" y2="135" gradientUnits="userSpaceOnUse"><stop stopColor="#dcffe0" /><stop offset=".45" stopColor="#60dda5" /><stop offset="1" stopColor="#238b83" /></linearGradient>
          <linearGradient id={`${id}-ruby`} x1="70" y1="50" x2="119" y2="139" gradientUnits="userSpaceOnUse"><stop stopColor="#ffe1dd" /><stop offset=".4" stopColor="#f66f92" /><stop offset="1" stopColor="#ad3066" /></linearGradient>
          <radialGradient id={`${id}-shine`} cx=".28" cy=".15" r=".85"><stop stopColor="#fff" stopOpacity=".44" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
          <clipPath id={`${id}-clip`}><path d={art.shape} /></clipPath>
        </defs>
        <path d={art.shape} fill={paint('enamel')} stroke={tier && tier.count > 1 ? rim : paint('metal')} strokeWidth={tier && tier.count > 1 ? 10 : 6} strokeLinejoin="round" />
        <g clipPath={paint('clip')}>
          <circle cx="100" cy="85" r="65" stroke={art.rim} strokeOpacity=".2" strokeWidth="1" />
          <circle cx="100" cy="85" r="73" stroke={art.rim} strokeOpacity=".12" strokeWidth="1" />
          <path d="M5 48Q70 3 143 31T202 16V0H0Z" fill="#fff" opacity=".16" />
          <path d="M-10 167Q76 111 210 151V205H-10Z" fill={art.dark} opacity=".55" />
          <path d={art.shape} fill={paint('shine')} />
          {kind === 'hundred' && <>
            <path d="M56 147 41 175 67 169 77 184 91 151M109 151 123 184 134 169 159 175 144 147" fill={paint('ruby')} stroke="#ffd6d5" strokeWidth="2" />
            <path d="M47 41H153V143Q100 172 47 143Z" fill={paint('gold')} stroke="#fff2c7" strokeWidth="3" />
            <path d="M55 52H145V135Q100 160 55 135Z" fill={paint('ruby')} />
            <path d="m100 58 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill={paint('gold')} />
            <text x="100" y="122" textAnchor="middle" fill="#fff4d1" fontSize="43" fontWeight="800" fontFamily="sans-serif">100</text>
            <path d="M66 132Q100 148 134 132" stroke={paint('gold')} strokeWidth="3" strokeLinecap="round" />
          </>}
          {kind === 'allEvents' && <>
            <circle cx="100" cy="99" r="61" fill={paint('ocean')} stroke={paint('metal')} strokeWidth="4" />
            <circle cx="100" cy="99" r="48" fill={art.dark} stroke="#b8f7ef" strokeWidth="1" />
            {[0, 60, 120, 180, 240, 300].map((angle, i) => <g key={angle} transform={`rotate(${angle} 100 99)`}>
              <path d="M100 42 118 75 100 89 82 75Z" fill={paint(['ruby', 'gold', 'jade', 'ocean', 'ruby', 'gold'][i])} stroke="#e7fff6" strokeWidth="1.5" />
              <path d="M100 42V89L118 75Z" fill="#fff" opacity=".2" />
            </g>)}
            <circle cx="100" cy="99" r="21" fill={paint('gold')} stroke="#fff7d6" strokeWidth="2" />
            <path d="m89 99 8 8 15-18" stroke="#315d72" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </>}
          {kind === 'champion' && <>
            <path d="M67 66H49Q43 105 80 110M133 66H151Q157 105 120 110" stroke={paint('gold')} strokeWidth="9" />
            <path d="M67 51H133L129 90Q124 117 100 119Q76 117 71 90Z" fill={paint('gold')} stroke="#fff1b5" strokeWidth="2" />
            <path d="M77 59H85L89 98Q76 87 77 59Z" fill="#fff" opacity=".6" />
            <path d="M95 116H105V136H121L127 148H73L79 136H95Z" fill={paint('gold')} stroke="#ffdda0" strokeWidth="2" />
            <path d="m100 68 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z" fill="#fff7d6" />
            <path d="M42 130Q42 153 72 165M158 130Q158 153 128 165" stroke="#e5b776" strokeWidth="3" />
            {[0, 1, 2].map(i => <g key={i}><ellipse cx={46 + i * 8} cy={137 + i * 10} rx="5" ry="10" transform={`rotate(-40 ${46 + i * 8} ${137 + i * 10})`} fill={paint('gold')} /><ellipse cx={154 - i * 8} cy={137 + i * 10} rx="5" ry="10" transform={`rotate(40 ${154 - i * 8} ${137 + i * 10})`} fill={paint('gold')} /></g>)}
          </>}
          {kind === 'wr' && <>
            <circle cx="100" cy="93" r="52" fill={paint('ocean')} stroke="#b8f7ff" strokeWidth="2" />
            <path d="M48 93H152M57 69H143M57 117H143M100 41C68 71 68 117 100 145M100 41C132 71 132 117 100 145" stroke="#e6ffff" strokeOpacity=".42" strokeWidth="2" />
            <path d="M32 120 167 57M32 131 166 68" stroke="#8bebff" strokeWidth="3" strokeLinecap="round" />
            <path d="M110 35 68 94H97L87 130 139 69H109L119 35Z" fill={paint('gold')} stroke="#fff8d3" strokeWidth="2" />
          </>}
          {kind === 'historicalWR' && <>
            <circle cx="100" cy="86" r="47" fill={paint('ocean')} stroke="#d8f7ff" strokeWidth="2" />
            <path d="m75 46 18 4 6 13-12 8-1 14-15 8-15-13 1-14ZM114 53l17 5 12 21-14 7-12-8-10-15ZM103 90l21 4 12 14-16 12-8 11-13-15-6-15Z" fill={paint('jade')} />
            <path d="M48 74C10 119 61 149 133 112S177 55 146 65" stroke={paint('metal')} strokeWidth="6" strokeLinecap="round" />
            <path d="M48 74C10 119 61 149 133 112" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />
          </>}
          {kind === 'historicalCR' && <>
            <circle cx="122" cy="61" r="18" fill={paint('gold')} />
            <path d="m29 120 43-61 39 61Z" fill={paint('ocean')} /><path d="m58 80 14-21 15 23-15-6Z" fill="#f0ffff" />
            <path d="m58 127 48-79 63 79Z" fill={paint('jade')} /><path d="m89 76 17-28 23 29-19-8-11 12Z" fill="#e9fff3" />
            <path d="m106 48 3 79h60Z" fill="#177c79" opacity=".5" />
            <path d="M26 137Q62 117 99 136T179 126M26 146Q66 130 101 148T173 142" stroke="#90ebd2" strokeWidth="3" strokeLinecap="round" />
          </>}
          {kind === 'historicalNR' && <>
            <circle cx="100" cy="87" r="42" fill={paint('gold')} opacity=".9" />
            <path d="M29 132 63 101 87 114 116 84 174 137V163H29Z" fill="#934166" />
            <path d="M76 126V47" stroke={paint('metal')} strokeWidth="5" strokeLinecap="round" />
            <path d="M79 49C103 31 116 63 143 43V88C116 108 103 76 79 94Z" fill={paint('ruby')} stroke="#ffe0d5" strokeWidth="2" />
            <path d="M79 49C103 31 116 63 143 43V55C116 75 103 43 79 61Z" fill="#fff" opacity=".4" />
            <path d="m104 59 4 7 8 2-6 6 1 8-7-4-7 4 1-8-6-6 8-2Z" fill="#fff3bd" />
          </>}
          {(kind === 'slam' || kind === 'gold') && <>
            <path d="M58 109 48 57 79 75 100 42 122 75 152 57 142 109Z" fill={paint('gold')} stroke="#fff2b8" strokeWidth="2" />
            <path d="m59 65 6 34h69l8-34-20 19-22-32-22 32Z" fill={kind === 'gold' ? '#f4a848' : '#654b95'} />
            <path d="M58 109H142V122H58Z" fill={paint('gold')} stroke="#fff2b8" strokeWidth="2" />
            {[50, 100, 150].map((x, i) => <g key={x} transform={`translate(${x} ${i === 1 ? 133 : 138})`}>
              <path d="M-21-10-12-22H12L21-10 0 16Z" fill={paint(kind === 'gold' ? 'gold' : ['ruby', 'ocean', 'jade'][i])} stroke="#fff2d5" strokeWidth="1.5" />
              <path d="M-21-10H21M-12-22 0 16 12-22M-12-22 0-10 12-22" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />
            </g>)}
            {[48, 100, 152].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? 39 : 54} r="5" fill={paint('gold')} stroke="#fff3bf" strokeWidth="2" />)}
          </>}
          <g fill="#fff8df"><path d="m43 44 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" /><path d="m157 96 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" /><circle cx="145" cy="37" r="2" /><circle cx="58" cy="31" r="1.5" /><circle cx="35" cy="106" r="1.5" /></g>
        </g>
        {tier && tier.count >= 10 && <path d={art.shape} transform="translate(8 8) scale(.92)" stroke={paint('metal')} strokeWidth="2" opacity=".85" />}
        {tier && tier.count >= 200 && [35, 165].map(x => <g key={x} transform={`translate(${x} 119)`}>
          <path d="M0-24 11-8 7 13 0 24-7 13-11-8Z" fill={paint('ocean')} stroke="#e9ffff" strokeWidth="2" />
          <path d="M0-24V24M-11-8H11L0 24Z" stroke="#fff" strokeOpacity=".7" />
        </g>)}
      </svg>
      {record && <span className="wp-achievement-record"><RecordBadge record={record} /></span>}
      {event && <span className="wp-achievement-event"><EventIcon event={event} /></span>}
      {tier && <span className="wp-achievement-count">×{recordCount}</span>}
    </span>
  );
}
