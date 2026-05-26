'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { extractAndNormalizeCross, hasWideMoveInCrossSection } from '@/lib/recon-norm-cross-extract';

export default function NormalizedCrossBlock({ solution }: { solution: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () => hasWideMoveInCrossSection(solution) ? extractAndNormalizeCross(solution) : null,
    [solution],
  );
  if (!result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(result.alg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className="normalized-cross-block">
      <div className="normalized-cross-header">
        <span className="normalized-cross-title">{t('recon.normalizedCross')}</span>
        <button type="button" className="normalized-cross-copy" onClick={handleCopy} title={t('recon.copy')}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre className="normalized-cross-body">{result.alg}</pre>
    </div>
  );
}
