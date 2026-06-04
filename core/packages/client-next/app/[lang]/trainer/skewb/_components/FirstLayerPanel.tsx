'use client';

import { Minus, Plus, RefreshCw } from 'lucide-react';
import SkewbImage from './SkewbImage';
import type { FltSettings } from '../_lib/useSkewbTrainer';

interface Props {
  isZh: boolean;
  flt: FltSettings;
  scramble: string;
  colour: string;
  onGenerate: () => void;
  onLength: (n: number) => void;
  onShuffle: (v: boolean) => void;
  onAnyColour: (v: boolean) => void;
  onShowImg: (v: boolean) => void;
}

export default function FirstLayerPanel({
  isZh,
  flt,
  scramble,
  colour,
  onGenerate,
  onLength,
  onShuffle,
  onAnyColour,
  onShowImg,
}: Props) {
  return (
    <>
      <div className="sk-stage">
        <button type="button" className="sk-generate-btn" onClick={onGenerate}>
          <RefreshCw size={16} />
          {isZh ? '生成打乱 + 颜色' : 'Generate Scramble + Colour'}
        </button>

        <div className="sk-scramble-label">{isZh ? '打乱' : 'Scramble'}</div>
        <div className={scramble ? 'sk-scramble-text' : 'sk-scramble-text is-empty'}>
          {scramble || (isZh ? '点击上方生成' : 'Press generate above')}
        </div>

        {flt.showImg && scramble ? (
          <div className="sk-image-box">
            <SkewbImage scramble={scramble} />
          </div>
        ) : null}

        {scramble ? (
          <div className="sk-swatch-row">
            <div className="sk-swatch" style={{ backgroundColor: colour }} />
            <div className="sk-swatch-caption">
              {isZh ? '以此颜色作为起手' : 'Use this as your starting colour'}
            </div>
          </div>
        ) : null}
      </div>

      <div className="sk-settings">
        <h2 className="sk-settings-title">{isZh ? '设置' : 'Settings'}</h2>

        <label className="sk-check">
          <input
            type="checkbox"
            checked={flt.shuffle}
            onChange={(e) => onShuffle(e.target.checked)}
          />
          {isZh ? '打乱顺序' : 'Shuffle scrambles'}
        </label>

        <label className="sk-check">
          <input
            type="checkbox"
            checked={flt.anyColour}
            onChange={(e) => onAnyColour(e.target.checked)}
          />
          {isZh ? '使用全部颜色' : 'Use all colours'}
        </label>

        <hr className="sk-settings-hr" />

        <div>
          <div className="sk-field-label">{isZh ? '打乱步数' : 'Scramble length'}</div>
          <div className="sk-stepper">
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onLength(flt.length - 1)}
              disabled={flt.length <= 1}
              aria-label={isZh ? '减少' : 'Decrease'}
            >
              <Minus size={16} />
            </button>
            <span className="sk-stepper-value">{flt.length}</span>
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onLength(flt.length + 1)}
              disabled={flt.length >= 7}
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
            checked={flt.showImg}
            onChange={(e) => onShowImg(e.target.checked)}
          />
          {isZh ? '显示打乱图' : 'Show scramble image'}
        </label>
      </div>
    </>
  );
}
