// NOTE: 图例弹窗 + 7 个药丸开关
// 1:1 翻译自 viz/index.html L100-137 + viz.js setupControls() 的开关逻辑

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useVizStore } from '../stores/viz_store';
import type { ShowLayers } from '../engine/data_fetch';

type LayerItem = { key: keyof ShowLayers; icon: string; iconStyle?: React.CSSProperties; label: string };

export default function LegendPanel() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const [visible, setVisible] = useState(false);
  const showLayers = useVizStore(s => s.showLayers);
  const setShowLayer = useVizStore(s => s.setShowLayer);
  const viewMode = useVizStore(s => s.viewMode);
  const resetZoom = useVizStore(s => s.resetZoom);

  // NOTE: 图层配置 (标签随语言变化, 所以依赖 isZh)
  const LAYER_ITEMS = useMemo<LayerItem[]>(() => [
    { key: 'currentVal', icon: '◆', label: isZh ? '当前值' : 'Current value' },
    { key: 'meanLine', icon: '●', label: isZh ? '窗口均值' : 'Window mean' },
    { key: 'ghost', icon: '━', label: isZh ? '初始残影' : 'Baseline trail' },
    { key: 'trail', icon: '✦', label: isZh ? '均值轨迹' : 'Mean track' },
    { key: 'bimodal', icon: '⚡', label: isZh ? '双峰检测' : 'Bimodality' },
    { key: 'followMean', icon: '⊙', label: isZh ? '均值居中' : 'Mean-centered' },
    { key: 'histBars', icon: '▮', iconStyle: { color: '#5cf' }, label: isZh ? '直方柱' : 'Histogram bars' },
  ], [isZh]);

  const VIEW_MODES = useMemo(() => [
    { key: 'line' as const, label: isZh ? '折线' : 'Line' },
    { key: 'histogram' as const, label: isZh ? '滑窗' : 'Window' },
    { key: 'cumHist' as const, label: isZh ? '累积' : 'Cumulative' },
  ], [isZh]);

  return (
    <>
      {/* 视图模式切换 */}
      <div className="view-mode-group">
        {VIEW_MODES.map(v => (
          <button
            key={v.key}
            className={`view-btn${viewMode === v.key ? ' active' : ''}`}
            onClick={() => useVizStore.getState().setViewMode(v.key)}
          >
            {v.label}
          </button>
        ))}
        <button
          className="view-btn"
          title={isZh ? '重置缩放范围 (双击画布也可重置)' : 'Reset zoom (double-click canvas also resets)'}
          onClick={resetZoom}
        >
          ⊡
        </button>
      </div>

      {/* ⓘ 按钮 */}
      <button
        className="legend-info-btn"
        title={isZh ? '图例说明' : 'Legend'}
        onClick={(e) => { e.stopPropagation(); setVisible(v => !v); }}
      >
        ⓘ
      </button>

      {/* 全屏按钮 */}
      <button
        className="fullscreen-btn"
        title={isZh ? '全屏' : 'Fullscreen'}
        onClick={() => {
          const wrap = document.querySelector('.canvas-wrapper');
          if (!wrap) return;
          const doc = document as Document & { webkitFullscreenElement?: Element };
          const el = wrap as HTMLElement & { webkitRequestFullscreen?: () => void };
          if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
            (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
          } else {
            (document.exitFullscreen || (document as Document & { webkitExitFullscreen?: () => void }).webkitExitFullscreen)?.call(document);
          }
        }}
      >
        ⛶
      </button>

      {/* 药丸开关弹窗 */}
      {visible && (
        <div
          className="legend-tooltip visible"
          onClick={e => e.stopPropagation()}
        >
          {LAYER_ITEMS.map(item => (
            <label key={item.key} className="legend-toggle">
              <span style={item.iconStyle}>{item.icon}</span> {item.label}
              <input
                type="checkbox"
                checked={showLayers[item.key]}
                onChange={e => setShowLayer(item.key, e.target.checked)}
              />
              <span className="toggle-pill" />
            </label>
          ))}
        </div>
      )}
    </>
  );
}
