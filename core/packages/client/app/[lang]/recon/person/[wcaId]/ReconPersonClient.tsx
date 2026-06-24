'use client';

/**
 * /recon/person/[wcaId] — 个人复盘主页。
 * 汇总某选手参与的全部 recon:作为选手 / 合作者 / 复盘者 / 添加者,角色 tab 过滤。
 * 数据走 GET /v1/recon/person/:wcaId(含 addedBy/addedById,LIST_COLUMNS 没有)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LogOut, TriangleAlert } from 'lucide-react';
import type { ReconSolve } from '@cuberoot/shared';
import { listPersonRecons } from '@/lib/recon-api';
import {
  formatTime, formatAvg, formatRound,
} from '@/lib/recon-utils';
import { compLinkProps } from '@/lib/comp-link';
import { displayCuberName } from '@/lib/cuber-name-display';
import { loadFlagData, flagDataVersion, personFlagIso2 } from '@/lib/country-flags';
import { Flag } from '@/components/Flag';
import { localizeCompName } from '@/lib/comp-localize';
import { reconPathSeg } from '@/lib/recon-seo';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { RecordBadge } from '@/components/RecordBadge';
import { EventIcon } from '@/components/EventIcon';
import { ListSelect, type ListSelectItem } from '@/components/ListSelect';
import { isWcaEvent, eventDisplayName } from '@/lib/wca-events';
import { useAuthStore } from '@/lib/auth-store';
import '../../recon.css';
import './recon-person.css';
import { tr } from '@/i18n/tr';

type Role = 'all' | 'solver' | 'reconer' | 'adder';

interface RoleFlags { solver: boolean; reconer: boolean; adder: boolean }

const PAGE_SIZE = 60;

export default function ReconPersonClient() {
  const params = useParams();
  const wcaId = String(params?.wcaId ?? '');
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const isSelf = !!user && user.wcaId === wcaId;

  const [solves, setSolves] = useState<ReconSolve[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('all');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // 异步 person-country 索引(复盘者/添加者只有 id 时反查旗帜)
  const [flagVer, setFlagVer] = useState(() => flagDataVersion());
  useEffect(() => {
    void loadFlagData().then(v => { if (v !== flagVer) setFlagVer(v); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!wcaId) return;
    let alive = true;
    setLoading(true);
    setDisplayCount(PAGE_SIZE);
    listPersonRecons(wcaId)
      .then(rows => { if (alive) { setSolves(rows); setError(null); } })
      .catch(e => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [wcaId]);

  const roleOf = useCallback((s: ReconSolve): RoleFlags => ({
    solver: s.personId === wcaId || (s.coPersons?.some(c => c.id === wcaId) ?? false),
    reconer: s.reconerId === wcaId,
    adder: s.addedById === wcaId,
  }), [wcaId]);

  const counts = useMemo(() => {
    let solver = 0, reconer = 0, adder = 0;
    for (const s of solves) {
      const r = roleOf(s);
      if (r.solver) solver++;
      if (r.reconer) reconer++;
      if (r.adder) adder++;
    }
    return { solver, reconer, adder, total: solves.length };
  }, [solves, roleOf]);

  const filtered = useMemo(() => {
    if (role === 'all') return solves;
    return solves.filter(s => roleOf(s)[role]);
  }, [solves, role, roleOf]);

  // 身份:名字 + 国籍——优先选手字段,退合作者 / 复盘者 / 添加者
  const identity = useMemo(() => {
    let name = '', country = '';
    for (const s of solves) {
      if (s.personId === wcaId) { name = s.person || name; country = s.personCountry || country; }
      if (name && country) break;
    }
    if (!name) {
      const co = solves.flatMap(s => s.coPersons ?? []).find(c => c.id === wcaId);
      if (co) { name = co.name; country = country || co.country || ''; }
    }
    if (!name) { const r = solves.find(s => s.reconerId === wcaId); if (r) name = r.reconer || ''; }
    if (!name) { const a = solves.find(s => s.addedById === wcaId); if (a) name = a.addedBy || ''; }
    if (!country) country = personFlagIso2(wcaId);
    return { name, country };
  }, [solves, wcaId, flagVer]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = identity.name ? displayCuberName(identity.name, isZh) : wcaId;
  useDocumentTitle(
    `${identity.name ? displayCuberName(identity.name, true) : wcaId} 的复盘`,
    `${identity.name ? displayCuberName(identity.name, false) : wcaId} · Reconstructions`,
  );

  // 自己的页面优先用登录头像
  const avatarUrl = isSelf ? user?.avatar : undefined;

  // ── 无限滚动 ──
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const ob = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setDisplayCount(c => c + PAGE_SIZE);
    }, { rootMargin: '300px' });
    ob.observe(el);
    observerRef.current = ob;
  }, []);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  const roleBadges = (r: RoleFlags) => {
    const out: { key: string; label: string }[] = [];
    if (r.solver) out.push({ key: 'solver', label: tr({ zh: '选手', en: 'Solver'
    }) });
    if (r.reconer) out.push({ key: 'reconer', label: tr({ zh: '复盘', en: 'Recon'
    }) });
    if (r.adder) out.push({ key: 'adder', label: tr({ zh: '添加', en: 'Added'
    }) });
    return out;
  };

  // 角色下拉项;暂无条目的角色置灰不可选(全部始终可选)。不显示计数(项目规范)。
  const roleItems: ListSelectItem[] = [
    { value: 'all', label: tr({ zh: '全部', en: 'All' }) },
    { value: 'solver', label: tr({ zh: '选手', en: 'Solver'
    }), disabled: counts.solver === 0 },
    { value: 'reconer', label: tr({ zh: '复盘者', en: 'Reconstructor'
    }), disabled: counts.reconer === 0 },
    { value: 'adder', label: tr({ zh: '添加者', en: 'Added by'
    }), disabled: counts.adder === 0 },
  ];

  return (
    <div className="recon-page">
      <div className="recon-person-header">
        <div className="recon-person-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt="" />
            : identity.country
              ? <Flag iso2={identity.country} className="recon-person-flag" />
              : <span className="recon-person-initial">{(displayName || '?').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="recon-person-id">
          <h1>
            <Link href={`/wca/persons/${wcaId}`} className="recon-person-name-link">{displayName}</Link>
          </h1>
          {avatarUrl && identity.country && (
            <div className="recon-person-meta">
              <Flag iso2={identity.country} className="recon-inline-flag" />
            </div>
          )}
          <div className="recon-person-stats">
            <span><b>{counts.solver}</b> {tr({ zh: '选手', en: 'solver'
            })}</span>
            <span><b>{counts.reconer}</b> {tr({ zh: '复盘', en: 'recon'
            })}</span>
            <span><b>{counts.adder}</b> {tr({ zh: '添加', en: 'added'
            })}</span>
          </div>
        </div>
        {isSelf && (
          <button type="button" className="recon-person-logout" onClick={() => logout()}>
            <LogOut size={14} /> {tr({ zh: '退出登录', en: 'Log out'
            })}
          </button>
        )}
      </div>

      <div className="recon-person-roles">
        <ListSelect
          items={roleItems}
          value={role}
          onChange={(v) => { setRole(v as Role); setDisplayCount(PAGE_SIZE); }}
          allLabel={tr({ zh: '全部', en: 'All' })}
          clearable={false}
          className="recon-person-role-select"
        />
      </div>

      {loading && <div className="recon-loading">{tr({ zh: '加载中…', en: 'Loading…'
    })}</div>}
      {error && <div className="recon-error"><TriangleAlert size={16} /> {error}</div>}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="recon-empty">
              <div>{tr({ zh: '暂无复盘记录', en: 'No reconstructions yet'
            })}</div>
            </div>
          ) : (
            <div className="recon-table-wrap">
              <table className="recon-table">
                <thead>
                  <tr>
                    <th className="col-event">{tr({ zh: '项目', en: 'Event'
                    })}</th>
                    <th className="col-solver">{tr({ zh: '选手', en: 'Solver'
                    })}</th>
                    <th className="col-dsingle">{tr({ zh: '单次', en: 'Single'
                    })}</th>
                    <th className="col-avg">{tr({ zh: '平均', en: 'Average' })}</th>
                    <th className="col-comp">{tr({ zh: '比赛', en: 'Competition'
                    })}</th>
                    <th className="col-date">{tr({ zh: '日期', en: 'Date' })}</th>
                    <th className="col-method">{tr({ zh: '方法', en: 'Method' })}</th>
                    <th className="col-role">{tr({ zh: '角色', en: 'Role' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((s) => {
                    const r = roleOf(s);
                    // 主选手 + 共同完成者(与列表 / 详情一致)
                    const cubers = [
                      { name: s.person || '', id: s.personId, country: s.personCountry },
                      ...(s.coPersons ?? []),
                    ].filter(c => c.name);
                    const compName = s.comp ? localizeCompName(s.compWcaId ?? '', s.comp, isZh) : '';
                    const compFlag = s.country ? <Flag iso2={s.country} className="recon-inline-flag" /> : null;
                    return (
                      <tr key={s.id}>
                        <td className="col-event">
                          {s.event
                            ? (isWcaEvent(s.event)
                              ? <EventIcon event={s.event} title={eventDisplayName(s.event, isZh)} />
                              : s.event)
                            : ''}
                        </td>
                        <td className="col-solver">
                          {cubers.map((c, i) => (
                            <span key={i}>
                              {i > 0 ? <span className="recon-cuber-sep"> &amp; </span> : null}
                              {c.country ? <><Flag iso2={c.country} className="recon-inline-flag" />{' '}</> : null}
                              {c.id
                                ? <Link href={`/recon/person/${c.id}`}>{displayCuberName(c.name, isZh)}</Link>
                                : displayCuberName(c.name, isZh)}
                            </span>
                          ))}
                        </td>
                        <td className="col-single">
                          <span className="record-num-cell">
                            {s.value || formatTime(s.rawTime)}
                            {s.regionalSingleRecord && (
                              <RecordBadge record={s.regionalSingleRecord} variant="inline" iso2={s.personCountry} />
                            )}
                          </span>
                        </td>
                        <td className="col-avg">
                          <span className="record-num-cell">
                            {formatAvg(s.average)}
                            {s.regionalAverageRecord && (
                              <RecordBadge record={s.regionalAverageRecord} variant="inline" iso2={s.personCountry} />
                            )}
                          </span>
                        </td>
                        <td className="col-comp">
                          {compFlag}{' '}
                          {s.compWcaId
                            ? <Link {...compLinkProps(s.compWcaId)} onClick={(e) => e.stopPropagation()}>{compName}</Link>
                            : compName}
                          {s.round ? <span className="recon-person-round"> {formatRound(s.round, s.solveNum)}</span> : null}
                        </td>
                        <td className="col-date">{s.date ? s.date.slice(0, 10) : ''}</td>
                        <td className="col-method">{s.method || ''}</td>
                        <td className="col-role">
                          <Link href={`/recon/${reconPathSeg(s)}`} className="recon-role-tags">
                            {roleBadges(r).map(b => (
                              <span key={b.key} className={`recon-role-tag recon-role-${b.key}`}>{b.label}</span>
                            ))}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
        </>
      )}
    </div>
  );
}
