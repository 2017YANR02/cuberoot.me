/**
 * /stack — 虚拟魔方 Playground
 * 核心 src/pages/stack/cuber/* 移植自 huazhechen/cuber (MIT)。
 * v1 = Playground:自由玩 + 撤销 + 打乱 + 复原 + 阶数 2~7。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { ChevronLeft, RotateCcw, Shuffle, Undo2 } from 'lucide-react';
import World from './cuber/world';
import Toucher from './Toucher';
import { TwistAction } from './cuber/twister';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import './stack.css';

const ORDERS = [2, 3, 4, 5, 6, 7] as const;

export default function StackPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const toucherRef = useRef<Toucher | null>(null);

  const [order, setOrder] = useState<number>(3);
  const [moves, setMoves] = useState<number>(0);

  // World 初始化（仅一次）。React StrictMode 会双调；用 ref 守卫。
  useEffect(() => {
    if (worldRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const world = new World();
    worldRef.current = world;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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

    // 历史变化时同步步数
    world.cube.callbacks.push(() => {
      setMoves(world.cube.history.moves);
    });

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

    let raf = 0;
    const loop = () => {
      if (world.dirty || world.cube.dirty) {
        renderer.clear();
        renderer.render(world.scene, world.camera);
        world.dirty = false;
        world.cube.dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      toucher.destroy();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      worldRef.current = null;
      rendererRef.current = null;
      toucherRef.current = null;
    };
  }, []);

  // 切阶数
  const handleOrder = useCallback((n: number) => {
    const world = worldRef.current;
    if (!world) return;
    world.order = n;
    setOrder(n);
    setMoves(0);
    world.cube.callbacks.push(() => {
      setMoves(world.cube.history.moves);
    });
    world.cube.dirty = true;
  }, []);

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

  return (
    <div className="stack-page">
      <header className="stack-header">
        <Link to="/" className="stack-back" title={isZh ? '返回' : 'Back'}>
          <ChevronLeft size={18} />
        </Link>
        <h1 className="stack-title">{isZh ? '魔方栈' : 'Stack'}</h1>
        <div className="stack-spacer" />
        <div className="stack-counter" title={isZh ? '步数 (HTM)' : 'Moves (HTM)'}>{moves}</div>
        <div className="stack-actions">
          <button onClick={handleUndo} title={isZh ? '撤销' : 'Undo'}>
            <Undo2 size={16} />
          </button>
          <button onClick={handleScramble} title={isZh ? '打乱' : 'Scramble'}>
            <Shuffle size={16} />
          </button>
          <button onClick={handleReset} title={isZh ? '复原' : 'Reset'}>
            <RotateCcw size={16} />
          </button>
        </div>
        <div className="stack-orders">
          {ORDERS.map((n) => (
            <button
              key={n}
              className={n === order ? 'active' : ''}
              onClick={() => handleOrder(n)}
              title={`${n}x${n}x${n}`}
            >
              {n}
            </button>
          ))}
        </div>
        <LangToggle variant="inline" />
        <ThemeToggle />
      </header>

      <div ref={containerRef} className="stack-canvas-wrap" />

      <div className="stack-credit">
        {isZh ? '核心移植自 ' : 'Cube engine ported from '}
        <a href="https://github.com/huazhechen/cuber" target="_blank" rel="noopener noreferrer">
          huazhechen/cuber
        </a>
        {' (MIT)'}
      </div>
    </div>
  );
}
