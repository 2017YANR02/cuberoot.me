/**
 * /sim — 虚拟魔方 Playground / Player / Algs / Director
 * 核心 src/pages/sim/cuber/* 移植自 huazhechen/cuber (MIT)。
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import {
  ChevronLeft, ChevronRight,
  BookOpen, Film,
  Maximize2, Minimize2,
} from 'lucide-react';
import World from './cuber/world';
import type Cube from './cuber/cube';
import Cubelet from './cuber/cubelet';
import Toucher from './Toucher';
import { TwistAction } from './cuber/twister';
import CubeGroup from './cuber/group';
import Sq1Cube from './cuber/sq1/Sq1Cube';
import { sq1DragStart, sq1DragDelta, sq1DragApply, sq1DragCommit, type Sq1DragStart } from './cuber/sq1/sq1Drag';
import { moveToString as sq1MoveToString } from './cuber/sq1/sq1State';

/** SimPage-level puzzle kind. World only supports `number | 'sq1'`; the three
 *  twisty-only puzzles render via cubing.js TwistyPlayer instead of the cuber
 *  engine. `isTwistyPuzzle()` gates everything that depends on `world`. */
export type SimPuzzle = number | 'sq1' | 'pyraminx' | 'skewb' | 'megaminx';
export const TWISTY_PUZZLES = ['pyraminx', 'skewb', 'megaminx'] as const;
export type TwistyPuzzle = typeof TWISTY_PUZZLES[number];
export function isTwistyPuzzle(p: SimPuzzle): p is TwistyPuzzle {
  return p === 'pyraminx' || p === 'skewb' || p === 'megaminx';
}

/** Narrow `world.cube` to the NxN Cube type. Returns null when world is in
 *  SQ1 mode (NxN-specific access — table/cubelets/twist(TwistAction) — is then
 *  skipped by the caller). */
function asNxN(world: World): Cube | null {
  return world.puzzleKind === 'sq1' ? null : (world.cube as Cube);
}

/** Reorder so `puzzle` is the first param in the URL (right after `?`).
 *  All other params keep their relative order. */
function withPuzzleFirst(p: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  const puzzle = p.get('puzzle');
  if (puzzle != null) out.set('puzzle', puzzle);
  for (const [k, v] of p) {
    if (k === 'puzzle') continue;
    out.set(k, v);
  }
  return out;
}
import { FACE } from './cuber/define';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { loadSettings, saveSettings, applySettings, type SimSettings } from './SettingDrawer';
import PlayerControls from './PlayerControls';
import AlgsPanel from './AlgsPanel';
import DirectorPanel from './DirectorPanel';
import PerfOverlay, { type PerfStats } from './PerfOverlay';
import { loadKeymap, saveKeymap, resetKeymap as resetKeymapStorage, type KeyMove } from './keymap';
import TwistySection from '../../components/TwistySection';
import './sim.css';

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

interface SimCube {
  history: { moves: number; redoStack: unknown[] };
  twister: { undo: () => void; redo: () => void; twist: (a: TwistAction, fast: boolean, force: boolean) => boolean; setup: (e: string) => void; push: (e: string) => void };
  callbacks: (() => void)[];
  complete: boolean;
  dirty: boolean;
}

export default function SimPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [searchParams, setSearchParams] = useSearchParams();
  // 没带 ?puzzle= 就强制写 puzzle=3 (默认 3x3),让 URL 永远显式。
  useEffect(() => {
    if (searchParams.get('puzzle') != null) return;
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set('puzzle', '3');
      return withPuzzleFirst(np);
    }, { replace: true });
  }, [searchParams, setSearchParams]);
  const algParam = searchParams.get('alg') || '';
  const setupParam = searchParams.get('setup') || '';
  /** Puzzle kind — number for NxN, 'sq1' / 'pyraminx' / 'skewb' / 'megaminx' for non-NxN. */
  const puzzleParam: SimPuzzle = (() => {
    const raw = searchParams.get('puzzle');
    if (!raw) return 3;
    if (raw === 'sq1') return 'sq1';
    if (raw === 'pyraminx' || raw === 'skewb' || raw === 'megaminx') return raw;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 400) return 3;
    return n;
  })();
  const twisty = isTwistyPuzzle(puzzleParam);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const wasCompleteRef = useRef(false);
  const statsRef = useRef<PerfStats>({
    drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0,
    meshCount: 0, cubeletCount: 0, fps: 0, frameMs: 0, order: 3,
    jsHeapMB: 0, gpuBufMB: 0, scrambleMs: 0, setupCpuMs: 0,
  });

  // 用户主动 twist (drag / tap / 实体键盘) 后,把 move 追加到 PlayerControls 的解法输入框。
  // PlayerControls 挂载时把 handler 装到这里; setup / jumpToStep / playback 等程序化 twist 不走这条。
  const userMoveRef = useRef<((action: TwistAction) => void) | null>(null);

  const [order, setOrder] = useState<number>(3);
  /** Tracks current puzzle for UI (PlayerControls reads this to switch mode). */
  const [puzzleKind, setPuzzleKind] = useState<SimPuzzle>(3);
  const [fullscreen, setFullscreen] = useState<boolean>(() => {
    try { return localStorage.getItem('sim.fullscreen') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sim.fullscreen', fullscreen ? '1' : '0'); } catch { /* private mode */ }
  }, [fullscreen]);
  const [worldTick, setWorldTick] = useState(0);
  const [settings, setSettings] = useState<SimSettings>(() => loadSettings());
  const [keymap, setKeymap] = useState<Record<string, KeyMove>>(() => loadKeymap());
  const keymapRef = useRef(keymap);
  useEffect(() => { keymapRef.current = keymap; saveKeymap(keymap); }, [keymap]);

  // 公式 / 录制 折叠状态;localStorage 持久化用户选择
  const [algsOpen, setAlgsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('sim.panel.algs') === '1'; } catch { return false; }
  });
  const [directorOpen, setDirectorOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('sim.panel.director') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sim.panel.algs', algsOpen ? '1' : '0'); } catch { /* private */ }
  }, [algsOpen]);
  useEffect(() => {
    try { localStorage.setItem('sim.panel.director', directorOpen ? '1' : '0'); } catch { /* private */ }
  }, [directorOpen]);

  // URL 中遗留的 mode 参数清掉 (mode 已并入单面板)
  useEffect(() => {
    if (!searchParams.get('mode')) return;
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.delete('mode');
      return withPuzzleFirst(np);
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const ensureCubeCallback = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const cube = w.cube as unknown as SimCube;
    const tag = '_simBound';
    const cubeAny = cube as unknown as Record<string, unknown>;
    if (cubeAny[tag]) return;
    cubeAny[tag] = true;
    cube.callbacks.push(() => {
      const wnow = worldRef.current;
      if (!wnow) return;
      const c = wnow.cube as unknown as SimCube;
      const completeNow = c.complete;
      wasCompleteRef.current = completeNow;
    });
  }, []);

  // World 初始化。React StrictMode 会双调;用 ref 守卫。Twisty puzzles
  // (pyraminx/skewb/megaminx) 不走 cuber 引擎,这里直接 skip;[twisty] 进 deps
  // 让 NxN↔twisty 切换时 cleanup 自动 dispose 老 world。
  useEffect(() => {
    if (twisty) return;
    if (worldRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const world = new World();
    worldRef.current = world;
    setWorldTick((n) => n + 1);  // 触发 re-render 让 PlayerControls 收到 world prop (worldRef.current 自身改不会 re-render)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.autoClear = false;
    renderer.setClearColor(0xffffff, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';

    const toucher = new Toucher();
    toucher.init(renderer.domElement, world.controller.touch);
    toucherRef.current = toucher;

    // 单击转动 — 仿 cubesim (cubegraphicsobject.cpp:267-336):
    // 无拖动 click = atan2(0,0)=0 = Right direction。layer 跟 sticker 的 cubelet 走,
    // 支持高阶魔方内层:点 U 最前一行 → F 层;点 U 中央行 → S 中切片;点 U 最后一行 → B 层。
    // Shift / 右键 = 逆时针。
    world.controller.taps.push((idx, face, opts) => {
      if (face === null) return;
      const cube = asNxN(world);
      if (!cube) return; // SQ1: no tap-to-twist (controller is disabled anyway)
      const order = cube.order;
      // positionIdx = z*N² + y*N + x → 反解 y, z (x 不需要)
      const y = Math.floor((idx % (order * order)) / order);
      const z = Math.floor(idx / (order * order));
      let axis: 'x' | 'y' | 'z';
      let layer: number;
      switch (face) {
        case FACE.U: axis = 'z'; layer = z; break;
        case FACE.F: axis = 'y'; layer = y; break;
        case FACE.R: axis = 'y'; layer = y; break;
        default: return;
      }
      const reverse = opts.shift || opts.button === 2;
      const group = cube.table.groups[axis]?.[layer];
      if (!group) return;
      // 默认单层切片(group.name,跟旧行为一致)。
      // Alt 按住 → 走 wide(点击深度决定宽度)
      // 1×1:只有转体,不存在"层",全部记成 x/y/z
      let sign: string;
      if (order === 1) {
        sign = axis;
      } else {
        sign = opts.alt ? CubeGroup.wideFromClick(axis, layer, order).sign : group.name;
      }
      const action = new TwistAction(sign, reverse, 1);
      cube.twister.twist(action, false, true);
      userMoveRef.current?.(action);
    });

    // 拖拽 / 整体旋转完成时,转发给上层 (PlayerControls) 的追加 handler。
    // 1×1 上 face/slice → xyz 转体的归一化在 appendUserMove 里统一处理,这里直接转发。
    world.controller.userTwist.push((action) => {
      userMoveRef.current?.(action);
    });

    // 右键 default 是 context menu,阻止它好让右键单击能触发逆时针转
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    ensureCubeCallback();
    applySettings(world, settings);

    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as { __sim__?: World }).__sim__ = world;
      (window as unknown as { __renderer__?: THREE.WebGLRenderer }).__renderer__ = renderer;
      (window as unknown as { __sim_stats__?: typeof statsRef.current }).__sim_stats__ = statsRef.current;
      // 暴露 tweener 实例,避免 console import 拿到不同的 module instance
      import('./cuber/tweener').then((m) => {
        (window as unknown as { __tweener__?: unknown }).__tweener__ = m.default;
      });

      // A/B bench:同 session 跑 baseline (所有 perf flags off) vs optimized (默认开)。
      // 返回结构化 JSON。用法: await window.__bench({ order: 250, runs: 3 })
      (window as unknown as { __bench?: unknown }).__bench = async (
        opts: { order: number; runs?: number; durationMs?: number; twists?: number } = { order: 250 },
      ) => {
        const { order: N, runs = 3, durationMs = 5000, twists = 30 } = opts;
        const cube = asNxN(world);
        if (!cube) return null; // bench only meaningful for NxN
        const m = await import('./cuber/instanced');
        const SIGNS = ['R', 'U', 'F', 'L', 'D', 'B'];
        const med = (arr: number[]): number => {
          const s = [...arr].sort((a, b) => a - b);
          return +s[Math.floor(s.length / 2)].toFixed(2);
        };
        const defaults = { ...m.__PERF_FLAGS };
        const variants: Record<string, { runs: { avgFps: number; minFps: number; frames: number }[]; median_avgFps: number; median_minFps: number; idle_tris: number; idle_draws: number }> = {};

        const configs: { name: string; flags: Partial<typeof m.__PERF_FLAGS> }[] = [
          { name: 'baseline', flags: { superOrderThreshold: N + 1, singleSliceQuaternion: false } },
          { name: 'optimized', flags: defaults },
        ];

        const tweenerMod = await import('./cuber/tweener');
        for (const cfg of configs) {
          Object.assign(m.__PERF_FLAGS, cfg.flags);
          // Flush pending tweens 释放对旧 cube/group 的引用;dispose + 清缓存 + 重建
          tweenerMod.default.finish();
          (world.cube as unknown as { dispose?: () => void }).dispose?.();
          (world as unknown as { cubes: (unknown | undefined)[] }).cubes[N] = undefined;
          world.order = N;
          await new Promise((r) => requestAnimationFrame(r));
          await new Promise((r) => setTimeout(r, 100));

          // idle tris/draws: reset 完, no active slice, moving.count=0 → 单 cube 真实场景成本
          cube.twister.twist(new TwistAction('#'), true, true);
          await new Promise((res) => setTimeout(res, 200));
          world.cube.dirty = true;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const idle_tris = rendererRef.current?.info.render.triangles ?? 0;
          const idle_draws = rendererRef.current?.info.render.calls ?? 0;

          const runsData: { avgFps: number; minFps: number; frames: number }[] = [];
          for (let r = 0; r < runs; r++) {
            cube.twister.twist(new TwistAction('#'), true, true);
            await new Promise((res) => setTimeout(res, 200));
            for (let i = 0; i < twists; i++) {
              cube.twister.twist(new TwistAction(SIGNS[i % SIGNS.length], i % 2 === 0, 1), false, false);
            }
            const t0 = performance.now();
            let frames = 0;
            let maxDt = 0;
            let lastT = t0;
            await new Promise<void>((resolve) => {
              const tick = () => {
                const now = performance.now();
                const dt = now - lastT;
                lastT = now;
                frames++;
                if (dt > maxDt && dt < 500) maxDt = dt;
                if (now - t0 < durationMs) requestAnimationFrame(tick);
                else resolve();
              };
              requestAnimationFrame(tick);
            });
            const elapsed = performance.now() - t0;
            runsData.push({
              avgFps: +((frames * 1000) / elapsed).toFixed(2),
              minFps: +(maxDt > 0 ? 1000 / maxDt : 0).toFixed(2),
              frames,
            });
          }
          variants[cfg.name] = {
            runs: runsData,
            median_avgFps: med(runsData.map((x) => x.avgFps)),
            median_minFps: med(runsData.map((x) => x.minFps)),
            idle_tris,
            idle_draws,
          };
        }
        Object.assign(m.__PERF_FLAGS, defaults);

        const b = variants.baseline;
        const o = variants.optimized;
        return {
          order: N, runs, durationMs, twists,
          flags_active: defaults,
          variants,
          summary: {
            baseline_avg_fps: b.median_avgFps,
            optimized_avg_fps: o.median_avgFps,
            avg_fps_delta_pct: +(((o.median_avgFps - b.median_avgFps) / b.median_avgFps) * 100).toFixed(1),
            baseline_min_fps: b.median_minFps,
            optimized_min_fps: o.median_minFps,
            min_fps_delta_pct: b.median_minFps > 0 ? +(((o.median_minFps - b.median_minFps) / b.median_minFps) * 100).toFixed(1) : null,
            idle_tris_saved: b.idle_tris - o.idle_tris,
            idle_draws_saved: b.idle_draws - o.idle_draws,
          },
        };
      };
      import('./cuber/instanced').then((mod) => {
        (window as unknown as { __PERF_FLAGS?: unknown }).__PERF_FLAGS = mod.__PERF_FLAGS;
      });
    }

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      world.width = w;
      world.height = h;
      world.resize();
      renderer.setSize(w, h, true);
      world.dirty = true;
    };
    resize();
    window.addEventListener('resize', resize);
    // 模式切换 / 设置抽屉等改变容器高度时, ResizeObserver 才能感知 — window resize 不会触发
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // 滚轮 / 双指捏合缩放: 实时改 world.scale + resize, 滚动停止后同步到 settings
    // 上限取消 (用户期望"无限放大"); 超出 slider 1.5 上限就不回写,避免 applySettings 反向 reset
    const SCALE_MIN = 0.3;
    const SCALE_MAX = Infinity;
    const settingsFromScale = (s: number) => Math.round((s - 0.5) * 100);  // mapScale 的反函数
    let scaleSyncTimer: number | null = null;
    const syncScaleToSettings = () => {
      if (scaleSyncTimer) window.clearTimeout(scaleSyncTimer);
      scaleSyncTimer = window.setTimeout(() => {
        const w = worldRef.current;
        if (!w) return;
        if (w.scale < 0.5 || w.scale > 1.5) return;  // 超出 slider 映射范围,保留 world.scale 不动 settings
        const v = Math.max(0, Math.min(100, settingsFromScale(w.scale)));
        setSettings((prev) => prev.scale === v ? prev : { ...prev, scale: v });
      }, 250);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const w = worldRef.current;
      if (!w) return;
      const oldScale = w.scale;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, oldScale * (e.deltaY > 0 ? 0.92 : 1.08)));
      if (newScale === oldScale) return;
      // 以光标为缩放中心:pan 补偿,使光标下 z=0 的世界点缩放前后不变。
      // 可见半高/半宽公式跟 world.resize() 同源 (halfH ∝ 1/scale)。
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const minDim = Math.min(w.width, w.height);
      const halfH = (Cubelet.SIZE * 3 * w.height) / (minDim * oldScale);
      const halfW = halfH * (w.width / w.height);
      const t = 1 - oldScale / newScale;
      w.panX += nx * halfW * t;
      w.panY += ny * halfH * t;
      w.scale = newScale;
      w.resize();
      syncScaleToSettings();
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // 屏幕像素 → 世界单位 pan delta:乘 cube 在该 fov + scale 下的等效世界尺寸 / canvas 像素
    const screenDeltaToWorld = (dxPx: number, dyPx: number) => {
      const w = worldRef.current;
      if (!w) return { x: 0, y: 0 };
      const cubeWorldSize = Cubelet.SIZE * 3;  // 跟 camera distance 系数同源
      const px = w.height;  // 视野高度对应世界 cubeWorldSize / scale
      const k = (cubeWorldSize / w.scale) / Math.max(px, 1);
      // "drag the cube" 直觉:屏拖右 → cube 跟手向右,即 camera 向左 → panX 减
      return { x: -dxPx * k, y: dyPx * k };
    };

    // 双指捏合 + 双指中点位移 pan;桌面右键拖拽 pan
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartScale = 0;
    let pinchStartCenter = { x: 0, y: 0 };
    let pinchStartPan = { x: 0, y: 0 };
    let pinching = false;
    let mousePanning = false;
    let panLastX = 0;
    let panLastY = 0;
    // SQ1-only: 左键 / 单指拖拽旋转场景(controller.disable=true,自家走)。
    // 拖到 top/bot 贴片上 → 该层 turn,否则 → 整体视角旋转。
    let sq1Rotating = false;
    let sq1LastX = 0;
    let sq1LastY = 0;
    let sq1Drag: Sq1DragStart | null = null;
    let sq1DragLastDelta = 0;
    // 区分 tap vs drag:小位移内不切到 turn 模式,松手 = 普通 click (留给后续 hit-test)
    const SQ1_DRAG_THRESHOLD_PX = 4;
    // 标记 pointerdown 之后还没决定走 turn/view 的待命态.
    // hover 时 pointerdown 没发, 这个标记是 false, move 不该走 threshold 分支.
    let sq1Pending = false;
    let sq1DownX = 0;
    let sq1DownY = 0;
    let sq1MovedPastThreshold = false;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const onPointerDown = (e: PointerEvent) => {
      // 桌面右键 / 中键 = pan
      if (e.pointerType === 'mouse' && (e.button === 2 || e.button === 1)) {
        e.preventDefault();
        mousePanning = true;
        panLastX = e.clientX;
        panLastY = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
        return;
      }
      // SQ1 左键 / 触摸单指 → 先记下,等 move 决定是 turn-drag 还是视角旋转
      if (worldRef.current?.puzzleKind === 'sq1' && (e.pointerType !== 'mouse' || e.button === 0)) {
        const isTouchMulti = e.pointerType === 'touch' && activePointers.size >= 1;
        if (!isTouchMulti) {
          sq1DownX = e.clientX;
          sq1DownY = e.clientY;
          sq1Pending = true;
          sq1MovedPastThreshold = false;
          sq1Drag = null;
          sq1DragLastDelta = 0;
          sq1Rotating = false;
          sq1LastX = e.clientX;
          sq1LastY = e.clientY;
          if (e.pointerType !== 'touch') renderer.domElement.setPointerCapture(e.pointerId);
        }
        if (e.pointerType === 'touch') {
          activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activePointers.size === 2) {
            // 双指 pinch — 走下面已有逻辑;放弃 turn / 旋转
            sq1Drag = null;
            sq1Rotating = false;
            sq1Pending = false;
            sq1MovedPastThreshold = false;
          }
        }
        if (e.pointerType !== 'touch') return;
      }
      if (e.pointerType !== 'touch') return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        pinchStartDist = dist(a, b);
        pinchStartScale = world.scale;
        pinchStartCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        pinchStartPan = { x: world.panX, y: world.panY };
        pinching = true;
        sq1Rotating = false;
        world.controller.disable = true;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (mousePanning && e.pointerType === 'mouse') {
        const d = screenDeltaToWorld(e.clientX - panLastX, e.clientY - panLastY);
        panLastX = e.clientX;
        panLastY = e.clientY;
        world.panX += d.x;
        world.panY += d.y;
        world.resize();
        return;
      }
      if (worldRef.current?.puzzleKind === 'sq1') {
        // 已进入 turn-drag → 跟新 Δθ, 滚 pivot
        if (sq1Drag) {
          const w = worldRef.current;
          const d = sq1DragDelta(sq1Drag, w.scene, w.camera, e.clientX, e.clientY, w.width, w.height);
          if (d != null) {
            sq1DragLastDelta = d;
            sq1DragApply(sq1Drag, d);
            w.dirty = true;
          }
          return;
        }
        // 已在视角旋转 → 接着拖
        if (sq1Rotating) {
          const dx = e.clientX - sq1LastX;
          const dy = e.clientY - sq1LastY;
          sq1LastX = e.clientX;
          sq1LastY = e.clientY;
          const k = 0.01;
          world.scene.rotation.y += dx * k;
          world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x + dy * k));
          world.scene.updateMatrix();
          world.dirty = true;
          return;
        }
        // 等待 threshold 决定 turn vs 视角
        if (sq1Pending && !sq1MovedPastThreshold && !pinching) {
          const dx = e.clientX - sq1DownX;
          const dy = e.clientY - sq1DownY;
          if (Math.hypot(dx, dy) >= SQ1_DRAG_THRESHOLD_PX) {
            sq1MovedPastThreshold = true;
            const w = worldRef.current;
            const c = w.cube;
            if (c instanceof Sq1Cube) {
              sq1Drag = sq1DragStart(c, w.scene, w.camera, sq1DownX, sq1DownY, w.width, w.height);
            }
            if (sq1Drag) {
              // turn-drag — 从 down 角度开始, 立即 apply 当前 delta 让贴片不卡顿
              const d = sq1DragDelta(sq1Drag, w.scene, w.camera, e.clientX, e.clientY, w.width, w.height);
              if (d != null) {
                sq1DragLastDelta = d;
                sq1DragApply(sq1Drag, d);
                w.dirty = true;
              }
            } else {
              sq1Rotating = true;
              sq1LastX = sq1DownX;
              sq1LastY = sq1DownY;
              // 把 threshold 内积累的位移补上, 否则手指会原地卡一下
              const dx2 = e.clientX - sq1LastX;
              const dy2 = e.clientY - sq1LastY;
              sq1LastX = e.clientX;
              sq1LastY = e.clientY;
              const k = 0.01;
              world.scene.rotation.y += dx2 * k;
              world.scene.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, world.scene.rotation.x + dy2 * k));
              world.scene.updateMatrix();
              world.dirty = true;
            }
            return;
          }
        }
      }
      if (e.pointerType !== 'touch') return;
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinching && activePointers.size === 2) {
        e.preventDefault();
        const [a, b] = [...activePointers.values()];
        const ratio = dist(a, b) / Math.max(pinchStartDist, 1);
        world.scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, pinchStartScale * ratio));
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const d = screenDeltaToWorld(center.x - pinchStartCenter.x, center.y - pinchStartCenter.y);
        world.panX = pinchStartPan.x + d.x;
        world.panY = pinchStartPan.y + d.y;
        world.resize();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (mousePanning && e.pointerType === 'mouse') {
        mousePanning = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        return;
      }
      if (sq1Drag) {
        const w = worldRef.current;
        if (w) {
          const c = w.cube;
          if (c instanceof Sq1Cube) {
            const move = sq1DragCommit(c, sq1Drag, sq1DragLastDelta);
            if (move) userMoveRef.current?.(new TwistAction(sq1MoveToString(move), false, 1));
          }
        }
        sq1Drag = null;
        sq1DragLastDelta = 0;
        sq1MovedPastThreshold = false;
        sq1Pending = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      if (sq1Rotating) {
        sq1Rotating = false;
        sq1MovedPastThreshold = false;
        sq1Pending = false;
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      // sq1 slash 走 PlayerControls 的"/" 按钮 / 实体键盘 / alg textarea 直接输入,
      // tap-on-side 启发式跟 bot-face ray 撞冲突易误触,不做。
      sq1Pending = false;
      if (e.pointerType !== 'touch') return;
      activePointers.delete(e.pointerId);
      if (pinching && activePointers.size < 2) {
        pinching = false;
        world.controller.disable = worldRef.current?.puzzleKind === 'sq1';
        syncScaleToSettings();
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    // 注:右键 contextmenu 已在前面 mount 时屏蔽,这里不重复

    let raf = 0;
    const fpsBuf: number[] = [];
    let lastFrameAt = performance.now();
    let meshSampleAt = 0;
    const loop = () => {
      const now = performance.now();
      const dt = now - lastFrameAt;
      lastFrameAt = now;
      const t0 = performance.now();
      let didRender = false;
      if (world.dirty || world.cube.dirty) {
        renderer.clear();
        renderer.render(world.scene, world.camera);
        world.dirty = false;
        world.cube.dirty = false;
        didRender = true;
      }
      if (IS_DEV) {
        fpsBuf.push(dt);
        if (fpsBuf.length > 60) fpsBuf.shift();
        const s = statsRef.current;
        if (didRender) {
          s.drawCalls = renderer.info.render.calls;
          s.triangles = renderer.info.render.triangles;
          s.frameMs = performance.now() - t0;
        }
        s.geometries = renderer.info.memory.geometries;
        s.textures = renderer.info.memory.textures;
        s.programs = renderer.info.programs?.length ?? 0;
        const avgDt = fpsBuf.reduce((a, b) => a + b, 0) / fpsBuf.length;
        s.fps = avgDt > 0 ? 1000 / avgDt : 0;
        s.cubeletCount = world.puzzleKind === 'sq1' ? 16 : (world.cube as Cube).cubelets.size;
        s.order = world.cube.order;
        if (now - meshSampleAt > 1000) {
          meshSampleAt = now;
          let count = 0;
          let gpuBytes = 0;
          world.scene.traverse((o) => {
            const mesh = o as THREE.Mesh & { isInstancedMesh?: boolean; instanceMatrix?: THREE.BufferAttribute; instanceColor?: THREE.BufferAttribute | null };
            if ((o as THREE.Mesh).isMesh) count++;
            if (mesh.isInstancedMesh) {
              if (mesh.instanceMatrix) gpuBytes += mesh.instanceMatrix.array.byteLength;
              if (mesh.instanceColor) gpuBytes += mesh.instanceColor.array.byteLength;
            }
          });
          s.meshCount = count;
          s.gpuBufMB = gpuBytes / (1024 * 1024);
          // Chrome 私有 API,Firefox/Safari undefined。100MB 量化(无 --enable-precise-memory-info)。
          const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
          s.jsHeapMB = mem ? mem.usedJSHeapSize / (1024 * 1024) : 0;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      if (scaleSyncTimer) window.clearTimeout(scaleSyncTimer);
      toucher.destroy();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      worldRef.current = null;
      rendererRef.current = null;
      toucherRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twisty]);

  // 切阶数 — handleOrder 永远是即时 apply。
  // 拖动期间不会被调:wheel 内部跟着手指走,onSettle 才 fire (手指松 + 惯性停 + 滚轮静 180ms 后),
  // 一次性 apply,避免一帧一重建造成动画卡。
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const handlePuzzle = useCallback((kind: SimPuzzle) => {
    setPuzzleKind(kind);
    if (typeof kind === 'number') setOrder(kind);
    const world = worldRef.current;
    const writeUrl = () => setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      if (kind === 3) np.delete('puzzle'); else np.set('puzzle', String(kind));
      return withPuzzleFirst(np);
    }, { replace: true });
    // Twisty puzzles never touch World — switching just updates URL; the
    // world-init effect's [twisty] dep tears down any live cuber instance.
    if (isTwistyPuzzle(kind)) { writeUrl(); return; }
    if (!world || world.puzzleKind === kind) { writeUrl(); return; }
    world.setPuzzle(kind);
    wasCompleteRef.current = true;
    ensureCubeCallback();
    applySettings(world, settingsRef.current);
    writeUrl();
  }, [ensureCubeCallback, setSearchParams]);

  /** Legacy adapter for AlgsPanel etc. that only know about numeric orders. */
  const handleOrder = useCallback((n: number) => {
    handlePuzzle(n);
  }, [handlePuzzle]);

  // URL puzzle=N 同步到 cube。worldTick 保证 mount 完后 effect 重跑一次
  useEffect(() => {
    if (isTwistyPuzzle(puzzleParam)) {
      // No world to sync — `puzzleKind` state still needs to mirror URL so
      // PlayerControls / settings render correctly.
      setPuzzleKind(puzzleParam);
      return;
    }
    if (!worldRef.current) return;
    if (worldRef.current.puzzleKind === puzzleParam) return;
    handlePuzzle(puzzleParam);
  }, [puzzleParam, handlePuzzle, worldTick]);

  // settings 变化时即时 apply
  useEffect(() => {
    saveSettings(settings);
    const world = worldRef.current;
    if (world) applySettings(world, settings);
  }, [settings]);

  // 主题切换 (html[data-theme] / prefers-color-scheme) 时重 apply,
  // 让 hint 预混底色跟随新的 --background
  useEffect(() => {
    const reapply = () => {
      const w = worldRef.current;
      if (w) applySettings(w, settings);
    };
    const mo = new MutationObserver(reapply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', reapply);
    return () => { mo.disconnect(); mq.removeEventListener('change', reapply); };
  }, [settings]);

  const handleUndo = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.undo();
  }, []);

  const handleRedo = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.redo();
  }, []);

  // 全键盘映射
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 输入框 / 模态时不接管
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY')) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.code === 'Backspace') {
        e.preventDefault();
        handleUndo();
        return;
      }
      const k = keymapRef.current[e.code];
      if (!k) return;
      e.preventDefault();
      const world = worldRef.current;
      if (!world) return;
      // SQ1: 全键盘 keymap 走 NxN 记号,不适用,直接吞掉
      const cube = asNxN(world);
      if (!cube) return;
      // force=true:前一个 group 还在转时 finish 它到终点 + unlock + retry,
      // 连按 I/J 时 R 截断到完成位 + U 立刻开始 (cube.lock 跨轴互斥)
      const action = new TwistAction(k.sign, k.reverse, 1);
      cube.twister.twist(action, false, true);
      userMoveRef.current?.(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  const onAlgChange = useCallback((alg: string) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      if (alg) np.set('alg', alg); else np.delete('alg');
      return withPuzzleFirst(np);
    }, { replace: true });
  }, [setSearchParams]);

  const onSetupChange = useCallback((setup: string) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      if (setup) np.set('setup', setup); else np.delete('setup');
      return withPuzzleFirst(np);
    }, { replace: true });
  }, [setSearchParams]);

  const onAlgPick = useCallback((setup: string, alg: string) => {
    const world = worldRef.current;
    if (!world) return;
    // 只 setup 到 case 状态 (训练用), 不自动跑 alg。
    // 把 setup/alg 写进 URL — 切到回放模式时, PlayerControls 自动 reset+载入。
    world.cube.twister.setup(setup);
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      if (setup) np.set('setup', setup); else np.delete('setup');
      if (alg) np.set('alg', alg); else np.delete('alg');
      return withPuzzleFirst(np);
    }, { replace: true });
  }, [setSearchParams]);

  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    return rendererRef.current?.domElement ?? null;
  }, []);
  const getWorld = useCallback((): World | null => worldRef.current, []);
  const getRenderer = useCallback((): THREE.WebGLRenderer | null => rendererRef.current, []);

  const playerSetup = useMemo(() => setupParam, [setupParam]);
  const playerAlg = useMemo(() => algParam, [algParam]);

  // Stress test: 复原 → 排队 30 个 twist → 测 5s 窗口里的 rAF tick
  const onStress = useCallback(async () => {
    const w = worldRef.current;
    if (!w) return { avgFps: 0, minFps: 0, durationMs: 0, frames: 0 };
    const stressCube = asNxN(w);
    if (!stressCube) return { avgFps: 0, minFps: 0, durationMs: 0, frames: 0 };
    stressCube.twister.twist(new TwistAction('#'), true, true);
    await new Promise((r) => setTimeout(r, 200));
    const SIGNS = ['R', 'U', 'F', 'L', 'D', 'B'];
    for (let i = 0; i < 30; i++) {
      stressCube.twister.twist(new TwistAction(SIGNS[i % SIGNS.length], i % 2 === 0, 1), false, false);
    }
    const DURATION = 5000;
    const t0 = performance.now();
    return new Promise<{ avgFps: number; minFps: number; durationMs: number; frames: number }>((resolve) => {
      let frames = 0;
      let maxDt = 0;
      let lastT = t0;
      const tick = () => {
        const now = performance.now();
        const dt = now - lastT;
        lastT = now;
        frames++;
        if (dt > maxDt && dt < 500) maxDt = dt;
        if (now - t0 < DURATION) {
          requestAnimationFrame(tick);
        } else {
          const elapsed = now - t0;
          const avgFps = (frames * 1000) / elapsed;
          const minFps = maxDt > 0 ? 1000 / maxDt : 0;
          resolve({ avgFps, minFps, durationMs: elapsed, frames });
        }
      };
      requestAnimationFrame(tick);
    });
  }, []);

  return (
    <div className={`sim-page${fullscreen ? ' sim-page--fullscreen' : ''}${settings.checkeredBg ? ' sim-page--checkered' : ''}`}>
      <header className="sim-header">
        <Link to="/" className="sim-back" title={t('返回', 'Back')}>
          <ChevronLeft size={18} />
        </Link>
        <h1 className="sim-title">{t('模拟', 'Sim')}</h1>
        <div className="sim-spacer" />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <div className="sim-body">
        <div className="sim-canvas-wrap" ref={containerRef}>
          {twisty ? (
            <TwistySection
              puzzle={puzzleParam}
              scramble={setupParam}
              alg={algParam}
              fillPane
              twistOnClick
              onUserMove={(moveText) => {
                userMoveRef.current?.(new TwistAction(moveText, false, 1));
              }}
            />
          ) : null}
          {IS_DEV && !twisty ? <PerfOverlay statsRef={statsRef} onStress={onStress} /> : null}
          <button
            className="sim-fullscreen-exit"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
            aria-label={fullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏魔方', 'Fullscreen cube')}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        <aside className="sim-side">
          <CollapsibleSection
            open={algsOpen}
            onToggle={() => setAlgsOpen((o) => !o)}
            icon={BookOpen}
            label={t('公式', 'Algs')}
          >
            <AlgsPanel
              onSelect={(setup, alg) => { onAlgPick(setup, alg); }}
              onOrderChange={handleOrder}
              disabled={twisty}
            />
          </CollapsibleSection>
          <PlayerControls
            world={worldRef.current}
            alg={playerAlg}
            setup={playerSetup}
            onAlgChange={onAlgChange}
            onSetupChange={onSetupChange}
            order={order}
            onOrderChange={handleOrder}
            puzzleKind={puzzleKind}
            onPuzzleChange={handlePuzzle}
            settings={settings}
            onSettingsChange={setSettings}
            keymap={keymap}
            onKeymapChange={setKeymap}
            onResetKeymap={() => setKeymap(resetKeymapStorage())}
            userMoveRef={userMoveRef}
            onScrambleTime={IS_DEV ? (ms, cpuMs) => {
              statsRef.current.scrambleMs = ms;
              if (cpuMs != null) statsRef.current.setupCpuMs = cpuMs;
            } : undefined}
          />
          {!twisty && (
            <CollapsibleSection
              open={directorOpen}
              onToggle={() => setDirectorOpen((o) => !o)}
              icon={Film}
              label={t('录制', 'Record')}
            >
              <DirectorPanel
                getCanvas={getCanvas}
                getWorld={getWorld}
                getRenderer={getRenderer}
                setup={setupParam}
                alg={algParam}
              />
            </CollapsibleSection>
          )}
        </aside>
      </div>

    </div>
  );
}

function CollapsibleSection({
  open, onToggle, icon: Icon, label, children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: typeof BookOpen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sim-puzzle">
      <button
        type="button"
        className="sim-puzzle-head"
        onClick={onToggle}
        aria-expanded={open}
        title={label}
      >
        <ChevronRight size={14} className={'sim-puzzle-caret' + (open ? ' open' : '')} />
        <Icon size={14} />
        <span className="sim-puzzle-title">{label}</span>
      </button>
      {open && <div className="sim-section-body">{children}</div>}
    </section>
  );
}
