import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMosaicStore } from '../state/store';
import { buildChooseSets } from '../engine/chooseSets';
import MosaicThumb from './MosaicThumb';

export default function MethodChooseStage() {
  const { t } = useTranslation();
  const palette = useMosaicStore(s => s.palette);
  const base = useMosaicStore(s => s.baseImageData);
  const selectMethod = useMosaicStore(s => s.selectMethod);
  const openPalette = useMosaicStore(s => s.openPalette);
  const chooseSets = useMemo(() => buildChooseSets(palette), [palette]);

  // Mirror source behavior: <2 colors means no method works — nudge user to palette editor.
  useEffect(() => {
    if (base && chooseSets.length === 0) openPalette();
  }, [base, chooseSets.length, openPalette]);

  if (!base || chooseSets.length === 0) return null;

  return (
    <>
      {chooseSets.map(set => (
        <div key={set.id} className="mosaic-method-section">
          <h2 className="mosaic-method-title">{t(set.displayKey)}</h2>
          <div className="mosaic-canvas-grid">
            {(set.opts as Array<number | number[]>).map((opt, i) => (
              <MosaicThumb
                key={i}
                chooseSet={set}
                opt={opt}
                base={base}
                maxWidth={180}
                decimals={1}
                onClick={() => selectMethod({ chooseSet: set, opt })}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
