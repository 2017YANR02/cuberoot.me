'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import BoolToggle from '@/components/BoolToggle';
import { useT } from '@/hooks/useT';

import { DrawCanvas } from './DrawCanvas';
import { DRAW_FONT_COLOR, SQ1_STICKER_PALETTE } from './palettes';
import {
  SQ1_AXIS_PATH,
  SQ1_CORNER_PATHS,
  SQ1_CORNER_TEXT_POINT,
  SQ1_EDGE_PATHS,
  SQ1_EDGE_TEXT_POINT,
  SQ1_PRESETS,
  SQ1_ROTATE_POINT,
  sq1PieceCounts,
  sq1PresetById,
  type Sq1Preset,
} from './sq1-data';
import type { DrawElement, DrawExport } from './types';

export interface Sq1DrawPanelProps {
  onDocumentChange?: (document: DrawExport) => void;
}

type Sq1View = 'single' | 'double';
type Sq1PieceKind = 'corner' | 'edge';
type Sq1Axis = -30 | 0 | 30;
type Sq1Layer = 'top' | 'bottom';

interface SimplePiece {
  id: number;
  kind: Sq1PieceKind;
}

interface LayerShape {
  presetId: string;
  revision: number;
}

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

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  color: 'var(--muted-foreground)',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const selectStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 32,
  border: '1px solid var(--input)',
  borderRadius: 6,
  background: 'var(--background)',
  color: 'var(--foreground)',
  font: 'inherit',
  fontSize: 13,
  padding: '4px 8px',
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

function actionButtonStyle(primary: boolean, disabled: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: `1px solid ${primary ? 'var(--accent)' : 'var(--border-default)'}`,
    borderRadius: 6,
    background: primary ? 'var(--accent-soft)' : 'transparent',
    color: disabled ? 'var(--faint-foreground)' : 'var(--foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    font: 'inherit',
    fontSize: 12,
    minHeight: 30,
    padding: '5px 9px',
  };
}

function ControlField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function presetLabel(t: ReturnType<typeof useT>, preset: Sq1Preset): string {
  return t(preset.zh, preset.en);
}

function axisElements(axis: Sq1Axis, key: string, translate?: readonly number[]): DrawElement[] {
  if (axis === 0) return [];
  return [{
    key,
    d: SQ1_AXIS_PATH,
    rotatePoint: SQ1_ROTATE_POINT,
    baseRotate: axis === -30 ? -30 : undefined,
    translate,
    disableDrawing: true,
  }];
}

function simpleElements(pieces: readonly SimplePiece[], rotation: number, axis: Sq1Axis): DrawElement[] {
  const elements = axisElements(axis, 'sq1_line');
  let angle = 0;

  for (const piece of pieces) {
    const paths = piece.kind === 'edge' ? SQ1_EDGE_PATHS : SQ1_CORNER_PATHS;
    const baseRotate = angle + (piece.kind === 'edge' ? 30 : 90);
    paths.forEach((d, pathIndex) => {
      elements.push({
        key: `${piece.kind}${piece.id}_${pathIndex}`,
        d,
        baseRotate,
        rotate: rotation,
        rotatePoint: SQ1_ROTATE_POINT,
      });
    });
    angle += piece.kind === 'edge' ? 30 : 60;
  }

  return elements;
}

function layerElements(
  layer: Sq1Layer,
  shape: LayerShape,
  rotation: number,
  axis: Sq1Axis,
  labels: readonly string[],
  showLabels: boolean,
): DrawElement[] {
  const preset = sq1PresetById(shape.presetId);
  if (!preset) return [];

  const translate = layer === 'bottom' ? ([0, 75] as const) : undefined;
  const elements = axisElements(axis, `sq1_line_${layer}`, translate);
  let angle = 0;

  for (let index = 0; index < preset.pattern.length; index += 1) {
    const piece = preset.pattern[index] === 'e' ? 'edge' : 'corner';
    const paths = piece === 'edge' ? SQ1_EDGE_PATHS : SQ1_CORNER_PATHS;
    const baseRotate = angle + (piece === 'edge' ? 30 : 90);
    const textCellId = `sq1-${layer}-${shape.revision}-text-${index}`;

    paths.forEach((d, pathIndex) => {
      elements.push({
        key: `sq1-${layer}-${shape.revision}-${piece}-${index}-${pathIndex}`,
        d,
        baseRotate,
        rotate: rotation,
        rotatePoint: SQ1_ROTATE_POINT,
        translate,
        unColorBindKey: pathIndex === 0 ? textCellId : undefined,
      });
    });

    elements.push({
      key: textCellId,
      cellId: textCellId,
      type: 'text',
      text: labels[index] ?? String(index),
      textPoint: piece === 'edge' ? SQ1_EDGE_TEXT_POINT : SQ1_CORNER_TEXT_POINT,
      textRouteResetPoint: [1.7, -2.5],
      textSize: 6,
      baseRotate,
      rotate: rotation,
      rotatePoint: SQ1_ROTATE_POINT,
      translate,
      disableDrawing: true,
      defaultFill: DRAW_FONT_COLOR,
      disShow: !showLabels,
    });

    angle += piece === 'edge' ? 30 : 60;
  }

  return elements;
}

function labelsForPreset(presetId: string): string[] {
  const length = sq1PresetById(presetId)?.pattern.length ?? 0;
  return Array.from({ length }, (_, index) => String(index));
}

export function Sq1DrawPanel({ onDocumentChange }: Sq1DrawPanelProps) {
  const t = useT();
  const [view, setView] = useState<Sq1View>('single');
  const nextSimpleId = useRef(6);
  const nextLayerRevision = useRef(2);
  const [simplePieces, setSimplePieces] = useState<SimplePiece[]>(() =>
    Array.from({ length: 6 }, (_, id) => ({ id, kind: 'corner' as const })),
  );
  const [simplePresetId, setSimplePresetId] = useState('star');
  const [simpleRotation, setSimpleRotation] = useState(0);
  const [simpleAxis, setSimpleAxis] = useState<Sq1Axis>(30);

  const [topShape, setTopShape] = useState<LayerShape>({ presetId: 'star', revision: 0 });
  const [bottomShape, setBottomShape] = useState<LayerShape>({ presetId: '8', revision: 1 });
  const [topRotation, setTopRotation] = useState(0);
  const [bottomRotation, setBottomRotation] = useState(0);
  const [topAxis, setTopAxis] = useState<Sq1Axis>(30);
  const [bottomAxis, setBottomAxis] = useState<Sq1Axis>(-30);
  const [showLabels, setShowLabels] = useState(false);
  const [topLabels, setTopLabels] = useState<string[]>(() => labelsForPreset('star'));
  const [bottomLabels, setBottomLabels] = useState<string[]>(() => labelsForPreset('8'));

  const singleDocument = useRef<DrawExport | null>(null);
  const doubleDocument = useRef<DrawExport | null>(null);

  const simpleAngle = useMemo(
    () => simplePieces.reduce((sum, piece) => sum + (piece.kind === 'edge' ? 30 : 60), 0),
    [simplePieces],
  );
  const simpleCounts = useMemo(() => ({
    corners: simplePieces.filter((piece) => piece.kind === 'corner').length,
    edges: simplePieces.filter((piece) => piece.kind === 'edge').length,
  }), [simplePieces]);
  const canAddCorner = simpleCounts.corners < 6 && simpleAngle + 60 <= 360;
  const canAddEdge = simpleCounts.edges < 8 && simpleAngle + 30 <= 360;

  const singleElements = useMemo(
    () => simpleElements(simplePieces, simpleRotation, simpleAxis),
    [simpleAxis, simplePieces, simpleRotation],
  );

  const compatibleBottomPresets = useMemo(() => {
    const top = sq1PresetById(topShape.presetId);
    if (!top) return [];
    const topCounts = sq1PieceCounts(top.pattern);
    return SQ1_PRESETS.filter((preset) => {
      const counts = sq1PieceCounts(preset.pattern);
      return counts.edges === 8 - topCounts.edges && counts.corners === 8 - topCounts.corners;
    });
  }, [topShape.presetId]);

  const doubleElements = useMemo(() => [
    ...layerElements('top', topShape, topRotation, topAxis, topLabels, showLabels),
    ...layerElements('bottom', bottomShape, bottomRotation, bottomAxis, bottomLabels, showLabels),
  ], [
    bottomAxis,
    bottomLabels,
    bottomRotation,
    bottomShape,
    showLabels,
    topAxis,
    topLabels,
    topRotation,
    topShape,
  ]);

  const publishSingleDocument = useCallback((document: DrawExport) => {
    singleDocument.current = document;
    if (view === 'single') onDocumentChange?.(document);
  }, [onDocumentChange, view]);

  const publishDoubleDocument = useCallback((document: DrawExport) => {
    doubleDocument.current = document;
    if (view === 'double') onDocumentChange?.(document);
  }, [onDocumentChange, view]);

  useEffect(() => {
    const document = view === 'single' ? singleDocument.current : doubleDocument.current;
    if (document) onDocumentChange?.(document);
  }, [onDocumentChange, view]);

  const selectSimplePreset = (presetId: string) => {
    const preset = sq1PresetById(presetId);
    if (!preset) return;
    const pieces = Array.from(preset.pattern, (kind) => ({
      id: nextSimpleId.current++,
      kind: kind === 'e' ? 'edge' as const : 'corner' as const,
    }));
    setSimplePieces(pieces);
    setSimplePresetId(presetId);
  };

  const resetSimple = () => {
    setSimplePieces([]);
    setSimplePresetId('');
  };

  const deleteSimplePiece = () => {
    setSimplePieces((pieces) => pieces.slice(0, -1));
    setSimplePresetId('');
  };

  const addSimplePiece = (kind: Sq1PieceKind) => {
    if (kind === 'corner' ? !canAddCorner : !canAddEdge) return;
    setSimplePieces((pieces) => [...pieces, { id: nextSimpleId.current++, kind }]);
  };

  const selectTopPreset = (presetId: string) => {
    const preset = sq1PresetById(presetId);
    if (!preset) return;
    const topCounts = sq1PieceCounts(preset.pattern);
    const bottom = SQ1_PRESETS.find((candidate) => {
      const counts = sq1PieceCounts(candidate.pattern);
      return counts.edges === 8 - topCounts.edges && counts.corners === 8 - topCounts.corners;
    });
    if (!bottom) return;

    setTopShape({ presetId, revision: nextLayerRevision.current++ });
    setTopLabels(labelsForPreset(presetId));
    setBottomShape({ presetId: bottom.id, revision: nextLayerRevision.current++ });
    setBottomLabels(labelsForPreset(bottom.id));
  };

  const selectBottomPreset = (presetId: string) => {
    if (!compatibleBottomPresets.some((preset) => preset.id === presetId)) return;
    setBottomShape({ presetId, revision: nextLayerRevision.current++ });
    setBottomLabels(labelsForPreset(presetId));
  };

  const setLayerLabel = (layer: Sq1Layer, index: number, value: string) => {
    const setter = layer === 'top' ? setTopLabels : setBottomLabels;
    const character = Array.from(value)[0] ?? '';
    setter((labels) => labels.map((label, labelIndex) => (labelIndex === index ? character : label)));
  };

  const singleControls = (
    <div style={{ display: 'grid', gap: 14 }}>
      <ControlField label={t('旋转', 'Rotation')}>
        <input
          type="range"
          min={0}
          max={180}
          step={30}
          value={simpleRotation}
          aria-label={t('旋转', 'Rotation')}
          onChange={(event) => setSimpleRotation(Number(event.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </ControlField>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))', gap: 10 }}>
        <ControlField label={t('中轴线', 'Central axis')}>
          <select value={simpleAxis} style={selectStyle} onChange={(event) => setSimpleAxis(Number(event.target.value) as Sq1Axis)}>
            <option value={0}>{t('无', 'None')}</option>
            <option value={30}>{t('正 15 度', 'Positive 15°')}</option>
            <option value={-30}>{t('负 15 度', 'Negative 15°')}</option>
          </select>
        </ControlField>
        <ControlField label={t('预设', 'Preset')}>
          <select value={simplePresetId} style={selectStyle} onChange={(event) => selectSimplePreset(event.target.value)}>
            <option value="">{t('无', 'None')}</option>
            {SQ1_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{presetLabel(t, preset)}</option>
            ))}
          </select>
        </ControlField>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" disabled={simplePieces.length === 0} style={actionButtonStyle(false, simplePieces.length === 0)} onClick={resetSimple}>
          {t('重置', 'Reset')}
        </button>
        <button type="button" disabled={simplePieces.length === 0} style={actionButtonStyle(false, simplePieces.length === 0)} onClick={deleteSimplePiece}>
          {t('删除', 'Delete')}
        </button>
        <button type="button" disabled={!canAddCorner} style={actionButtonStyle(true, !canAddCorner)} onClick={() => addSimplePiece('corner')}>
          {t('添加角块', 'Add corner')}
        </button>
        <button type="button" disabled={!canAddEdge} style={actionButtonStyle(true, !canAddEdge)} onClick={() => addSimplePiece('edge')}>
          {t('添加棱块', 'Add edge')}
        </button>
      </div>
    </div>
  );

  const layerControls = (
    <div style={{ display: 'grid', gap: 14 }}>
      <BoolToggle value={showLabels} onChange={setShowLabels} label={t('文字', 'Labels')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))', gap: 10 }}>
        <ControlField label={t('顶层', 'Top')}>
          <select value={topShape.presetId} style={selectStyle} onChange={(event) => selectTopPreset(event.target.value)}>
            {SQ1_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{presetLabel(t, preset)}</option>
            ))}
          </select>
        </ControlField>
        <ControlField label={t('顶层中轴线', 'Top axis')}>
          <select value={topAxis} style={selectStyle} onChange={(event) => setTopAxis(Number(event.target.value) as Sq1Axis)}>
            <option value={0}>{t('无', 'None')}</option>
            <option value={30}>{t('正 15 度', 'Positive 15°')}</option>
            <option value={-30}>{t('负 15 度', 'Negative 15°')}</option>
          </select>
        </ControlField>
        <ControlField label={t('顶层旋转', 'Top rotation')}>
          <input type="range" min={0} max={180} step={30} value={topRotation} aria-label={t('顶层旋转', 'Top rotation')} onChange={(event) => setTopRotation(Number(event.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </ControlField>
      </div>

      {showLabels && topLabels.length > 0 ? (
        <ControlField label={t('顶层文字', 'Top labels')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(40px, 1fr))', gap: 6 }}>
            {topLabels.map((label, index) => (
              <input
                key={`top-label-${index}`}
                value={label}
                maxLength={1}
                aria-label={`${t('顶层文字', 'Top label')} ${index + 1}`}
                onChange={(event) => setLayerLabel('top', index, event.target.value)}
                style={{ ...selectStyle, textAlign: 'center', paddingInline: 4 }}
              />
            ))}
          </div>
        </ControlField>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))', gap: 10 }}>
        <ControlField label={t('底层', 'Bottom')}>
          <select value={bottomShape.presetId} style={selectStyle} onChange={(event) => selectBottomPreset(event.target.value)}>
            {compatibleBottomPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{presetLabel(t, preset)}</option>
            ))}
          </select>
        </ControlField>
        <ControlField label={t('底层中轴线', 'Bottom axis')}>
          <select value={bottomAxis} style={selectStyle} onChange={(event) => setBottomAxis(Number(event.target.value) as Sq1Axis)}>
            <option value={0}>{t('无', 'None')}</option>
            <option value={30}>{t('正 15 度', 'Positive 15°')}</option>
            <option value={-30}>{t('负 15 度', 'Negative 15°')}</option>
          </select>
        </ControlField>
        <ControlField label={t('底层旋转', 'Bottom rotation')}>
          <input type="range" min={0} max={180} step={30} value={bottomRotation} aria-label={t('底层旋转', 'Bottom rotation')} onChange={(event) => setBottomRotation(Number(event.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </ControlField>
      </div>

      {showLabels && bottomLabels.length > 0 ? (
        <ControlField label={t('底层文字', 'Bottom labels')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(40px, 1fr))', gap: 6 }}>
            {bottomLabels.map((label, index) => (
              <input
                key={`bottom-label-${index}`}
                value={label}
                maxLength={1}
                aria-label={`${t('底层文字', 'Bottom label')} ${index + 1}`}
                onChange={(event) => setLayerLabel('bottom', index, event.target.value)}
                style={{ ...selectStyle, textAlign: 'center', paddingInline: 4 }}
              />
            ))}
          </div>
        </ControlField>
      ) : null}
    </div>
  );

  return (
    <div style={panelStyle}>
      <div role="tablist" aria-label={t('SQ1 绘图视图', 'SQ1 drawing view')} style={tabRowStyle}>
        <button type="button" role="tab" aria-selected={view === 'single'} style={tabStyle(view === 'single')} onClick={() => setView('single')}>
          {t('俯视图', 'Top view')}
        </button>
        <button type="button" role="tab" aria-selected={view === 'double'} style={tabStyle(view === 'double')} onClick={() => setView('double')}>
          {t('双层图', 'Double view')}
        </button>
      </div>

      <div role="tabpanel" hidden={view !== 'single'}>
        <DrawCanvas
          elements={singleElements}
          viewBox="0 0 75 75"
          width={400}
          height={400}
          filenameBase="sq1-top"
          presetColors={SQ1_STICKER_PALETTE}
          historyStorageKey="sq1Draw"
          strokeWidthScale={0.2}
          controls={singleControls}
          onDocumentChange={publishSingleDocument}
        />
      </div>

      <div role="tabpanel" hidden={view !== 'double'}>
        <DrawCanvas
          elements={doubleElements}
          viewBox="0 0 75 150"
          width={300}
          height={600}
          filenameBase="sq1-double"
          presetColors={SQ1_STICKER_PALETTE}
          historyStorageKey="sq1DrawDouble"
          strokeWidthScale={0.2}
          controls={layerControls}
          onDocumentChange={publishDoubleDocument}
        />
      </div>
    </div>
  );
}

export default Sq1DrawPanel;
