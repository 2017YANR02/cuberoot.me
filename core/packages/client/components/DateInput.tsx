'use client';

import {
  DateInput as SharedDateInput,
  type DateInputLabels,
  type DateInputProps as SharedDateInputProps,
} from '@cuberoot/timer-ui';

import { tr } from '@/i18n/tr';

const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export interface DateInputProps extends Omit<SharedDateInputProps, 'labels'> {}

export function webDateInputLabels(): DateInputLabels {
  return {
    clearDate: tr({ zh: '清除日期', en: 'Clear date' }),
    chooseDate: tr({ zh: '选择日期', en: 'Choose date' }),
    previousMonth: tr({ zh: '上个月', en: 'Previous month' }),
    nextMonth: tr({ zh: '下个月', en: 'Next month' }),
    year: tr({ zh: '年份', en: 'Year' }),
    month: tr({ zh: '月份', en: 'Month' }),
    monthOption: (month) => tr({ zh: `${month}月`, en: EN_MONTHS[month - 1] }),
    weekdays: [
      tr({ zh: '一', en: 'Mon' }),
      tr({ zh: '二', en: 'Tue' }),
      tr({ zh: '三', en: 'Wed' }),
      tr({ zh: '四', en: 'Thu' }),
      tr({ zh: '五', en: 'Fri' }),
      tr({ zh: '六', en: 'Sat' }),
      tr({ zh: '日', en: 'Sun' }),
    ],
    today: tr({ zh: '今天', en: 'Today' }),
    calendarDate: (year, month, day) => tr({
      zh: `${year}年${month}月${day}日`,
      en: `${EN_MONTHS[month - 1]} ${day}, ${year}`,
    }),
  };
}

export function DateInput(props: DateInputProps) {
  return <SharedDateInput {...props} labels={webDateInputLabels()} />;
}
