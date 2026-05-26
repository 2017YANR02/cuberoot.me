'use client';

/**
 * SessionManagerModal — list of events with solve counts. Lets the user switch
 * the active event or clear an event's history.
 */

import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { EventId } from '../timer-db';
import { EVENTS, clearEvent, loadSolves } from '../timer-db';

interface Props {
  isZh: boolean;
  currentEvent: EventId;
  onPickEvent: (e: EventId) => void;
  onClose: () => void;
}

export default function SessionManagerModal({ isZh, currentEvent, onPickEvent, onClose }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ver, setVer] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const e of EVENTS) {
        try {
          const list = await loadSolves(e.id);
          next[e.id] = list.length;
        } catch { next[e.id] = 0; }
      }
      if (!cancelled) setCounts(next);
    })();
    return () => { cancelled = true; };
  }, [ver]);

  const handleClear = async (id: EventId) => {
    if (!window.confirm(t(`清空 ${id} 的所有成绩?`, `Clear all solves for ${id}?`))) return;
    await clearEvent(id);
    setVer((v) => v + 1);
  };

  return (
    <div className="tmr-modal-backdrop" onClick={onClose}>
      <div className="tmr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tmr-modal-head">
          <h3>{t('会话 / 项目管理', 'Sessions')}</h3>
          <button type="button" className="tmr-icon-btn" onClick={onClose} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>

        <div className="tmr-session-list">
          {EVENTS.map((e) => {
            const active = e.id === currentEvent;
            return (
              <div key={e.id} className={`tmr-session-row${active ? ' active' : ''}`}>
                <button
                  type="button"
                  className="tmr-session-pick"
                  onClick={() => { onPickEvent(e.id); onClose(); }}
                >
                  <span className="tmr-session-name">{isZh ? e.nameZh : e.nameEn}</span>
                  <span className="tmr-session-count">{counts[e.id] ?? 0}</span>
                </button>
                <button
                  type="button"
                  className="tmr-icon-btn"
                  onClick={() => void handleClear(e.id)}
                  aria-label={t('清空', 'Clear')}
                  title={t('清空', 'Clear')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="tmr-modal-foot">
          <button type="button" className="tmr-action-btn" onClick={onClose}>{t('完成', 'Done')}</button>
        </div>
      </div>
    </div>
  );
}
