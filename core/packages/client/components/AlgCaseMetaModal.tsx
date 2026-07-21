'use client';

/**
 * case 的富元数据**弹窗**(训练运行页里用)。正文抽到了 {@link AlgCaseMetaContent},
 * 列表页那个入口已经改成独立详情页(`AlgCaseDetailClient`),两处共用同一份正文。
 *
 * 为什么当初是弹窗:元数据有 20 来个字段(6 套打乱、4 套最优解、对称性、镜像/逆的编号……),
 * 铺进 case 卡片会把主视图挤爆(docs/1lll-migration.md B10)。
 *
 * 关联缩略图点了是**切弹窗**(`onJump`):跳过去的那个 case 多半在别的组,身后的列表根本
 * 没渲染它,只给元数据等于跳进一片空白;弹窗自带缩略图 + 公式,原地看得到。
 */
import { useEffect, useMemo } from 'react';
import { X, ExternalLink } from 'lucide-react';
import Link from '@/components/AppLink';
import type { AlgCase, AlgCaseMeta, AlgPuzzle } from '@cuberoot/shared';
import AlgCaseMetaContent from '@/components/AlgCaseMetaContent';
import { algCaseHref } from '@/lib/alg_case_link';
import { tr } from '@/i18n/tr';

interface Props {
  caseObj: AlgCase;
  puzzle: AlgPuzzle;
  set: string;
  /** 同一个 set 里的 `meta.no` → case,用来把镜像/逆做成链接 */
  byNo: Map<number, AlgCase>;
  onClose: () => void;
  onJump: (c: AlgCase) => void;
}

export default function AlgCaseMetaModal({ caseObj, puzzle, set, byNo, onClose, onJump }: Props) {
  const m = caseObj.meta as AlgCaseMeta;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** 「在列表中打开」—— 真 <a>,中键能新开(CLAUDE.md「链接支持中键新开」) */
  const listHref = useMemo(() => algCaseHref(puzzle, set, caseObj), [caseObj, puzzle, set]);

  return (
    <div className="alg-admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="alg-admin-modal alg-meta-modal" onClick={e => e.stopPropagation()}>
        <div className="alg-admin-modal-head">
          <h2>
            {m.ollcp}
            <span className="alg-meta-head-sub">{caseObj.name}</span>
            {/* 标题旁直达 case 所在列表页(真 <a>,中键可新开) */}
            <Link href={listHref} className="alg-meta-head-open" prefetch={false} title={tr({ zh: '跳转到 case 所在页面', en: 'Open the case in its list page' })}>
              <ExternalLink size={14} />
            </Link>
          </h2>
          <button type="button" className="alg-admin-modal-head-btn" onClick={onClose} title={tr({ zh: '关闭', en: 'Close' })}>
            <X size={16} />
          </button>
        </div>

        <div className="alg-admin-modal-body alg-meta-body">
          <AlgCaseMetaContent caseObj={caseObj} puzzle={puzzle} set={set} byNo={byNo} jump={{ kind: 'callback', onJump }} />
        </div>
      </div>
    </div>
  );
}
