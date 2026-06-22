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
