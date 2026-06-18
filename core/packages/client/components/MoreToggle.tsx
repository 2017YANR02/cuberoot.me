'use client';

// 共享「更多 / 收起」展开开关:文字 + 旋转 chevron。落地页「近期打乱」「今日复盘」
// 等需要折叠次要内容的卡片统一用它,避免每处各写一份 *-more 按钮。
import { ChevronDown } from 'lucide-react';
import { tr } from '@/i18n/tr';
import './more_toggle.css';

interface Props {
  expanded: boolean;
  onToggle: () => void;
  /** 额外类名(布局微调,如 margin) */
  className?: string;
}

export default function MoreToggle({ expanded, onToggle, className }: Props) {
  return (
    <button
      type="button"
      className={`more-toggle${expanded ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {expanded ? tr({ zh: '收起', en: 'Show less' }) : tr({ zh: '更多', en: 'More' })}
      <ChevronDown size={15} className="more-toggle-chevron" aria-hidden="true" />
    </button>
  );
}
