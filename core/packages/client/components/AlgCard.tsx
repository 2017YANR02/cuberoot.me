'use client';

/**
 * AlgCard — /alg 全站统一的缩略图卡片。**一处定义**,套列表(/alg/3x3)、子组选择、子组封面、
 * LSLL 全用它,别再各页各写一套(bento / subgroup / cover)。卡片只展示缩略图和名字,
 * 可选副名、可选展开箭头(组封面)。有 href → 真 `<a>`(中键新开);只有 onClick → `<button>`(如展开切换)。
 */
import Link from '@/components/AppLink';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './AlgCard.css';

interface AlgCardProps {
  thumb: React.ReactNode;
  title: React.ReactNode;
  /** 副名(如 1LLL 卡的原组名),小字另起一行。 */
  sub?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  prefetch?: boolean;
  ariaLabel?: string;
  tooltip?: string;
  /** 组封面(可展开):淡强调底 + 角标箭头。传当前展开状态。 */
  expand?: 'open' | 'closed';
  className?: string;
}

export default function AlgCard({
  thumb, title, sub, href, onClick, prefetch, ariaLabel, tooltip, expand, className,
}: AlgCardProps) {
  const cls = `alg-card${expand ? ' alg-card--cover' : ''}${className ? ` ${className}` : ''}`;
  const body = (
    <>
      {expand && (
        <span className="alg-card-chevron">
          {expand === 'closed' ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </span>
      )}
      <div className="alg-card-thumb">{thumb}</div>
      <div className="alg-card-foot">
        <span className="alg-card-title">{title}</span>
      </div>
      {sub != null && sub !== '' && <div className="alg-card-sub">{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} prefetch={prefetch} aria-label={ariaLabel} title={tooltip}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={expand ? expand === 'open' : undefined}
      title={tooltip}
    >
      {body}
    </button>
  );
}
