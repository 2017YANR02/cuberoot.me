'use client';

import { Minus, Plus, RefreshCw } from 'lucide-react';
import SkewbImage from './SkewbImage';
import type { OlSettings } from '../_lib/useSkewbTrainer';

interface Props {
  isZh: boolean;
  ol: OlSettings;
  scramble: string;
  onGenerate: () => void;
  onExtra: (n: number) => void;
  onShowImg: (v: boolean) => void;
}

export default function OneLookPanel({
  isZh,
  ol,
  scramble,
  onGenerate,
  onExtra,
  onShowImg,
}: Props) {
  return (
    <>
      <div className="sk-stage">
        <button type="button" className="sk-generate-btn" onClick={onGenerate}>
          <RefreshCw size={16} />
          {isZh ? '生成打乱' : 'Generate Scramble'}
        </button>

        <div className="sk-scramble-label">{isZh ? '打乱' : 'Scramble'}</div>
        <div className={scramble ? 'sk-scramble-text' : 'sk-scramble-text is-empty'}>
          {scramble || (isZh ? '点击上方生成' : 'Press generate above')}
        </div>

        {ol.showImg && scramble ? (
          <div className="sk-image-box">
            <SkewbImage scramble={scramble} />
          </div>
        ) : null}
      </div>

      <div className="sk-settings">
        <h2 className="sk-settings-title">{isZh ? '设置' : 'Settings'}</h2>

        <div>
          <div className="sk-field-label">{isZh ? '附加步数' : 'Extra moves'}</div>
          <div className="sk-stepper">
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onExtra(ol.extra - 1)}
              disabled={ol.extra <= 1}
              aria-label={isZh ? '减少' : 'Decrease'}
            >
              <Minus size={16} />
            </button>
            <span className="sk-stepper-value">{ol.extra}</span>
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onExtra(ol.extra + 1)}
              disabled={ol.extra >= 7}
              aria-label={isZh ? '增加' : 'Increase'}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <hr className="sk-settings-hr" />

        <label className="sk-check">
          <input
            type="checkbox"
            checked={ol.showImg}
            onChange={(e) => onShowImg(e.target.checked)}
          />
          {isZh ? '显示打乱图' : 'Show scramble image'}
        </label>
      </div>
    </>
  );
}
