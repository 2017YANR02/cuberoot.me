'use client';

/**
 * admin 的「校验」入口：按钮和报告弹窗，失败项默认链接到 case 详情页。
 *
 * `/alg`(全库)、`/alg/<puzzle>`(整个魔方)、case 详情页(单张 case)共用这一份 ——
 * 三处只差一个 scope，共用报告状态。
 *
 * case 列表页(AlgCategoryView)自己持有报告状态，用于同步列表校验结果。
 *
 * 鉴权用 hydration-safe 的 `useIsAdmin()`(`/alg` 是 SSG 页,裸读 store 会首帧错配)。
 */
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import ValidationReportModal, { type ValidationScope } from '@/components/ValidationReportModal';
import type { AlgFailure } from '@/lib/alg_validation_scan';
import { useIsAdmin } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';

interface Props {
  scope: ValidationScope;
  /** 按钮上的字。默认「校验」;范围大的页面(全库 / 整个魔方)自己说清楚。 */
  label?: string;
  className?: string;
  /** 默认链接到详情页；详情页可接管为滚动到当前编辑区。 */
  onPickCase?: (puzzle: AlgPuzzle, set: string, caseObj: AlgCase) => void;
  /** 把扫描结果交给需要同步标记公式行的宿主。 */
  onResults?: (failures: AlgFailure[]) => void;
}

export default function AlgAdminValidate({ scope, label, className, onPickCase, onResults }: Props) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        className={className ?? 'alg-admin-add-btn'}
        onClick={() => setOpen(true)}
        title={tr({ zh: '校验公式(setup + 公式是否还原)', en: 'Validate algs (setup + alg solves)' })}
      >
        <ShieldCheck size={14} /> {label ?? tr({ zh: '校验', en: 'Validate' })}
      </button>

      {open && (
        <ValidationReportModal
          scope={scope}
          onClose={() => setOpen(false)}
          onPickCase={onPickCase}
          onResults={onResults}
        />
      )}

    </>
  );
}
