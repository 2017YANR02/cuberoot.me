/**
 * PlayerControls — alg playground for /stack。
 * 完全复用 ReconSubmit 那套:AlgInput + CubeKeyboardSection + recon_alg_utils。
 * 唯一 stack-特有部分:把"播放到第 n 步"转成 stack World twister 的 reset+fast-twist
 * (因为 stack 渲染是 huazhechen/cuber 自渲染,不是 TwistyPlayer,没 timestamp scrub)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FlipHorizontal2, FlipVertical2, Eraser, Sparkles, RotateCw } from 'lucide-react';
import { Alg } from 'cubing/alg';
import World from './cuber/world';
import { TwistAction } from './cuber/twister';
import { invertAlg, simplifyAlg, mirrorAlg, countMoves } from '../../utils/cube3';
import { cleanForPlayer, extractAlgFromText } from '../../utils/recon_alg_utils';
import AlgInput from '../../components/AlgInput';
import CubeKeyboardSection from '../../components/CubeKeyboardSection';
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
  const [speed, setSpeed] = useState(1);
  const playTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const setupElRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  const algElRef = useRef<HTMLTextAreaElement | HTMLDivElement | null>(null);
  useEffect(() => { stepRef.current = step; }, [step]);

  // 外部 URL params 变化时同步 draft
  useEffect(() => { setAlgDraft(alg); }, [alg]);
  useEffect(() => { setSetupDraft(setup ?? ''); }, [setup]);

  // alg → 可播 alg(剥注释 / 零宽 / 连写补空格)→ leaf moves
  // cleanForPlayer 已经处理 `D'U'` `UD2` 这种连写,Alg parser 不会再 throw
  const actions = useMemo<TwistAction[]>(() => {
    if (!algDraft.trim()) return [];
    try {
      const cleaned = cleanForPlayer(algDraft);
      return [...new Alg(cleaned).experimentalLeafMoves()].map((m) => new TwistAction(m.toString()));
    } catch {
      return [];
    }
  }, [algDraft]);

  const moveCount = useMemo(() => countMoves(cleanForPlayer(algDraft)), [algDraft]);

  // 跳转到第 n 步:setup 重置 + fast 应用前 n 个 action
  const jumpToStep = useCallback((n: number) => {
    if (!world) return;
    world.cube.twister.setup(setupDraft);
    const target = Math.max(0, Math.min(n, actions.length));
    for (let i = 0; i < target; i++) {
      world.cube.twister.twist(actions[i], true, true);
    }
    setStep(target);
  }, [world, setupDraft, actions]);

  // setup / alg / actions 变化时重置到当前 step(或 0)
  useEffect(() => { jumpToStep(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [setupDraft, actions]);

  // caret 同步:从 textarea selectionStart 算前面有几个 move → jump
  const handleCaretSync = useCallback((text: string, caretIndex: number) => {
    const before = text.slice(0, caretIndex);
    const algBefore = extractAlgFromText(before);
    try {
      const n = [...new Alg(algBefore).experimentalLeafMoves()].length;
      jumpToStep(n);
    } catch { /* ignore */ }
  }, [jumpToStep]);

  const stepForward = useCallback(() => { jumpToStep(step + 1); }, [jumpToStep, step]);
  const stepBack = useCallback(() => { jumpToStep(step - 1); }, [jumpToStep, step]);

  // 播放
  useEffect(() => {
    if (!playing) {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
      return;
    }
    const intervalMs = Math.max(60, Math.round(600 / speed));
    playTimerRef.current = window.setInterval(() => {
      const s = stepRef.current;
      if (s >= actions.length) { setPlaying(false); return; }
      world?.cube.twister.twist(actions[s], false, true);
      stepRef.current = s + 1;
      setStep(s + 1);
    }, intervalMs);
    return () => {
      if (playTimerRef.current) { window.clearInterval(playTimerRef.current); playTimerRef.current = null; }
    };
  }, [playing, actions, world, speed]);

  // 工具:对 alg 文本做变换(全用 cube3 / cubing.js 提供的能力,不造轮子)
  const tool = (transform: (s: string) => string) => () => {
    const next = transform(algDraft);
    setAlgDraft(next);
    onAlgChange(next);
  };

  return (
    <div className="stack-player">
      <div className="stack-player-row">
        <label className="stack-player-label">{t('打乱', 'Setup')}</label>
        <AlgInput
          elementRef={setupElRef}
          initialText={setupDraft}
          autoSpace
          autoResize
          rows={1}
          className="stack-player-input"
          onChange={(text) => {
            setSetupDraft(text);
            onSetupChange(text);
          }}
        />
      </div>
      <div className="stack-player-row">
        <label className="stack-player-label">{t('公式', 'Alg')}</label>
        <AlgInput
          elementRef={algElRef}
          initialText={algDraft}
          autoSpace
          autoResize
          rows={1}
          className="stack-player-input"
          onChange={(text) => {
            setAlgDraft(text);
            onAlgChange(text);
          }}
          onCaretChange={handleCaretSync}
        />
        <span className="stack-player-count" title={t('展开后的 move 数', 'Expanded move count')}>{moveCount}</span>
      </div>
      <div className="stack-player-row">
        <button onClick={() => jumpToStep(0)} title={t('回到起点', 'Reset')}><RotateCcw size={14} /></button>
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
      <CubeKeyboardSection
        target={algElRef}
        onInput={() => {
          // 虚拟键盘改动直接写到 textarea.value,触发不了 React onChange — 手动 sync
          const el = algElRef.current;
          if (!el) return;
          const text = el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '');
          setAlgDraft(text);
          onAlgChange(text);
        }}
      />
    </div>
  );
}
