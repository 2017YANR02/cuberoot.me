/**
 * /stack — 虚拟魔方 Playground / Player / Algs / Director
 * 核心 src/pages/stack/cuber/* 移植自 huazhechen/cuber (MIT)。
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import {
  ChevronLeft, RotateCcw, Shuffle, Undo2, Redo2,
  Settings, BookOpen, Film, PlayCircle, Box,
} from 'lucide-react';
import World from './cuber/world';
import Toucher from './Toucher';
import { TwistAction } from './cuber/twister';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { useIsMobile } from '../../hooks/useIsMobile';
import SettingDrawer, { loadSettings, saveSettings, applySettings, type StackSettings } from './SettingDrawer';
import MobileKeypad from './MobileKeypad';
import PlayerControls from './PlayerControls';
import AlgsPanel from './AlgsPanel';
import DirectorPanel from './DirectorPanel';
import PerfOverlay, { type PerfStats } from './PerfOverlay';
import './stack.css';

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

const ORDER_MIN = 2;
const ORDER_MAX = 2000;
type Mode = 'play' | 'player' | 'algs' | 'director';

const KEYMAP: Record<string, { sign: string; reverse?: boolean }> = {
  KeyI: { sign: 'R' },                  KeyK: { sign: 'R', reverse: true },
  KeyW: { sign: 'B' },                  KeyO: { sign: 'B', reverse: true },
  KeyS: { sign: 'D' },                  KeyL: { sign: 'D', reverse: true },
  KeyD: { sign: 'L' },                  KeyE: { sign: 'L', reverse: true },
  KeyJ: { sign: 'U' },                  KeyF: { sign: 'U', reverse: true },
  KeyH: { sign: 'F' },                  KeyG: { sign: 'F', reverse: true },
  Semicolon: { sign: 'y' },             KeyA: { sign: 'y', reverse: true },
  KeyU: { sign: 'r' },                  KeyR: { sign: 'l', reverse: true },
  KeyM: { sign: 'r', reverse: true },   KeyV: { sign: 'l' },
  KeyT: { sign: 'x' },                  KeyY: { sign: 'x' },
  KeyN: { sign: 'x', reverse: true },   KeyB: { sign: 'x', reverse: true },
  Period: { sign: 'M', reverse: true }, KeyX: { sign: 'M', reverse: true },
  Digit5: { sign: 'M' },                Digit6: { sign: 'M' },
  KeyP: { sign: 'z' },                  KeyQ: { sign: 'z', reverse: true },
  KeyZ: { sign: 'd' },                  Slash: { sign: 'd', reverse: true },
  KeyC: { sign: 'u', reverse: true },   Comma: { sign: 'u' },
  ArrowLeft: { sign: 'U' },             ArrowUp: { sign: 'R' },
  ArrowRight: { sign: 'U', reverse: true }, ArrowDown: { sign: 'R', reverse: true },
};

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
  const isMobile = useIsMobile(640);

  const [searchParams, setSearchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as Mode) || 'play';
  const algParam = searchParams.get('alg') || '';
  const setupParam = searchParams.get('setup') || '';

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
  const [orderDraft, setOrderDraft] = useState<string>('3');
  const [moves, setMoves] = useState<number>(0);
  const [canRedo, setCanRedo] = useState(false);
  const [solvedToast, setSolvedToast] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<StackSettings>(() => loadSettings());

  const setMode = useCallback((next: Mode) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      if (next === 'play') np.delete('mode'); else np.set('mode', next);
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
      setMoves(c.history.moves);
      setCanRedo(c.history.redoStack.length > 0);
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

    ensureCubeCallback();
    applySettings(world, settings);

    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as { __stack__?: World }).__stack__ = world;
      // 暴露 tweener 实例,避免 console import 拿到不同的 module instance
      import('./cuber/tweener').then((m) => {
        (window as unknown as { __tweener__?: unknown }).__tweener__ = m.default;
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
        world.cube.instancedRenderer.update();
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
        s.cubeletCount = world.cube.cubelets.length;
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
    if (n >= 5) {
      setOrderLoading(true);
      window.setTimeout(() => {
        if (!worldRef.current) return;
        worldRef.current.order = n;
        setOrder(n);
        setMoves(0);
        setCanRedo(false);
        wasCompleteRef.current = true;
        ensureCubeCallback();
        applySettings(worldRef.current, settings);
        setOrderLoading(false);
      }, 16);
    } else {
      world.order = n;
      setOrder(n);
      setMoves(0);
      setCanRedo(false);
      wasCompleteRef.current = true;
      ensureCubeCallback();
      applySettings(world, settings);
    }
  }, [ensureCubeCallback, settings]);

  // settings 变化时即时 apply
  useEffect(() => {
    saveSettings(settings);
    const world = worldRef.current;
    if (world) applySettings(world, settings);
  }, [settings]);

  // 外部 (AlgsPanel onOrderChange) 改 order 时同步 draft
  useEffect(() => { setOrderDraft(String(order)); }, [order]);

  const handleScramble = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.twist(new TwistAction('*'), true, true);
  }, []);

  const handleReset = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    world.cube.twister.twist(new TwistAction('#'), true, true);
  }, []);

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
      // 输入框 / 设置抽屉 / 模态时不接管
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (settingsOpen) return;

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
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      const world = worldRef.current;
      if (!world) return;
      world.cube.twister.twist(new TwistAction(k.sign, k.reverse, 1), false, false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, settingsOpen]);

  const onAlgChange = useCallback((alg: string) => {
    setSearchParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set('mode', 'player');
      if (alg) np.set('alg', alg); else np.delete('alg');
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
    { id: 'play',     icon: Box,        label: t('自由', 'Play') },
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
        <div className="stack-counter" title={t('步数 (HTM)', 'Moves (HTM)')}>{moves}</div>
        <div className="stack-actions">
          <button onClick={handleUndo} disabled={moves === 0 && !canRedo} title={t('撤销 Ctrl+Z', 'Undo Ctrl+Z')}>
            <Undo2 size={16} />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title={t('重做 Ctrl+Y', 'Redo Ctrl+Y')}>
            <Redo2 size={16} />
          </button>
          <button onClick={handleScramble} title={t('打乱', 'Scramble')}>
            <Shuffle size={16} />
          </button>
          <button onClick={handleReset} title={t('复原', 'Reset')}>
            <RotateCcw size={16} />
          </button>
          <button onClick={() => setSettingsOpen(true)} title={t('设置', 'Settings')}>
            <Settings size={16} />
          </button>
        </div>
        <input
          className="stack-order-input"
          type="number"
          min={ORDER_MIN}
          max={ORDER_MAX}
          step={1}
          value={orderDraft}
          onChange={(e) => setOrderDraft(e.target.value)}
          onBlur={() => {
            const n = Math.max(ORDER_MIN, Math.min(ORDER_MAX, Math.floor(Number(orderDraft) || order)));
            setOrderDraft(String(n));
            handleOrder(n);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'Escape') { setOrderDraft(String(order)); (e.target as HTMLInputElement).blur(); }
          }}
          title={t('阶数 2–2000(回车 / 失焦应用)', 'Cube order 2–2000 (Enter / blur to apply)')}
        />
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

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

      {isMobile ? (
        <MobileKeypad
          onTwist={(sign, reverse) => {
            const world = worldRef.current;
            if (!world) return;
            world.cube.twister.twist(new TwistAction(sign, reverse, 1), false, false);
          }}
        />
      ) : null}

      {mode === 'player' ? (
        <PlayerControls
          world={worldRef.current}
          alg={playerAlg}
          setup={playerSetup}
          onAlgChange={onAlgChange}
        />
      ) : null}
      {mode === 'algs' ? (
        <AlgsPanel
          onSelect={(setup, alg) => {
            onAlgPick(setup, alg);
          }}
          onOrderChange={handleOrder}
        />
      ) : null}
      {mode === 'director' ? (
        <DirectorPanel getCanvas={getCanvas} />
      ) : null}

      <SettingDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}
