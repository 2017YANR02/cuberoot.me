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
import { createPortal } from 'react-dom';
import { ShieldCheck } from '@app-foundation/icons/lucide';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import type { ValidationScope } from '@/components/ValidationReportModal';
import dynamic from 'next/dynamic';
const ValidationReportModal = dynamic(() => import('@/components/ValidationReportModal'));
import type { AlgFailure } from '@/lib/alg_validation_scan';
import { useIsAdmin } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';

interface Props {
  scope: ValidationScope;
  /** 多个校验范围合并为一个菜单入口。 */
  options?: { label: string; scope: ValidationScope }[];
  /** 入口可放进设置面板；报告保留在原挂载位置，避免被面板裁切或关闭。 */
  triggerContainer?: HTMLElement | null;
  /** 按钮上的字。默认「校验」;范围大的页面(全库 / 整个魔方)自己说清楚。 */
  label?: string;
  className?: string;
  /** 默认链接到详情页；详情页可接管为滚动到当前编辑区。 */
  onPickCase?: (puzzle: AlgPuzzle, set: string, caseObj: AlgCase) => void;
  /** 把扫描结果交给需要同步标记公式行的宿主。 */
  onResults?: (failures: AlgFailure[]) => void;
}

export default function AlgAdminValidate({ scope, options, triggerContainer, label, className, onPickCase, onResults }: Props) {
  const isAdmin = useIsAdmin();
  const [activeScope, setActiveScope] = useState<ValidationScope | null>(null);

  if (!isAdmin) return null;

  const trigger = options ? (
        <select
          className={className ?? 'alg-admin-add-btn'}
          aria-label={label ?? tr({ zh: '校验', en: 'Validate' })}
          value=""
          onChange={event => {
            const option = options[Number(event.target.value)];
            if (option) setActiveScope(option.scope);
          }}
        >
          <option value="" disabled>{label ?? tr({ zh: '校验', en: 'Validate' })}</option>
          {options.map((option, index) => <option key={index} value={index}>{option.label}</option>)}
        </select>
      ) : <button
        type="button"
        className={className ?? 'alg-admin-add-btn'}
        onClick={() => setActiveScope(scope)}
        title={tr({ zh: '校验公式(setup + 公式是否还原)', en: 'Validate algs (setup + alg solves)' })}
      >
        <ShieldCheck size={14} /> {label ?? tr({ zh: '校验', en: 'Validate' })}
      </button>;

  return (
    <>
      {triggerContainer === undefined ? trigger : triggerContainer ? createPortal(trigger, triggerContainer) : null}

      {activeScope && (
        <ValidationReportModal
          scope={activeScope}
          onClose={() => setActiveScope(null)}
          onPickCase={onPickCase}
          onResults={onResults}
        />
      )}

    </>
  );
}
