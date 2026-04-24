import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMosaicStore } from '../state/store';
import { buildVariantClusters } from '../engine/chooseSets';
import { populateSetOfRanges } from '../engine/ranges';
import type { DitherCluster } from '../state/types';
import MosaicThumb from './MosaicThumb';

export default function VariantChooseStage() {
  const { t } = useTranslation();
  const palette = useMosaicStore(s => s.palette);
  const base = useMosaicStore(s => s.baseImageData);
  const selection = useMosaicStore(s => s.selection);
  const selectVariant = useMosaicStore(s => s.selectVariant);

  const clusters = useMemo<DitherCluster[]>(() => {
    if (!selection) return [];
    if (selection.chooseSet.method === 'gradient') {
      return [{
        labelKey: selection.chooseSet.displayKey,
        chooseSet: selection.chooseSet,
        variants: populateSetOfRanges(selection.opt as number[]),
      }];
    }
    return buildVariantClusters(palette, selection.chooseSet, selection.opt);
  }, [palette, selection]);

  // Closest color has no variants — skip straight to adjust
  useEffect(() => {
    if (selection && selection.chooseSet.method === 'closest') {
      selectVariant(selection.chooseSet, selection.opt);
    }
  }, [selection, selectVariant]);

  if (!base || !selection || selection.chooseSet.method === 'closest') return null;

  return (
    <>
      {clusters.map((cluster, idx) => (
        <div key={idx} className="mosaic-method-section">
          <h2 className="mosaic-method-title">
            {cluster.labelArg
              ? t(cluster.labelKey, { arg: cluster.labelArg })
              : t(cluster.labelKey)}
          </h2>
          <div className="mosaic-canvas-grid">
            {cluster.variants.map((opt, i) => (
              <MosaicThumb
                key={i}
                chooseSet={cluster.chooseSet}
                opt={opt}
                base={base}
                maxWidth={200}
                decimals={2}
                onClick={() => selectVariant(cluster.chooseSet, opt)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
