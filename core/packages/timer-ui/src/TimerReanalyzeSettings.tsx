'use client';
import { useRef, useState } from 'react';
import { timerSettingFieldContract } from '@cuberoot/shared/timer';

export function TimerReanalyzeSettings({ language, run, disabled = false }: {
  language: 'en' | 'zh';
  run(): Promise<{ scanned: number; updated: number }>;
  disabled?: boolean;
}) {
  const tr = <T,>(text: { en: T; zh: T }) => text[language];
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const reanalyze = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const result = await run();
      setMessage(tr({ en: `Scanned ${result.scanned} solves; updated ${result.updated}.`, zh: `已检查 ${result.scanned} 条成绩，更新 ${result.updated} 条。` }));
    } catch { setMessage(tr({ en: 'Reanalyze failed', zh: '重算失败' })); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="settings-row" data-setting-id="settings.data.reanalyze">
    <span className="settings-row-label">{tr(timerSettingFieldContract('settings.data.reanalyze').copy)}</span>
    <span className="settings-row-control"><button className="hint-btn" type="button" disabled={disabled || busy} onClick={() => void reanalyze()} aria-busy={busy}>
      {busy ? tr({ en: 'Working…', zh: '处理中…' }) : tr({ en: 'Reanalyze', zh: '重新分析' })}
    </button>{message && <span className="hint" role="status">{message}</span>}</span>
  </div>;
}

export const TIMER_REANALYZE_SETTING_FIELD_IDS = [
  "settings.data.reanalyze"
] as const;
