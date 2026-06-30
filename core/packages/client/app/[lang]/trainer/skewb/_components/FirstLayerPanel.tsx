'use client';

import { Minus, Plus, RefreshCw } from 'lucide-react';
import BoolToggle from '@/components/BoolToggle';
import SkewbImage from './SkewbImage';
import type { FltSettings } from '../_lib/useSkewbTrainer';
import { tr } from '@/i18n/tr';

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
          {tr({ zh: '生成打乱 + 颜色', en: 'Generate Scramble + Colour'
        })}
        </button>

        <div className="sk-scramble-label">{tr({ zh: '打乱', en: 'Scramble'
        })}</div>
        <div className={scramble ? 'sk-scramble-text' : 'sk-scramble-text is-empty'}>
          {scramble || tr({ zh: '点击上方生成', en: 'Press generate above'
                          })}
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
              {tr({ zh: '以此颜色作为起手', en: 'Use this as your starting colour'
            })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="sk-settings">
        <h2 className="sk-settings-title">{tr({ zh: '设置', en: 'Settings'
        })}</h2>

        <BoolToggle
          className="sk-check"
          value={flt.shuffle}
          onChange={onShuffle}
          label={tr({ zh: '打乱顺序', en: 'Shuffle scrambles' })}
        />

        <BoolToggle
          className="sk-check"
          value={flt.anyColour}
          onChange={onAnyColour}
          label={tr({ zh: '使用全部颜色', en: 'Use all colours' })}
        />

        <hr className="sk-settings-hr" />

        <div>
          <div className="sk-field-label">{tr({ zh: '打乱步数', en: 'Scramble length'
        })}</div>
          <div className="sk-stepper">
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onLength(flt.length - 1)}
              disabled={flt.length <= 1}
              aria-label={tr({ zh: '减少', en: 'Decrease'
            })}
            >
              <Minus size={16} />
            </button>
            <span className="sk-stepper-value">{flt.length}</span>
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onLength(flt.length + 1)}
              disabled={flt.length >= 7}
              aria-label={tr({ zh: '增加', en: 'Increase' })}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <hr className="sk-settings-hr" />

        <BoolToggle
          className="sk-check"
          value={flt.showImg}
          onChange={onShowImg}
          label={tr({ zh: '显示打乱图', en: 'Show scramble image' })}
        />
      </div>
    </>
  );
}
