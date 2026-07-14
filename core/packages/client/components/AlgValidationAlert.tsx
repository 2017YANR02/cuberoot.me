'use client';

/**
 * 个人页给**管理员**的公式校验汇总 —— 全库哪些公式过不了校验,点一下直接跳到那张 case 卡。
 *
 * 只有管理员看得见(别人看不到、也不跑)。扫描是纯客户端的(cubing.js),全库 ≈ 1.6 万条、
 * 数秒 —— 所以结果进 sessionStorage,同一次会话里再进这页不重扫;要最新的按「重扫」。
 *
 * 跳转走 `algCaseHref()` 的 `#case-<id>` 深链:AlgCategoryView 接住它,把折叠的组展开、
 * 滚过去、闪一下。真 `<a>`(AppLink),中键能新开。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, ChevronRight } from 'lucide-react';
import AppLink from '@/components/AppLink';
import { useIsAdmin } from '@/lib/auth-store';
import { scanAll, type AlgFailure } from '@/lib/alg_validation_scan';
import { algCaseHref } from '@/lib/alg_case_link';
import { tr } from '@/i18n/tr';
import './alg-validation-alert.css';

const CACHE_KEY = 'alg-validation-report-v1';

/** 缓存只存**能跳过去**的最小信息 —— AlgCase 整个塞进 sessionStorage 太胖。 */
interface CachedFailure {
  puzzle: string;
  set: string;
  caseId: number | null;
  caseName: string;
  subgroup: string;
  alg: string;
  reason: string;
}

const toCached = (f: AlgFailure): CachedFailure => ({
  puzzle: f.puzzle,
  set: f.set,
  caseId: f.caseObj.id ?? null,
  caseName: f.caseObj.name,
  subgroup: f.caseObj.subgroup ?? '',
  alg: f.alg,
  reason: f.reason,
});

function readCache(): CachedFailure[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedFailure[]) : null;
  } catch { return null; }
}

export default function AlgValidationAlert() {
  const isAdmin = useIsAdmin();
  const [items, setItems] = useState<CachedFailure[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [open, setOpen] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const found = await scanAll({ onProgress: (done, total) => setProgress({ done, total }) });
      const cached = found.map(toCached);
      setItems(cached);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch { /* 配额满了不算错 */ }
    } catch (e) {
      console.warn('[alg] 全库校验失败', e);
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const cached = readCache();
    if (cached) { setItems(cached); return; }
    void run();
  }, [isAdmin, run]);

  /** 按 set 归堆 —— 一次坏一整个 set 是常态(抓取事故),平铺 500 行没法看 */
  const bySet = useMemo(() => {
    const m = new Map<string, CachedFailure[]>();
    for (const f of items ?? []) {
      const k = `${f.puzzle}/${f.set}`;
      const arr = m.get(k) ?? [];
      arr.push(f);
      m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [items]);

  if (!isAdmin) return null;

  const total = items?.length ?? 0;
  const clean = items !== null && total === 0;

  return (
    <section className="ava-section">
      <h2 className="ava-head">
        {clean
          ? <ShieldCheck size={15} className="ava-icon ava-icon-ok" />
          : <ShieldAlert size={15} className="ava-icon ava-icon-bad" />}
        <span>{tr({ zh: '公式校验', en: 'Alg validation' })}</span>
        {items !== null && (
          <span className={`ava-count${clean ? ' is-ok' : ''}`}>
            {clean
              ? tr({ zh: '全部通过', en: 'All passed' })
              : tr({ zh: `${total} 条不通过`, en: `${total} failing` })}
          </span>
        )}
        <button
          type="button"
          className="ava-rescan"
          onClick={() => void run()}
          disabled={running}
          title={tr({ zh: '重扫全库', en: 'Re-scan all sets' })}
        >
          <RefreshCw size={13} className={running ? 'ava-spin' : undefined} />
        </button>
      </h2>

      {running && (
        <div className="ava-progress">
          {tr({ zh: '校验中', en: 'Validating' })} {progress.done} / {progress.total}
        </div>
      )}

      {!running && items !== null && total > 0 && (
        <>
          <button type="button" className="ava-toggle" onClick={() => setOpen(o => !o)}>
            {open ? tr({ zh: '收起', en: 'Hide' }) : tr({ zh: '查看明细', en: 'Show details' })}
          </button>
          {open && (
            <ul className="ava-list">
              {bySet.map(([key, fails]) => (
                <li key={key} className="ava-set">
                  <div className="ava-set-head">
                    <span className="ava-set-name">{key}</span>
                    <span className="ava-set-count">{fails.length}</span>
                  </div>
                  <ul className="ava-rows">
                    {fails.map((f, i) => (
                      <li key={`${f.caseId}-${i}`}>
                        <AppLink
                          href={algCaseHref(f.puzzle, f.set, { id: f.caseId, name: f.caseName, subgroup: f.subgroup })}
                          className="ava-row"
                          prefetch={false}
                        >
                          <span className="ava-row-case">{f.caseName}</span>
                          <code className="ava-row-alg">{f.alg}</code>
                          <span className="ava-row-reason">{f.reason}</span>
                          <ChevronRight size={13} className="ava-row-chev" />
                        </AppLink>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
