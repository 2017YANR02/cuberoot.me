'use client';
// 选手页详细成绩的「各次成绩」单元 — ByCompList / ByEventView 共用。
// 每一把成绩点击 → 统一弹窗 AttemptPopover(复盘 + 判罚原因 + 编辑/提议 + 管理员变更记录),
// 不再分「有复盘直接跳 / 编辑模式行内改 / 没复盘跳 submit」三条路 —— 全收进弹窗。

import type { CSSProperties } from 'react';
import { formatWcaResult } from '@/lib/wca-format-result';
import { isAo5Bracketed, trimEmptyAttempts } from '@/lib/wca-ao5-brackets';
import { findReconForAttempt, buildReconSubmitHref } from '@/lib/recon-attempt-lookup';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { AttemptPopover } from './AttemptPopover';

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
  canEdit?: boolean;            // 任何登录用户:可在弹窗里展开编辑/提议。
  // submit 预填上下文(无复盘 solve 点击跳 /recon/submit 用)
  personId: string;
  personName: string;
  personCountry?: string;
  compName: string;
  compCountry?: string;
  compDate?: string;
  attemptOlds?: number[][];
  penalties?: number[];
  penaltyNote?: string | null;   // 罚时原因(整条记录共享)→ 弹窗内展示
  attemptVideos?: string[];      // 各把已批准的比赛视频(下标对齐 attempts)→ 弹窗内封面展示
  pendingVideos?: string[];      // 各把待审核的比赛视频提议
  onAddVideo?: (index: number, url: string) => Promise<void> | void;  // 提交某把的视频链接(非管理员→待审核)
  // 每把单次的时间序 PR 名次(下标对齐 attempts);最好那把 == 单次列 singleRank。
  attemptRanks?: (number | null)[] | null;
  // 该轮最佳单次的区域纪录(WR/CR/NR):最好那把优先显示它(与单次列同优先级)。
  singleRecord?: string | null;
  // 详细成绩网格列数(--att-cols):ByEventView 传统一的 maxAttempts(与表头序号同列对齐);
  // ByCompList 不传 → 按本行真实把数,避免尾部空列占宽。
  cols?: number;
  onEdit?: (index: number, newValue: number, note?: string) => Promise<void> | void;
  onSetOriginal?: (index: number, originalValue: number, note?: string) => Promise<void> | void;
  onSetPenalty?: (index: number, penaltyCs: number, note?: string) => Promise<void> | void;
  onEditRecord?: () => void;     // 管理员:打开整条变更记录编辑模态(原行级铅笔的功能)。
}

export function AttemptsList({
  attempts, best, eventId, compId, roundTypeId, reconLookup, isZh, admin, isOwner, canEdit,
  personId, personName, personCountry, compName, compCountry, compDate,
  attemptOlds, penalties, penaltyNote, attemptVideos, pendingVideos, onAddVideo,
  attemptRanks, singleRecord, cols, onEdit, onSetOriginal, onSetPenalty, onEditRecord,
}: AttemptsListProps) {
  // 砍掉尾部「未进行的把」(0 占位):3 把项目(多盲 / 三四五盲 / 最少步 / 六七阶)及未过晋级线
  // 的行不再拖 2 个空 —;length≠5 后 isAo5Bracketed 也不会给非 Ao5 误加括号。
  const atts = trimEmptyAttempts(attempts);
  if (atts.length === 0) return <span className="wp-text-mute">—</span>;
  const colCount = cols ?? Math.max(atts.length, 1);
  const validNums = atts.filter((x) => x > 0);
  const minValid = validNums.length > 0 ? Math.min(...validNums) : 0;
  const langQuery = (isZh && '?lang=zh') || '';   // recon 详情页读 ?lang;AppLink 另管 /zh 前缀
  const fmt = (v: number) => formatWcaResult(v, eventId, 'single');
  // 每把的 PR 角标:最好那把优先区域纪录(同单次列),否则用时间序名次(1→PR,n→PRn)。
  const rankTag = (i: number, isBestAtt: boolean): string | undefined => {
    if (isBestAtt && singleRecord) return singleRecord;
    const rk = attemptRanks?.[i] ?? null;
    return rk ? (rk === 1 ? 'PR' : `PR${rk}`) : undefined;
  };
  const rankBadge = (i: number, isBestAtt: boolean) => {
    const tag = rankTag(i, isBestAtt);
    return tag ? <RecordBadge record={tag} variant="inline" /> : null;
  };
  return (
    <span className="wp-attempts-flow" style={{ '--att-cols': colCount } as CSSProperties}>
      {atts.map((a, i) => {
        if (a === undefined) return null;
        const pen = penalties?.[i] ?? 0;
        const isBest = validNums.length > 0 && a > 0 && a === minValid && a === best;
        const cls = `wp-att ${isBest ? 'wp-att-best' : ''} ${isAo5Bracketed(atts, i) ? 'wp-att-trimmed' : ''} ${pen > 0 ? 'wp-att-haspen' : ''}`;
        const reconId = findReconForAttempt(reconLookup, compId, eventId, roundTypeId, i + 1);
        // 复盘目标:有复盘→详情页(所有人可看);没复盘→/recon/submit 预填好身份字段。
        const reconHref = reconId
          ? `/recon/${reconId}${langQuery}`
          : buildReconSubmitHref({
              wcaEventId: eventId, roundTypeId, solveNum: i + 1,
              personId, personName, personCountry, compId, compName, compCountry, compDate,
              // 有罚时 → 原始成绩 = 显示值 − 罚时(厘秒 → 秒);无罚时交给表单自动取官方值。
              rawTimeSec: pen > 0 && a > 0 ? (a - pen) / 100 : undefined,
              // 这把在选手页显示的名次角标(PR119 / 区域纪录)→ 预填「单次纪录」。
              singleRecordTag: rankTag(i, isBest),
            });
        return (
          <AttemptPopover
            key={i}
            value={a}
            eventId={eventId}
            penalty={pen}
            penaltyNote={penaltyNote}
            format={fmt}
            cls={cls}
            oldValues={attemptOlds?.[i] ?? []}
            rankBadge={rankBadge(i, isBest)}
            reconHref={reconHref}
            hasRecon={!!reconId}
            reconId={reconId}
            canEdit={canEdit}
            isAdmin={admin}
            isOwner={isOwner}
            video={{
              approved: attemptVideos?.[i],
              pending: pendingVideos?.[i],
              onAdd: onAddVideo ? (url) => onAddVideo(i, url) : undefined,
            }}
            onEdit={(v, note) => onEdit?.(i, v, note)}
            onSetOriginal={(v, note) => onSetOriginal?.(i, v, note)}
            onSetPenalty={(cs, note) => onSetPenalty?.(i, cs, note)}
            onEditRecord={onEditRecord}
          />
        );
      })}
    </span>
  );
}
