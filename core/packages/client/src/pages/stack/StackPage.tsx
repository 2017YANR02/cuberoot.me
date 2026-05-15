/**
 * /stack — 虚拟魔方 Playground / Player / Algs / Director
 * 核心 src/pages/stack/cuber/* 移植自 huazhechen/cuber (MIT)。
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import {
  ChevronLeft,
  BookOpen, Film, PlayCircle, Box,
} from 'lucide-react';
import World from './cuber/world';
import Toucher from './Toucher';
import { TwistAction } from './cuber/twister';
import { FACE } from './cuber/define';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { loadSettings, saveSettings, applySettings, type StackSettings } from './SettingDrawer';
import PlayerControls from './PlayerControls';
import AlgsPanel from './AlgsPanel';
import DirectorPanel from './DirectorPanel';
import PerfOverlay, { type PerfStats } from './PerfOverlay';
import { loadKeymap, saveKeymap, resetKeymap as resetKeymapStorage, type KeyMove } from './keymap';
import './stack.css';

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

type Mode = 'player' | 'algs' | 'director';

interface StackCube {
  history: { moves: number; redoStack: unknown[] };
  twister: { undo: () => void; redo: () => void; twist: (a: TwistAction, fast: boolean, force: boolean) => boolean; setup: (e: string) => void; push: (e: string) => void };
  callbacks: (() => void)[];
  complete: boolean;
  dirty: boolean;
}

export default function StackPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [searchParams, setSearchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as Mode) || 'player';
  const algParam = searchParams.get('alg') || '';
  const setupParam = searchParams.get('setup') || '';
  const puzzleParam = (() => {
    const raw = searchParams.get('puzzle');
    if (!raw) return 3;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 2 || n > 500) return 3;
    return n;
  })();

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);
  const wasCompleteRef = useRef(false);
  const statsRef = useRef<PerfStats>({
    drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0,
    meshCount: 0, cubeletCount: 0, fps: 0, frameMs: 0, order: 3,
  });

  const [order, setOrder] = useState<number>(3);
  const [solvedToast, setSolvedToast] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [worldTick, setWorldTick] = useState(0);
  const [settings, setSettings] = useState<StackSettings>(() => loadSettings());
  const [keymap, setKeymap] = useState<Record<string, KeyMove>>(() => loadKeymap());
  const keymapRef = useRef(keymap);
  useEffect(() => { keymapRef.current = keymap; saveKeymap(keymap); }, [keymap]);

  const setMode = useCallback((next: Mode) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      if (next === 'player') np.delete('mode'); else np.set('mode', next);
      if (next !== 'player') { np.delete('alg'); np.delete('setup'); }
      return np;
    }, { replace: true });
  }, [setSearchParams]);

  const ensureCubeCallback = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const cube = w.cube as unknown as StackCube;
    const tag = '_stackBound';
    const cubeAny = cube as unknown as Record<string, unknown>;
    if (cubeAny[tag]) return;
    cubeAny[tag] = true;
    cube.callbacks.push(() => {
      const wnow = worldRef.current;
      if (!wnow) return;
      const c = wnow.cube as unknown as StackCube;
      const completeNow = c.complete;
      if (completeNow && !wasCompleteRef.current && c.history.moves > 0) {
        setSolvedToast(true);
        window.setTimeout(() => setSolvedToast(false), 2200);
      }
      wasCompleteRef.current = completeNow;
    });
  }, []);

  // World 初始化(仅一次)。React StrictMode 会双调;用 ref 守卫。
  useEffect(() => {
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
      const order = world.cube.order;
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
      const group = world.cube.table.groups[axis]?.[layer];
      if (!group) return;
      // group.name 已含 wide/layer 前缀 (如 "R" / "2R" / "M'" / "2L'"),
      // 走 twister.twist 让 history 也 record (undo/redo 才 work),
      // force=true 截断前一个动画 + 接续按键的"截断"语义
      world.cube.twister.twist(new TwistAction(group.name, reverse, 1), false, true);
    });

    // 右键 default 是 context menu,阻止它好让右键单击能触发逆时针转
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    ensureCubeCallback();
    applySettings(world, settings);

    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as { __stack__?: World }).__stack__ = world;
      (window as unknown as { __renderer__?: THREE.WebGLRenderer }).__renderer__ = renderer;
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
          world.cube.twister.twist(new TwistAction('#'), true, true);
          await new Promise((res) => setTimeout(res, 200));
          world.cube.dirty = true;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const idle_tris = rendererRef.current?.info.render.triangles ?? 0;
          const idle_draws = rendererRef.current?.info.render.calls ?? 0;

          const runsData: { avgFps: number; minFps: number; frames: number }[] = [];
          for (let r = 0; r < runs; r++) {
            world.cube.twister.twist(new TwistAction('#'), true, true);
            await new Promise((res) => setTimeout(res, 200));
            for (let i = 0; i < twists; i++) {
              world.cube.twister.twist(new TwistAction(SIGNS[i % SIGNS.length], i % 2 === 0, 1), false, false);
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
    const SCALE_MIN = 0.3;
    const SCALE_MAX = 3.0;
    const settingsFromScale = (s: number) => Math.round((s - 0.5) * 100);  // mapScale 的反函数
    let scaleSyncTimer: number | null = null;
    const syncScaleToSettings = () => {
      if (scaleSyncTimer) window.clearTimeout(scaleSyncTimer);
      scaleSyncTimer = window.setTimeout(() => {
        const w = worldRef.current;
        if (!w) return;
        const v = Math.max(0, Math.min(100, settingsFromScale(w.scale)));
        setSettings((prev) => prev.scale === v ? prev : { ...prev, scale: v });
      }, 250);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const w = worldRef.current;
      if (!w) return;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      w.scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, w.scale * factor));
      w.resize();
      syncScaleToSettings();
    };
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // 双指捏合: pointerdown 跟踪两个 active pointer
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartScale = 0;
    let pinching = false;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size === 2) {
        const [a, b] = [...activePointers.values()];
        pinchStartDist = dist(a, b);
        pinchStartScale = world.scale;
        pinching = true;
        world.controller.disable = true;  // 暂停旋转, 让捏合主导
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinching && activePointers.size === 2) {
        e.preventDefault();
        const [a, b] = [...activePointers.values()];
        const ratio = dist(a, b) / Math.max(pinchStartDist, 1);
        world.scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, pinchStartScale * ratio));
        world.resize();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      activePointers.delete(e.pointerId);
      if (pinching && activePointers.size < 2) {
        pinching = false;
        world.controller.disable = false;
        syncScaleToSettings();
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

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
        s.cubeletCount = world.cube.cubelets.size;
        s.order = world.cube.order;
        if (now - meshSampleAt > 1000) {
          meshSampleAt = now;
          let count = 0;
          world.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) count++; });
          s.meshCount = count;
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
  }, []);

  // 切阶数(大阶数有几百毫秒构建,先 spinner 再切)
  const handleOrder = useCallback((n: number) => {
    const world = worldRef.current;
    if (!world || world.order === n) return;
    const writeUrl = () => {
      setSearchParams((prev) => {
        const np = new URLSearchParams(prev);
        if (n === 3) np.delete('puzzle'); else np.set('puzzle', String(n));
        return np;
      }, { replace: true });
    };
    if (n >= 5) {
      setOrderLoading(true);
      window.setTimeout(() => {
        if (!worldRef.current) return;
        worldRef.current.order = n;
        setOrder(n);
        wasCompleteRef.current = true;
        ensureCubeCallback();
        applySettings(worldRef.current, settings);
        setOrderLoading(false);
        writeUrl();
      }, 16);
    } else {
      world.order = n;
      setOrder(n);
      wasCompleteRef.current = true;
      ensureCubeCallback();
      applySettings(world, settings);
      writeUrl();
    }
  }, [ensureCubeCallback, settings, setSearchParams]);

  // URL puzzle=N 同步到 cube。worldTick 保证 mount 完后 effect 重跑一次
  useEffect(() => {
    if (!worldRef.current) return;
    if (worldRef.current.order === puzzleParam) return;
    handleOrder(puzzleParam);
  }, [puzzleParam, handleOrder, worldTick]);

  // settings 变化时即时 apply
  useEffect(() => {
    saveSettings(settings);
    const world = worldRef.current;
    if (world) applySettings(world, settings);
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
      // force=true:前一个 group 还在转时 finish 它到终点 + unlock + retry,
      // 连按 I/J 时 R 截断到完成位 + U 立刻开始 (cube.lock 跨轴互斥)
      world.cube.twister.twist(new TwistAction(k.sign, k.reverse, 1), false, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  const onAlgChange = useCallback((alg: string) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set('mode', 'player');
      if (alg) np.set('alg', alg); else np.delete('alg');
      return np;
    }, { replace: true });
  }, [setSearchParams]);

  const onSetupChange = useCallback((setup: string) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set('mode', 'player');
      if (setup) np.set('setup', setup); else np.delete('setup');
      return np;
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
      return np;
    }, { replace: true });
  }, [setSearchParams]);

  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    return rendererRef.current?.domElement ?? null;
  }, []);

  const playerSetup = useMemo(() => setupParam, [setupParam]);
  const playerAlg = useMemo(() => algParam, [algParam]);

  // Stress test: 复原 → 排队 30 个 twist → 测 5s 窗口里的 rAF tick
  const onStress = useCallback(async () => {
    const w = worldRef.current;
    if (!w) return { avgFps: 0, minFps: 0, durationMs: 0, frames: 0 };
    w.cube.twister.twist(new TwistAction('#'), true, true);
    await new Promise((r) => setTimeout(r, 200));
    const SIGNS = ['R', 'U', 'F', 'L', 'D', 'B'];
    for (let i = 0; i < 30; i++) {
      w.cube.twister.twist(new TwistAction(SIGNS[i % SIGNS.length], i % 2 === 0, 1), false, false);
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

  const modeButtons: { id: Mode; icon: typeof Box; label: string }[] = useMemo(() => [
    { id: 'player',   icon: PlayCircle, label: t('回放', 'Player') },
    { id: 'algs',     icon: BookOpen,   label: t('公式', 'Algs') },
    { id: 'director', icon: Film,       label: t('录制', 'Record') },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isZh]);

  return (
    <div className="stack-page">
      <header className="stack-header">
        <Link to="/" className="stack-back" title={t('返回', 'Back')}>
          <ChevronLeft size={18} />
        </Link>
        <h1 className="stack-title">{t('魔方栈', 'Stack')}</h1>
        <nav className="stack-modes">
          {modeButtons.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                className={m.id === mode ? 'active' : ''}
                onClick={() => setMode(m.id)}
                title={m.label}
              >
                <Icon size={14} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="stack-spacer" />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <div className="stack-body">
        <div className="stack-canvas-wrap" ref={containerRef}>
          {orderLoading ? (
            <div className="stack-loading">
              <div className="stack-spinner" />
              <span>{t('构建中…', 'Building…')}</span>
            </div>
          ) : null}
          {solvedToast ? (
            <div className="stack-toast">{t('已复原 ✦', 'Solved ✦')}</div>
          ) : null}
          {IS_DEV ? <PerfOverlay statsRef={statsRef} onStress={onStress} /> : null}
        </div>

        <aside className="stack-side">
          {mode === 'algs' ? (
            <AlgsPanel
              onSelect={(setup, alg) => { onAlgPick(setup, alg); }}
              onOrderChange={handleOrder}
            />
          ) : mode === 'director' ? (
            <DirectorPanel getCanvas={getCanvas} />
          ) : (
            <PlayerControls
              world={worldRef.current}
              alg={playerAlg}
              setup={playerSetup}
              onAlgChange={onAlgChange}
              onSetupChange={onSetupChange}
              order={order}
              onOrderChange={handleOrder}
              settings={settings}
              onSettingsChange={setSettings}
              keymap={keymap}
              onKeymapChange={setKeymap}
              onResetKeymap={() => setKeymap(resetKeymapStorage())}
            />
          )}
        </aside>
      </div>

    </div>
  );
}
