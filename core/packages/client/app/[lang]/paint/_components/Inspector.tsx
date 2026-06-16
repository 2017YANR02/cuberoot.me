'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  BringToFront,
  SendToBack,
  ArrowUp,
  ArrowDown,
  Group as GroupIcon,
  Ungroup,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Ban,
  Link2,
  Link2Off,
  Minus,
  Plus,
} from 'lucide-react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { CUBE_FILL } from '@/lib/cube-colors';
import type { LineShape, PolygonShape, Shape, StarShape, TextShape } from '../_lib/types';
import { usePaint } from '../_lib/store';
import { remeasureText } from '../_lib/registry';
import LayersPanel from './LayersPanel';

// Swatch palette for the color pickers — the colors WCA puzzles use, so drawings
// match scramble art. Standard cube scheme (single-sourced from CUBE_FILL: white /
// yellow / green / blue / orange / red) + the extra Megaminx hues (tnoodle
// MegaminxPuzzle default scheme), ending with neutral gray / black ink.
const WCA_SWATCHES: string[] = [
  CUBE_FILL.U, CUBE_FILL.D, CUBE_FILL.F, CUBE_FILL.B, CUBE_FILL.L, CUBE_FILL.R,
  '#8a1aff', // megaminx purple
  '#ff99ff', // megaminx pink
  '#71e600', // megaminx light green
  '#88ddff', // megaminx light blue
  '#ffffb3', // megaminx cream
  '#ff8433', // megaminx light orange
  '#006600', // megaminx dark green
  '#0000b3', // megaminx dark blue
  '#999999', // neutral gray
  '#000000', // black ink
];

const DASH_PRESETS: Record<string, number[] | undefined> = {
  solid: undefined,
  dashed: [8, 6],
  dotted: [1, 5],
};
function dashName(dash?: number[]): string {
  if (!dash || !dash.length) return 'solid';
  if (dash[0] <= 2) return 'dotted';
  return 'dashed';
}

// shared value over a list of shapes: returns the value if all equal, else undefined
function common<T>(shapes: Shape[], pick: (s: Shape) => T): T | undefined {
  if (!shapes.length) return undefined;
  const first = pick(shapes[0]);
  return shapes.every((s) => pick(s) === first) ? first : undefined;
}

export default function Inspector() {
  const t = useT();
  const selection = usePaint((s) => s.selection);
  const shapesMap = usePaint((s) => s.shapes);
  const [open, setOpen] = useState(false);

  const sel = selection.map((id) => shapesMap[id]).filter((s): s is Shape => !!s);
  const ids = sel.map((s) => s.id);

  const update = useCallback(
    (patch: Partial<Shape>, commit = true) => {
      usePaint.getState().updateShapes(ids, patch, commit);
    },
    [ids]
  );

  const hasFill = sel.some((s) => 'fill' in s);

  return (
    <aside className={`paint-inspector${open ? ' is-open' : ''}`}>
      <div
        className="paint-sheet-handle"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
      >
        {sel.length
          ? t(`已选 ${sel.length} 个`, `${sel.length} selected`)
          : t('属性', 'Properties')}
      </div>

      <LayersPanel />

      {sel.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Fill */}
          {hasFill && (
            <section className="paint-insp-section">
              <div className="paint-insp-title">{t('填充', 'Fill')}</div>
              <ColorField
                value={common(sel, (s) => s.fill) ?? '#cbd5e1'}
                onChange={(v, commit) => update({ fill: v }, commit)}
              />
            </section>
          )}

          {/* Stroke */}
          <section className="paint-insp-section">
            <div className="paint-insp-title">{t('描边', 'Stroke')}</div>
            <ColorField
              value={common(sel, (s) => s.stroke) ?? '#1e293b'}
              onChange={(v, commit) => update({ stroke: v }, commit)}
            />
            <div className="paint-insp-row" style={{ marginTop: 7 }}>
              <span className="paint-insp-label">{t('粗', 'W')}</span>
              <NumberField
                value={common(sel, (s) => s.strokeWidth)}
                min={0}
                onChange={(v, commit) => update({ strokeWidth: Math.max(0, v) }, commit)}
              />
              <select
                className="paint-select"
                value={dashName(common(sel, (s) => s.strokeDash))}
                onChange={(e) => update({ strokeDash: DASH_PRESETS[e.target.value] }, true)}
              >
                <option value="solid">{t('实线', 'Solid')}</option>
                <option value="dashed">{t('虚线', 'Dashed')}</option>
                <option value="dotted">{t('点线', 'Dotted')}</option>
              </select>
            </div>
            <div className="paint-insp-row">
              <span className="paint-insp-label">{t('端', 'Cap')}</span>
              <div className="paint-seg">
                {(['butt', 'round', 'square'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={common(sel, (s) => s.strokeLinecap ?? 'butt') === c ? 'is-on' : ''}
                    onClick={() => update({ strokeLinecap: c }, true)}
                  >
                    {c === 'butt' ? t('平', 'Butt') : c === 'round' ? t('圆', 'Round') : t('方', 'Sq')}
                  </button>
                ))}
              </div>
            </div>
            <div className="paint-insp-row">
              <span className="paint-insp-label">{t('角', 'Join')}</span>
              <div className="paint-seg">
                {(['miter', 'round', 'bevel'] as const).map((j) => (
                  <button
                    key={j}
                    type="button"
                    className={common(sel, (s) => s.strokeLinejoin ?? 'miter') === j ? 'is-on' : ''}
                    onClick={() => update({ strokeLinejoin: j }, true)}
                  >
                    {j === 'miter' ? t('尖', 'Miter') : j === 'round' ? t('圆', 'Round') : t('斜', 'Bevel')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="paint-insp-section">
            <div className="paint-insp-title">{t('外观', 'Appearance')}</div>
            <div className="paint-insp-row">
              <span className="paint-insp-label">{t('明', 'O')}</span>
              <input
                className="paint-range"
                type="range"
                min={0}
                max={100}
                value={Math.round((common(sel, (s) => s.opacity) ?? 1) * 100)}
                onChange={(e) => update({ opacity: Number(e.target.value) / 100 }, false)}
                onPointerUp={() => usePaint.getState().commit()}
                onPointerDown={() => usePaint.getState().beginHistory()}
              />
              <span className="paint-range-val">
                {Math.round((common(sel, (s) => s.opacity) ?? 1) * 100)}%
              </span>
            </div>
          </section>

          {/* Geometry */}
          <GeometrySection sel={sel} update={update} />

          {/* Polygon */}
          <PolygonSection sel={sel} update={update} />

          {/* Star */}
          <StarSection sel={sel} update={update} />

          {/* Text */}
          <TextSection sel={sel} update={update} />

          {/* Arrange */}
          <ArrangeSection sel={sel} />
        </>
      )}
    </aside>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <section className="paint-insp-section">
      <div className="paint-insp-title">{t('画布', 'Canvas')}</div>
      <p className="paint-hint">
        {t(
          '未选中对象。用左侧工具绘制形状，或点击已有形状进行编辑。',
          'Nothing selected. Draw a shape with a tool on the left, or click an existing shape to edit.'
        )}
      </p>
      <p className="paint-hint" style={{ marginTop: 8 }}>
        <span className="paint-kbd">V</span> {t('选择', 'select')} ·{' '}
        <span className="paint-kbd">R</span> {t('矩形', 'rect')} ·{' '}
        <span className="paint-kbd">O</span> {t('椭圆', 'ellipse')} ·{' '}
        <span className="paint-kbd">H</span>/<span className="paint-kbd">Space</span>{' '}
        {t('平移', 'pan')}
      </p>
    </section>
  );
}

// A line is the diagonal of its (unrotated) bbox; `flipped` picks which diagonal.
// So its on-screen slope lives in width/height/flipped (+ box rotation), NOT in the
// `rotation` field — that one only spins the box. These helpers expose the *visual*
// angle so the ∠ field can read/drive the line direction directly.
function lineEndsLocal(s: LineShape): [[number, number], [number, number]] {
  return s.flipped
    ? [[s.x, s.y + s.height], [s.x + s.width, s.y]]
    : [[s.x, s.y], [s.x + s.width, s.y + s.height]];
}
// Visual orientation in [0,180) degrees (a segment and its 180° flip look the same).
function lineAngleDeg(s: LineShape): number {
  const [[ax, ay], [bx, by]] = lineEndsLocal(s);
  const deg = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI + s.rotation;
  return ((deg % 180) + 180) % 180;
}
// Rebuild width/height/flipped so the line points at `deg`, keeping its midpoint and
// length fixed, folding any box rotation back to 0.
function linePatchFromAngle(s: LineShape, deg: number): Partial<LineShape> {
  const [[ax, ay], [bx, by]] = lineEndsLocal(s);
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-6) return {};
  const r = (deg * Math.PI) / 180;
  const hx = (len / 2) * Math.cos(r);
  const hy = (len / 2) * Math.sin(r);
  const flipped = hx < 0 ? hy >= 0 : hy < 0;
  return {
    x: cx - Math.abs(hx),
    y: cy - Math.abs(hy),
    width: Math.abs(2 * hx),
    height: Math.abs(2 * hy),
    flipped,
    rotation: 0,
  };
}

function GeometrySection({
  sel,
  update,
}: {
  sel: Shape[];
  update: (patch: Partial<Shape>, commit?: boolean) => void;
}) {
  const t = useT();
  const [lockAspect, setLockAspect] = useState(false);
  const single = sel.length === 1 ? sel[0] : null;
  const isRect = single?.type === 'rect';
  const lineSingle = single && single.type === 'line' ? (single as LineShape) : null;

  const w = common(sel, (s) => s.width);
  const h = common(sel, (s) => s.height);

  const setW = (val: number, commit: boolean) => {
    const nv = Math.max(1, val);
    if (lockAspect && single && single.width) {
      const ratio = single.height / single.width;
      update({ width: nv, height: nv * ratio }, commit);
    } else {
      update({ width: nv }, commit);
    }
  };
  const setH = (val: number, commit: boolean) => {
    const nv = Math.max(1, val);
    if (lockAspect && single && single.height) {
      const ratio = single.width / single.height;
      update({ height: nv, width: nv * ratio }, commit);
    } else {
      update({ height: nv }, commit);
    }
  };

  return (
    <section className="paint-insp-section">
      <div className="paint-insp-title">{t('几何', 'Geometry')}</div>
      <div className="paint-insp-grid2">
        <LabeledNumber
          prefix="X"
          value={common(sel, (s) => s.x)}
          onChange={(v, c) => update({ x: v }, c)}
        />
        <LabeledNumber
          prefix="Y"
          value={common(sel, (s) => s.y)}
          onChange={(v, c) => update({ y: v }, c)}
        />
      </div>
      <div className="paint-insp-grid2" style={{ marginTop: 6, alignItems: 'center' }}>
        <LabeledNumber prefix="W" value={w} onChange={setW} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LabeledNumber prefix="H" value={h} onChange={setH} />
          <button
            type="button"
            className={`paint-lock-btn${lockAspect ? ' is-on' : ''}`}
            title={t('锁定宽高比', 'Lock aspect ratio')}
            onClick={() => setLockAspect((v) => !v)}
          >
            {lockAspect ? <Link2 size={14} /> : <Link2Off size={14} />}
          </button>
        </div>
      </div>
      <div className="paint-insp-grid2" style={{ marginTop: 6 }}>
        <LabeledNumber
          prefix="∠"
          value={
            lineSingle
              ? Math.round(lineAngleDeg(lineSingle))
              : common(sel, (s) => Math.round(s.rotation))
          }
          onChange={(v, c) =>
            lineSingle
              ? update(linePatchFromAngle(lineSingle, v), c)
              : update({ rotation: ((v % 360) + 360) % 360 }, c)
          }
        />
        {isRect && (
          <LabeledNumber
            prefix="◵"
            value={(single as Extract<Shape, { type: 'rect' }>).rx}
            min={0}
            onChange={(v, c) => update({ rx: Math.max(0, v) } as Partial<Shape>, c)}
          />
        )}
      </div>
    </section>
  );
}

function PolygonSection({
  sel,
  update,
}: {
  sel: Shape[];
  update: (patch: Partial<Shape>, commit?: boolean) => void;
}) {
  const t = useT();
  const poly = sel.length === 1 && sel[0].type === 'polygon' ? (sel[0] as PolygonShape) : null;
  if (!poly) return null;
  const setSides = (n: number) =>
    update({ sides: Math.max(3, Math.round(n)) } as Partial<Shape>, true);

  return (
    <section className="paint-insp-section">
      <div className="paint-insp-title">{t('多边形', 'Polygon')}</div>
      <div className="paint-insp-row">
        <span className="paint-insp-label paint-insp-label--wide">{t('边数', 'Sides')}</span>
        <Stepper value={poly.sides} min={3} onChange={setSides} />
      </div>
      <div className="paint-insp-row" style={{ marginTop: 7 }}>
        <span className="paint-insp-label paint-insp-label--wide">{t('圆角', 'Round')}</span>
        <NumberField
          value={poly.rx ?? 0}
          min={0}
          onChange={(v, commit) => update({ rx: Math.max(0, v) } as Partial<Shape>, commit)}
        />
      </div>
    </section>
  );
}

function StarSection({
  sel,
  update,
}: {
  sel: Shape[];
  update: (patch: Partial<Shape>, commit?: boolean) => void;
}) {
  const t = useT();
  const star = sel.length === 1 && sel[0].type === 'star' ? (sel[0] as StarShape) : null;
  if (!star) return null;
  const setPoints = (n: number) =>
    update({ points: Math.max(3, Math.round(n)) } as Partial<Shape>, true);
  const ratioPct = Math.round((star.innerRatio ?? 0.5) * 100);

  return (
    <section className="paint-insp-section">
      <div className="paint-insp-title">{t('星形', 'Star')}</div>
      <div className="paint-insp-row">
        <span className="paint-insp-label paint-insp-label--wide">{t('角数', 'Points')}</span>
        <Stepper value={star.points} min={3} onChange={setPoints} />
      </div>
      <div className="paint-insp-row" style={{ marginTop: 7 }}>
        <span className="paint-insp-label paint-insp-label--wide">{t('内径', 'Inner')}</span>
        <input
          className="paint-range"
          type="range"
          min={5}
          max={100}
          value={ratioPct}
          onChange={(e) =>
            update({ innerRatio: Number(e.target.value) / 100 } as Partial<Shape>, false)
          }
          onPointerDown={() => usePaint.getState().beginHistory()}
          onPointerUp={() => usePaint.getState().commit()}
        />
        <span className="paint-range-val">{ratioPct}%</span>
      </div>
      <div className="paint-insp-row" style={{ marginTop: 7 }}>
        <span className="paint-insp-label paint-insp-label--wide">{t('圆角', 'Round')}</span>
        <NumberField
          value={star.rx ?? 0}
          min={0}
          onChange={(v, commit) => update({ rx: Math.max(0, v) } as Partial<Shape>, commit)}
        />
      </div>
    </section>
  );
}

const FONT_FAMILIES: { value: string; label: { zh: string; en: string } }[] = [
  { value: 'var(--font-sans)', label: { zh: '无衬线', en: 'Sans' } },
  { value: 'var(--font-serif)', label: { zh: '衬线', en: 'Serif' } },
  { value: 'var(--font-mono)', label: { zh: '等宽', en: 'Mono' } },
  { value: 'sans-serif', label: { zh: '系统无衬线', en: 'System sans' } },
];

const FONT_WEIGHTS = [
  { value: 400, label: { zh: '常规', en: 'Regular' } },
  { value: 600, label: { zh: '半粗', en: 'Semibold' } },
  { value: 700, label: { zh: '粗体', en: 'Bold' } },
];

function TextSection({
  sel,
  update,
}: {
  sel: Shape[];
  update: (patch: Partial<Shape>, commit?: boolean) => void;
}) {
  const t = useT();
  const text = sel.length === 1 && sel[0].type === 'text' ? (sel[0] as TextShape) : null;
  if (!text) return null;

  // Apply a text-affecting patch then re-measure the box so handles stay tight.
  const applyAndMeasure = (patch: Partial<TextShape>, commit: boolean) => {
    const next = { ...text, ...patch } as TextShape;
    const m = remeasureText(next);
    update({ ...patch, width: m.width, height: m.height } as Partial<Shape>, commit);
  };

  return (
    <section className="paint-insp-section">
      <div className="paint-insp-title">{t('文字', 'Text')}</div>
      <div className="paint-insp-row">
        <span className="paint-insp-label paint-insp-label--wide">{t('字体', 'Font')}</span>
        <select
          className="paint-select"
          value={text.fontFamily}
          onChange={(e) => applyAndMeasure({ fontFamily: e.target.value }, true)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {tr(f.label)}
            </option>
          ))}
        </select>
      </div>
      <div className="paint-insp-row" style={{ marginTop: 7 }}>
        <span className="paint-insp-label paint-insp-label--wide">{t('字号', 'Size')}</span>
        <NumberField
          value={text.fontSize}
          min={1}
          onChange={(v, commit) => applyAndMeasure({ fontSize: Math.max(1, v) }, commit)}
        />
      </div>
      <div className="paint-insp-row" style={{ marginTop: 7 }}>
        <span className="paint-insp-label paint-insp-label--wide">{t('字重', 'Weight')}</span>
        <select
          className="paint-select"
          value={text.fontWeight}
          onChange={(e) => applyAndMeasure({ fontWeight: Number(e.target.value) }, true)}
        >
          {FONT_WEIGHTS.map((w) => (
            <option key={w.value} value={w.value}>
              {tr(w.label)}
            </option>
          ))}
        </select>
      </div>
      <div className="paint-insp-row" style={{ marginTop: 7 }}>
        <span className="paint-insp-label paint-insp-label--wide">{t('对齐', 'Align')}</span>
        <div className="paint-seg">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={text.textAlign === a ? 'is-on' : ''}
              title={
                a === 'left'
                  ? t('左对齐', 'Left')
                  : a === 'center'
                    ? t('居中', 'Center')
                    : t('右对齐', 'Right')
              }
              onClick={() => update({ textAlign: a } as Partial<Shape>, true)}
            >
              {a === 'left' ? (
                <AlignLeft size={14} />
              ) : a === 'center' ? (
                <AlignCenter size={14} />
              ) : (
                <AlignRight size={14} />
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stepper({
  value,
  min,
  onChange,
}: {
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="paint-stepper">
      <button
        type="button"
        className="paint-btn"
        aria-label="−"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <NumberField value={value} min={min} onChange={(v, commit) => commit && onChange(v)} />
      <button type="button" className="paint-btn" aria-label="+" onClick={() => onChange(value + 1)}>
        <Plus size={14} />
      </button>
    </div>
  );
}

function ArrangeSection({ sel }: { sel: Shape[] }) {
  const t = useT();
  const st = usePaint.getState;
  const multi = sel.length >= 2;
  const dist = sel.length >= 3;
  const hasGroup = sel.some((s) => s.type === 'group');
  const locked = sel.length === 1 ? !!sel[0].locked : false;

  return (
    <section className="paint-insp-section">
      <div className="paint-insp-title">{t('排列', 'Arrange')}</div>

      {multi && (
        <>
          <div className="paint-arrange-grid">
            <IconBtn label={t('左对齐', 'Align left')} onClick={() => st().align('left')}>
              <AlignStartVertical size={15} />
            </IconBtn>
            <IconBtn label={t('水平居中', 'Align center')} onClick={() => st().align('centerX')}>
              <AlignCenterVertical size={15} />
            </IconBtn>
            <IconBtn label={t('右对齐', 'Align right')} onClick={() => st().align('right')}>
              <AlignEndVertical size={15} />
            </IconBtn>
            <IconBtn label={t('顶对齐', 'Align top')} onClick={() => st().align('top')}>
              <AlignStartHorizontal size={15} />
            </IconBtn>
            <IconBtn label={t('垂直居中', 'Align middle')} onClick={() => st().align('centerY')}>
              <AlignCenterHorizontal size={15} />
            </IconBtn>
            <IconBtn label={t('底对齐', 'Align bottom')} onClick={() => st().align('bottom')}>
              <AlignEndHorizontal size={15} />
            </IconBtn>
          </div>
          {dist && (
            <div className="paint-arrange-grid" style={{ marginTop: 4, gridTemplateColumns: '1fr 1fr' }}>
              <IconBtn label={t('水平分布', 'Distribute H')} onClick={() => st().distribute('x')}>
                <AlignHorizontalSpaceBetween size={15} />
              </IconBtn>
              <IconBtn label={t('垂直分布', 'Distribute V')} onClick={() => st().distribute('y')}>
                <AlignVerticalSpaceBetween size={15} />
              </IconBtn>
            </div>
          )}
        </>
      )}

      <div className="paint-arrange-grid" style={{ marginTop: multi ? 6 : 0, gridTemplateColumns: 'repeat(4,1fr)' }}>
        <IconBtn label={t('置于顶层', 'To front')} onClick={() => reorderSel('front')}>
          <BringToFront size={15} />
        </IconBtn>
        <IconBtn label={t('上移一层', 'Forward')} onClick={() => reorderSel('forward')}>
          <ArrowUp size={15} />
        </IconBtn>
        <IconBtn label={t('下移一层', 'Backward')} onClick={() => reorderSel('backward')}>
          <ArrowDown size={15} />
        </IconBtn>
        <IconBtn label={t('置于底层', 'To back')} onClick={() => reorderSel('back')}>
          <SendToBack size={15} />
        </IconBtn>
      </div>

      <div className="paint-arrange-grid" style={{ marginTop: 6, gridTemplateColumns: 'repeat(4,1fr)' }}>
        <IconBtn
          label={t('编组', 'Group')}
          disabled={!multi}
          onClick={() => st().group()}
        >
          <GroupIcon size={15} />
        </IconBtn>
        <IconBtn
          label={t('取消编组', 'Ungroup')}
          disabled={!hasGroup}
          onClick={() => st().ungroup()}
        >
          <Ungroup size={15} />
        </IconBtn>
        <IconBtn label={t('复制', 'Duplicate')} onClick={() => st().duplicateSelected()}>
          <Copy size={15} />
        </IconBtn>
        <IconBtn label={t('删除', 'Delete')} onClick={() => st().removeSelected()}>
          <Trash2 size={15} />
        </IconBtn>
      </div>

      {sel.length === 1 && (
        <div className="paint-insp-row" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="paint-btn"
            style={{ flex: 1, border: '1px solid var(--border)' }}
            onClick={() => st().updateShape(sel[0].id, { locked: !locked }, true)}
          >
            {locked ? <Lock size={14} /> : <Unlock size={14} />}
            {locked ? t('已锁定', 'Locked') : t('未锁定', 'Unlocked')}
          </button>
        </div>
      )}
    </section>
  );
}

function reorderSel(dir: 'front' | 'back' | 'forward' | 'backward') {
  const st = usePaint.getState();
  for (const id of st.selection) st.reorder(id, dir);
}

// ---- shared local field components ----

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="paint-btn"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string, commit: boolean) => void;
}) {
  const isNone = value === 'none';
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const colorVal = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  return (
    <>
      <div className="paint-insp-row" style={{ marginBottom: 0 }}>
        <div className="paint-color-field">
          <span className="paint-swatch">
            {isNone ? (
              <span className="paint-swatch-none">
                <Ban size={13} color="var(--muted)" />
              </span>
            ) : (
              <span className="paint-swatch-fill" style={{ background: value }} />
            )}
            <input
              type="color"
              value={colorVal}
              onChange={(e) => {
                setHex(e.target.value);
                onChange(e.target.value, false);
              }}
              onBlur={() => onChange(hex, true)}
            />
          </span>
          <input
            className="paint-input paint-hex"
            value={isNone ? 'none' : hex}
            onChange={(e) => setHex(e.target.value)}
            onBlur={() => {
              const v = hex.trim();
              if (v === 'none' || /^#[0-9a-fA-F]{3,8}$/.test(v)) onChange(v, true);
              else setHex(value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
        <button
          type="button"
          className={`paint-none-toggle${isNone ? ' is-on' : ''}`}
          title="none"
          aria-label="none"
          onClick={() => onChange(isNone ? '#cbd5e1' : 'none', true)}
        >
          <Ban size={14} />
        </button>
      </div>
      <div className="paint-swatches">
        {WCA_SWATCHES.map((sw) => (
          <button
            key={sw}
            type="button"
            className={`paint-swatch-chip${value.toLowerCase() === sw.toLowerCase() ? ' is-on' : ''}`}
            style={{ background: sw }}
            title={sw.toUpperCase()}
            aria-label={sw}
            onClick={() => onChange(sw, true)}
          />
        ))}
      </div>
    </>
  );
}

function LabeledNumber({
  prefix,
  value,
  onChange,
  min,
}: {
  prefix: string;
  value: number | undefined;
  onChange: (v: number, commit: boolean) => void;
  min?: number;
}) {
  return (
    <div className="paint-field">
      <ScrubLabel
        text={prefix}
        value={value}
        min={min}
        onChange={onChange}
      />
      <NumberInput value={value} onChange={onChange} min={min} />
    </div>
  );
}

function NumberField({
  value,
  onChange,
  min,
}: {
  value: number | undefined;
  onChange: (v: number, commit: boolean) => void;
  min?: number;
}) {
  return (
    <div className="paint-field">
      <NumberInput value={value} onChange={onChange} min={min} />
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
}: {
  value: number | undefined;
  onChange: (v: number, commit: boolean) => void;
  min?: number;
}) {
  const [draft, setDraft] = useState<string>('');
  const [editing, setEditing] = useState(false);
  // select-all on the focusing click so a value can be overwritten immediately;
  // the guard lets later clicks in an already-focused field place a caret normally.
  const justFocused = useRef(false);
  const display = editing ? draft : value === undefined ? '' : round(value);

  return (
    <input
      className="paint-input"
      type="number"
      value={display}
      placeholder={value === undefined ? '—' : ''}
      onFocus={(e) => {
        setEditing(true);
        setDraft(value === undefined ? '' : String(round(value)));
        justFocused.current = true;
        e.currentTarget.select();
      }}
      onMouseUp={(e) => {
        // keep the focus-time select-all from collapsing to a caret on this click
        if (justFocused.current) {
          e.preventDefault();
          justFocused.current = false;
        }
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(clampMin(n, min), false);
      }}
      onBlur={() => {
        setEditing(false);
        const n = parseFloat(draft);
        if (Number.isFinite(n)) onChange(clampMin(n, min), true);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

// drag-to-scrub label
function ScrubLabel({
  text,
  value,
  onChange,
  min,
}: {
  text: string;
  value: number | undefined;
  onChange: (v: number, commit: boolean) => void;
  min?: number;
}) {
  const start = useRef<{ x: number; base: number } | null>(null);
  return (
    <span
      className="paint-field-prefix"
      onPointerDown={(e) => {
        if (value === undefined) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, base: value };
        usePaint.getState().beginHistory();
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        onChange(clampMin(start.current.base + dx, min), false);
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        start.current = null;
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        usePaint.getState().commit();
      }}
    >
      {text}
    </span>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function clampMin(n: number, min?: number): number {
  return min !== undefined ? Math.max(min, n) : n;
}
