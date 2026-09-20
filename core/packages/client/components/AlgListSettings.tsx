'use client';

import { useCallback, useSyncExternalStore } from 'react';
import AlgViewModeToggle, { type AlgViewMode } from '@/components/AlgViewModeToggle';
import BoolToggle from '@/components/BoolToggle';
import { SettingsPopover } from '@/components/TrainingSettings';
import { tr } from '@/i18n/tr';
import { persistItem } from '@/lib/safe-storage';

const ALG_CASE_NUMBERS_KEY = 'alg-show-case-numbers';

let currentShowCaseNumbers: boolean | null = null;
const numberListeners = new Set<() => void>();

function emitNumberChange() {
  for (const listener of numberListeners) listener();
}

function subscribeToNumberChange(listener: () => void): () => void {
  numberListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== ALG_CASE_NUMBERS_KEY) return;
    currentShowCaseNumbers = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    numberListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getNumberSnapshot(): boolean {
  if (currentShowCaseNumbers === null) {
    try {
      currentShowCaseNumbers = localStorage.getItem(ALG_CASE_NUMBERS_KEY) === 'true';
    } catch {
      currentShowCaseNumbers = false;
    }
  }
  return currentShowCaseNumbers;
}

function getNumberServerSnapshot(): boolean {
  return false;
}

/** `/alg` 全站共用的 case 数字编号显示偏好，默认隐藏。 */
export function useAlgCaseNumberVisibility(): [boolean, (show: boolean) => void] {
  const show = useSyncExternalStore(subscribeToNumberChange, getNumberSnapshot, getNumberServerSnapshot);
  const setShow = useCallback((next: boolean) => {
    currentShowCaseNumbers = next;
    persistItem(ALG_CASE_NUMBERS_KEY, String(next));
    emitNumberChange();
  }, []);
  return [show, setShow];
}

interface AlgListSettingsProps {
  view: AlgViewMode;
  onViewChange: (next: AlgViewMode) => void;
  showCaseNumbers: boolean;
  onShowCaseNumbersChange: (show: boolean) => void;
  showViewMode?: boolean;
  className?: string;
}

/** `/alg` case 列表页的统一设置入口。 */
export default function AlgListSettings({
  view,
  onViewChange,
  showCaseNumbers,
  onShowCaseNumbersChange,
  showViewMode = true,
  className,
}: AlgListSettingsProps) {
  return (
    <SettingsPopover
      label={tr({ zh: '公式列表设置', en: 'Algorithm list settings' })}
      className={`alg-list-settings${className ? ` ${className}` : ''}`}
    >
      {showViewMode && (
        <span className="alg-list-settings-row">
          <span className="alg-list-settings-label">{tr({ zh: '列表内容', en: 'List content' })}</span>
          <AlgViewModeToggle value={view} onChange={onViewChange} />
        </span>
      )}
      <BoolToggle
        value={showCaseNumbers}
        onChange={onShowCaseNumbersChange}
        label={tr({ zh: '数字编号', en: 'Numeric IDs' })}
      />
    </SettingsPopover>
  );
}
