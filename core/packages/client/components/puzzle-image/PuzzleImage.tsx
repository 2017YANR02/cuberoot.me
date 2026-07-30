'use client';

/**
 * PuzzleImage — the headless preview half of the puzzle-image studio.
 *
 * Owns every render-dispatch DOM branch that used to live inline in
 * the retired app/[lang]/visualcube/page.tsx:
 *
 *   pure          renderSpecSvg()  → visualcube iso/plan/trans + all tnoodle nets
 *   sr-puzzlegen  <PuzzleSVG>      → non-cube iso/top
 *   net-paint-3x3 <InteractiveCubeNet> → the 3x3 net paint editor
 *   skewb-net     <scramble-display>   → cubing.js custom element
 *
 * Dispatch is a REGISTRY keyed on (puzzleType, view) — `view` being cubeView for
 * a cube and puzzleVariant otherwise — so a new renderer is one row, not a sixth
 * `if`. The picture is passive: drag-to-rotate lived on the retired page, where
 * this preview WAS the cube; in the /sim panel it mirrors the sim, whose own
 * 左右 / 上下 sliders (and the real 3D cube next to it) own the camera.
 *
 * The root keeps the class `vc-preview`: app/globals.css and puzzle-image.css
 * key off it, and the studio's export path serializes its <svg> as a last resort
 * as the zero-loss oracle. Do not rename it.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import InteractiveCubeNet from '@/app/[lang]/scramble/solver/_InteractiveCubeNet';
import { PuzzleSVG, type SrColor } from '@/components/PuzzleSVG';
import { CUBE_FILL } from '@/lib/cube-colors';
import { SQ1_COLORS } from '@/app/[lang]/sim/engine/sq1/sq1Colors';
import { invertAlg } from '@/lib/cube3';
import { rotationsMatchDefault } from '@/lib/puzzle-image/defaults';
import { srPromoteAxis } from '@cuberoot/shared/sr-rotations';
import { renderSpecSvg, srKindOf } from '@/lib/puzzle-image/render';
import { sizeEngineSvg } from '@/lib/puzzle-image/engine-svg';
import type { StickerId } from '@/lib/puzzle-image/mask-core';
import type { ImageSpec, PuzzleType } from '@/lib/puzzle-image/types';

// ── skewb net (cubing.js scramble-display) ──────────────────────────────────

/**
 * Skewb 'net' is cubing.js' scramble-display unfolded view (NOT the WCA colour
 * configuration — that's the 'wca' variant, which is our tnoodle port).
 * scramble-display is a thin <scramble-display> custom element around
 * cubing/twisty; importing it side-effect-registers the element via
 * customElements.define, so it is lazy-imported inside the effect (client-only,
 * avoids SSR + a duplicate define on Fast Refresh).
 */
function SkewbNetPreview({ scramble, pixelSize }: { scramble: string; pixelSize: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    let el: HTMLElement | null = null;
    import('scramble-display').then(() => {
      if (cancelled || !hostRef.current) return;
      el = document.createElement('scramble-display');
      el.setAttribute('event', 'skewb');
      el.setAttribute('scramble', scramble ?? '');
      el.setAttribute('visualization', '2D');
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.display = 'block';
      hostRef.current.appendChild(el);
    }).catch((err) => console.warn('[PuzzleImage] scramble-display load failed', err));
    return () => {
      cancelled = true;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    };
  }, [scramble]);
  // Match the scramble-display skewb facelet aspect (12 wide x 9 tall units).
  const size = Math.max(8, Math.round(pixelSize / 12));
  return (
    <div
      ref={hostRef}
      style={{ width: size * 12, height: size * 9, display: 'block' }}
      role="img"
      aria-label="skewb net"
    />
  );
}

// ── registry ────────────────────────────────────────────────────────────────

type RendererId = 'pure' | 'sr-puzzlegen' | 'net-paint-3x3' | 'skewb-net-display';

/** Most rows are a constant; cube `net` alone needs the size to choose. */
type RendererEntry = RendererId | ((s: ImageSpec) => RendererId);

/** Extra `.vc-preview` class, keyed on the RESOLVED renderer — not the row, so a
 *  4x4 `cube:net` (which resolves to the pure tnoodle SVG, not the 3x3 paint
 *  editor) does not inherit the paint-editor marker. Mirrors the original markup,
 *  where these classes lived inside the per-renderer branch. */
const RENDERER_CLASS: Partial<Record<RendererId, string>> = {
  'net-paint-3x3': 'vc-preview-net-paint',
  'skewb-net-display': 'vc-preview-cubing',
};

/** key = `${puzzleType}:${cubeView | puzzleVariant}`. Every combination the codec
 *  can produce has a row — an unknown key falls back to the pure renderer. */
const REGISTRY: Record<string, RendererEntry> = {
  'cube:normal': 'pure',
  'cube:plan':   'pure',
  'cube:trans':  'pure',
  // 3x3 net is the paint editor; every other size falls through to the tnoodle net.
  'cube:net':    (s) => (s.cubeSize === 3 ? 'net-paint-3x3' : 'pure'),
  'cube:wca':    'pure',

  'sq1:iso':      'sr-puzzlegen',
  'sq1:top':      'sr-puzzlegen',
  'sq1:net':      'pure',
  'sq1:wca':      'pure',

  'megaminx:iso': 'sr-puzzlegen',
  'megaminx:top': 'sr-puzzlegen',
  'megaminx:net': 'pure',
  'megaminx:wca': 'pure',

  'pyraminx:iso': 'sr-puzzlegen',
  'pyraminx:top': 'sr-puzzlegen',
  'pyraminx:net': 'pure',
  'pyraminx:wca': 'pure',

  'skewb:iso': 'sr-puzzlegen',
  'skewb:top': 'sr-puzzlegen',
  'skewb:net': 'skewb-net-display',
  'skewb:wca': 'pure',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function registryKey(s: ImageSpec): string {
  return `${s.puzzleType}:${s.puzzleType === 'cube' ? s.cubeView : s.puzzleVariant}`;
}

function entryFor(s: ImageSpec): { renderer: RendererId; extraClass?: string } {
  const e = REGISTRY[registryKey(s)] ?? 'pure';
  const renderer = typeof e === 'function' ? e(s) : e;
  return { renderer, extraClass: RENDERER_CLASS[renderer] };
}

// Perspective calibration: map the shared visualcube `dist` (透视 slider → 2..10, default 6
// via SimPage's `2+persp/100*8`) to sr's camera distance. Larger = flatter (camera farther);
// smaller = stronger perspective. Tuned so the default (dist 6) matches the sim's left 3D
// foreshortening — sr's native 5 renders slightly flatter than the sim, so the base sits a bit
// closer. sr consumes this via setSrPerspective; the cube preview uses `dist` directly.
const SR_DIST_BASE = 3.9; // sr camera distance at the default perspective (spec.dist === 6)
const SR_DIST_GAIN = 0.55; // sr distance change per unit of visualcube dist
function srCameraDist(specDist: number): number {
  return Math.round((SR_DIST_BASE + (specDist - 6) * SR_DIST_GAIN) * 100) / 100;
}

/**
 * sr-puzzlegen `scheme` (per-face colours) mirroring the sim's own 3D scheme so the
 * panel image is colour-consistent with the left — the sr renderer defaults to its OWN
 * scheme (yellow-top skewb etc.), which is why the colours never matched. Each sr face
 * key maps to the sim face at the same physical position.
 *
 * IMPORTANT: the sim's EXOTIC engines use FIXED schemes, NOT the user's `faceColors`
 * palette (only NxN cubes follow the palette): skewb → CUBE_FILL (WCA standard),
 * sq1 → SQ1_COLORS (F=red, R=green, U=black…). So we source those constants directly;
 * driving the preview off spec.faceU..B would only match when the palette equals the
 * fixed scheme (i.e. at default) and diverge once the user recolours. megaminx/pyraminx
 * likewise use fixed schemes — mapped here as they get calibrated.
 */
function srSchemeFor(type: PuzzleType): Record<string, SrColor> | undefined {
  const c = (hex: string): SrColor => ({ value: hex });
  const n = (v: number): SrColor => ({ value: '#' + v.toString(16).padStart(6, '0') });
  if (type === 'skewb') {
    return {
      top: c(CUBE_FILL.U), front: c(CUBE_FILL.F), right: c(CUBE_FILL.R),
      back: c(CUBE_FILL.B), left: c(CUBE_FILL.L), bottom: c(CUBE_FILL.D),
    };
  }
  if (type === 'sq1') {
    return {
      top: n(SQ1_COLORS.U), front: n(SQ1_COLORS.F), bottom: n(SQ1_COLORS.D),
      left: n(SQ1_COLORS.L), right: n(SQ1_COLORS.R), back: n(SQ1_COLORS.B),
    };
  }
  if (type === 'pyraminx') {
    // sim pyra uses CUBE_FILL by face index (0=D bottom, 1=F, 2=R, 3=B). sr's 4 keys are the
    // 3 apex faces {left,right,top} + the bottom {back}. Verified vs the left: sr `right`=R(red)
    // goes flat-on upright at the base orientation [{y:0},{x:-20}] = the sim default; identity
    // (yaw0) shows F(green) left / R(red) right, so left=F, right=R; top=B apex, back=D bottom.
    return {
      left: c(CUBE_FILL.F), right: c(CUBE_FILL.R), top: c(CUBE_FILL.B), back: c(CUBE_FILL.D),
    };
  }
  if (type === 'megaminx') {
    // sim megaminx = cubing.js TwistyPlayer, whose default scheme is defaultPlatonicColorSchemes()[12]
    // keyed {U F R C A L E BF BR BL I D}. sr's 12 keys {U F R dr dl L d br BR BL bl b} are the SAME
    // face-naming convention with 6 faces renamed. Anchoring U↔U + F↔F (both physically top/front,
    // both same hex) fixes the whole dodecahedron with matching chirality, forcing this unique
    // sr-key → cubing-hex map (code-verified via both hex tables + both adjacency graphs; see the
    // TODO). So the right preview's colours exactly match the left's cubing.js render.
    return {
      U: c('#ffffff'), F: c('#008800'), R: c('#ff0000'), dr: c('#e8d0a0'),
      dl: c('#3399ff'), L: c('#8800dd'), d: c('#888888'), br: c('#ff66cc'),
      BR: c('#0000ff'), BL: c('#f4f400'), bl: c('#ff8000'), b: c('#99ff00'),
    };
  }
  return undefined;
}

// ── component ───────────────────────────────────────────────────────────────

export interface PuzzleImageProps {
  spec: ImageSpec;
  className?: string;
  /** Required for the 3x3 paint editor to write back; every other renderer is a
   *  read-only picture. */
  onSpecChange?: (patch: Partial<ImageSpec>) => void;
  /**
   * Click a sticker → its canonical id (mask authoring). Only the tnoodle
   * unfolded renderers carry a `data-sid` id space, so this fires on the net /
   * wca views; visualcube iso/plan and sr-puzzlegen emit no ids and stay silent.
   */
  onStickerClick?: (sid: StickerId) => void;
  /**
   * /sim 引擎 BSP 矢量镜像(sim_svg_export_bsp,SimPage 静止帧生成):有值时
   * 3D 投影视图(cube 的 normal / 异形的 iso)不再走 visualcube / sr-puzzlegen,
   * 直接显示引擎自己的精确矢量投影 —— 相机 / 配色 / 状态天然一致,无需角度标定。
   * 其余视图(plan/trans/net/wca/top)不受影响。sr / visualcube 伴图退役
   * Phase 3,回退:/sim?img_engine=sr。
   */
  engineSvg?: string | null;
}

export default function PuzzleImage({
  spec, className, onSpecChange, onStickerClick, engineSvg,
}: PuzzleImageProps) {
  const { renderer, extraClass } = entryFor(spec);
  const wantIds = !!onStickerClick;

  // Pinned pre-existing behaviour: a renderer throw becomes a red div rather than
  // an error boundary. The message is HTML-escaped before it reaches
  // dangerouslySetInnerHTML (the original interpolated it raw). The sr-puzzlegen
  // render-fail path is the one the golden fixtures lock; this is the parallel
  // pure-render path.
  const svg = useMemo(() => {
    if (renderer !== 'pure') return null;
    try {
      return renderSpecSvg(spec, wantIds ? { stickerIds: true } : undefined);
    } catch (e) {
      return `<div style="color:red">${escapeHtml((e as Error).message)}</div>`;
    }
  }, [spec, renderer, wantIds]);

  // ── sticker picking ──────────────────────────────────────────────────────
  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onStickerClick) return;
    const el = (e.target as Element).closest?.('[data-sid]');
    const sid = el?.getAttribute('data-sid');
    if (sid) onStickerClick(sid);
  }, [onStickerClick]);

  const cls = [
    'vc-preview',
    extraClass,
    wantIds ? 'vc-preview-pickable' : null,
    className,
  ].filter(Boolean).join(' ');

  // 引擎 BSP 矢量镜像:3D 投影视图直接显示引擎自己的精确投影(见 engineSvg 注释)。
  // 贴纸遮罩由 SimPage 单点负责:引擎直映认识的拼图把 mask 烙进 engineSvg,
  // 不认识的置 engineSvg=null → 这里自然落回 spec 渲染器(sr/visualcube 认 mask),
  // 任何一边都不会静默丢遮罩。
  // cube 全部视图(normal 3D 投影 / net·wca 展开图 / plan 俯视 OLL / trans X 光 3D)
  // 均走引擎 engineSvg(§2b 视图对照表 5 行全落引擎);非 cube 仍限 iso 镜像。
  const engineMirrors = spec.puzzleType === 'cube'
    ? (spec.cubeView === 'normal' || spec.cubeView === 'net' || spec.cubeView === 'wca'
      || spec.cubeView === 'plan' || spec.cubeView === 'trans')
    : spec.puzzleVariant === 'iso';
  if (engineSvg && engineMirrors) {
    // 引擎镜像是全尺寸画布投影;钉成方形显示框,viewBox + 默认 meet 保比例。
    const sized = sizeEngineSvg(engineSvg, spec.imageSize);
    return <div className={cls} dangerouslySetInnerHTML={{ __html: sized }} />;
  }

  if (renderer === 'net-paint-3x3') {
    return (
      <div className={cls}>
        <InteractiveCubeNet
          facelet={spec.paintedFacelet}
          onChange={(next) => onSpecChange?.({ paintedFacelet: next })}
          activeColor={spec.netActiveColor}
          onActiveColorChange={(c) => onSpecChange?.({ netActiveColor: c })}
          pixelSize={spec.imageSize}
        />
      </div>
    );
  }

  if (renderer === 'skewb-net-display') {
    const raw = spec.algorithm ?? '';
    // scramble-display takes a forward scramble; a `case` is the inverse of it.
    const forward = spec.algType === 'case' ? invertAlg(raw) : raw;
    return (
      <div className={cls}>
        <SkewbNetPreview scramble={forward} pixelSize={spec.imageSize} />
      </div>
    );
  }

  if (renderer === 'sr-puzzlegen') {
    const kind = srKindOf(spec.puzzleType, spec.puzzleVariant)!;
    const rotations = !rotationsMatchDefault(spec) ? [
      { [srPromoteAxis(spec.puzzleType, spec.rotateAxis1)]: spec.rotateAngle1 },
      { [srPromoteAxis(spec.puzzleType, spec.rotateAxis2)]: spec.rotateAngle2 },
    ] as { x?: number; y?: number; z?: number }[] : undefined;
    return (
      <div className={cls}>
        <PuzzleSVG
          kind={kind}
          alg={spec.algType === 'alg' ? spec.algorithm : undefined}
          case={spec.algType === 'case' ? spec.algorithm : undefined}
          size={spec.imageSize}
          rotations={rotations}
          cameraDist={srCameraDist(spec.dist)}
          mask={spec.stickerMask || undefined}
          scheme={srSchemeFor(spec.puzzleType)}
        />
      </div>
    );
  }

  return (
    <div
      className={cls}
      {...(onStickerClick ? { onClick } : {})}
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}
