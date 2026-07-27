'use client';

/**
 * SimStage —— 嵌入式 3D 画布的「壳」,只有一份。
 *
 * 每个 /sim 嵌入点(二阶/三阶涂色板、金字塔/斜转涂色板、SQ1 转盘、预判题板 …)都要
 * 重写同一套外围:
 *   ① 等第一帧画完再动态 import three + 引擎(`import three` 会在主线程解析执行,
 *      撞在首屏绘制里会卡一下);
 *   ② 一个方形 host div 给渲染器挂 canvas;
 *   ③ 「装好了没」+ 只在**慢到人能察觉**时(250ms)才显示转圈 —— chunk 命中缓存时
 *      几乎立刻就位,先闪一下 spinner 比空着更吵;
 *   ④ 右上角「重置视角」小按钮。
 * 抽走前这四件在三个文件里各写了一遍(~40 行 ×3),视角复位那三行还各自硬抄了
 * `π/6, −π/4+π/16`(真正的源头在 `engine/viewControls` 的 `HOME_SCENE_ROT`)。
 *
 * `mount` **只在挂载时跑一次**(和它替换掉的那些 `useEffect(..., [])` 同语义):
 * 里面要读最新的 props/state 一律走 ref,别指望闭包会更新。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Spinner } from '@/components/Spinner/Spinner';
import { useT } from '@/hooks/useT';

/** 第一帧画完(rAF 在绘制前触发,所以要嵌套两层)。 */
export const afterFirstPaint = (): Promise<void> => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

export interface SimStageProps {
  /** 画布边长(px,正方形)。 */
  size: number;
  /**
   * 引擎挂载。调用时 host 已在 DOM 里、尺寸已定;返回卸载函数(同 useEffect 的清理)。
   * 组件已经等过第一帧,里面直接 `await import(...)` 即可。
   */
  mount: (host: HTMLElement) => Promise<(() => void) | void> | (() => void) | void;
  /** 挂载完成(引擎可用)。调用方拿它把自己的 ready 打开、触发同步 effect。 */
  onReady?: () => void;
  /** 传了才显示右上角「重置视角」按钮(一般是 `resetSceneView(world)`)。 */
  onResetView?: () => void;
  /** 加在最外层的类名(布局/边框由调用方定,壳自己不画装饰)。 */
  className?: string;
  /** 转圈的无障碍文案,默认「正在加载立体画板」。 */
  busyLabel?: string;
  /** 叠在画布上的额外内容(提示条、角标 …)。 */
  children?: ReactNode;
}

export default function SimStage({
  size, mount, onReady, onResetView, className, busyLabel, children,
}: SimStageProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef(mount);
  mountRef.current = mount;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const [ready, setReady] = useState(false);
  const [showBusy, setShowBusy] = useState(false);
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setShowBusy(true), 250);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | void;

    void (async () => {
      await afterFirstPaint();
      if (cancelled) return;
      cleanup = await mountRef.current(host);
      if (cancelled) { cleanup?.(); return; }
      setReady(true);
      onReadyRef.current?.();
    })();

    return () => { cancelled = true; cleanup?.(); };
  }, []);

  return (
    <div className={`sim-stage${className ? ` ${className}` : ''}`}>
      <style>{INLINE_CSS}</style>
      <div ref={hostRef} className="sim-stage-canvas" style={{ width: size, height: size }} />
      {children}
      {!ready && showBusy && (
        <span className="sim-stage-busy">
          <Spinner size={22} label={busyLabel ?? t('正在加载立体画板', 'Loading the 3D board')} />
        </span>
      )}
      {onResetView && (
        <button
          type="button"
          className="sim-stage-reset"
          onClick={onResetView}
          title={t('重置视角', 'Reset view')}
          aria-label={t('重置视角', 'Reset view')}
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}

const INLINE_CSS = `
.sim-stage { position: relative; line-height: 0; max-width: 100%; }
.sim-stage-canvas {
  max-width: 100%; touch-action: none;
  -webkit-user-select: none; user-select: none;
}
.sim-stage-busy {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted-foreground); pointer-events: none;
}
.sim-stage-reset {
  position: absolute; top: 4px; right: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: var(--card); border: 1px solid var(--border-default);
  color: var(--muted-foreground); border-radius: 6px; cursor: pointer;
  transition: border-color 0.12s ease, color 0.12s ease;
}
.sim-stage-reset:hover { border-color: var(--accent); color: var(--accent); }
`;
