'use client';
import { useEffect, useState } from 'react';
import { Check, Download, Layers2 } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import { useTrainerStore, TimerState } from '@/lib/trainer-store';
import { loadDoubleZbll, doubleZbllOfflineReady, installDoubleZbllOffline } from '@/lib/double-zbll';

/** This trainer's opt-in download and mode control. */
export default function DoubleZbllOptions({ incompatible }: { incompatible: boolean }) {
  const enabled = useTrainerStore(s => s.doubleZbll);
  const setEnabled = useTrainerStore(s => s.setDoubleZbll);
  const timerState = useTrainerStore(s => s.timerState);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; void doubleZbllOfflineReady().then(ready => { if (active) setOffline(ready); }); return () => { active = false; }; }, []);
  const toggle = async (value: boolean) => {
    if (!value) { setEnabled(false); return; }
    setBusy(true); setError(false);
    try { await loadDoubleZbll(); setEnabled(true); } catch { setError(true); }
    finally { setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setError(false);
    try { await installDoubleZbllOffline((done, total) => setProgress(`${done} / ${total}`)); setOffline(true); }
    catch { setError(true); }
    finally { setBusy(false); setProgress(''); }
  };
  return (
    <section className="trainer-double-options" aria-label={tr({ zh: '双底 ZBLL', en: 'Double ZBLL' })}>
      <div className="trainer-double-heading"><Layers2 size={18} aria-hidden /><span>ZBLL × 2</span><span className="trainer-double-metric">{tr({ zh: '最优 HTM', en: 'Optimal HTM' })}</span></div>
      <BoolToggle className="trainer-double-toggle" value={enabled} onChange={value => void toggle(value)}
        label={tr({ zh: '双底', en: 'Double ZBLL' })} disabled={busy || incompatible || timerState !== TimerState.NOT_RUNNING} />
      <p>{tr({ zh: '一次打乱，顶底各练一个。先解顶层，翻转后再解另一层。', en: 'One scramble, two cases. Solve the top, flip the cube, then solve the other layer.' })}</p>
      <div className="trainer-double-offline">
        <button type="button" className="trainer-quick-btn" onClick={() => void download()} disabled={busy || timerState !== TimerState.NOT_RUNNING}>
          {offline ? <Check size={15} /> : <Download size={15} />}
          {busy ? (progress || tr({ zh: '正在加载…', en: 'Loading…' })) : offline ? tr({ zh: '已下载 · 离线可用', en: 'Downloaded · available offline' }) : tr({ zh: '下载离线包', en: 'Download for offline use' })}
        </button>
        <span>{tr({ zh: '222,784 组 · 打乱约 4.7 MB', en: '222,784 pairs · 4.7 MB of scrambles' })}</span>
      </div>
      {enabled && <p>{tr({ zh: '两层都从已选情况中出题。覆盖模式每次练两个，奇数末项重复一次。朝向随题库固定，整颗打乱均为全局最短。', en: 'Both layers use your selection. Coverage pairs consecutive cases and repeats the last case for odd selections. Each pair has fixed orientations and a globally shortest scramble.' })}</p>}
      {incompatible && <p>{tr({ zh: '双底用于单机训练；请先退出记忆、分屏或房间模式。', en: 'Double ZBLL uses local training. Exit memory, split-screen or room mode first.' })}</p>}
      {error && <p role="alert">{tr({ zh: '下载未完成。请联网后重试；已有离线数据会保留。', en: 'Download incomplete. Reconnect and retry; existing offline data is retained.' })}</p>}
    </section>
  );
}
