'use client';
// 选手页详细成绩的「各次成绩」单元 — ByCompList / ByEventView 共用(原来两边各一份相同副本)。
// 每一次 solve 的点击行为:
//   1. 已有复盘 → 跳该复盘详情页(所有人)。
//   2. 没复盘 + 管理员 + 编辑模式开 → 行内编辑浮层(改值 / 原始 / 罚时)。
//   3. 没复盘(其余情况)→ 跳 /recon/submit 预填好身份字段,用户来复盘。

import Link from '@/components/AppLink';
import { formatWcaResult } from '@/lib/wca-format-result';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import { findReconForAttempt, buildReconSubmitHref } from '@/lib/recon-attempt-lookup';
import { tr } from '@/i18n/tr';
import { AttemptEditPopover } from './AttemptEditPopover';
import { SolveValue } from './SolveValue';

export interface AttemptsListProps {
  attempts: number[];
  best: number;
  eventId: string;
  compId: string;
  roundTypeId: string;
  reconLookup: Map<string, number> | null;
  isZh: boolean;
  admin?: boolean;
  isOwner?: boolean;             // 本人页面:罚时即时生效(其余改动仍需审核)。
  canEdit?: boolean;            // 任何登录用户:可打开编辑/提议浮层。
  editMode?: boolean;            // 「编辑模式」:开 → 无复盘 solve 点击=行内编辑/提议;关 → 跳 submit。
  // submit 预填上下文(无复盘 solve 点击跳 /recon/submit 用)
  personId: string;
  personName: string;
  personCountry?: string;
  compName: string;
  compCountry?: string;
  compDate?: string;
  attemptOlds?: number[][];
  penalties?: number[];
  onEdit?: (index: number, newValue: number, note?: string) => Promise<void> | void;
  onSetOriginal?: (index: number, originalValue: number, note?: string) => Promise<void> | void;
  onSetPenalty?: (index: number, penaltyCs: number, note?: string) => Promise<void> | void;
}

export function AttemptsList({
  attempts, best, eventId, compId, roundTypeId, reconLookup, isZh, admin, isOwner, canEdit, editMode,
  personId, personName, personCountry, compName, compCountry, compDate,
  attemptOlds, penalties, onEdit, onSetOriginal, onSetPenalty,
}: AttemptsListProps) {
  if (attempts.length === 0) return <span className="wp-text-mute">—</span>;
  const validNums = attempts.filter((x) => x > 0);
  const minValid = validNums.length > 0 ? Math.min(...validNums) : 0;
  const langQuery = isZh ? '?lang=zh' : '';
  const fmt = (v: number) => formatWcaResult(v, eventId, 'single');
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => {
        if (a === undefined) return null;
        const pen = penalties?.[i] ?? 0;
        const isBest = validNums.length > 0 && a > 0 && a === minValid && a === best;
        const cls = `wp-att ${isBest ? 'wp-att-best' : ''} ${isAo5Bracketed(attempts, i) ? 'wp-att-trimmed' : ''}`;
        const olds = (attemptOlds?.[i] ?? []).map((ov, k) => (
          <s key={k} className="wp-old-result">{formatWcaResult(ov, eventId, 'single')}</s>
        ));
        // 复盘链接所有人(含管理员)都可点 → 优先
        const reconId = findReconForAttempt(reconLookup, compId, eventId, roundTypeId, i + 1);
        if (reconId) {
          return (
            <Link key={i} href={`/recon/${reconId}${langQuery}`} className={`${cls} wp-att-recon`}>
              {olds}<SolveValue value={a} penalty={pen} format={fmt} />
            </Link>
          );
        }
        // 编辑模式下:任何登录用户都能行内改/提议这一次(管理员=即时;本人罚时=即时;其余=待审核)。
        if (editMode && canEdit) {
          return (
            <AttemptEditPopover
              key={i}
              value={a}
              eventId={eventId}
              oldValues={attemptOlds?.[i] ?? []}
              cls={cls}
              format={fmt}
              penalty={pen}
              isAdmin={admin}
              isOwner={isOwner}
              onSetOriginal={(v, note) => onSetOriginal?.(i, v, note)}
              onCorrect={(v, note) => onEdit?.(i, v, note)}
              onSetPenalty={(cs, note) => onSetPenalty?.(i, cs, note)}
            />
          );
        }
        // 没复盘 → 点击去复盘(预填好选手/比赛/项目/轮次/第几把)
        const href = buildReconSubmitHref({
          wcaEventId: eventId, roundTypeId, solveNum: i + 1,
          personId, personName, personCountry, compId, compName, compCountry, compDate,
        });
        return (
          <Link
            key={i}
            href={href}
            className={`${cls} wp-att-tonew`}
            title={tr({ zh: '还没有复盘 — 点击去复盘这一把', en: 'No reconstruction yet — click to reconstruct' })}
          >
            {olds}<SolveValue value={a} penalty={pen} format={fmt} />
          </Link>
        );
      })}
    </span>
  );
}
