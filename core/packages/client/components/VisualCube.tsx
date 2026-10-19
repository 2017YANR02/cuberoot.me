'use client';

import { useMemo, useRef, useState } from 'react';
import { renderFromSimpleQuery, buildSimpleOptions, renderCubeSVG, Axis, type ICubeOptions, type PlanSimplifyOptions } from '@cuberoot/visualcube';
import { ORBIT_K } from '@cuberoot/puzzle-render-core/engine/viewControls';
import { tr } from '@/i18n/tr';
import { apiUrl } from '@/lib/api-base';
import { TimerRoomDialog } from '@cuberoot/timer-ui';
import LazyVisible from '@/components/LazyVisible';
import './visual-cube.css';
import { COLORS, STICKER_INNER, STICKER_OUTLINE_WIDTH } from '@cuberoot/puzzle-render-core/engine/define';
const stickerOutlineStyle = { color: COLORS.High, widthFraction: STICKER_OUTLINE_WIDTH / STICKER_INNER };

interface Props {
  /** WCA notation alg. Treated as a SOLUTION — cube renders the case state that `algorithm`
   *  solves (i.e. inverse(algorithm) applied to solved). Defaults to '' (solved); ignored when
   *  `setup` is given. */
  algorithm?: string;
  /** Forward scramble — applied DIRECTLY without inversion. When set, takes precedence over
   *  `algorithm`. */
  setup?: string;
  view: 'iso' | 'plan' | 'f2l' | 'oll' | 'pll' | 'pll-iso' | 'trans';
  /** Explicit Masking enum value (e.g. 'vh', 'wv', 'els'). Overrides the view-implied mask. */
  mask?: string;
  /** Exact final-state 6N² compact colour codes in U R F D L B order. */
  faceletColors?: string;
  /** Solved-piece colours in U R F D L B order; setup/algorithm moves carry these colours. */
  stickerColors?: string[];
  /** Colour treated as hidden on the plan view's side rim. */
  stickerMaskColor?: string;
  /** Semantic diagrams may show another camera angle; rendered locally. */
  viewportRotations?: ICubeOptions['viewportRotations'];
  /** Highlight masked top stickers with the prediction trainer's inset outline. */
  outlineMaskedTop?: boolean;
  /** Final-state sticker indices in U R F D L B order to highlight in any view. */
  outlinedFacelets?: readonly number[];
  /** Forward whole-cube rotation applied only when `faceletColors` is present. */
  faceletAlg?: string;
  /** U R F D L B face colours, using the visualcube `sch=` format. Only for semantic diagrams. */
  scheme?: string;
  /** Plan simplification: keep every sticker carrying the U-face colour. Defaults to renderer behavior. */
  showLastLayerColor?: boolean;
  /** Recognition projection for plan views: retain only salient bars, pairs and U-face features. */
  planSimplify?: PlanSimplifyOptions;
  /**
   * Plan views (`plan` / `oll` / `pll`) only — drop the grey (masked) side-rim stickers
   * instead of drawing them, so an OLL thumbnail is just the yellow bars. The 9 U-face
   * stickers are byte-identical either way. Bare `view="plan"` already does this by
   * default; use the prop for aliases such as `oll`. No-op on iso views and on `pll`,
   * whose rim carries real colours.
   */
  hideGreySides?: boolean;
  size?: number;
  puzzleSize?: number;
  alt?: string;
  /** With local rendering, 'lazy' defers SVG generation until near the viewport; otherwise the native image hint. */
  loading?: 'lazy' | 'eager';
  /**
   * Render the SVG in-process instead of fetching `/v1/visualcube.svg`.
   *
   * Same renderer as the server route (`renderFromSimpleQuery`), so the picture is identical —
   * it just costs main-thread work instead of a request. Use it where several cubes must appear
   * *together and instantly* (the trainer's three-at-once screen: a network `<img>` per cube
   * lands one by one, so the images visibly lag the scrambles and each other).
   *
   * Long lists must combine local with loading="lazy", so offscreen diagrams are not generated.
   */
  local?: boolean;
  /** Drag to orbit the existing state; leaving restores the original projection. */
  interactive?: boolean;
  /** Single-click opens a larger view; dragging never opens it. */
  enlargeable?: boolean;
}

export function VisualCube(props: Props) {
  if (props.loading === 'lazy' && (props.local || props.faceletColors || props.interactive || props.stickerColors || props.viewportRotations || props.outlineMaskedTop || props.outlinedFacelets?.length)) {
    const size = props.size ?? 88;
    return <LazyVisible inline minHeight={size} rootMargin="160px" unwrapWhenVisible
      style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <VisualCubeContent {...props} />
    </LazyVisible>;
  }
  return <VisualCubeContent {...props} />;
}

function VisualCubeContent(props: Props) {
  const { algorithm = '', setup, view, mask, faceletColors, stickerColors, stickerMaskColor, viewportRotations, outlineMaskedTop, outlinedFacelets, faceletAlg, scheme, showLastLayerColor, planSimplify, size = 88, puzzleSize = 3, alt = 'Cube state', loading, local, hideGreySides, interactive = false, enlargeable = false } = props;
  const [expanded, setExpanded] = useState(false);
  const dragged = useRef(false);
  const isPlan = view === 'plan' || view === 'oll' || view === 'pll';
  const [orbit, setOrbit] = useState<{ x: number; y: number; z: number } | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const rotate = (dx: number, dy: number) => setOrbit(previous => {
    const current = previous ?? { x: -30, y: 30, z: 0 };
    const degrees = ORBIT_K * 180 / Math.PI;
    return { x: Math.max(-90, Math.min(90, current.x - dy * degrees)), y: current.y - dx * degrees, z: current.z + (dx + dy) * degrees };
  });
  // Exact facelet states are already available in the client bundle and may use
  // query features that an older deployed API does not know yet. Render them
  // locally so the page and its data stay atomic during rolling deployments.
  const renderLocally = Boolean(local || faceletColors || interactive || stickerColors || viewportRotations || outlineMaskedTop || outlinedFacelets?.length);
  // 同一组参数喂两条路:本地渲染直接调 server 端点用的那个函数,URL 版把它们拼成 query。
  const svg = useMemo(() => {
    if (!renderLocally) return null;
    const query = {
      ...(faceletColors ? { fc: faceletColors, ...(faceletAlg ? { alg: faceletAlg } : {}) } : setup ? { setup } : { case: algorithm }),
      view, size, pzl: puzzleSize, ...(mask ? { mask } : {}),
      ...(scheme ? { sch: scheme } : {}),
      ...(hideGreySides ? { ngs: '1' } : {}),
      ...((planSimplify?.showYellow ?? showLastLayerColor) !== undefined
        ? { psy: (planSimplify?.showYellow ?? showLastLayerColor) ? '1' : '0' }
        : {}),
      ...(planSimplify?.side ? { psr: planSimplify.side } : {}),
      ...(planSimplify?.up ? { pur: planSimplify.up } : {}),
      ...(planSimplify?.forceShow ? { pfs: planSimplify.forceShow } : {}),
      ...(planSimplify?.forceHide ? { pfh: planSimplify.forceHide } : {}),
    };
    if ((interactive && orbit && !isPlan) || (stickerColors && !faceletColors) || viewportRotations || outlineMaskedTop || outlinedFacelets?.length) {
      return renderCubeSVG({ ...buildSimpleOptions(query), ...(stickerColors && !faceletColors ? { stickerColors } : {}), ...(viewportRotations ? { viewportRotations } : {}), ...(outlineMaskedTop ? { maskedTopOutline: stickerOutlineStyle } : {}), ...(outlinedFacelets?.length ? { stickerOutline: { ...stickerOutlineStyle, indices: outlinedFacelets } } : {}), ...(stickerMaskColor ? { maskColor: stickerMaskColor } : {}), ...(interactive && orbit && !isPlan ? { view: 'iso', viewportRotations: [[Axis.Y, orbit.y], [Axis.X, orbit.x]] } : {}) });
    }
    return renderFromSimpleQuery(query);
  }, [interactive, orbit, isPlan, renderLocally, algorithm, setup, view, mask, faceletColors, stickerColors, stickerMaskColor, viewportRotations, outlineMaskedTop, outlinedFacelets, faceletAlg, scheme, showLastLayerColor, planSimplify, size, puzzleSize, hideGreySides]);

  const src = useMemo(() => {
    if (renderLocally) return '';
    const params = new URLSearchParams({ view, size: String(size) });
    if (faceletColors) {
      params.set('fc', faceletColors);
      if (faceletAlg) params.set('alg', faceletAlg);
    } else if (setup) params.set('setup', setup);
    else params.set('case', algorithm);
    if (mask) params.set('mask', mask);
    if (scheme) params.set('sch', scheme);
    const keepLastLayer = planSimplify?.showYellow ?? showLastLayerColor;
    if (keepLastLayer !== undefined) params.set('psy', keepLastLayer ? '1' : '0');
    if (planSimplify?.side) params.set('psr', planSimplify.side);
    if (planSimplify?.up) params.set('pur', planSimplify.up);
    if (planSimplify?.forceShow) params.set('pfs', planSimplify.forceShow);
    if (planSimplify?.forceHide) params.set('pfh', planSimplify.forceHide);
    if (puzzleSize !== 3) params.set('pzl', String(puzzleSize));
    // 新 query key = 新缓存键,老链接的 24h CDN 缓存不受影响,无需 bump v=。
    if (hideGreySides) params.set('ngs', '1');
    return apiUrl(`/v1/visualcube.svg?${params}`);
  }, [renderLocally, algorithm, setup, view, mask, faceletColors, faceletAlg, scheme, showLastLayerColor, planSimplify, size, puzzleSize, hideGreySides]);

  // puzzle-art:柔和度的统一钩子(见 globals.css),贴纸色不走 token,靠它跟。
  if (interactive && svg) {
    return <><button type="button" className="puzzle-art"
      aria-label={alt + (enlargeable ? tr({ zh: '；单击放大，拖动旋转', en: '; click to enlarge, drag to rotate' }) : tr({ zh: '；拖动或用方向键旋转，移开复位', en: '; drag or use arrow keys to rotate, leave to reset' }))}
      aria-haspopup={enlargeable ? 'dialog' : undefined}
      style={{ display: 'inline-flex', width: size, height: size, padding: 0, border: 0, background: 'none', cursor: pointer.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none', flexShrink: 0 }}
      onClick={event => { event.preventDefault(); event.stopPropagation(); if (enlargeable && (event.detail === 0 || !dragged.current)) setExpanded(true); }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        dragged.current = false;
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const previous = pointer.current;
        if (!previous || previous.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 3) dragged.current = true;
        rotate(event.clientX - previous.x, event.clientY - previous.y);
        pointer.current = { ...previous, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        if (pointer.current?.id !== event.pointerId) return;
        pointer.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOrbit(null);
      }}
      onLostPointerCapture={() => { pointer.current = null; }}
      onPointerCancel={() => { pointer.current = null; setOrbit(null); }}
      onPointerLeave={() => { if (!pointer.current) setOrbit(null); }}
      onBlur={() => { if (!pointer.current) setOrbit(null); }}
      onKeyDown={event => {
        const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[event.key];
        if (!delta && event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation();
        if (delta) rotate(delta[0], delta[1]); else setOrbit(null);
      }}
      >
      <span style={{ display: 'inline-flex', width: size, height: size, transform: isPlan && orbit ? `rotate(${orbit.z}deg)` : undefined }}
        dangerouslySetInnerHTML={{ __html: svg }} />
    </button>
      {expanded && <TimerRoomDialog title={alt} className="visualcube-preview" language={tr({ zh: 'zh', en: 'en' }) as 'zh' | 'en'} onClose={() => setExpanded(false)}>
        <div className="visualcube-preview-body" onKeyDownCapture={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setExpanded(false); }
        }}>
          <VisualCube {...props} size={220} local interactive enlargeable={false} />
        </div>
      </TimerRoomDialog>}
    </>;
  }
  if (svg) {
    return (
      <span
        role="img"
        className="puzzle-art"
        aria-label={alt}
        style={{ display: 'inline-flex', width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return <img className="puzzle-art" src={src} width={size} height={size} alt={alt} loading={loading} />;
}

