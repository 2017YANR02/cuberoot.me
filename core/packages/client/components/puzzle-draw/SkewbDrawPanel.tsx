'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useT } from '@/hooks/useT';
import BoolToggle from '@/components/BoolToggle';

import { DrawCanvas } from './DrawCanvas';
import { SKEWB_STICKER_PALETTE } from './palettes';
import { SKEWB_3D_SHAPES, SKEWB_BOTTOM_SHAPES, SKEWB_NET_SHAPES, SKEWB_SIDE_LINES } from './skewb-data';
import type { DrawElement, DrawExport } from './types';

export interface SkewbDrawPanelProps {
  onDocumentChange?: (document: DrawExport) => void;
}

type SkewbView = 'net' | 'stereo';

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
};

const tabRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  borderBottom: '1px solid var(--border-default)',
};

function tabStyle(selected: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: 0,
    borderBottom: selected ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: selected ? 'var(--foreground)' : 'var(--muted-foreground)',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: selected ? 600 : 400,
    padding: '8px 2px 7px',
  };
}

export function SkewbDrawPanel({ onDocumentChange }: SkewbDrawPanelProps) {
  const t = useT();
  const [view, setView] = useState<SkewbView>('net');
  const [showBottom, setShowBottom] = useState(true);
  const [sideLines, setSideLines] = useState<ReadonlySet<number>>(() => new Set());
  const netDocument = useRef<DrawExport | null>(null);
  const stereoDocument = useRef<DrawExport | null>(null);

  const netElements = useMemo<DrawElement[]>(
    () => SKEWB_NET_SHAPES.map((shape, index) => ({
      key: `simple_sk${index}`,
      d: shape.d,
      transformStr: shape.transform,
    })),
    [],
  );

  // The attached face occupies the lower-left flank indicators' space.
  const availableSideLines = useMemo(() => SKEWB_SIDE_LINES.filter(
    (line) => !showBottom || line.labelKey !== 'bottomLeft',
  ), [showBottom]);

  const sideLabel = useCallback((labelKey: (typeof SKEWB_SIDE_LINES)[number]['labelKey']): string => {
    switch (labelKey) {
      case 'topLeft': return t('左上', 'Top left');
      case 'topRight': return t('右上', 'Top right');
      case 'right': return t('右', 'Right');
      case 'bottomRight': return t('右下', 'Bottom right');
      case 'bottomLeft': return t('左下', 'Bottom left');
      case 'left': return t('左', 'Left');
    }
  }, [t]);

  const stereoElements = useMemo<DrawElement[]>(() => [
    ...SKEWB_3D_SHAPES.map((d, index) => ({
      key: `sk_3d_2_sk${index}`,
      d,
    })),
    ...(showBottom ? SKEWB_BOTTOM_SHAPES.map((d, index) => ({
      key: `sk_3d_bottom${index}`,
      d,
    })) : []),
    ...availableSideLines.map((line) => ({
      key: `sk_3d_line${line.key}`,
      d: line.d,
      transformStr: line.transform,
      toggle: { selected: sideLines.has(line.key), label: sideLabel(line.labelKey) + line.suffix },
    })),
  ], [availableSideLines, showBottom, sideLines, sideLabel]);

  const publishNetDocument = useCallback((document: DrawExport) => {
    netDocument.current = document;
    if (view === 'net') onDocumentChange?.(document);
  }, [onDocumentChange, view]);

  const publishStereoDocument = useCallback((document: DrawExport) => {
    stereoDocument.current = document;
    if (view === 'stereo') onDocumentChange?.(document);
  }, [onDocumentChange, view]);

  useEffect(() => {
    const document = view === 'net' ? netDocument.current : stereoDocument.current;
    if (document) onDocumentChange?.(document);
  }, [onDocumentChange, view]);

  const toggleSideLine = useCallback((elementKey: string) => {
    const line = SKEWB_SIDE_LINES.find((item) => `sk_3d_line${item.key}` === elementKey);
    if (!line) return;
    const key = line.key;
    setSideLines((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const stereoControls = (
    <BoolToggle value={showBottom} onChange={setShowBottom} label={t('底面', 'Bottom face')} />
  );

  return (
    <div style={panelStyle}>
      <div role="tablist" aria-label={t('Skewb 绘图视图', 'Skewb drawing view')} style={tabRowStyle}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'net'}
          style={tabStyle(view === 'net')}
          onClick={() => setView('net')}
        >
          {t('展开图', 'Net')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'stereo'}
          style={tabStyle(view === 'stereo')}
          onClick={() => setView('stereo')}
        >
          {t('立体图', '3D')}
        </button>
      </div>

      <div role="tabpanel" hidden={view !== 'net'}>
        <DrawCanvas
          elements={netElements}
          viewBox="0 0 130 76"
          width={400}
          height={400}
          filenameBase="skewb-net"
          presetColors={SKEWB_STICKER_PALETTE}
          historyStorageKey="simpleSkDraw"
          strokeWidthScale={0.2}
          onDocumentChange={publishNetDocument}
        />
      </div>

      <div role="tabpanel" hidden={view !== 'stereo'}>
        <DrawCanvas
          elements={stereoElements}
          viewBox={showBottom ? '0 0 78 114' : '0 0 78 82'}
          width={400}
          height={showBottom ? 560 : 400}
          filenameBase="skewb-3d"
          presetColors={SKEWB_STICKER_PALETTE}
          historyStorageKey="SK3DDraw"
          strokeWidthScale={0.2}
          controls={stereoControls}
          onElementToggle={toggleSideLine}
          onDocumentChange={publishStereoDocument}
        />
      </div>
    </div>
  );
}

export default SkewbDrawPanel;
