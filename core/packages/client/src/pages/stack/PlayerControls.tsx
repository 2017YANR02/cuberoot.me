/**
 * PlayerControls — 公式回放面板。
 * Setup + main alg 双输入。alg 用 cubing.js Alg 解析 (支持 [A, B] commutator /
 * [A: B] conjugate / 嵌套 / // 注释 / NISS 等),展开为 leaf moves 后喂给现有 twister。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FlipHorizontal2, FlipVertical2, Eraser, Sparkles, RotateCw } from 'lucide-react';
import { Alg } from 'cubing/alg';
import World from './cuber/world';
import { TwistAction } from './cuber/twister';
import { invertAlg, simplifyAlg, mirrorAlg, countMoves } from '../../utils/cube3';
import './player-controls.css';

interface Props {
  world: World | null;
  alg: string;
  setup?: string;
  onAlgChange: (alg: string) => void;
  onSetupChange: (setup: string) => void;
}

export default function PlayerControls({ world, alg, setup, onAlgChange, onSetupChange }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);   // 倍速 0.25..4
  const playTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  useEffect(() => { stepRef.current = step; }, [step]);

  // 外部 alg/setup 变化时同步 draft
  useEffect(() => { setAlgDraft(alg); }, [alg]);
  useEffect(() => { setSetupDraft(setup ?? ''); }, [setup]);

  // alg → flat TwistAction[],用 cubing.js Alg parser(commutator/conjugate/嵌套全支持)
  const actions = useMemo<TwistAction[]>(() => {
    if (!alg.trim()) return [];
    try {
      return [...new Alg(alg).experimentalLeafMoves()].map((m) => new TwistAction(m.toString()));
    } catch {
      return [];
    }
  }, [alg]);

  const moveCount = useMemo(() => countMoves(alg), [alg]);

  const reset = useCallback(() => {
    if (!world) return;
    world.cube.twister.setup(setup ?? '');
    setStep(0);
  }, [world, setup]);

  // setup / alg 变化时 reset
  useEffect(() => { reset(); }, [reset, alg]);

  const stepForward = useCallback(() => {
    if (!world) return;
    if (step >= actions.length) return;
    world.cube.twister.twist(actions[step], false, true);
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
    const intervalMs = Math.max(60, Math.round(600 / speed));
    playTimerRef.current = window.setInterval(() => {
      const s = stepRef.current;
      if (s >= actions.length) {
        setPlaying(false);
        return;
      }
      world?.cube.twister.twist(actions[s], false, true);
      stepRef.current = s + 1;
      setStep(s + 1);
    }, intervalMs);
    return () => {
      if (playTimerRef.current) {
        window.clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playing, actions, world, speed]);

  const applyAlg = () => { onAlgChange(algDraft); };
  const applySetup = () => { onSetupChange(setupDraft); };

  // 工具按钮:都先 apply draft (避免覆盖用户未提交的编辑),再变换
  const tool = (transform: (s: string) => string) => () => {
    const next = transform(algDraft);
    setAlgDraft(next);
    onAlgChange(next);
  };

  return (
    <div className="stack-player">
      <div className="stack-player-row">
        <label className="stack-player-label">{t('打乱', 'Setup')}</label>
        <input
          className="stack-player-input"
          type="text"
          placeholder={t("Setup (例: R U R' D2)", "Setup (e.g. R U R' D2)")}
          value={setupDraft}
          onChange={(e) => setSetupDraft(e.target.value)}
          onBlur={applySetup}
          onKeyDown={(e) => { if (e.key === 'Enter') applySetup(); }}
        />
      </div>
      <div className="stack-player-row">
        <label className="stack-player-label">{t('公式', 'Alg')}</label>
        <input
          className="stack-player-input"
          type="text"
          placeholder={t("公式 (例: [R, U: F'])", "Alg (e.g. [R, U: F'])")}
          value={algDraft}
          onChange={(e) => setAlgDraft(e.target.value)}
          onBlur={applyAlg}
          onKeyDown={(e) => { if (e.key === 'Enter') applyAlg(); }}
        />
        <span className="stack-player-count" title={t('展开后的 move 数', 'Move count after expansion')}>{moveCount}</span>
      </div>
      <div className="stack-player-row">
        <button onClick={reset} title={t('回到起点', 'Reset')}><RotateCcw size={14} /></button>
        <button onClick={stepBack} disabled={step === 0} title={t('上一步', 'Step back')}><SkipBack size={14} /></button>
        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={actions.length === 0}
          title={playing ? t('暂停', 'Pause') : t('播放', 'Play')}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={stepForward} disabled={step >= actions.length} title={t('下一步', 'Step forward')}><SkipForward size={14} /></button>
        <span className="stack-player-progress">{step} / {actions.length}</span>
        <label className="stack-player-speed">
          <span>{speed.toFixed(2)}×</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="stack-player-tools">
        <button onClick={tool(invertAlg)} title={t('取逆', 'Invert')}><RotateCw size={13} />{t('取逆', 'Invert')}</button>
        <button onClick={tool(simplifyAlg)} title={t('简化', 'Simplify')}><Sparkles size={13} />{t('简化', 'Simplify')}</button>
        <button onClick={tool((s) => mirrorAlg(s, 'M'))} title={t('沿 M 面镜像 (L↔R)', 'Mirror M (L↔R)')}><FlipHorizontal2 size={13} />Mirror M</button>
        <button onClick={tool((s) => mirrorAlg(s, 'S'))} title={t('沿 S 面镜像 (F↔B)', 'Mirror S (F↔B)')}><FlipVertical2 size={13} />Mirror S</button>
        <button onClick={tool(() => '')} title={t('清空', 'Clear')}><Eraser size={13} />{t('清空', 'Clear')}</button>
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
