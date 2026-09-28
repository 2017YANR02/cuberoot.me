'use client';
import { useTranslation } from 'react-i18next';
import SharedTimerFontPicker from '@cuberoot/timer-ui/font-picker';
import type { ComponentProps } from 'react';
export type { TimerFontOptionId } from '@cuberoot/timer-ui/font-picker';
export default function TimerFontPicker(props: ComponentProps<typeof SharedTimerFontPicker>) {
  const { i18n } = useTranslation();
  return <SharedTimerFontPicker {...props} language={i18n.language === 'zh' ? 'zh' : 'en'} />;
}