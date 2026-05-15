/**
 * PlayerControls — 公式回放面板。
 * 接受 alg 字符串,展开为 TwistAction 列表,前进 / 后退 / 播放 / 暂停。
 * setup 在 mount 时已 reset cube,逐步 twist。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import World from './cuber/world';
import { TwistAction, TwistNode } from './cuber/twister';
import './player-controls.css';

interface Props {
  world: World | null;
  alg: string;
  setup?: string;
  onAlgChange: (alg: string) => void;
}

export default function PlayerControls({ world, alg, setup, onAlgChange }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [draft, setDraft] = useState(alg);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playTimerRef = useRef<number | null>(null);

  const actions = useMemo<TwistAction[]>(() => {
    if (!alg.trim()) return [];
    try {
      return new TwistNode(alg).parse();
    } catch {
      return [];
    }
  }, [alg]);

  const reset = useCallback(() => {
    if (!world) return;
    world.cube.twister.setup(setup ?? '');
    setStep(0);
  }, [world, setup]);

  useEffect(() => { reset(); }, [reset]);

  const stepForward = useCallback(() => {
    if (!world) return;
    if (step >= actions.length) return;
    const a = actions[step];
    world.cube.twister.twist(a, false, true);
    setStep((s) => s + 1);
  }, [world, step, actions]);

  const stepBack = useCallback(() => {
    if (!world) return;
    if (step <= 0) return;
    const last = actions[step - 1];
    const inv = new TwistAction(last.sign, !last.reverse, last.times);
    world.cube.twister.twist(inv, false, true);
    setStep((s) => s - 1);
  }, [world, step, actions]);

  // 播放循环
  useEffect(() => {
    if (!playing) {
      if (playTimerRef.current) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      return;
    }
    playTimerRef.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= actions.length) {
          setPlaying(false);
          return s;
        }
        const a = actions[s];
        world?.cube.twister.twist(a, false, true);
        return s + 1;
      });
    }, 600);
    return () => {
      if (playTimerRef.current) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playing, actions, world]);

  const apply = () => {
    onAlgChange(draft);
  };

  const total = actions.length;

  return (
    <div className="stack-player">
      <div className="stack-player-row">
        <input
          className="stack-player-input"
          type="text"
          placeholder={t('输入公式 (例: R U R\' U\')', "Enter alg (e.g. R U R' U')")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
        />
        <button onClick={apply}>{t('载入', 'Load')}</button>
      </div>
      <div className="stack-player-row">
        <button onClick={reset} title={t('回到起点', 'Reset')}><RotateCcw size={14} /></button>
        <button onClick={stepBack} disabled={step === 0} title={t('上一步', 'Step back')}><SkipBack size={14} /></button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={total === 0}
          title={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={stepForward} disabled={step >= total} title={t('下一步', 'Step forward')}><SkipForward size={14} /></button>
        <span className="stack-player-progress">{step} / {total}</span>
      </div>
      {actions.length > 0 ? (
        <div className="stack-player-moves">
          {actions.map((a, i) => (
            <span
              key={i}
              className={i < step ? 'done' : i === step ? 'current' : ''}
            >
              {a.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
