'use client';

import { useId } from 'react';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { RecordBadge } from '@/components/RecordBadge';
import { EXPLORER_ACHIEVEMENTS, type ExplorerAchievement } from '@/lib/person-achievements';
import './person-achievements.css';

export const ACHIEVEMENT_TITLES = {
  ...Object.fromEntries(Object.entries(EXPLORER_ACHIEVEMENTS).map(([kind, entry]) => [kind, entry.title])) as { [K in keyof typeof EXPLORER_ACHIEVEMENTS]: { zh: string; en: string } },
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
  traveler: { light: '#92eddd', dark: '#155e79', rim: '#e0fff0', shape: 'M24 15H176V185H24V15Z' },
  continents: { light: '#90e0fa', dark: '#234e94', rim: '#c5fbff', shape: 'M100 8 180 54V146L100 192 20 146V54Z' },
  breakthrough: { light: '#ffd0b1', dark: '#ae3658', rim: '#fff0cf', shape: 'M30 20H170V105Q167 158 100 190Q33 158 30 105Z' },
  podiumStreak: { light: '#d6b4ff', dark: '#59358e', rim: '#ffe3a4', shape: 'M24 180V85A76 76 0 0 1 176 85V180Z' },
  haul: { light: '#f8c9bd', dark: '#8d405f', rim: '#ffdd99', shape: 'M100 9Q129-1 140 29Q175 17 174 55Q209 65 185 99Q209 134 174 145Q176 181 141 172Q131 206 100 187Q70 207 59 172Q24 181 26 145Q-9 134 15 100Q-9 65 26 55Q25 18 60 29Q71-1 100 9Z' },
  sweep: { light: '#ffb1a9', dark: '#982c56', rim: '#ffe197', shape: 'M30 20H170V105Q167 158 100 190Q33 158 30 105Z' },
  storm: { light: '#bbbcff', dark: '#5337a2', rim: '#eff1ff', shape: 'M100 7 123 62 182 43 157 100 184 157 123 139 100 193 77 139 16 157 43 100 18 43 77 62Z' },
  constellation: { light: '#a4d1fa', dark: '#333571', rim: '#d9e4ff', shape: 'M100 8 187 100 100 192 13 100Z' },
  monument: { light: '#f9d49e', dark: '#835941', rim: '#ffe6bf', shape: 'M24 180V85A76 76 0 0 1 176 85V180Z' },
  solves: { light: '#7de4d1', dark: '#225d74', rim: '#c2ffec', shape: 'M100 8 180 54V146L100 192 20 146V54Z' },
  firstWin: { light: '#bbe6ae', dark: '#246f66', rim: '#ffe1a3', shape: 'M30 20H170V105Q167 158 100 190Q33 158 30 105Z' },
  butterfly: { light: '#c5c5ff', dark: '#643a92', rim: '#f8d8ff', shape: 'M100 9Q129-1 140 29Q175 17 174 55Q209 65 185 99Q209 134 174 145Q176 181 141 172Q131 206 100 187Q70 207 59 172Q24 181 26 145Q-9 134 15 100Q-9 65 26 55Q25 18 60 29Q71-1 100 9Z' },
  calendar: { light: '#f9cba9', dark: '#965774', rim: '#fff0bd', shape: 'M15 27H185V69Q158 100 185 131V173H15V131Q42 100 15 69Z' },
  triplets: { light: '#c7a8f5', dark: '#354986', rim: '#f3dafa', shape: 'M100 7 123 62 182 43 157 100 184 157 123 139 100 193 77 139 16 157 43 100 18 43 77 62Z' },
  passport: { light: '#a5d2f9', dark: '#405186', rim: '#e1f1ff', shape: 'M24 15H176V185H24V15Z' },
  worldPodium: { light: '#a9dcf7', dark: '#315e94', rim: '#f9e2a8', shape: 'M30 20H170V105Q167 158 100 190Q33 158 30 105Z' },
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

export function AchievementMedal({ kind, event, recordCount, achievement }: { kind: AchievementKind; event?: string; recordCount?: number; achievement?: ExplorerAchievement }) {
  const id = useId();
  const paint = (name: string) => `url(#${id}-${name})`;
  const art = ART[kind];
  const tier = kind.startsWith('historical') ? recordAchievementTier(recordCount) : undefined;
  const explorerIndex = achievement ? (EXPLORER_ACHIEVEMENTS[achievement.kind].tiers as readonly number[]).indexOf(achievement.tier) : 0;
  const rim = tier && tier.count > 1 ? tier.rim : explorerIndex > 0 ? ['#ce925c', '#c7deef', '#ffd27d', '#a9f4ff'][explorerIndex] : art.rim;
  const record = achievement?.record ?? (kind === 'wr' ? 'WR' : kind.startsWith('historical') ? kind.slice(10) : null);
  return (
    <span className={`wp-achievement-medal wp-achievement-art-${kind}`} data-tier={tier?.count ?? achievement?.tier} aria-hidden="true">
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
        <path d={art.shape} fill={paint('enamel')} stroke={tier && tier.count > 1 || explorerIndex > 0 ? rim : paint('metal')} strokeWidth={tier && tier.count > 1 || explorerIndex > 0 ? 10 : 6} strokeLinejoin="round" />
        <g clipPath={paint('clip')}>
          <circle cx="100" cy="85" r="65" stroke={art.rim} strokeOpacity=".2" strokeWidth="1" />
          <circle cx="100" cy="85" r="73" stroke={art.rim} strokeOpacity=".12" strokeWidth="1" />
          <path d="M5 48Q70 3 143 31T202 16V0H0Z" fill="#fff" opacity=".16" />
          <path d="M-10 167Q76 111 210 151V205H-10Z" fill={art.dark} opacity=".55" />
          <path d={art.shape} fill={paint('shine')} />
          {kind === 'traveler' && <>
            <path d="M34 27H166V173H34Z" stroke="#fff4d8" strokeWidth="3" strokeDasharray="3 7" />
            <circle cx="99" cy="94" r="48" fill={paint('ocean')} stroke="#d0ffff" strokeWidth="2" />
            <path d="m68 56 23 2 8 14-20 12-5 20-22-15ZM106 97l26-10 13 19-24 25-17-12Z" fill={paint('jade')} />
            <path d="M46 142Q100 172 157 95" stroke="#fff4b2" strokeWidth="3" strokeDasharray="5 5" />
            <path d="m139 76 26-17-13 31 13 15-9 6-17-13-22 3-2-7 21-9-9-14 5-3Z" fill={paint('gold')} stroke="#fff1d1" strokeWidth="2" />
          </>}
          {kind === 'continents' && <>
            <circle cx="100" cy="100" r="63" fill={paint('ocean')} stroke={paint('metal')} strokeWidth="4" />
            <circle cx="100" cy="100" r="50" fill={art.dark} />
            {[0,60,120,180,240,300].map((angle,i) => <g key={angle} transform={`rotate(${angle} 100 100)`}>
              <path d="m100 42 12 37-12 21-12-21Z" fill={paint(['ruby','gold','jade','ocean','ruby','gold'][i])} stroke="#e4ffff" strokeWidth="2" />
              <circle cx="100" cy="49" r="3" fill="#fff6d5" />
            </g>)}
            <circle cx="100" cy="100" r="15" fill={paint('gold')} stroke="#fff4c1" strokeWidth="3" />
          </>}
          {kind === 'breakthrough' && <>
            <path d="M48 145 79 143 60 122Z" fill={paint('ruby')} />
            <path d="M54 153Q48 130 78 119Q84 150 54 153Z" fill={paint('gold')} />
            <path d="M69 126 88 153 99 127M72 98 46 111 72 128" fill={paint('ruby')} stroke="#ffc5cb" strokeWidth="2" />
            <path d="M65 115Q86 56 145 47Q149 103 94 137Z" fill="#fff1d4" stroke="#ffd59b" strokeWidth="3" />
            <path d="M106 62Q124 51 145 47L141 83Z" fill={paint('ruby')} />
            <circle cx="108" cy="91" r="16" fill={paint('ocean')} stroke={paint('gold')} strokeWidth="5" />
            <path d="m40 159-9 9m51-14-9 17m-32-58-12 8" stroke="#ffdc9a" strokeWidth="3" strokeLinecap="round" />
          </>}
          {kind === 'podiumStreak' && <>
            <path d="M42 133H77V91H118V115H158V162H42Z" fill={paint('gold')} stroke="#fff1c6" strokeWidth="3" />
            <path d="M48 139H71V156H48ZM84 98H111V156H84ZM125 122H151V156H125Z" fill={paint('ruby')} opacity=".7" />
            <path d="M48 121Q24 72 69 47M151 113Q178 70 131 47" stroke={paint('jade')} strokeWidth="5" />
            {[0,1,2].map(i => <g key={i}><ellipse cx={41+i*5} cy={93-i*15} rx="7" ry="12" transform={`rotate(-40 ${41+i*5} ${93-i*15})`} fill={paint('jade')} /><ellipse cx={159-i*5} cy={93-i*15} rx="7" ry="12" transform={`rotate(40 ${159-i*5} ${93-i*15})`} fill={paint('jade')} /></g>)}
            <path d="m99 49 7 14 16 3-12 11 3 16-14-8-14 8 3-16-12-11 16-3Z" fill={paint('gold')} />
          </>}
          {kind === 'haul' && <>
            <path d="m56 121 44 54 45-54" fill={paint('jade')} stroke="#ccffdf" strokeWidth="2" />
            {[['62','91','ruby'],['138','91','ocean'],['100','66','jade']].map(([x,y,color]) => <g key={x} transform={`translate(${x} ${y})`}>
              <path d="m-20-35 8 34H12L20-35" fill={paint(color)} stroke="#ffebd1" strokeWidth="2" />
              <circle cy="10" r="25" fill={paint('gold')} stroke="#fff2c4" strokeWidth="3" />
              <circle cy="10" r="17" stroke="#ba7038" strokeWidth="2" />
              <path d="m0-1 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#fff1bd" />
            </g>)}
            <path d="m78 143 22 8 22-8-2 17-20-5-20 5Z" fill={paint('ruby')} stroke="#ffd0d9" strokeWidth="2" />
          </>}
          {kind === 'sweep' && <>
            <path d="M60 94 35 156Q66 146 100 177Q137 145 167 156L141 93Z" fill={paint('ruby')} stroke="#ffc4bf" strokeWidth="3" />
            <path d="m73 112-14 39m39-33 2 50m27-56 15 39" stroke="#ffb185" strokeWidth="3" />
            <path d="m54 56 25 21 21-36 22 36 26-21-11 56H65Z" fill={paint('gold')} stroke="#fff4c5" strokeWidth="3" />
            <path d="M65 112H137V126H65Z" fill={paint('gold')} stroke="#fff1ca" strokeWidth="2" />
            {[77,101,125].map((x,i) => <path key={x} d={`m${x} 87 6 8-6 8-6-8Z`} fill={paint(['ocean','ruby','jade'][i])} />)}
            {[54,100,148].map(x => <circle key={x} cx={x} cy={x===100?41:56} r="5" fill="#fff0a9" />)}
          </>}
          {kind === 'storm' && <>
            <path d="m99 39 48 43-14 52-47 14-38-50Z" fill={paint('ocean')} stroke="#d5faff" strokeWidth="3" />
            <path d="m99 39 2 51 46-8m-46 8 32 44m-32-44-15 58m15-58-53 8" stroke="#b6d5ff" strokeWidth="2" />
            <path d="m107 33-45 68h32l-12 43 55-68h-33l16-43Z" fill={paint('gold')} stroke="#fff2c1" strokeWidth="3" />
            <path d="m39 55 15 6m93 69 13 8m-117-9 13-8m92-60 14-6" stroke="#ffcbed" strokeWidth="4" strokeLinecap="round" />
          </>}
          {kind === 'constellation' && <>
            <path d="m59 76 69-25 18 72-64 25-23-72 87 47-18-72-46 97" stroke="#bbe6ff" strokeOpacity=".8" strokeWidth="2" />
            {[[59,76],[128,51],[146,123],[82,148],[100,96]].map(([x,y],i) => <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0-16 14-5 10 12 0 18-10 12-14-5Z" fill={paint(['ruby','gold','jade','ocean','ruby'][i])} stroke="#f7e5ff" strokeWidth="2" />
              <path d="M0-16V18M-14-5H14L0 18Z" stroke="#fff" strokeOpacity=".5" />
            </g>)}
          </>}
          {kind === 'monument' && <>
            <path d="M55 46H145V151H55Z" fill={art.dark} stroke={paint('gold')} strokeWidth="5" />
            <path d="M66 56H134Q133 83 109 99Q133 117 134 142H66Q66 117 91 99Q66 83 66 56Z" fill={paint('ocean')} stroke="#ffe4b0" strokeWidth="3" />
            <path d="M74 68H126Q119 86 101 98Q83 87 74 68ZM74 138l26-24 26 24Z" fill={paint('gold')} />
            <path d="M100 98V119" stroke="#ffe69e" strokeWidth="3" />
            <path d="M49 41H151V53H49ZM49 146H151V160H49Z" fill={paint('gold')} stroke="#fff1c8" strokeWidth="2" />
          </>}
          {kind === 'solves' && <>
            {[0,45,90,135,180,225,270,315].map(angle => <path key={angle} transform={`rotate(${angle} 100 98)`} d="M89 34H111L116 58H84Z" fill={paint('gold')} stroke="#ffe7b5" strokeWidth="2" />)}
            <circle cx="100" cy="98" r="48" fill={paint('jade')} stroke={paint('gold')} strokeWidth="9" />
            <path d="M53 80H147V117H53Z" fill={art.dark} stroke="#c6ffe1" strokeWidth="2" />
            <text x="100" y="106" textAnchor="middle" fontSize="24" fontWeight="800" fill="#ffedb7" fontFamily="sans-serif">10 000</text>
            <path d="m81 145 12 12 27-28" stroke="#fff1b8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </>}
          {kind === 'firstWin' && <>
            <path d="M100 157V106M98 133Q58 139 55 105Q89 100 98 133ZM103 121Q142 126 148 92Q111 93 103 121Z" fill={paint('jade')} stroke="#c7ffd8" strokeWidth="3" />
            <path d="M78 65H61Q61 92 81 94M122 65H139Q139 92 119 94" stroke={paint('gold')} strokeWidth="6" />
            <path d="M77 55H123V81Q119 108 100 110Q81 108 77 81Z" fill={paint('gold')} stroke="#fff2bd" strokeWidth="3" />
            <path d="M58 157Q100 143 143 157" stroke="#ffd6aa" strokeWidth="5" strokeLinecap="round" />
            <path d="m100 66 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="#fff8dd" />
          </>}
          {kind === 'butterfly' && <>
            <path d="M100 98Q42 17 42 81Q36 123 92 113Q44 116 64 150Q89 163 100 113Q110 162 139 150Q158 116 109 113Q164 123 158 81Q158 17 100 98Z" fill={paint('ocean')} stroke="#e2d8ff" strokeWidth="3" />
            <path d="M91 95Q53 50 56 83Q58 103 91 95ZM109 95Q147 50 144 83Q142 103 109 95ZM88 122Q64 130 74 143ZM112 122Q136 130 126 143Z" fill={paint('ruby')} stroke="#f3b5ed" strokeWidth="2" />
            <path d="M100 91V123M98 91Q87 72 82 77M102 91Q113 72 118 77" stroke={paint('gold')} strokeWidth="5" strokeLinecap="round" />
            <path d="M52 164Q77 148 100 162Q124 148 148 164L139 177H61Z" fill={art.dark} stroke="#dcc7ff" strokeWidth="2" />
          </>}
          {kind === 'calendar' && <>
            <path d="M48 48H151V147Q151 159 139 159H48Z" fill="#fff0d2" stroke="#ffe9ab" strokeWidth="3" />
            <path d="M48 48H151V78H48Z" fill={paint('ruby')} />
            <path d="M68 40V59M128 40V59" stroke={paint('gold')} strokeWidth="7" strokeLinecap="round" />
            <text x="97" y="115" textAnchor="middle" fontSize="31" fontWeight="800" fill="#a94f68" fontFamily="sans-serif">5.20</text>
            <path d="M59 133Q98 103 139 133" stroke={paint('ruby')} strokeWidth="5" />
            <path d="M62 140Q98 111 136 140" stroke={paint('gold')} strokeWidth="5" />
            <path d="M67 146Q98 120 131 146" stroke={paint('jade')} strokeWidth="5" />
          </>}
          {kind === 'triplets' && <>
            <path d="M60 113 100 64 140 113Z" stroke="#dcd7ff" strokeWidth="4" />
            {[[60,113],[100,64],[140,113]].map(([x,y],i) => <g key={i} transform={`translate(${x} ${y})`}>
              <path d="m0-25 8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3Z" fill={paint(['ruby','gold','jade'][i])} stroke="#fff3d6" strokeWidth="3" />
              <path d="M-6 0H6M-6 6H6" stroke="#fff5dc" strokeWidth="3" strokeLinecap="round" />
            </g>)}
          </>}
          {kind === 'passport' && <>
            <path d="M49 38H139Q151 38 151 51V161H49Z" fill={paint('ocean')} stroke="#daeaff" strokeWidth="3" />
            <path d="M58 39V160" stroke="#c0d8ff" strokeWidth="3" />
            <circle cx="102" cy="77" r="24" stroke={paint('gold')} strokeWidth="3" />
            <path d="M78 77H126M102 53Q82 77 102 101Q122 77 102 53Z" stroke={paint('gold')} strokeWidth="2" />
            {[75,103,131].map((x,i) => <g key={x}>
              <path d={`m${x-9} 112 9 17 9-17`} fill={paint(['ruby','jade','ruby'][i])} />
              <circle cx={x} cy="137" r="13" fill={['#fbd283','#d0e8f5','#d7a083'][i]} stroke="#fff1d2" strokeWidth="2" />
            </g>)}
          </>}
          {kind === 'worldPodium' && <>
            <circle cx="100" cy="88" r="49" fill={paint('ocean')} stroke="#c9f2ff" strokeWidth="3" />
            <path d="M51 88H149M100 39Q65 88 100 137Q135 88 100 39ZM59 63H141M59 113H141" stroke="#c5efff" strokeWidth="2" opacity=".6" />
            <path d="M60 62 85 103H115L140 62" fill={paint('ruby')} stroke="#ffccdc" strokeWidth="3" />
            <circle cx="100" cy="121" r="34" fill={achievement?.place === 2 ? '#bfd6eb' : achievement?.place === 3 ? '#d99b75' : paint('gold')} stroke="#ffefcc" strokeWidth="4" />
            <circle cx="100" cy="121" r="25" stroke="#90653e" strokeWidth="2" />
            <path d="m100 104 5 11 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2Z" fill="#fff3d4" />
          </>}
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
      {achievement && <span className="wp-achievement-count">{achievement.kind === 'worldPodium' ? ['','1','2','3'][achievement.place ?? 1] : achievement.kind === 'monument' ? `${achievement.count}d` : `×${achievement.count}`}</span>}
    </span>
  );
}
