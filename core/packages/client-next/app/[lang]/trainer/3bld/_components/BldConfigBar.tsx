'use client';

// Compact, collapsible 3BLD config bar driven by useBldConfigStore.
// `show` gates which control groups render (default: all).

import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { ClearButton } from '@/components/ClearButton';
import { useBldConfigStore } from '../_store/bld-config-store';
import { ORIENTATION_LABELS_ZH } from '../_lib/scheme-presets';

// 8 corner buffer letters / 12 edge buffer letters (upstream chichu buffers).
const CORNER_BUFFERS = ['J', 'A', 'G', 'D', 'W', 'O', 'R', 'X'];
const EDGE_BUFFERS = ['A', 'G', 'E', 'C', 'I', 'K', 'M', 'O', 'Q', 'S', 'W', 'Y'];

interface ShowFlags {
  corner?: boolean;
  edge?: boolean;
  scheme?: boolean;
  orientation?: boolean;
  hueSkip?: boolean;
}

interface BldConfigBarProps {
  show?: ShowFlags;
}

const ALL: Required<ShowFlags> = {
  corner: true,
  edge: true,
  scheme: true,
  orientation: true,
  hueSkip: true,
};

export function BldConfigBar({ show }: BldConfigBarProps): JSX.Element {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [open, setOpen] = useState(false);

  const config = useBldConfigStore((s) => s.config);
  const setConfig = useBldConfigStore((s) => s.setConfig);

  const flags = { ...ALL, ...(show ?? {}) };

  const upper = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, '');

  const summary = isZh
    ? `角 ${config.cBuf} / 棱 ${config.eBuf} / ${config.scheme === 'chichu' ? '彳亍' : 'Speffz'}`
    : `C ${config.cBuf} / E ${config.eBuf} / ${config.scheme === 'chichu' ? 'Chichu' : 'Speffz'}`;

  return (
    <div className="bld-config-bar">
      <button
        type="button"
        className="bld-config-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Settings2 size={15} />
        {isZh ? '配置' : 'Config'}
        <span className="bld-config-summary">{summary}</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="bld-config-panel">
          {flags.corner && (
            <div className="bld-config-group">
              <span className="bld-config-group-title">{isZh ? '角块' : 'Corner'}</span>
              <div className="bld-field">
                <label className="bld-field-label" htmlFor="bld-cbuf">
                  {isZh ? '角块缓冲' : 'Corner buffer'}
                </label>
                <select
                  id="bld-cbuf"
                  className="bld-select"
                  value={config.cBuf}
                  onChange={(e) => setConfig({ cBuf: e.target.value })}
                >
                  {CORNER_BUFFERS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="bld-field">
                <label className="bld-field-label" htmlFor="bld-corder">
                  {isZh ? '借位顺序' : 'Borrow order'}
                </label>
                <div className="bld-input-wrap">
                  <input
                    id="bld-corder"
                    className="bld-input"
                    value={config.cOrder}
                    onChange={(e) => setConfig({ cOrder: upper(e.target.value) })}
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                  {config.cOrder && (
                    <ClearButton isZh={isZh} onClick={() => setConfig({ cOrder: '' })} preserveFocus />
                  )}
                </div>
              </div>
            </div>
          )}

          {flags.edge && (
            <div className="bld-config-group">
              <span className="bld-config-group-title">{isZh ? '棱块' : 'Edge'}</span>
              <div className="bld-field">
                <label className="bld-field-label" htmlFor="bld-ebuf">
                  {isZh ? '棱块缓冲' : 'Edge buffer'}
                </label>
                <select
                  id="bld-ebuf"
                  className="bld-select"
                  value={config.eBuf}
                  onChange={(e) => setConfig({ eBuf: e.target.value })}
                >
                  {EDGE_BUFFERS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="bld-field">
                <label className="bld-field-label" htmlFor="bld-eorder">
                  {isZh ? '借位顺序' : 'Borrow order'}
                </label>
                <div className="bld-input-wrap">
                  <input
                    id="bld-eorder"
                    className="bld-input"
                    value={config.eOrder}
                    onChange={(e) => setConfig({ eOrder: upper(e.target.value) })}
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                  {config.eOrder && (
                    <ClearButton isZh={isZh} onClick={() => setConfig({ eOrder: '' })} preserveFocus />
                  )}
                </div>
              </div>
            </div>
          )}

          {(flags.scheme || flags.orientation) && (
            <div className="bld-config-group">
              <span className="bld-config-group-title">{isZh ? '编码' : 'Scheme'}</span>
              {flags.scheme && (
                <div className="bld-field">
                  <label className="bld-field-label" htmlFor="bld-scheme">
                    {isZh ? '编码方案' : 'Scheme'}
                  </label>
                  <select
                    id="bld-scheme"
                    className="bld-select"
                    value={config.scheme}
                    onChange={(e) => setConfig({ scheme: e.target.value as 'chichu' | 'speffz' })}
                  >
                    <option value="chichu">{isZh ? '彳亍' : 'Chichu'}</option>
                    <option value="speffz">Speffz</option>
                  </select>
                </div>
              )}
              {flags.orientation && (
                <div className="bld-field">
                  <label className="bld-field-label" htmlFor="bld-orient">
                    {isZh ? '打乱坐标' : 'Orientation'}
                  </label>
                  <select
                    id="bld-orient"
                    className="bld-select"
                    value={config.orientation}
                    onChange={(e) => setConfig({ orientation: Number(e.target.value) })}
                  >
                    {ORIENTATION_LABELS_ZH.map((label, i) => (
                      <option key={i} value={i}>
                        {isZh ? label : `#${i + 1} ${label}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {flags.hueSkip && (
            <div className="bld-config-group">
              <span className="bld-config-group-title">{isZh ? '高级' : 'Advanced'}</span>
              <div className="bld-check-row">
                <label className="bld-check">
                  <input
                    type="checkbox"
                    checked={config.keepHueC}
                    onChange={(e) => setConfig({ keepHueC: e.target.checked })}
                  />
                  {isZh ? '角保持色相借位' : 'Corner keep hue'}
                </label>
                <label className="bld-check">
                  <input
                    type="checkbox"
                    checked={config.keepHueE}
                    onChange={(e) => setConfig({ keepHueE: e.target.checked })}
                  />
                  {isZh ? '棱保持色相借位' : 'Edge keep hue'}
                </label>
              </div>
              <div className="bld-check-row">
                <label className="bld-check">
                  <input
                    type="checkbox"
                    checked={config.skipC === 1}
                    onChange={(e) => setConfig({ skipC: e.target.checked ? 1 : 0 })}
                  />
                  {isZh ? '角跳编法' : 'Corner fixed-buffer'}
                </label>
                <label className="bld-check">
                  <input
                    type="checkbox"
                    checked={config.skipE === 1}
                    onChange={(e) => setConfig({ skipE: e.target.checked ? 1 : 0 })}
                  />
                  {isZh ? '棱跳编法' : 'Edge fixed-buffer'}
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
