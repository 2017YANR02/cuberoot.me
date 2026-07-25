'use client';

/**
 * admin 的「校验」入口:按钮 + 校验报告弹窗 +(默认)点失败项直接开 case 编辑器。
 *
 * `/alg`(全库)、`/alg/<puzzle>`(整个魔方)、case 详情页(单张 case)共用这一份 ——
 * 三处只差一个 scope,别各自再写一遍 open / refreshKey / editorState 三段 state。
 *
 * case 列表页(AlgCategoryView)不走这里:它还要把编辑结果写回已经加载好的 `data`
 * (卡片、计数、红框都挂在那份数据上),必须自己持有 editorState,不是这里的无状态形态。
 *
 * 鉴权用 hydration-safe 的 `useIsAdmin()`(`/alg` 是 SSG 页,裸读 store 会首帧错配)。
 */
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import AdminCaseEditor, { type AdminEditorState } from '@/components/AdminCaseEditor';
import ValidationReportModal, { type ValidationScope } from '@/components/ValidationReportModal';
import { useIsAdmin } from '@/lib/auth-store';
import { tr } from '@/i18n/tr';

interface Props {
  scope: ValidationScope;
  /** 按钮上的字。默认「校验」;范围大的页面(全库 / 整个魔方)自己说清楚。 */
  label?: string;
  className?: string;
  /** 报告里点某条失败项。默认自己开编辑器;宿主页已有编辑器就接管(免两份叠着)。 */
  onPickCase?: (puzzle: AlgPuzzle, set: string, caseObj: AlgCase) => void;
  /** case 存盘后通知宿主(刷新它自己那份数据)。 */
  onSaved?: () => void;
}

export default function AlgAdminValidate({ scope, label, className, onPickCase, onSaved }: Props) {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<{ puzzle: AlgPuzzle; set: string; state: AdminEditorState } | null>(null);

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
          refreshKey={refreshKey}
          onClose={() => setOpen(false)}
          onPickCase={(p, s, c) => {
            if (onPickCase) onPickCase(p, s, c);
            else setEditing({ puzzle: p, set: s, state: { mode: 'edit', existing: c } });
          }}
        />
      )}

      {editing && (
        <AdminCaseEditor
          puzzle={editing.puzzle}
          setSlug={editing.set}
          state={editing.state}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRefreshKey(k => k + 1); // 报告还开着 → 重跑,改过的那条该消失了
            onSaved?.();
          }}
        />
      )}
    </>
  );
}
