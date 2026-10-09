'use client';
import { TimerHistoryWorkspace, type TimerHistoryWorkspaceProps } from '@cuberoot/timer-ui';
import { webDateRangeInputLabels } from '@/components/DateRangeInput';
import { tr } from '@/i18n/tr';
import { updateSettings } from '../_lib/settings';
type Props = Omit<TimerHistoryWorkspaceProps, 'dateRangeLabels' | 'rollingPickerLabels' | 'onRollingColumnsChange'>;
export default function HistoryPanel(props: Props) { return <TimerHistoryWorkspace {...props} dateRangeLabels={webDateRangeInputLabels()} onRollingColumnsChange={statsRollingColumns => updateSettings({statsRollingColumns})} rollingPickerLabels={{changeColumn: current => tr({zh: `更改统计列，当前 ${current}`,en:`Change stats column, currently ${current}`}),clear:tr({zh:'清除',en:'Clear'}),customPlaceholder:tr({zh:'自定义 ao',en:'Custom ao'}),customSize:tr({zh:'自定义 ao 大小',en:'Custom ao size'}),replace:tr({zh:'替换',en:'Replace'})}} />; }
