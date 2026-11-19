'use client';

import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useDialogMotion, useModalDismiss } from '@/hooks/useModalDismiss';
import { T } from '@/i18n/tr';
import './practice-reference-sheet.css';

export default function PracticeReferenceSheet({ children, title, onClose }: { children: ReactNode; title: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const { motionRef, close } = useDialogMotion(onClose, { sheet: true });
  const backdropProps = useModalDismiss(close);
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="tutorial-practice-reference-sheet" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
    <div ref={motionRef} className="tutorial-practice-reference-backdrop" {...backdropProps}>
      <section className="tutorial-practice-reference-panel" data-site-surface="popover">
        <header>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="tutorial-practice-reference-close" onClick={close}><T zh="收起面板" en="Close panel" /></button>
        </header>
        {children}
      </section>
    </div>
  </dialog>;
}
