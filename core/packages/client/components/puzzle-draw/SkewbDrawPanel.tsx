'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useT } from '@/hooks/useT';

import { DrawCanvas } from './DrawCanvas';
import { SKEWB_STICKER_PALETTE } from './palettes';
import { SKEWB_3D_SHAPES, SKEWB_NET_SHAPES, SKEWB_SIDE_LINES } from './skewb-data';
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

function sideButtonStyle(selected: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-default)'}`,
    borderRadius: 6,
    background: selected ? 'var(--accent-soft)' : 'transparent',
    color: 'var(--foreground)',
    cursor: 'pointer',
    font: 'inherit',
    fontSize: 12,
    lineHeight: 1.2,
    minHeight: 30,
    padding: '5px 8px',
  };
}

export function SkewbDrawPanel({ onDocumentChange }: SkewbDrawPanelProps) {
  const t = useT();
  const [view, setView] = useState<SkewbView>('net');
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

  const stereoElements = useMemo<DrawElement[]>(() => [
    ...SKEWB_3D_SHAPES.map((d, index) => ({
      key: `sk_3d_2_sk${index}`,
      d,
    })),
    ...SKEWB_SIDE_LINES.filter((line) => sideLines.has(line.key)).map((line) => ({
      key: `sk_3d_line${line.key}`,
      d: line.d,
      transformStr: line.transform,
    })),
  ], [sideLines]);

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

  const toggleSideLine = (key: number) => {
    setSideLines((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sideLabel = (labelKey: (typeof SKEWB_SIDE_LINES)[number]['labelKey']): string => {
    switch (labelKey) {
      case 'topLeft': return t('左上', 'Top left');
      case 'topRight': return t('右上', 'Top right');
      case 'right': return t('右', 'Right');
      case 'bottomRight': return t('右下', 'Bottom right');
      case 'bottomLeft': return t('左下', 'Bottom left');
      case 'left': return t('左', 'Left');
    }
  };

  const stereoControls = (
    <section aria-label={t('侧面', 'Flanks')} style={{ display: 'grid', gap: 8 }}>
      <span style={{ color: 'var(--muted-foreground)', fontSize: 13, fontWeight: 600 }}>
        {t('侧面', 'Flanks')}
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 6 }}>
        {SKEWB_SIDE_LINES.map((line) => {
          const selected = sideLines.has(line.key);
          return (
            <button
              key={line.key}
              type="button"
              aria-pressed={selected}
              style={sideButtonStyle(selected)}
              onClick={() => toggleSideLine(line.key)}
            >
              {sideLabel(line.labelKey)}{line.suffix}
            </button>
          );
        })}
      </div>
    </section>
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
          viewBox="0 0 78 82"
          width={400}
          height={400}
          filenameBase="skewb-3d"
          presetColors={SKEWB_STICKER_PALETTE}
          historyStorageKey="SK3DDraw"
          strokeWidthScale={0.2}
          controls={stereoControls}
          onDocumentChange={publishStereoDocument}
        />
      </div>
    </div>
  );
}

export default SkewbDrawPanel;
