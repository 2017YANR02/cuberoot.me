'use client';

// 重复日程的作用域三选一(改 / 删都用它)。Google 的原话是「此活动 / 此活动及后续活动 /
// 所有活动」,我们照抄语义 —— 用户在别处已经建立了这套心智,别自创说法。

import { useState } from 'react';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import type { EditScope } from '@cuberoot/shared/calendar';

interface Props {
  mode: 'edit' | 'delete';
  onPick: (scope: EditScope) => void;
  onClose: () => void;
}

export default function ScopePrompt({ mode, onPick, onClose }: Props) {
  const [scope, setScope] = useState<EditScope>('this');
  useModalDismiss(onClose);

  const options: { value: EditScope; label: string }[] = [
    { value: 'this', label: tr({ zh: '此日程', en: 'This event' }) },
    { value: 'following', label: tr({ zh: '此日程及后续日程', en: 'This and following events' }) },
    { value: 'all', label: tr({ zh: '所有日程', en: 'All events' }) },
  ];

  return (
    <div
      className="cal-modal-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cal-modal is-narrow" role="dialog" aria-modal="true">
        <div className="cal-modal-head">
          <h2>{mode === 'delete' ? tr({ zh: '删除重复日程', en: 'Delete recurring event' }) : tr({ zh: '编辑重复日程', en: 'Edit recurring event' })}</h2>
        </div>
        <div className="cal-modal-body">
          <ul className="cal-scope-list">
            {options.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`cal-scope-opt${scope === o.value ? ' is-on' : ''}`}
                  aria-pressed={scope === o.value}
                  onClick={() => setScope(o.value)}
                >
                  <span className="cal-scope-dot" aria-hidden />
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="cal-modal-foot">
          <span className="cal-foot-gap" />
          <button type="button" className="cal-btn" onClick={onClose}>{tr({ zh: '取消', en: 'Cancel' })}</button>
          <button type="button" className="cal-btn is-primary" onClick={() => onPick(scope)}>
            {tr({ zh: '确定', en: 'OK' })}
          </button>
        </div>
      </div>
    </div>
  );
}
