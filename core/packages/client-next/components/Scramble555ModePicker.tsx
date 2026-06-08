'use client';

/**
 * 5x5 打乱模式 toggle:随机状态 ↔ 随机转动。只在用户选中 5x5 时显示;
 * localStorage 持久。默认 random-move(WCA 60 步,cubing.js)。
 */
import { use555Mode } from '@/lib/scramble-555-mode';
import ScrambleModePickerRow from './ScrambleModePickerRow';
import i18n from "@/i18n/i18n-client";

interface Props {
  active555: boolean;
  isZh: boolean;
}

export default function Scramble555ModePicker({ active555, isZh }: Props) {
  const [mode, setMode] = use555Mode();
  if (!active555) return null;
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  return (
    <ScrambleModePickerRow
      label={t('5x5 打乱', '5x5 scramble', "5x5 打亂")}
      value={mode === 'rs'}
      onChange={(v) => setMode(v ? 'rs' : 'rm')}
      onLabel={t('随机状态', 'random-state', "隨機狀態")}
      offLabel={t('随机转动', 'random-move', "隨機轉動")}
      ariaLabel={t('5x5 打乱类型', '5x5 scramble type', "5x5 打亂型別")}
      helpHref="/scramble/555-about"
      helpTitle={t('什么是随机状态 / 随机转动?', "What's random-state vs random-move?", "什麼是隨機狀態 / 隨機轉動?")}
      helpAriaLabel={t('查看 5x5 打乱方法说明', 'About 5x5 scramble methods', "檢視 5x5 打亂方法說明")}
    />
  );
}
