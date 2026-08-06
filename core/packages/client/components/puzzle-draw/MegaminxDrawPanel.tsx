'use client';

import { useCallback, useRef, useState } from 'react';
import PillToggle from '@/components/PillToggle/PillToggle';
import { useT } from '@/hooks/useT';
import DrawCanvas from './DrawCanvas';
import { MEGAMINX_STICKER_PALETTE } from './palettes';
import {
  MEGAMINX_EXPANDED_ELEMENTS,
  MEGAMINX_TOP_ELEMENTS,
} from './MegaminxDrawPanel-data';
import type { DrawExport } from './types';

export interface MegaminxDrawPanelProps {
  onDocumentChange?: (doc: DrawExport) => void;
}

type MegaminxDrawView = 'top' | 'expanded';

/** Megaminx painter with the two layouts from the authorized cubing.pro tool. */
export function MegaminxDrawPanel({ onDocumentChange }: MegaminxDrawPanelProps) {
  const t = useT();
  const [view, setView] = useState<MegaminxDrawView>('top');
  const activeRef = useRef<MegaminxDrawView>('top');
  const documentsRef = useRef<Partial<Record<MegaminxDrawView, DrawExport>>>({});

  const selectView = useCallback((next: MegaminxDrawView) => {
    activeRef.current = next;
    setView(next);
    const document = documentsRef.current[next];
    if (document) onDocumentChange?.(document);
  }, [onDocumentChange]);

  const receiveDocument = useCallback((source: MegaminxDrawView, document: DrawExport) => {
    documentsRef.current[source] = document;
    if (activeRef.current === source) onDocumentChange?.(document);
  }, [onDocumentChange]);
  const receiveTopDocument = useCallback(
    (document: DrawExport) => receiveDocument('top', document),
    [receiveDocument],
  );
  const receiveExpandedDocument = useCallback(
    (document: DrawExport) => receiveDocument('expanded', document),
    [receiveDocument],
  );

  return (
    <div>
      <PillToggle
        value={view === 'expanded'}
        onChange={(expanded) => selectView(expanded ? 'expanded' : 'top')}
        offLabel={t('俯视图', 'Top view')}
        onLabel={t('展开图', 'Expanded view')}
        ariaLabel={t('五魔方绘图视图', 'Megaminx drawing view')}
      />

      {/* Keep both canvases mounted so changing layouts never discards either paint document. */}
      <div hidden={view !== 'top'}>
        <DrawCanvas
          elements={MEGAMINX_TOP_ELEMENTS}
          viewBox="0 0 10000 10000"
          width={400}
          height={400}
          filenameBase="megaminx-top"
          presetColors={MEGAMINX_STICKER_PALETTE}
          historyStorageKey="sim.draw.megaminx.top"
          strokeWidthScale={25}
          onDocumentChange={receiveTopDocument}
        />
      </div>

      <div hidden={view !== 'expanded'}>
        <DrawCanvas
          elements={MEGAMINX_EXPANDED_ELEMENTS}
          viewBox="0 0 565.4 566.6"
          width={400}
          height={400}
          filenameBase="megaminx-expanded"
          presetColors={MEGAMINX_STICKER_PALETTE}
          historyStorageKey="sim.draw.megaminx.expanded"
          strokeWidthScale={2}
          onDocumentChange={receiveExpandedDocument}
        />
      </div>
    </div>
  );
}

export default MegaminxDrawPanel;
