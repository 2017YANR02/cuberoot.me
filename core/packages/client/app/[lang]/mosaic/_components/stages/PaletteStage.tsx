'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMosaicStore } from '../state/store';
import { DEFAULT_PALETTE, newColor, validatePalette } from '../engine/palette';
import type { PaletteColor, RGB } from '../state/types';

function rgbToHex(rgb: RGB) {
  return '#' + rgb.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export default function PaletteStage() {
  const { t } = useTranslation();
  const palette = useMosaicStore(s => s.palette);
  const setPalette = useMosaicStore(s => s.setPalette);
  const resetPalette = useMosaicStore(s => s.resetPalette);
  const [advanced, setAdvanced] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (i: number, patch: Partial<PaletteColor>) => {
    setPalette(palette.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  };

  const addColor = () => setPalette([...palette, newColor()]);

  const doExport = () => {
    const blob = new Blob([JSON.stringify(palette, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'palette.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const doImport = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const v = validatePalette(data);
        if (!v.valid) { setErr(v.msg); return; }
        setErr(null);
        setPalette(data as PaletteColor[]);
      } catch {
        setErr(t('mosaic.palette.errParse'));
      }
    };
    reader.readAsText(f);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button className="mosaic-btn mosaic-btn-danger" onClick={() => {
          if (window.confirm(t('mosaic.palette.resetConfirm'))) resetPalette();
        }}>
          ↺ {t('mosaic.palette.reset')}
        </button>
        <button className="mosaic-btn" onClick={() => setAdvanced(v => !v)}>
          ⚙ {advanced ? t('mosaic.palette.simple') : t('mosaic.palette.advanced')}
        </button>
        {advanced && (
          <>
            <button className="mosaic-btn" onClick={addColor}>＋ {t('mosaic.palette.addColor')}</button>
            <button className="mosaic-btn" onClick={doExport}>⬇ {t('mosaic.palette.export')}</button>
            <button className="mosaic-btn" onClick={() => fileInput.current?.click()}>⬆ {t('mosaic.palette.import')}</button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,.pal"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>
      {err && <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}

      <table className="mosaic-palette-table">
        <thead>
          <tr>
            <th>{t('mosaic.palette.available')}</th>
            <th>{t('mosaic.palette.name')}</th>
            <th>{t('mosaic.palette.color')}</th>
            {advanced && <th>{t('mosaic.palette.letter')}</th>}
            {advanced && <th>{t('mosaic.palette.grad')}</th>}
            {advanced && <th>{t('mosaic.palette.de')}</th>}
          </tr>
        </thead>
        <tbody>
          {palette.map((c, i) => (
            <tr key={i} className={c.available ? '' : 'disabled'}>
              <td style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={c.available}
                  onChange={e => update(i, { available: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={c.name}
                  maxLength={24}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^[0-9A-Za-z]*$/.test(v) && v.length > 0) update(i, { name: v });
                  }}
                />
              </td>
              <td style={{ width: 60 }}>
                <input
                  type="color"
                  value={rgbToHex(c.rgb)}
                  onChange={e => update(i, { rgb: hexToRgb(e.target.value) })}
                />
              </td>
              {advanced && (
                <td style={{ width: 80 }}>
                  <input
                    type="text"
                    value={c.notation}
                    maxLength={4}
                    onChange={e => {
                      const v = e.target.value;
                      if (/^[0-9A-Za-z]*$/.test(v)) update(i, { notation: v });
                    }}
                  />
                </td>
              )}
              {advanced && (
                <td style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.grad}
                    onChange={e => update(i, { grad: e.target.checked })}
                  />
                </td>
              )}
              {advanced && (
                <td style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.tryDitherWo}
                    onChange={e => update(i, { tryDitherWo: e.target.checked })}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
        {t('mosaic.palette.defaultNote')}
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        {advanced ? t('mosaic.palette.advancedNote') : ''}
      </p>
      <details style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
        <summary style={{ cursor: 'pointer' }}>{t('mosaic.palette.defaults')}</summary>
        <ul style={{ paddingLeft: 20 }}>
          {DEFAULT_PALETTE.map((c, i) => (
            <li key={i}>
              <span className="mosaic-range-swatch" style={{ background: rgbToHex(c.rgb) }} /> {c.name}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
