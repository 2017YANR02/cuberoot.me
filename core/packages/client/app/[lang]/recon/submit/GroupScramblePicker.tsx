'use client';

/**
 * 「对照各组打乱」弹窗 — submit 表单里用户拿不准自己在哪个分组时用。
 * 给定 comp/event/round 与当前「第几把」,一次性列出各分组(A/B/C…)同一把的打乱,
 * 用户比对认领后点选,回填 groupId(打乱字段随表单既有的自动填充逻辑跟着填)。
 *
 * 表格样式(边框 / 序号格 + 复制按钮 / 对齐等宽打乱 / 打乱图格)完全复用 /scramble/gen 的
 * SheetView —— 与 /wca/comp 打乱页同一套渲染,不另造轮子。把「各分组第 N 把」塞进一个
 * RoundSheet 的 attempts(label = 组号),analyzable 关掉让点行=选组而非展开解法器。
 */

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { useTranslation } from 'react-i18next';
import { fetchGroupScrambles, type GroupScrambles } from '@/lib/wca-results-api';
import { toWcaEventId } from '@/lib/wca-events';
import { useT } from '@/hooks/useT';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import SheetView, { type RoundSheet, type AttemptScramble } from '@/app/[lang]/scramble/gen/SheetView';
// SheetView 用 .gen-tn-* 表格样式;平时由 /scramble/gen 的 page.tsx 引入,内嵌到别处必须自带。
import '@/app/[lang]/scramble/gen/gen.css';

interface Props {
  compWcaId: string;
  event: string;
  round: string;
  solveNum?: number;          // 当前第几把(1..5);对照就取这一把,缺省按第 1 把
  currentGroup?: string;      // 当前已选分组,高亮
  onPick: (group: string) => void;
  onClose: () => void;
}

// recon round('1'/'2'/'3'/'f')→ SheetView 的 0-based roundIdx(3=决赛/combined final)。
const ROUND_IDX: Record<string, number> = { '1': 0, '2': 1, '3': 2, 'f': 3 };

export default function GroupScramblePicker({
  compWcaId, event, round, solveNum, currentGroup, onPick, onClose,
}: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();
  const [groups, setGroups] = useState<GroupScrambles[] | null>(null);
  const [failed, setFailed] = useState(false);

  useModalDismiss(onClose);

  useEffect(() => {
    let alive = true;
    fetchGroupScrambles(compWcaId, event, round)
      .then(g => { if (alive) { if (g) setGroups(g); else setFailed(true); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [compWcaId, event, round]);

  // 对照哪一把:落在 1..5 用它,否则退回第 1 把。
  const idx = solveNum && solveNum >= 1 && solveNum <= 5 ? solveNum - 1 : 0;
  const solveLabel = idx + 1;
  const wcaEvent = toWcaEventId(event); // recon 短名 → WCA 标准 id(SheetView / 打乱图按 WCA id 分发)

  // 各分组第 idx 把 → 一个 RoundSheet 的 attempts(label = 组号)。
  const sheet = useMemo<RoundSheet | null>(() => {
    if (!groups || groups.length === 0) return null;
    const attempts: AttemptScramble[] = groups.map(g => ({
      label: g.group,
      scramble: g.scrambles[idx] ?? '',
      isExtra: false,
    }));
    return {
      event: wcaEvent,
      roundIdx: ROUND_IDX[round] ?? 0,
      groupIdx: 0,
      format: '1',
      attempts,
      totalGroups: 1,
    };
  }, [groups, idx, wcaEvent, round]);

  return (
    <div
      className="rr-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="rr-modal">
        <div className="rr-head gsp-head">
          <button type="button" className="rr-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
            <X size={18} />
          </button>
        </div>

        <div className="rr-body gsp-body">
          {groups == null && !failed ? (
            <div className="rr-state"><Spinner size={18} /> {tr({ zh: '加载中…', en: 'Loading…' })}</div>
          ) : failed || !sheet ? (
            <div className="rr-state">{tr({ zh: '这一轮暂无打乱数据', en: 'No scrambles for this round' })}</div>
          ) : (
            /* .gen-page 供 SheetView 表格的 --gen-* 变量 + 明暗主题(定义在 gen.css 的 .gen-page 作用域) */
            <div className="gen-page">
              <SheetView
                sheet={sheet}
                isZh={isZh}
                t={t}
                showPreview
                analyzable={false}
                titleSuffix={tr({ zh: `第 ${solveLabel} 把`, en: ` · scramble #${solveLabel}` })}
                selectedLabel={currentGroup ?? null}
                onSelectScramble={label => {
                  // analyzable 关 → 点行只「选中」,回传该行 label(=组号);
                  // 再点当前已选组时 label 为 null,退回 currentGroup。
                  const picked = label ?? currentGroup;
                  if (picked) onPick(picked);
                  onClose();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
