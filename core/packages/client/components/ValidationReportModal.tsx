'use client';

/**
 * 一次性扫描 alg DB 的「setup + alg = 目标态」校验报告 modal。
 *
 * 四种粒度,`/alg` 下每一层各用一个(入口统一走 `AlgAdminValidate`,
 * case 列表页则由 AlgCategoryView 自己挂 —— 它还要把改完的 case 写回已加载的 data):
 *   - `case`   单张 case 的详情页
 *   - `set`    set 首页 / 子组选择页 / case 列表页
 *   - `puzzle` `/alg/<puzzle>` 公式集网格
 *   - `all`    `/alg` 首页(全库)
 *
 * 扫描逻辑在 `lib/alg_validation_scan.ts`(卡片红框、个人页汇总共用同一份)。
 *
 * 失败项可点击,触发父组件打开对应 case 的 admin editor。
 * 父组件在 case saved 后递增 refreshKey,modal 重新校验(轻量 revalidate)。
 */
import { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play, ExternalLink } from 'lucide-react';
import { ALG_CATALOG, type AlgCase, type AlgPuzzle } from '@cuberoot/shared';
import { scanCases, scanTargets, allTargets, type AlgFailure } from '@/lib/alg_validation_scan';
import { tr } from '@/i18n/tr';

export type ValidationScope =
  | { kind: 'case'; puzzle: AlgPuzzle; set: string; caseObj: AlgCase }
  | { kind: 'set'; puzzle: AlgPuzzle; set: string }
  | { kind: 'puzzle'; puzzle: AlgPuzzle }
  | { kind: 'all' };

export type FailureItem = AlgFailure;

interface Props {
  scope: ValidationScope;
  onClose: () => void;
  onPickCase: (puzzle: AlgPuzzle, set: string, caseObj: AlgFailure['caseObj']) => void;
  /** 改变会触发重新校验(用于 case saved 后) */
  refreshKey?: number;
}

export default function ValidationReportModal({
  scope, onClose, onPickCase, refreshKey = 0,
}: Props) {
  useTranslation(); // subscribe to language changes; text via tr()
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<AlgFailure[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const targets = useMemo(() => {
    if (scope.kind === 'case' || scope.kind === 'set') return [{ puzzle: scope.puzzle, set: scope.set }];
    if (scope.kind === 'puzzle') {
      return (ALG_CATALOG[scope.puzzle] ?? []).map(s => ({ puzzle: scope.puzzle, set: s.slug }));
    }
    return allTargets();
  }, [scope]);

  const run = async () => {
    cancelRef.current = false;
    setRunning(true);
    setFailures([]);
    setError(null);
    try {
      // 单张 case:它就在手上了,别为一张卡再把整个 set 拉一遍(scanTargets 会 fresh 重拉)。
      if (scope.kind === 'case') {
        const total = scope.caseObj.algs.reduce((n, ori) => n + ori.length, 0);
        setProgress({ done: 0, total });
        const found = await scanCases(scope.puzzle, scope.set, [scope.caseObj], {
          shouldCancel: () => cancelRef.current,
        });
        if (cancelRef.current) return;
        setProgress({ done: total, total });
        setFailures(found);
        return;
      }
      const found = await scanTargets(targets, {
        onProgress: (done, total) => setProgress({ done, total }),
        shouldCancel: () => cancelRef.current,
      });
      if (cancelRef.current) return;
      setFailures(found);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (!cancelRef.current) setRunning(false);
    }
  };

  useEffect(() => {
    void run();
    return () => { cancelRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const title = (() => {
    if (scope.kind === 'case') {
      return tr({
        zh: `校验 ${scope.puzzle} / ${scope.set} ${scope.caseObj.name}`,
        en: `Validate ${scope.puzzle} / ${scope.set} ${scope.caseObj.name}`,
      });
    }
    if (scope.kind === 'set') {
      return tr({ zh: `校验 ${scope.puzzle} / ${scope.set}`, en: `Validate ${scope.puzzle} / ${scope.set}` });
    }
    if (scope.kind === 'puzzle') {
      return tr({ zh: `校验 ${scope.puzzle} 全部公式集`, en: `Validate all ${scope.puzzle} sets` });
    }
    return tr({ zh: '校验全库', en: 'Validate all sets' });
  })();

  return (
    <div className="alg-admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal alg-validation-modal" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>{title}</h2>
          <button type="button" className="alg-admin-modal-head-btn" onClick={onClose} title={tr({ zh: '关闭', en: 'Close' })}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-body alg-validation-body">
          {error && <div className="alg-admin-modal-error">{error}</div>}
          {running && (
            <div className="alg-validation-progress">
              {tr({ zh: '校验中', en: 'Validating' })} {progress.done} / {progress.total}
            </div>
          )}
          {!running && !error && (
            <div className="alg-validation-summary">
              {failures.length === 0
                ? tr({ zh: '✅ 全部通过', en: '✅ All passed' })
                : tr({ zh: `共 ${failures.length} 条不通过 (点击跳到对应 case 修):`, en: `${failures.length} failures (click row to fix):` })}
            </div>
          )}
          {failures.length > 0 && (
            <ul className="alg-validation-list">
              {failures.map((f, i) => (
                <li
                  key={`${f.puzzle}/${f.set}/${f.caseObj.id}/${f.oriIdx}/${f.algIdx}/${i}`}
                  className="alg-validation-row"
                  onClick={() => onPickCase(f.puzzle, f.set, f.caseObj)}
                >
                  <div className="alg-validation-row-head">
                    <span className="alg-validation-tag">{f.puzzle}/{f.set}</span>
                    <span className="alg-validation-name">{f.caseObj.name}</span>
                    <ExternalLink size={12} className="alg-validation-link" />
                  </div>
                  <div className="alg-validation-alg">{f.alg}</div>
                  <div className="alg-validation-reason">{f.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="alg-admin-modal-foot">
          <button type="button" className="alg-admin-modal-foot-btn" onClick={() => void run()} disabled={running}>
            <Play size={14} /> {tr({ zh: '重跑', en: 'Re-run' })}
          </button>
          <div className="alg-admin-modal-foot-spacer" />
          <button type="button" className="alg-admin-modal-foot-btn" onClick={onClose}>{tr({ zh: '关闭', en: 'Close' })}</button>
        </div>
      </div>
    </div>
  );
}
