'use client';

/**
 * 「复用以前的填写」选择器 — YouTube「重用以前视频的详细信息」式弹窗。
 * 列出本人提交 / 复盘过的复盘,带视频缩略图 + 标题,搜索过滤,点一条把元数据回填表单。
 * 数据走公开 GET(listPersonRecons / getRecon,无需鉴权);点选时再 getRecon 取全字段,
 * 保证 cube / city / group_id 等列表精简列没带的字段也能完整复用。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, Film } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { listPersonRecons, getRecon } from '@/lib/recon-api';
import { EventIcon } from '@/components/EventIcon';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import { localizeCompName } from '@/lib/comp-localize';
import { displayCuberName } from '@/lib/name-utils';
import { formatRound, formatTime, padReconSingle } from '@/lib/recon-utils';
import { tr } from '@/i18n/tr';

interface Props {
  wcaId: string;
  isZh: boolean;
  onClose: () => void;
  onPick: (solve: Partial<ReconSolve>) => void;
}

/** 从 videoUrl(可能多行)取第一条 YouTube 的缩略图;非 YouTube 返 null(用项目图标兜底)。 */
function ytThumb(videoUrl?: string): string | null {
  if (!videoUrl) return null;
  const first = videoUrl.split('\n').map(s => s.trim()).find(Boolean) || '';
  const m = first.match(/youtu\.?be(?:\.com)?\/(?:watch\?.*v=|embed\/|shorts\/|live\/|v\/|)([A-Za-z0-9_-]{6,})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

const PAGE = 60;

export default function ReconReuseModal({ wcaId, isZh, onClose, onPick }: Props) {
  const [all, setAll] = useState<ReconSolve[] | null>(null);
  const [q, setQ] = useState('');
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [count, setCount] = useState(PAGE);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => {
    if (!wcaId) { setAll([]); return; }
    let alive = true;
    listPersonRecons(wcaId).then(rows => {
      if (!alive) return;
      // 本人作为复盘者 / 添加者提交的优先(像 YouTube 复用「自己的」视频);为空再退回全部参与。
      const mine = rows.filter(s => s.reconerId === wcaId || s.addedById === wcaId);
      const list = [...(mine.length ? mine : rows)].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
      setAll(list);
    }).catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, [wcaId]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter(r => {
      const hay = [r.caption, r.comp, r.event, r.person, ...(r.coPersons?.map(c => c.name) ?? [])]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [all, q]);

  // 搜索词变化 / 列表加载完重置分页;无限滚动每次 +PAGE,避免一次性渲染上千张卡。
  useEffect(() => { setCount(PAGE); }, [q, all]);
  const shown = filtered.slice(0, count);
  const hasMore = filtered.length > count;
  const sentinelRef = useCallback((el: HTMLLIElement | null) => {
    if (!el) return;
    const ob = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setCount(c => c + PAGE);
    }, { rootMargin: '300px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const handlePick = async (r: ReconSolve) => {
    if (pickingId != null) return;
    setPickingId(r.id ?? -1);
    try {
      const full = r.id != null ? await getRecon(r.id) : r;
      onPick(full);
    } catch {
      onPick(r); // getRecon 失败:退回列表项(精简字段也够回填大半)
    }
  };

  return (
    <div
      className="rr-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rr-modal">
        <div className="rr-head">
          <h2 className="rr-title">{tr({ zh: '复用以前的填写', en: 'Reuse a previous entry'
        })}</h2>
          <button type="button" className="rr-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close'
        })}>
            <X size={18} />
          </button>
        </div>

        <div className="rr-search">
          <Search size={16} />
          <input
            className="rr-search-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={tr({ zh: '搜索你的复盘', en: 'Search your reconstructions'
            })}
            autoFocus
          />
        </div>

        <div className="rr-body">
          {all == null ? (
            <div className="rr-state"><Loader2 size={18} className="rr-spin" /> {tr({ zh: '加载中…', en: 'Loading…'
            })}</div>
          ) : filtered.length === 0 ? (
            <div className="rr-state">
              {q.trim()
                ? tr({ zh: '没有匹配的复盘', en: 'No matching reconstructions'
                })
                : tr({ zh: '还没有可复用的复盘', en: 'No previous reconstructions yet'
                })}
            </div>
          ) : (
            <ul className="rr-grid">
              {shown.map(r => {
                const thumb = ytThumb(r.videoUrl);
                // 单次:复盘列表的主标识(value 优先,否则用 rawTime 格式化;都没有才省略)
                const single = padReconSingle(r.value) || (r.rawTime != null ? formatTime(r.rawTime) : '');
                const compName = r.comp ? localizeCompName(r.compWcaId ?? '', r.comp, isZh) : '';
                const title = r.caption?.trim()
                  || compName
                  || (r.event ? eventDisplayName(r.event, isZh) : tr({ zh: '复盘', en: 'Reconstruction'
                }));
                const picking = pickingId === (r.id ?? -1);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="rr-card"
                      onClick={() => handlePick(r)}
                      disabled={pickingId != null}
                    >
                      <div className="rr-thumb">
                        {thumb ? (
                          <img src={thumb} alt="" loading="lazy" />
                        ) : (
                          <div className="rr-thumb-fallback">
                            {r.event && isWcaEvent(r.event) ? <EventIcon event={r.event} /> : <Film size={28} />}
                          </div>
                        )}
                        {single && <span className="rr-thumb-time">{single}</span>}
                        {picking && <div className="rr-thumb-busy"><Loader2 size={20} className="rr-spin" /></div>}
                      </div>
                      <div className="rr-info">
                        <div className="rr-card-title">{title}</div>
                        <div className="rr-card-meta">
                          {r.event && isWcaEvent(r.event)
                            ? <EventIcon event={r.event} title={eventDisplayName(r.event, isZh)} />
                            : (r.event ? <span>{r.event}</span> : null)}
                          {compName && title !== compName && <span className="rr-card-comp">{compName}</span>}
                          {r.round && <span>{formatRound(r.round, r.solveNum)}</span>}
                          {r.date && <span>{String(r.date).slice(0, 10)}</span>}
                        </div>
                        {r.person && (
                          <div className="rr-card-person">
                            {displayCuberName(r.person, isZh)}
                            {r.coPersons?.length ? ` +${r.coPersons.length}` : ''}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
              {hasMore && <li className="rr-sentinel" ref={sentinelRef} aria-hidden="true" />}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
