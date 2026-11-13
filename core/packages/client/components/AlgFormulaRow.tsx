import type { HTMLAttributes, ReactNode } from 'react';
import AlgTagLabel from '@/components/AlgTagLabel';
import { algTagLabel } from '@/lib/alg_tags';
import './alg-formula-row.css';

type Props = HTMLAttributes<HTMLDivElement> & {
  tags?: readonly string[];
  actions?: ReactNode;
  selected?: boolean;
};

// Tag placement belongs to the row, never to its page or grouped caller.
const LEADING_TAGS = ['mainstream', 'beginner'];
const renderTag = (tag: string) => <span key={tag} className={`alg-tag alg-tag-${tag}`}>
  <AlgTagLabel tag={tag} label={algTagLabel(tag)} />
</span>;

/** Reading, editing and grouped insertions share this geometry. The action
 * column remains reserved even when empty; controls never resize the notation. */
export default function AlgFormulaRow({ tags, actions, children, selected = false, className = '', ...props }: Props) {
  return <div {...props} data-selected={selected} className={`alg-formula-row ${className}`}>
    <div className="alg-formula-body">
      {LEADING_TAGS.filter(tag => tags?.includes(tag)).map(renderTag)}
      <div className="alg-formula-value">{children}</div>
    </div>
    <div className="alg-formula-actions">{actions}</div>
  </div>;
}

export function AlgFormulaReadRow({ children, tags, actions, ...props }: Props) {
  return <AlgFormulaRow {...props} tags={tags} actions={actions ? <div className="alg-formula-read-details">
    {actions}
  </div> : null}>
    <span className="alg-alg-text alg-formula-text">{children}
      {[...new Set(tags)].filter(tag => !LEADING_TAGS.includes(tag)).map(renderTag)}
    </span>
  </AlgFormulaRow>;
}
