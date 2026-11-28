'use client';

import { useMemo, useState } from 'react';
import { ListSelect, type ListSelectItem } from './ListSelect';
import { setDisplayTimeZone, useDisplayTimeZone } from '@/lib/display-time-zone';
import { calendarZoneSelectItems, zoneLabel } from '@/lib/tz-zones';
import { tr, useLang } from '@/i18n/tr';

export function DisplayTimeZoneSelect({ compact = false, settingsRow = false, venueZone, onOpen }: {
  compact?: boolean;
  settingsRow?: boolean;
  venueZone?: string;
  onOpen?: () => void;
}) {
  const isZh = useLang() === 'zh';
  const { zone, followsDevice } = useDisplayTimeZone();
  const [opened, setOpened] = useState(false);
  const options = useMemo(() => opened ? calendarZoneSelectItems(isZh, new Date()) : [], [opened, isZh]);
  const device = tr({ zh: '跟随设备', en: 'Use device time zone' });
  const title = tr({ zh: '显示时区', en: 'Display time zone' });
  const city = zone === 'Asia/Shanghai' ? tr({ zh: '北京', en: 'Beijing' }) : zoneLabel(zone, isZh);
  const venue = venueZone && options.find(item => item.value === venueZone);
  const items: ListSelectItem[] = [{ value: '', label: device }];
  if (venue) items.push({ ...venue, hint: tr({ zh: '比赛场馆', en: 'Venue' }) });
  items.push(...(venue ? options.filter(item => item !== venue) : options));
  const label = followsDevice && !compact ? `${device} · ${city}` : city;
  return <ListSelect portal={settingsRow} popupClassName="settings-typography display-time-zone-popup"
    className={settingsRow ? 'display-time-zone accent-color-select-value' : 'display-time-zone'}
    items={items} value={followsDevice ? '' : zone}
    selectedLabel={label} allLabel={title} ariaLabel={`${title} · ${label}`} clearable={false}
    searchable maxVisible={60} searchPlaceholder={tr({ zh: '搜索城市、国家或时区', en: 'Search city, country or time zone' })}
    onOpen={() => { setOpened(true); onOpen?.(); }} onChange={setDisplayTimeZone} />;
}
