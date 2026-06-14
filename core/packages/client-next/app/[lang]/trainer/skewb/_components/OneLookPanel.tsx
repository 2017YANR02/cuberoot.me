'use client';

import { Minus, Plus, RefreshCw } from 'lucide-react';
import SkewbImage from './SkewbImage';
import type { OlSettings } from '../_lib/useSkewbTrainer';
import { tr } from '@/i18n/tr';

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
          {tr({ zh: '生成打乱', en: 'Generate Scramble'
        })}
        </button>

        <div className="sk-scramble-label">{tr({ zh: '打乱', en: 'Scramble'
        })}</div>
        <div className={scramble ? 'sk-scramble-text' : 'sk-scramble-text is-empty'}>
          {scramble || (tr({ zh: '点击上方生成', en: 'Press generate above'
        }))}
        </div>

        {ol.showImg && scramble ? (
          <div className="sk-image-box">
            <SkewbImage scramble={scramble} />
          </div>
        ) : null}
      </div>

      <div className="sk-settings">
        <h2 className="sk-settings-title">{tr({ zh: '设置', en: 'Settings'
        })}</h2>

        <div>
          <div className="sk-field-label">{tr({ zh: '附加步数', en: 'Extra moves'
        })}</div>
          <div className="sk-stepper">
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onExtra(ol.extra - 1)}
              disabled={ol.extra <= 1}
              aria-label={tr({ zh: '减少', en: 'Decrease'
            })}
            >
              <Minus size={16} />
            </button>
            <span className="sk-stepper-value">{ol.extra}</span>
            <button
              type="button"
              className="sk-stepper-btn"
              onClick={() => onExtra(ol.extra + 1)}
              disabled={ol.extra >= 7}
              aria-label={tr({ zh: '增加', en: 'Increase' })}
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
          {tr({ zh: '显示打乱图', en: 'Show scramble image'
        })}
        </label>
      </div>
    </>
  );
}
