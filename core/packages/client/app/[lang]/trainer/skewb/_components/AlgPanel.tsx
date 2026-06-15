'use client';

import { useState } from 'react';
import { HelpCircle, RefreshCw } from 'lucide-react';
import SkewbImage from './SkewbImage';
import HintModal from './HintModal';
import { CATEGORIES, ALL_ALGS, type SkewbAlgCase } from '../_lib/algs';
import type { AlgSelectView } from '../_lib/useSkewbTrainer';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface Props {
  isZh: boolean;
  view: AlgSelectView;
  onView: (v: AlgSelectView) => void;
  selectedCategories: Set<string>;
  selectedIds: Set<string>;
  onToggleCategory: (key: string) => void;
  onToggleId: (id: string) => void;
  onToggleAll: () => void;
  onTogglePi: () => void;
  onTogglePeanut: () => void;
  onToggleL: () => void;
  showImg: boolean;
  onShowImg: (v: boolean) => void;
  scramble: string;
  currentCase: SkewbAlgCase | null;
  hasSelection: boolean;
  onGenerate: () => void;
}

export default function AlgPanel({
  isZh,
  view,
  onView,
  selectedCategories,
  selectedIds,
  onToggleCategory,
  onToggleId,
  onToggleAll,
  onTogglePi,
  onTogglePeanut,
  onToggleL,
  showImg,
  onShowImg,
  scramble,
  currentCase,
  hasSelection,
  onGenerate,
}: Props) {
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <>
      <div className="sk-stage">
        <button
          type="button"
          className={hasSelection ? 'sk-generate-btn' : 'sk-generate-btn is-disabled'}
          onClick={onGenerate}
          disabled={!hasSelection}
        >
          <RefreshCw size={16} />
          {tr({ zh: '生成 L2L 案例', en: 'Generate L2L Case' })}
        </button>

        <div className="sk-scramble-label">{tr({ zh: '打乱', en: 'Scramble'
        })}</div>
        <div className={scramble ? 'sk-scramble-text' : 'sk-scramble-text is-empty'}>
          {scramble ||
            (hasSelection
              ? tr({ zh: '点击上方生成', en: 'Press generate above'
            })
              : tr({ zh: '请至少选择一个类别或案例', en: 'Select at least one category or case'
            }))}
        </div>

        {showImg && scramble ? (
          <div className="sk-image-box">
            <SkewbImage scramble={scramble} />
          </div>
        ) : null}

        {currentCase ? (
          <div className="sk-stage-actions">
            <button
              type="button"
              className="sk-help-btn"
              onClick={() => setHintOpen(true)}
            >
              <HelpCircle size={15} />
              {tr({ zh: '忘记解法了?', en: 'Help! I forgot the solution.'
            })}
            </button>
          </div>
        ) : null}
      </div>

      <div className="sk-settings">
        <h2 className="sk-settings-title">{tr({ zh: '选择案例', en: 'Select cases'
        })}</h2>

        {/* category vs case-id view switch */}
        <div className="sk-select-mode">
          <button
            type="button"
            className={view === 'category' ? 'sk-select-mode-btn is-active' : 'sk-select-mode-btn'}
            onClick={() => onView('category')}
          >
            {tr({ zh: '按类别', en: 'By Category'
            })}
          </button>
          <button
            type="button"
            className={view === 'id' ? 'sk-select-mode-btn is-active' : 'sk-select-mode-btn'}
            onClick={() => onView('id')}
          >
            {tr({ zh: '按案例编号', en: 'By Case ID'
            })}
          </button>
        </div>

        {/* convenience toggles */}
        <div className="sk-toggle-group">
          <button type="button" className="sk-toggle-btn" onClick={onToggleAll}>
            {tr({ zh: '全部', en: 'Toggle All' })}
          </button>
          <button type="button" className="sk-toggle-btn" onClick={onTogglePi}>
            {isZh ? 'Pi' : 'Toggle Pi'}
          </button>
          <button type="button" className="sk-toggle-btn" onClick={onTogglePeanut}>
            {isZh ? 'Peanut' : 'Toggle Peanut'}
          </button>
          <button type="button" className="sk-toggle-btn" onClick={onToggleL}>
            {isZh ? 'L4C/L5C' : 'Toggle L4C/L5C'}
          </button>
        </div>

        <hr className="sk-settings-hr" />

        {view === 'category' ? (
          <div className="sk-grid-panel">
            <div className="sk-grid">
              {CATEGORIES.map((cat) => {
                const on = selectedCategories.has(cat.key);
                return (
                  <label
                    key={cat.key}
                    className={on ? 'sk-cell is-selected' : 'sk-cell'}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggleCategory(cat.key)}
                    />
                    {tr(cat)}
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="sk-grid-panel">
            <div className="sk-grid is-ids">
              {ALL_ALGS.map((c) => {
                const on = selectedIds.has(c.id);
                return (
                  <label key={c.id} className={on ? 'sk-cell is-selected' : 'sk-cell'}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggleId(c.id)}
                    />
                    {c.id}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <hr className="sk-settings-hr" />

        <label className="sk-check">
          <input
            type="checkbox"
            checked={showImg}
            onChange={(e) => onShowImg(e.target.checked)}
          />
          {tr({ zh: '显示打乱图', en: 'Show scramble image'
        })}
        </label>
      </div>

      {currentCase ? (
        <HintModal
          open={hintOpen}
          onClose={() => setHintOpen(false)}
          id={currentCase.id}
          setup={currentCase.setup}
          solutions={currentCase.solutions}
          isZh={isZh}
        />
      ) : null}
    </>
  );
}
