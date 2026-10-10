'use client';
import { useEffect, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useTrainerStore, TimerState } from '@/lib/trainer-store';
import { doubleZbllOfflineReady, installDoubleZbllOffline } from '@/lib/double-zbll';

/** Compact offline download action next to the scramble selector. */
export default function DoubleZbllOptions() {
  const timerState = useTrainerStore(s => s.timerState);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; void doubleZbllOfflineReady().then(ready => { if (active) setOffline(ready); }); return () => { active = false; }; }, []);
  const download = async () => {
    setBusy(true); setError(false);
    try { await installDoubleZbllOffline((done, total) => setProgress(`${done} / ${total}`)); setOffline(true); }
    catch { setError(true); }
    finally { setBusy(false); setProgress(''); }
  };
  const label = busy ? (progress || tr({ zh: '正在加载…', en: 'Loading…' }))
    : offline ? tr({ zh: '已可离线使用', en: 'Available offline' }) : tr({ zh: '保存供离线使用', en: 'Save for offline use' });
  return (
    <>
      <button type="button" className="trainer-quick-btn" title={label} aria-label={label}
        onClick={() => void download()} disabled={busy || timerState !== TimerState.NOT_RUNNING}>
        {busy ? label : offline ? <Check size={15} aria-hidden /> : <Download size={15} aria-hidden />}
      </button>
      {error && <span role="alert">{tr({ zh: '保存失败，请重试', en: 'Save failed. Retry.' })}</span>}
    </>
  );
}
