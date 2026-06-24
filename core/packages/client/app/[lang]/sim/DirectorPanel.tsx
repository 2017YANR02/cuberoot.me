/**
 * DirectorPanel — 截图 PNG + 导出当前 setup+alg 到 1080p mp4。
 *
 * 截图: canvas → PNG 下载。
 * 导出: 离线 renderer + WebCodecs + mp4-muxer (跟 wr_metric 同一套路)。
 *       点按钮 → 弹 overlay (进度条 + 预览 + 取消) → 后台跑 sim_export.exportSimVideo。
 */
'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Film } from 'lucide-react';
import * as THREE from 'three';
import World from './engine/world';
import { exportSimVideo, type ExportProgress } from './sim_export';
import './director-panel.css';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";
import { useT } from "@/hooks/useT";

interface Props {
  getCanvas: () => HTMLCanvasElement | null;
  getWorld: () => World | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  setup: string;
  alg: string;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DirectorPanel({ getCanvas, getWorld, getRenderer, setup, alg }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });

  const snapshot = useCallback(() => {
    const cv = getCanvas();
    if (!cv) return;
    cv.toBlob((blob) => {
      if (!blob) return;
      download(blob, `sim-${Date.now()}.png`);
    }, 'image/png');
  }, [getCanvas]);

  const startExport = useCallback(async () => {
    const world = getWorld();
    const renderer = getRenderer();
    if (!world || !renderer || exporting) return;
    setExporting(true);
    abortRef.current = { aborted: false };
    setProgress({ phase: tr({ zh: '准备...', en: 'Preparing...'
    }), pct: 0, framesDone: 0, framesTotal: 0 });
    // 等 overlay 挂载后 previewRef 就位
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    try {
      await exportSimVideo({
        world, renderer, setup, alg, isZh,
        abortRef: abortRef.current,
        onProgress: setProgress,
        previewCanvas: previewRef.current,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'aborted') {
        console.error('[Sim Export] failed:', e);
        // eslint-disable-next-line no-alert
        alert(tr({ zh: '导出失败:', en: 'Export failed: '
                    }) + msg);
      }
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }, [getWorld, getRenderer, exporting, setup, alg, isZh]);

  const cancelExport = useCallback(() => {
    abortRef.current.aborted = true;
  }, []);

  const canExport = alg.trim().length > 0;

  return (
    <div className="sim-director">
      <button className="sim-director-btn" onClick={snapshot}>
        <Camera size={14} />
        {t('截图 PNG', 'Snapshot PNG')}
      </button>
      <button
        className="sim-director-btn"
        onClick={startExport}
        disabled={!canExport || exporting}
        title={!canExport ? t('解法为空, 无可导出动画', 'Alg is empty — nothing to record') : ''}
      >
        <Film size={14} />
        {t('导出 mp4 1080p', 'Export mp4 1080p')}
      </button>
      <span className="sim-director-hint">
        {t('1080p 离线渲染当前打乱+解法的动画', 'Offline 1080p render of current scramble+solution')}
      </span>

      {exporting && progress && (
        <div className="sim-export-overlay">
          <div className="sim-export-card">
            <div className="sim-export-title">{t('导出视频中', 'Exporting video')}</div>
            <canvas ref={previewRef} className="sim-export-preview" />
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
    </div>
  );
}
