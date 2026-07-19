'use client';

/**
 * 「从已有打乱选择」弹窗 — 给 submit 表单的两个打乱框（WCA / 最优）做候选。
 * 数据走公开 GET listRecons()（整个复盘库），按归一化打乱字符串去重，
 * 每条带项目 / 选手 / 比赛 / 成绩上下文,点选回填字段。挑别人录过的同一打乱,
 * 新复盘就能和旧的在「相同打乱的复盘」里互相连上。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { listRecons } from '@/lib/recon-api';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import { localizeCompName } from '@/lib/comp-localize';
import { displayCuberName } from '@/lib/cuber-name-display';
import { formatTime } from '@/lib/recon-utils';
import { tr } from '@/i18n/tr';

interface Props {
  isZh: boolean;
  event?: string;              // 当前表单项目:同项目候选排前
  onClose: () => void;
  onPick: (scramble: string) => void;
}

const PAGE = 60;

// 与详情页 SameScrambleNav 的归一化保持一致(去首尾 + 折叠空白,大小写敏感)。
function normScramble(s?: string): string {
  return (s || '').trim().replace(/\s+/g, ' ');
}

interface ScrambleEntry {
  scramble: string;            // 归一化后的打乱
  sample: ReconSolve;          // 代表条(最新一条)给上下文
  count: number;               // 用此打乱的复盘条数
}

export default function ScramblePicker({ isZh, event, onClose, onPick }: Props) {
  const [all, setAll] = useState<ReconSolve[] | null>(null);
  const [q, setQ] = useState('');
  const [count, setCount] = useState(PAGE);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    listRecons().then(rows => { if (alive) setAll(rows); }).catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  // 按归一化打乱聚合去重,保留最新一条作代表 + 计数。
  const entries = useMemo<ScrambleEntry[]>(() => {
    if (!all) return [];
    const map = new Map<string, ScrambleEntry>();
    for (const r of all) {
      const sc = normScramble(r.optimalScramble);
      if (!sc) continue;
      const cur = map.get(sc);
      if (cur) {
        cur.count++;
        if ((r.id ?? 0) > (cur.sample.id ?? 0)) cur.sample = r;
      } else {
        map.set(sc, { scramble: sc, sample: r, count: 1 });
      }
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      const ae = a.sample.event === event ? 0 : 1;
      const be = b.sample.event === event ? 0 : 1;
      if (ae !== be) return ae - be;          // 同项目优先
      return (b.sample.id ?? 0) - (a.sample.id ?? 0);  // 再按新近度
    });
    return list;
  }, [all, event]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter(e => {
      const r = e.sample;
      const hay = [e.scramble, r.comp, r.event, r.person].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [entries, q]);

  useEffect(() => { setCount(PAGE); }, [q, entries]);
  const shown = filtered.slice(0, count);
  const hasMore = filtered.length > count;
  const sentinelRef = useCallback((el: HTMLLIElement | null) => {
    if (!el) return;
    const ob = new IntersectionObserver(es => {
      if (es[0].isIntersecting) setCount(c => c + PAGE);
    }, { rootMargin: '300px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  return (
    <div
      className="rr-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rr-modal">
        <div className="rr-head">
          <h2 className="rr-title">{tr({ zh: '从已有打乱选择', en: 'Pick an existing scramble' })}</h2>
          <button type="button" className="rr-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
            <X size={18} />
          </button>
        </div>

        <div className="rr-search">
          <Search size={16} />
          <input
            className="rr-search-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={tr({ zh: '搜索打乱 / 选手 / 比赛', en: 'Search scramble / cuber / comp' })}
            autoFocus
          />
        </div>

        <div className="rr-body">
          {all == null ? (
            <div className="rr-state"><Loader2 size={18} className="rr-spin" /> {tr({ zh: '加载中…', en: 'Loading…' })}</div>
          ) : filtered.length === 0 ? (
            <div className="rr-state">
              {q.trim()
                ? tr({ zh: '没有匹配的打乱', en: 'No matching scramble' })
                : tr({ zh: '复盘库里还没有打乱', en: 'No scrambles in the library yet' })}
            </div>
          ) : (
            <ul className="sp-list">
              {shown.map(e => {
                const r = e.sample;
                const compName = r.comp ? localizeCompName(r.compWcaId ?? '', r.comp, isZh) : '';
                const time = r.rawTime != null ? formatTime(r.rawTime) : (r.value || '').trim();
                return (
                  <li key={e.scramble}>
                    <button type="button" className="sp-row" onClick={() => onPick(e.scramble)}>
                      <span className="sp-scramble">{e.scramble}</span>
                      <span className="sp-meta">
                        {r.event && isWcaEvent(r.event) && <EventIcon event={r.event} title={eventDisplayName(r.event, isZh)} />}
                        {r.person && <span className="sp-person">{displayCuberName(r.person, isZh)}</span>}
                        {compName && <span className="sp-comp">{compName}</span>}
                        {time && <span className="sp-time">{time}</span>}
                        {e.count > 1 && <span className="sp-count">{tr({ zh: `${e.count} 条`, en: `×${e.count}` })}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {hasMore && <li className="sp-sentinel" ref={sentinelRef} aria-hidden="true" />}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
