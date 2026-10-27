'use client';

import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ClearButton } from '@/components/ClearButton';
import { loadAlg, type AlgFile, type AlgPuzzle } from '@cuberoot/shared/alg';
import AppLink from '@/components/AppLink';
import { resolveCaseSlug } from '@/lib/alg_case_link';
import { useModalDismiss } from '@/hooks/useModalDismiss';
import { tr } from '@/i18n/tr';
import '../app/[lang]/alg/alg.css';
import './recon-case-link.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const AlgCaseView = lazy(() => import('../app/[lang]/alg/[puzzle]/[set]/[subgroup]/AlgCaseView'));

function CaseDialog({ href, onClose }: { href: string; onClose: () => void }) {
  const backdrop = useModalDismiss(onClose);
  const [currentHref, setCurrentHref] = useState(href);
  const [, puzzle, set, slug] = /^\/alg\/([^/]+)\/([^/]+)\/([^/?#]+)/.exec(currentHref)!;
  const [data, setData] = useState<AlgFile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Escape belongs to this nested dialog, not the timer recap underneath it.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [onClose]);
  useEffect(() => {
    let active = true;
    void loadAlg(puzzle as AlgPuzzle, set).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [puzzle, set]);
  const caseObj = data && resolveCaseSlug(data.cases, decodeURIComponent(slug), puzzle, set);
  const loading = <p><LoadingIndicator>{tr({ zh: '加载中…', en: 'Loading…' })}</LoadingIndicator></p>;
  return createPortal(
    <div className="alg-admin-modal-backdrop recon-case-backdrop" {...backdrop} role="dialog" aria-modal="true" aria-label={tr({ zh: '公式详情', en: 'Algorithm details' })}>
      <div className="alg-admin-modal recon-case-dialog">
        <div className="alg-admin-modal-head">
          <AppLink href={currentHref} prefetch={false} target="_blank" rel="noopener noreferrer">{tr({ zh: '打开完整公式页', en: 'Open full algorithm page' })}</AppLink>
          <ClearButton variant="standalone" onClick={onClose} ariaLabel={tr({ zh: '关闭公式详情', en: 'Close algorithm details' })} />
        </div>
        <div className="alg-admin-modal-body alg-root">
          {failed || (data && !caseObj) ? <p>{tr({ zh: '无法加载此公式，请打开完整公式页。', en: 'Could not load this case. Open the full algorithm page.' })}</p>
            : data && caseObj ? <Suspense fallback={loading}><AlgCaseView puzzle={puzzle as AlgPuzzle} set={set} caseObj={caseObj} data={data} onEmbeddedCaseChange={setCurrentHref} embedded /></Suspense> : loading}
        </div>
      </div>
    </div>, document.body,
  );
}

/** Keep real URLs for modified clicks; ordinary clicks inspect the case in place. */
export default function ReconCaseLink({ href, children, className, title }: {
  href: string; children: ReactNode; className?: string; title?: string; prefetch?: false;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return <>
    <AppLink href={href} prefetch={false} className={className} title={title} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !/^\/alg\/[^/]+\/[^/]+\/[^/?#]+/.test(href)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    }}>{children}</AppLink>
    {open && <CaseDialog href={href} onClose={close} />}
  </>;
}
