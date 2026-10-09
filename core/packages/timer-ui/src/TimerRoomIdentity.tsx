import type { NetIdentity } from '@cuberoot/shared/timer';
import { WcaPersonPicker, type WcaPersonPickerProps } from './WcaPersonPicker';
import { Flag } from './CountryFlag';
import { timerRoomPlayerName } from './TimerRoomPlayers';

export interface TimerRoomIdentityProps extends Pick<WcaPersonPickerProps, 'value' | 'onChange' | 'onQueryChange' | 'defaultQuery' | 'disabled'> {
  language: 'en' | 'zh';
  account?: NetIdentity | null;
}
export function TimerRoomIdentity({ language, account, ...picker }: TimerRoomIdentityProps) {
  const placeholder = { en: 'Nickname, or search name / WCA ID (optional)', zh: '昵称，或搜姓名 / WCA ID（可留空）' }[language];
  return account ? <div className="timer-room-identity">
    {account.iso2 && <Flag iso2={account.iso2} className="timer-room-player-flag" />}
    <span>{timerRoomPlayerName(account, language)}</span>
  </div> : <WcaPersonPicker {...picker} isZh={language === 'zh'} allowFreeText placeholder={placeholder} />;
}
