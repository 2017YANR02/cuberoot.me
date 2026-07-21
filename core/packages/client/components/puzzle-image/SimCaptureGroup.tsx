'use client';

/**
 * SimCaptureGroup — /sim 的「实时」捕获按钮组:PNG 截图 / SVG 截图 / 录制 MP4,
 * 附 MP4 离线渲染进度浮层。从 PuzzleImageStudio 抽出,两处使用:
 *  - 图像面板内(visualcube 支持的拼图,PuzzleImageStudio 渲染);
 *  - 其余拼图(枫叶 / 恐龙 / 齿轮 / PG 骨架族等)在 SimPage 侧栏单独渲染 ——
 *    截图能力覆盖菜单里的所有拼图,不随图像面板的 spec 渲染器支持面收窄。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// Type-only imports (fully erased at build) — the concrete sim engine + export
// modules are dynamically imported inside the handlers so pages without a live
// sim never bundle the ~1.2MB three/cuber engine.
import type * as THREE from 'three';
import type World from '@/app/[lang]/sim/engine/world';
import type { ExportProgress } from '@/app/[lang]/sim/sim_export';
import { useT } from '@/hooks/useT';
import './puzzle-image.css';

/**
 * Live-simulator bridge — carries the sim's live handles (canvas PNG snapshot,
 * scene→SVG projection, offline-render mp4) and its current setup + alg (the mp4
 * export animates the alg).
 */
export interface SimBridge {
  getCanvas: () => HTMLCanvasElement | null;
  getWorld: () => World | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  /** cubing.js TwistyPlayer(自定义切割 / PG 目录拼图 / renderer='cubing')。
   *  引擎 world 不在场时,截图走它:PNG 用 experimentalScreenshot,SVG 从
   *  experimentalCurrentVantages 取 scene+camera 喂同一个投影导出器。 */
  getTwistyPlayer?: () => unknown | null;
  setup: string;
  alg: string;
}

/** TwistyPlayer 实验 API 的最小 duck-type(避免引入 cubing/twisty 类型依赖)。
 *  SimPage 的伴图 twisty 路径与本组件的截图路径共用。 */
export interface TwistyPlayerLike {
  experimentalCurrentVantages?: () => Promise<Iterable<{
    camera: () => Promise<THREE.PerspectiveCamera>;
    scene: { scene: () => Promise<THREE.Scene> };
    contentWrapper?: HTMLElement;
  }>>;
  experimentalScreenshot?: () => Promise<string>;
  getBoundingClientRect: () => DOMRect;
}

export default function SimCaptureGroup({ simBridge }: { simBridge: SimBridge }) {
  const t = useT();
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const capturePreviewRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  // dev-only:Playwright / devtools 直取两条导出路径做 A/B(GPU depth-map vs
  // BSP 解析隐面),不经下载。生产构建整段被 tree-shake。
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const w = window as unknown as { __simSvgExport?: unknown };
    w.__simSvgExport = {
      gpu: async () => {
        const { exportSimSvg } = await import('@/app/[lang]/sim/sim_svg_export');
        const world = simBridge.getWorld();
        return world ? exportSimSvg({ world, renderer: simBridge.getRenderer() }) : null;
      },
      bsp: async () => {
        const { exportSimSvgBspWithDebug } = await import('@/app/[lang]/sim/sim_svg_export_bsp');
        const world = simBridge.getWorld();
        if (!world) return null;
        const t0 = performance.now();
        const out = exportSimSvgBspWithDebug({ world });
        return { ...out, ms: performance.now() - t0 };
      },
    };
    return () => { delete w.__simSvgExport; };
  }, [simBridge]);

  const downloadUrl = useCallback((url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const snapshot = useCallback(async () => {
    const cv = simBridge.getCanvas();
    if (cv) {
      cv.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        downloadUrl(url, `sim-${Date.now()}.png`);
        URL.revokeObjectURL(url);
      }, 'image/png');
      return;
    }
    // cubing.js TwistyPlayer 拼图:官方离屏截图(dataURL)
    const tp = simBridge.getTwistyPlayer?.() as TwistyPlayerLike | null;
    if (!tp?.experimentalScreenshot) return;
    try {
      downloadUrl(await tp.experimentalScreenshot(), `sim-${Date.now()}.png`);
    } catch { /* 截图失败静默(与旧行为一致:无引擎时无操作) */ }
  }, [simBridge, downloadUrl]);

  // 实时 SVG 截图 — 把当前 3D 场景静止帧投影成矢量 SVG(所有 /sim 拼图 + 任意
  // 设置开关组合;与 PNG 截图一样导出主视图,背景透明)。引擎拼图默认走 BSP
  // 解析隐面消除(遮挡边界 = 平面求交直线,任意放大无毛刺);场景含 BSP 不覆盖
  // 的特性(手 SkinnedMesh / 方位字母 Sprite / logo 贴图 / 原核分色 aRaw)或
  // BSP 爆量时回退 GPU depth-map 路径。twisty 拼图从 TwistyPlayer vantage 取
  // scene+camera 喂截图导出器(全 Basic 材质无灯,无深度图 → 纯 painter 分支)。
  const svgSnapshot = useCallback(async () => {
    try {
      const world = simBridge.getWorld();
      let svg: string | undefined;
      if (world) {
        const bsp = await import('@/app/[lang]/sim/sim_svg_export_bsp');
        const audit = bsp.bspSceneAudit(world.scene);
        if (!audit.losesDetail && !audit.miscolors) {
          try {
            svg = bsp.exportSimSvgBsp({ world });
          } catch { /* SVG_TOO_COMPLEX(超高阶)等 → 回退 GPU 路径 */ }
        }
        if (svg === undefined) {
          const { exportSimSvg } = await import('@/app/[lang]/sim/sim_svg_export');
          svg = exportSimSvg({ world, renderer: simBridge.getRenderer() });
        }
      } else {
        const { exportSimSvg } = await import('@/app/[lang]/sim/sim_svg_export');
        const tp = simBridge.getTwistyPlayer?.() as TwistyPlayerLike | null;
        if (!tp?.experimentalCurrentVantages) return;
        const vantage = [...await tp.experimentalCurrentVantages()][0];
        if (!vantage) return;
        const camera = await vantage.camera();
        const scene = await vantage.scene.scene();
        const rect = (vantage.contentWrapper ?? tp).getBoundingClientRect();
        svg = exportSimSvg({
          world: {
            scene, camera,
            width: Math.max(1, Math.round(rect.width)),
            height: Math.max(1, Math.round(rect.height)),
          },
          srgbColors: true, // cubing.js 旧版 three 无色彩管理,颜色 sRGB 直存
        });
      }
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `sim-${Date.now()}.svg`);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-alert
      alert(msg.startsWith('SVG_TOO_COMPLEX')
        ? t('场景面片太多(超高阶),SVG 导出不适用,请用 PNG 截图', 'Too many faces for SVG export (very high order) — use the PNG snapshot')
        : t('SVG 导出失败: ', 'SVG export failed: ') + msg);
    }
  }, [simBridge, downloadUrl, t]);

  const startExport = useCallback(async () => {
    const world = simBridge.getWorld();
    const renderer = simBridge.getRenderer();
    if (!world || !renderer || exporting) return;
    setExporting(true);
    abortRef.current = { aborted: false };
    setProgress({ phase: t('准备...', 'Preparing...'), pct: 0, framesDone: 0, framesTotal: 0 });
    // wait a frame so the overlay mounts and capturePreviewRef is live
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      const { exportSimVideo } = await import('@/app/[lang]/sim/sim_export');
      await exportSimVideo({
        world, renderer, setup: simBridge.setup, alg: simBridge.alg, isZh,
        abortRef: abortRef.current,
        onProgress: setProgress,
        previewCanvas: capturePreviewRef.current,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'aborted') {
        console.error('[Sim Export] failed:', e);
        // eslint-disable-next-line no-alert
        alert(t('导出失败:', 'Export failed: ') + msg);
      }
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }, [simBridge, exporting, isZh, t]);

  const cancelExport = useCallback(() => { abortRef.current.aborted = true; }, []);
  const canRecord = simBridge.alg.trim().length > 0;

  return (
    <>
      <div className="vc-capture-group">
        <button type="button" className="vc-btn" onClick={snapshot}>
          <Camera size={14} /> {t('截图', 'Snapshot')}
        </button>
        <button
          type="button"
          className="vc-btn"
          onClick={svgSnapshot}
          title={t('把当前画面(含动画停帧)导出为矢量 SVG', 'Export the current frame (incl. mid-animation) as vector SVG')}
        >
          <Camera size={14} /> {t('截图 SVG', 'SVG')}
        </button>
        <button
          type="button"
          className="vc-btn"
          onClick={startExport}
          disabled={!canRecord || exporting}
          title={!canRecord
            ? t('解法为空, 无可导出动画', 'Alg is empty — nothing to record')
            : t('导出 mp4 1080p:离线渲染当前解法动画', 'Export mp4 1080p: offline render of the solution animation')}
        >
          <Film size={14} /> {t('录制 MP4', 'Record MP4')}
        </button>
      </div>

      {exporting && progress && (
        <div className="sim-export-overlay">
          <div className="sim-export-card">
            <div className="sim-export-title">{t('导出视频中', 'Exporting video')}</div>
            <canvas ref={capturePreviewRef} className="sim-export-preview" />
            <div className="sim-export-bar">
              <div className="sim-export-bar-fill" style={{ width: `${(progress.pct * 100).toFixed(1)}%` }} />
            </div>
            <div className="sim-export-msg">{progress.phase}</div>
            <button type="button" className="sim-export-cancel" onClick={cancelExport}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
