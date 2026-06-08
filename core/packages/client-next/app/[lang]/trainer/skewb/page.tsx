'use client';

// SkewbSkills trainer — orchestrator.
// Port of annikastein.github.io/SkewbPage/SkewbSkills. Three modes
// (First Layer / L2L Alg / One-Looking) share a timer + keyboard shortcuts.
// Engine logic lives in _lib; this file wires mode switch, layout, timer,
// and the mode-aware keydown handler (Enter=generate, Space=start/stop, R=reset).

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { Layers, RotateCcw, Eye, TimerReset, ArrowRight } from 'lucide-react';
import { ALG_CATALOG, ALG_PUZZLES } from '@cuberoot/shared';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import WcaEventSelector from '@/components/WcaEventSelector';
import { useSkewbTrainer, type SkewbMode } from './_lib/useSkewbTrainer';
import { PUZZLE_EVENT } from '../_events';
import FirstLayerPanel from './_components/FirstLayerPanel';
import AlgPanel from './_components/AlgPanel';
import OneLookPanel from './_components/OneLookPanel';
import '../trainer.css';
import './skewb.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

// Same selector vocabulary as the [puzzle] hub: every alg-set puzzle with ≥1
// catalog set, plus 333bf (3BLD). SkewbSkills shadows the skewb hub, so we
// carry the event selector here to keep cross-event navigation intact.
const SELECTOR_EVENTS = new Set<string>([
  ...ALG_PUZZLES.filter((p) => ALG_CATALOG[p].length > 0).map((p) => PUZZLE_EVENT[p]),
  '333bf',
]);

export default function SkewbTrainerPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const lang = (i18n.language.startsWith('zh') ? 'zh' : 'en');
  const router = useRouter();
  useDocumentTitle('Skewb 技巧训练', 'Skewb Skills');

  const t = useSkewbTrainer();

  // Mode-aware global keyboard shortcuts. Ignore when typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        t.generate();
      } else if (e.key === ' ') {
        e.preventDefault();
        t.toggleTimer();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        t.resetTimer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t]);

  const modes: { key: SkewbMode; en: string; zh: string; icon: React.ReactNode }[] = [
    { key: 'flt', en: 'First Layer', zh: '第一层', icon: <Layers size={15} />
    },
    { key: 'alg', en: 'L2L Alg', zh: 'L2L 公式', icon: <RotateCcw size={15} /> },
    { key: 'ol', en: 'One-Looking', zh: '一步看穿', icon: <Eye size={15} /> },
  ];

  return (
    <div className="trainer-root">
      <div className="trainer-topbar">
        <WcaEventSelector
          availableEvents={SELECTOR_EVENTS}
          onlyAvailable
          selectedEvent="skewb"
          onSelect={(id) => router.push(`${lang === 'zh' ? '/zh' : ''}/trainer/${id}`)}
          isZh={isZh}
        />
      </div>
      <div className="sk-root">
        <h1 className="sk-title">{tr({ zh: 'Skewb 技巧训练', en: 'Skewb Skills',
            zhHant: "Skewb 技巧訓練"
        })}</h1>
        <p className="sk-subtitle">
          {tr({ zh: '三种训练模式:第一层、L2L 公式、一步看穿。', en: 'Three training modes: First Layer, L2L Algs, and One-Looking.',
              zhHant: "三種訓練模式:第一層、L2L 公式、一步看穿。"
        })}
        </p>

        <Link href={`/${lang}/trainer/skewb/sarahs-advanced`} className="sk-altlink">
          {tr({ zh: '经典公式集训练器:Sarah’s Advanced', en: "Classic alg-set trainer: Sarah’s Advanced",
              zhHant: "經典公式集訓練器:Sarah’s Advanced"
        })}
          <ArrowRight size={14} />
        </Link>

        {/* mode switcher */}
        <div className="sk-modes">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              className={t.mode === m.key ? 'sk-mode-btn is-active' : 'sk-mode-btn'}
              onClick={() => t.setMode(m.key)}
            >
              {m.icon}
              {(i18n.language.startsWith('zh') ? m.zh : m.en)}
            </button>
          ))}
        </div>

        <div className="sk-body">
          {t.mode === 'flt' ? (
            <FirstLayerPanel
              isZh={isZh}
              flt={t.flt}
              scramble={t.fltScramble}
              colour={t.fltColour}
              onGenerate={t.generate}
              onLength={t.setFltLength}
              onShuffle={t.setFltShuffle}
              onAnyColour={t.setFltAnyColour}
              onShowImg={t.setFltShowImg}
            />
          ) : t.mode === 'alg' ? (
            <AlgPanel
              isZh={isZh}
              view={t.algView}
              onView={t.setAlgView}
              selectedCategories={t.selectedCategories}
              selectedIds={t.selectedIds}
              onToggleCategory={t.toggleCategory}
              onToggleId={t.toggleId}
              onToggleAll={t.toggleAll}
              onTogglePi={t.togglePi}
              onTogglePeanut={t.togglePeanut}
              onToggleL={t.toggleL}
              showImg={t.algShowImg}
              onShowImg={t.setAlgShowImg}
              scramble={t.algScramble}
              currentCase={t.currentCase}
              hasSelection={t.hasAlgSelection}
              onGenerate={t.generate}
            />
          ) : (
            <OneLookPanel
              isZh={isZh}
              ol={t.ol}
              scramble={t.olScramble}
              onGenerate={t.generate}
              onExtra={t.setOlExtra}
              onShowImg={t.setOlShowImg}
            />
          )}
        </div>

        {/* shared timer */}
        <div className="sk-timer-wrap">
          <div className={t.timerState === 'running' ? 'sk-timer is-running' : 'sk-timer is-stopped'}>
            {t.timeText}
          </div>
          <div className="sk-timer-actions">
            <button type="button" className="sk-timer-btn" onClick={t.toggleTimer}>
              {t.timerState === 'running'
                ? tr({ zh: '停止', en: 'Stop' })
                : tr({ zh: '开始', en: 'Start',
                    zhHant: "開始"
                })}
            </button>
            <button type="button" className="sk-timer-btn" onClick={t.resetTimer}>
              <TimerReset size={15} />
              {tr({ zh: '重置', en: 'Reset' })}
            </button>
          </div>

          {t.mode === 'alg' && t.pbText ? (
            <div className={t.isPB ? 'sk-timer-pb is-new' : 'sk-timer-pb'}>
              {t.isPB ? (
                isZh ? (
                  '本案例新纪录!'
                ) : (
                  "That's a PB!"
                )
              ) : (
                <>
                  {tr({ zh: '本案例最好:', en: 'Best for this case: ' })}
                  <span className="sk-pb-value">{t.pbText}</span>
                </>
              )}
            </div>
          ) : null}

          <div className="sk-kbd-hint">
            <span className="sk-kbd">Enter</span> {tr({ zh: '新打乱', en: 'new scramble',
                zhHant: "新打亂"
            })}
            {'  '}
            <span className="sk-kbd">Space</span> {tr({ zh: '开始/停止', en: 'start/stop',
                zhHant: "開始/停止"
            })}
            {'  '}
            <span className="sk-kbd">R</span> {tr({ zh: '重置', en: 'reset' })}
          </div>
        </div>
      </div>
    </div>
  );
}
