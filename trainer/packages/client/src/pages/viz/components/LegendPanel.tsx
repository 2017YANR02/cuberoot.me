// NOTE: 图例弹窗 + 7 个药丸开关
// 1:1 翻译自 viz/index.html L100-137 + viz.js setupControls() 的开关逻辑

import { useState } from 'react';
import { useVizStore } from '../stores/viz_store';
import type { ShowLayers } from '../engine/data_fetch';

// NOTE: 图层配置
const LAYER_ITEMS: { key: keyof ShowLayers; icon: string; iconStyle?: React.CSSProperties; label: string }[] = [
  { key: 'currentVal', icon: '◆', label: '当前值' },
  { key: 'meanLine', icon: '●', label: '窗口均值' },
  { key: 'ghost', icon: '━', label: '初始残影' },
  { key: 'trail', icon: '✦', label: '均值轨迹' },
  { key: 'bimodal', icon: '⚡', label: '双峰检测' },
  { key: 'followMean', icon: '⊙', label: '均值居中' },
  { key: 'histBars', icon: '▮', iconStyle: { color: '#5cf' }, label: '直方柱' },
];

export default function LegendPanel() {
  const [visible, setVisible] = useState(false);
  const showLayers = useVizStore(s => s.showLayers);
  const setShowLayer = useVizStore(s => s.setShowLayer);
  const viewMode = useVizStore(s => s.viewMode);
  const resetZoom = useVizStore(s => s.resetZoom);

  return (
    <>
      {/* 视图模式切换 */}
      <div className="view-mode-group">
        {([
          { key: 'line', label: '折线' },
          { key: 'histogram', label: '滑窗' },
          { key: 'cumHist', label: '累积' },
        ] as const).map(v => (
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
          title="重置缩放范围 (双击画布也可重置)"
          onClick={resetZoom}
        >
          ⊡
        </button>
      </div>

      {/* ⓘ 按钮 */}
      <button
        className="legend-info-btn"
        title="图例说明"
        onClick={(e) => { e.stopPropagation(); setVisible(v => !v); }}
      >
        ⓘ
      </button>

      {/* 全屏按钮 */}
      <button
        className="fullscreen-btn"
        title="全屏"
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
