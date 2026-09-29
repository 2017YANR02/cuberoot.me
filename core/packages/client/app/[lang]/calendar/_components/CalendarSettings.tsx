'use client';

import type { ReactNode } from 'react';
import { Settings } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import type { CalendarPrefs } from '@/lib/calendar-store';
import { tr } from '@/i18n/tr';
import { VIEW_KEYS, VIEW_LABELS } from '../_lib/format';

export const SETTINGS_SECTIONS = ['general', 'events', 'view', 'shortcuts', 'import'] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number];
const LABELS = {
  general: { zh: '时间与时区', en: 'Time & time zone' },
  events: { zh: '活动设置', en: 'Event settings' },
  view: { zh: '视图选项', en: 'View options' },
  shortcuts: { zh: '键盘快捷键', en: 'Keyboard shortcuts' },
  import: { zh: '导入和导出', en: 'Import & export' },
};

interface Props {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  prefs: CalendarPrefs;
  onPrefs: (patch: Partial<CalendarPrefs>) => void;
  displayTz: string;
  zoneItems: ListSelectItem[];
  onClose: () => void;
  children: ReactNode;
}

export default function CalendarSettings({ section, onSection, prefs, onPrefs, displayTz, zoneItems, onClose, children }: Props) {
  const backdropProps = useModalDismiss(onClose);
  return (
    <div className="cal-modal-backdrop" {...backdropProps}>
      <section className="cal-modal cal-settings" data-site-surface="popover" role="dialog" aria-modal="true" aria-label={tr({ zh: '日历设置', en: 'Calendar settings' })}>
        <header className="cal-settings-head">
          <Settings size={20} aria-hidden />
          <h2>{tr({ zh: '设置', en: 'Settings' })}</h2>
          <ClearButton variant="standalone" ariaLabel={tr({ zh: '关闭设置', en: 'Close settings' })} onClick={onClose} />
        </header>
        <div className="cal-settings-layout">
          <nav className="cal-settings-nav" aria-label={tr({ zh: '设置分类', en: 'Settings sections' })}>
            {SETTINGS_SECTIONS.map((key) => (
              <button key={key} type="button" className={section === key ? 'is-active' : ''} aria-current={section === key ? 'page' : undefined} onClick={() => onSection(key)}>
                {tr(LABELS[key])}
              </button>
            ))}
          </nav>
          <div className="cal-settings-content" key={section}>
            <h3>{tr(LABELS[section])}</h3>
            {section === 'general' && <>
              <div className="cal-settings-field">
                <span>{tr({ zh: '时间格式', en: 'Time format' })}</span>
                <ListSelect items={[{ value: '24', label: '13:00' }, { value: '12', label: '1:00 PM' }]} value={prefs.hour24 ? '24' : '12'} allLabel="" clearable={false} onChange={(v) => onPrefs({ hour24: v === '24' })} />
              </div>
              <BoolToggle value={!prefs.tz} label={tr({ zh: '使用设备时区', en: 'Use device time zone' })} onChange={(v) => onPrefs({ tz: v ? '' : displayTz })} />
              <div className="cal-settings-field">
                <span>{tr({ zh: '显示时区', en: 'Display time zone' })}</span>
                <ListSelect items={zoneItems} value={displayTz} allLabel="" clearable={false} searchable maxVisible={80} searchPlaceholder={tr({ zh: '搜城市 / 时区', en: 'Search city or zone' })} onChange={(tz) => onPrefs({ tz })} />
              </div>
              <p className="cal-hint">{tr({ zh: '日程按这个时区显示，原来的时间和时区保持不变。', en: 'Events are displayed in this time zone. Their original times and time zones stay the same.' })}</p>
            </>}
            {section === 'events' && <>
              <div className="cal-settings-field">
                <span>{tr({ zh: '默认活动时长', en: 'Default event duration' })}</span>
                <ListSelect items={[15, 30, 60, 90, 120].map((n) => ({ value: String(n), label: tr({ zh: `${n} 分钟`, en: `${n} minutes` }) }))} value={String(prefs.defaultDuration)} allLabel="" clearable={false} onChange={(v) => onPrefs({ defaultDuration: Number(v) })} />
              </div>
              <p className="cal-hint">{tr({ zh: '用于“创建”、C 快捷键和单击时间格。拖选时间段时使用你选中的时长，已有日程不受影响。', en: 'Used by Create, the C shortcut and a click on a time slot. Dragging uses the duration you select. Existing events are unchanged.' })}</p>
            </>}
            {section === 'view' && <>
              <div className="cal-settings-field">
                <span>{tr({ zh: '默认视图', en: 'Default view' })}</span>
                <ListSelect items={VIEW_KEYS.map((v) => ({ value: v, label: tr(VIEW_LABELS[v]) }))} value={prefs.view} allLabel="" clearable={false} onChange={(view) => onPrefs({ view })} />
                <p className="cal-hint">{tr({ zh: '下次打开日历时使用；链接指定的视图优先，窄屏默认按日显示。', en: 'Used the next time you open Calendar. A view in the link takes priority; narrow screens start in Day view.' })}</p>
              </div>
              <div className="cal-settings-field">
                <span>{tr({ zh: '一周的第一天', en: 'Start week on' })}</span>
                <ListSelect items={[{ value: '1', label: tr({ zh: '星期一', en: 'Monday' }) }, { value: '0', label: tr({ zh: '星期日', en: 'Sunday' }) }]} value={String(prefs.weekStart)} allLabel="" clearable={false} onChange={(v) => onPrefs({ weekStart: v === '1' ? 1 : 0 })} />
              </div>
              <BoolToggle value={prefs.weekends} label={tr({ zh: '显示周末', en: 'Show weekends' })} onChange={(weekends) => onPrefs({ weekends })} />
              <BoolToggle value={prefs.weekNumbers} label={tr({ zh: '显示周数（ISO）', en: 'Show week numbers (ISO)' })} onChange={(weekNumbers) => onPrefs({ weekNumbers })} />
              <BoolToggle value={prefs.showDeclined} label={tr({ zh: '显示已拒绝的邀请', en: 'Show declined invitations' })} onChange={(showDeclined) => onPrefs({ showDeclined })} />
            </>}
            {section === 'shortcuts' && <>
              <BoolToggle value={prefs.keyboardShortcuts} label={tr({ zh: '启用键盘快捷键', en: 'Enable keyboard shortcuts' })} onChange={(keyboardShortcuts) => onPrefs({ keyboardShortcuts })} />
              <dl className="cal-shortcut-list">
                <div><dt><kbd>C</kbd></dt><dd>{tr({ zh: '创建日程', en: 'Create event' })}</dd></div>
                <div><dt><kbd>T</kbd></dt><dd>{tr({ zh: '回到今天', en: 'Go to today' })}</dd></div>
                <div><dt><kbd>J / ←</kbd></dt><dd>{tr({ zh: '上一页', en: 'Previous period' })}</dd></div>
                <div><dt><kbd>K / →</kbd></dt><dd>{tr({ zh: '下一页', en: 'Next period' })}</dd></div>
                <div><dt><kbd>/</kbd></dt><dd>{tr({ zh: '搜索日程', en: 'Search events' })}</dd></div>
                {VIEW_KEYS.map((v) => <div key={v}><dt><kbd>{VIEW_LABELS[v].hint}</kbd></dt><dd>{tr(VIEW_LABELS[v])}</dd></div>)}
                <div><dt><kbd>?</kbd></dt><dd>{tr({ zh: '查看快捷键', en: 'Show shortcuts' })}</dd></div>
              </dl>
            </>}
            {section === 'import' && children}
            {section !== 'import' && <p className="cal-settings-note">{tr({ zh: '偏好设置自动保存在当前浏览器。', en: 'Preferences are saved automatically in this browser.' })}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
