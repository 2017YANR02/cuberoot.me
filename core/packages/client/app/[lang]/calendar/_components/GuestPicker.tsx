'use client';

// 嘉宾选择 —— 搜站内用户(昵称 / WCA id),选中的人以头像 chip 排在下面,可移除。
// 被邀请的人会在自己的 /calendar 里看到这条日程,并能接受 / 拒绝(状态回显在 chip 上)。

import { useEffect, useRef, useState } from 'react';
import { UserPlus, X, Check, Ban } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { searchPeople, type PersonHit } from '@/lib/calendar-api';
import { tr } from '@/i18n/tr';
import type { EventGuest } from '@cuberoot/shared/calendar';

interface Props {
  guests: EventGuest[];
  onChange: (next: EventGuest[]) => void;
  /** 自己的归属键,搜索结果里剔掉 */
  meKey: string;
  disabled?: boolean;
}

export default function GuestPicker({ guests, onChange, meKey, disabled }: Props) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    // 打字防抖 250ms:搜索走服务端 ILIKE,别每敲一个键就查一次。
    let alive = true;
    setBusy(true);
    const id = setTimeout(() => {
      searchPeople(term)
        .then((list) => { if (alive) setHits(list.filter((p) => p.key !== meKey)); })
        .catch(() => { if (alive) setHits([]); })
        .finally(() => { if (alive) setBusy(false); });
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [q, meKey]);

  const add = (p: PersonHit): void => {
    if (guests.some((g) => g.key === p.key)) return;
    onChange([...guests, { key: p.key, name: p.name, avatar: p.avatar, status: 'pending' }]);
    setQ('');
    setHits([]);
  };

  return (
    <div className="cal-guests" ref={boxRef}>
      <div className="cal-guest-input">
        <UserPlus size={15} aria-hidden />
        <input
          type="text"
          className="cal-guest-field"
          value={q}
          disabled={disabled}
          placeholder={tr({ zh: '搜昵称或 WCA ID 添加参与者', en: 'Add guests by name or WCA ID' })}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && <ClearButton onClick={() => { setQ(''); setHits([]); }} />}
      </div>

      {hits.length > 0 && (
        <ul className="cal-guest-hits">
          {hits.map((p) => (
            <li key={p.key}>
              <button type="button" className="cal-guest-hit" onClick={() => add(p)}>
                {p.avatar
                  ? <img src={p.avatar} alt="" className="cal-avatar" />
                  : <span className="cal-avatar is-blank" aria-hidden />}
                <span className="cal-guest-name">{p.name}</span>
                {p.wcaId && <span className="cal-guest-id">{p.wcaId}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {busy && hits.length === 0 && q.trim().length >= 2 && (
        <p className="cal-hint">{tr({ zh: '搜索中…', en: 'Searching…' })}</p>
      )}

      {guests.length > 0 && (
        <ul className="cal-guest-chips">
          {guests.map((g) => (
            <li key={g.key} className={`cal-guest-chip is-${g.status}`}>
              {g.avatar
                ? <img src={g.avatar} alt="" className="cal-avatar" />
                : <span className="cal-avatar is-blank" aria-hidden />}
              <span className="cal-guest-name">{g.name || g.key}</span>
              {g.status === 'accepted' && <Check size={13} aria-label={tr({ zh: '已接受', en: 'Accepted' })} />}
              {g.status === 'declined' && <Ban size={13} aria-label={tr({ zh: '已拒绝', en: 'Declined' })} />}
              {!disabled && (
                <button
                  type="button"
                  className="cal-guest-remove"
                  aria-label={tr({ zh: '移除', en: 'Remove' })}
                  onClick={() => onChange(guests.filter((x) => x.key !== g.key))}
                >
                  <X size={13} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
