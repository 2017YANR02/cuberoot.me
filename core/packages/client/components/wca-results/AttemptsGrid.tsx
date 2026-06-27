'use client';
// 详细成绩「各次成绩」的只读网格展示 —— 与选手页 AttemptsList / recon 同场表同构(共用 attempts-grid.css):
// 每把右对齐 + ao5 去尾括号 CSS 占位 + 跨行同列小数点对齐。纯展示无交互;
// 需要「点跳复盘 / 管理员行内编辑」用 AttemptsList,这里只要样式一致的静态版本。

import { formatWcaResult } from '@/lib/wca-format-result';
import { isAo5Bracketed } from '@/lib/wca-ao5-brackets';
import './attempts-grid.css';

export function AttemptsGrid({ attempts, eventId }: { attempts: number[]; eventId: string }) {
  if (!attempts || attempts.length === 0) return null;
  return (
    <span className="wp-attempts-flow">
      {attempts.map((a, i) => (
        <span key={i} className={`wp-att${isAo5Bracketed(attempts, i) ? ' wp-att-trimmed' : ''}`}>
          {formatWcaResult(a, eventId, 'single', { failure: 'dnf' })}
        </span>
      ))}
    </span>
  );
}

// 详细成绩用「真表格列」:每把一个 <th>/<td>,由 <table> 的列布局保证表头数字与数据同列同宽
// 对齐(单格 CSS 栅格那套在表头/数据两套独立轨道间宽度对不齐 → 逐列累积错位,故弃用)。
// records / results 两页共用;count = 该表实际把数(各行 attempts 最大长度,夹到 [0,5]),
// 不足的把渲染空列占位,保证表头与每行列数一致。

// 表头:每把一个数字 <th>(列内居中)。放进 thead 的 <tr>,与 AttemptCells 用同一 count。
export function AttemptHeaderCells({ count = 5 }: { count?: number }) {
  const n = Math.max(0, Math.min(5, count));
  return <>{Array.from({ length: n }, (_, i) => (
    <th key={i} className="wse-attempts-col wse-att-th">{i + 1}</th>
  ))}</>;
}

// 数据:每把一个 <td>(列内居中;ao5 去尾那把显括号,其余等宽透明括号占位)。放进 tbody 每行的 <tr>。
export function AttemptCells({ attempts, eventId, count = 5 }: { attempts: number[] | null | undefined; eventId: string; count?: number }) {
  const n = Math.max(0, Math.min(5, count));
  const arr = attempts ?? [];
  return <>{Array.from({ length: n }, (_, i) => {
    const a = arr[i] ?? 0;
    return (
      <td key={i} className={`wse-attempts-col wse-att-td${isAo5Bracketed(arr, i) ? ' is-trimmed' : ''}`}>
        {a !== 0 ? formatWcaResult(a, eventId, 'single', { failure: 'dnf' }) : ''}
      </td>
    );
  })}</>;
}
