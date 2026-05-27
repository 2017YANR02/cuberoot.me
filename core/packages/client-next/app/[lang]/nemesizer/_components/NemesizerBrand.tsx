'use client';

interface Props { isZh: boolean; }

export default function NemesizerBrand({ isZh: _isZh }: Props) {
  return (
    <div className="nemesizer-brand">
      <span className="nemesizer-brand-logo" aria-hidden="true" />
      <span className="nemesizer-brand-title">Nemesizer</span>
    </div>
  );
}
