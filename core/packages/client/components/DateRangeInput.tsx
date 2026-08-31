'use client';

import {
  DateRangeInput as SharedDateRangeInput,
  type DateRangeInputLabels,
  type DateRangeInputProps as SharedDateRangeInputProps,
} from '@cuberoot/timer-ui';

import { tr } from '@/i18n/tr';
import { webDateInputLabels } from '@/components/DateInput';

export interface DateRangeInputProps extends Omit<SharedDateRangeInputProps, 'labels'> {}

function webDateRangeInputLabels(): DateRangeInputLabels {
  return {
    dateInput: webDateInputLabels(),
    dateRange: tr({ zh: '日期范围', en: 'Date range' }),
    startDate: tr({ zh: '开始日期', en: 'Start date' }),
    endDate: tr({ zh: '结束日期', en: 'End date' }),
    clearDateRange: tr({ zh: '清除日期范围', en: 'Clear date range' }),
  };
}

export function DateRangeInput(props: DateRangeInputProps) {
  return <SharedDateRangeInput {...props} labels={webDateRangeInputLabels()} />;
}
