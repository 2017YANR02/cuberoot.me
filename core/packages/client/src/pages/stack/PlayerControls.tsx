/**
 * PlayerControls — alg playground for /stack。
 * 完全复用 ReconSubmit 那套:AlgInput + CubeKeyboardSection + recon_alg_utils。
 * 唯一 stack-特有部分:把"播放到第 n 步"转成 stack World twister 的 reset+fast-twist
 * (因为 stack 渲染是 huazhechen/cuber 自渲染,不是 TwistyPlayer,没 timestamp scrub)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FlipHorizontal2, FlipVertical2, Eraser, Sparkles, RotateCw, Settings, ChevronRight, Shuffle, Keyboard, Grid3x3 } from 'lucide-react';
import { Alg } from 'cubing/alg';
import World from './cuber/world';
import { TwistAction } from './cuber/twister';
import { invertAlg, simplifyAlg, mirrorAlg } from '../../utils/cube3';
import { cleanForPlayer, extractAlgFromText } from '../../utils/recon_alg_utils';
import { tnoodleRandomScramble } from '../../utils/cubingScramble';
import AlgInput from '../../components/AlgInput';
import CubeVirtualKeyboard from '../../components/CubeVirtualKeyboard';
import { Slider, Toggle, KeymapModal, DEFAULT_SETTINGS, type StackSettings } from './SettingDrawer';
import { KEYBOARD_ROWS, keyLabel, displayMove, type KeyMove } from './keymap';
import './player-controls.css';

interface Props {
  world: World | null;
  alg: string;
  setup?: string;
  onAlgChange: (alg: string) => void;
  onSetupChange: (setup: string) => void;
  order: number;
  onOrderChange: (n: number) => void;
  settings: StackSettings;
  onSettingsChange: (s: StackSettings) => void;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
}

export default function PlayerControls({
  world, alg, setup, onAlgChange, onSetupChange,
  order, onOrderChange, settings, onSettingsChange,
  keymap, onKeymapChange, onResetKeymap,
}: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [algDraft, setAlgDraft] = useState(alg);
  const [setupDraft, setSetupDraft] = useState(setup ?? '');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [kbVariant, setKbVariant] = useState<'alg' | 'qwerty' | null>(null);
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

  // applyMove (QWERTY 增量追加) 时 set 这个 ref,下面 actions-effect 跳过 reset 避免冲掉刚 twist 的状态
  const skipAutoResetRef = useRef(false);

  // setup / alg / actions 变化时重置到当前 step(或 0)
  useEffect(() => {
    if (skipAutoResetRef.current) {
      skipAutoResetRef.current = false;
      setStep(actions.length);  // applyMove 已直接 twist cube,step 推到末尾保持一致
      return;
    }
    jumpToStep(0);
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [setupDraft, actions]);

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

  // 工具:对 (打乱 + 解法) 作为整体做变换,结果全部落到解法,打乱清空。
  // AlgInput 非受控 (defaultValue),改 state 必须同时把 textarea.value 也写一遍。
  const tool = (transform: (s: string) => string) => () => {
    const combined = (setupDraft + ' ' + algDraft).trim();
    const next = transform(combined);
    setSetupDraft('');
    onSetupChange('');
    setAlgDraft(next);
    onAlgChange(next);
    const setupEl = setupElRef.current;
    if (setupEl instanceof HTMLTextAreaElement) setupEl.value = '';
    const algEl = algElRef.current;
    if (algEl instanceof HTMLTextAreaElement) algEl.value = next;
  };

  // QWERTY 模式:按一个 keymap 动作 → 转魔方 + 追加到 setup/alg (打乱框激活时落 setup,否则落 alg 并 focus alg)
  const applyMove = useCallback((k: KeyMove) => {
    if (world) world.cube.twister.twist(new TwistAction(k.sign, !!k.reverse, 1), false, true);
    const setupEl = setupElRef.current;
    const algEl = algElRef.current;
    const active = document.activeElement;
    const writeToSetup = setupEl instanceof HTMLTextAreaElement && active === setupEl;
    const target = writeToSetup ? setupEl : algEl;
    if (!(target instanceof HTMLTextAreaElement)) return;
    if (!writeToSetup && active !== target) target.focus();
    const current = target.value;
    const next = current.trimEnd() + (current.trim() ? ' ' : '') + displayMove(k) + ' ';
    target.value = next;
    target.selectionStart = target.selectionEnd = next.length;
    skipAutoResetRef.current = true;  // 阻止下面 useEffect 把 cube 复原回 setup
    if (writeToSetup) {
      setSetupDraft(next);
      onSetupChange(next);
    } else {
      setAlgDraft(next);
      onAlgChange(next);
    }
  }, [world, onAlgChange, onSetupChange]);

  // QWERTY 激活时,实体键盘按 keymap 走;但打乱框激活时让字符直接落到打乱框 (不接管)
  useEffect(() => {
    if (kbVariant !== 'qwerty') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement === setupElRef.current) return;
      const k = keymap[e.code];
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      applyMove(k);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [kbVariant, keymap, applyMove]);

  // 随机打乱:WCA 2-7 阶走 tnoodle,其它阶用 world 自带 '*' 落到 cube 上 (不入 setup 文本)
  const handleScramble = useCallback(async () => {
    if (!world) return;
    if (order >= 2 && order <= 7) {
      const eventId = `${order}${order}${order}`;
      const s = await tnoodleRandomScramble(eventId);
      if (s) {
        setSetupDraft(s);
        onSetupChange(s);
        const el = setupElRef.current;
        if (el instanceof HTMLTextAreaElement) el.value = s;
        return;
      }
    }
    world.cube.twister.twist(new TwistAction('*'), true, true);
  }, [world, order, onSetupChange]);

  return (
    <div className="stack-player">
      <div className="stack-player-row">
        <AlgInput
          elementRef={setupElRef}
          initialText={setupDraft}
          autoSpace
          autoResize
          rows={1}
          className="stack-player-input"
          placeholder={t('打乱', 'Scramble')}
          onChange={(text) => {
            setSetupDraft(text);
            onSetupChange(text);
          }}
        />
        <button
          type="button"
          className="stack-player-scramble"
          onClick={handleScramble}
          title={t('随机打乱', 'Random scramble')}
          aria-label={t('随机打乱', 'Random scramble')}
        >
          <Shuffle size={14} />
        </button>
      </div>
      <div className="stack-player-row">
        <AlgInput
          elementRef={algElRef}
          initialText={algDraft}
          autoSpace
          autoResize
          rows={1}
          className="stack-player-input"
          placeholder={t('解法', 'Solution')}
          onChange={(text) => {
            setAlgDraft(text);
            onAlgChange(text);
          }}
          onCaretChange={handleCaretSync}
        />
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
      <div className="stack-keyboard-section">
        <div className="stack-keyboard-switcher">
          <button
            type="button"
            className={'vkb-toggle' + (kbVariant === 'alg' ? ' active' : '')}
            onClick={() => setKbVariant((v) => (v === 'alg' ? null : 'alg'))}
            title={t('解法虚拟键盘', 'Alg virtual keyboard')}
            aria-label={t('解法虚拟键盘', 'Alg virtual keyboard')}
          >
            <Keyboard size={14} />
          </button>
          <button
            type="button"
            className={'vkb-toggle' + (kbVariant === 'qwerty' ? ' active' : '')}
            onClick={() => setKbVariant((v) => (v === 'qwerty' ? null : 'qwerty'))}
            title={t('按键映射键盘 (点击 = 转魔方)', 'Keymap keyboard (click = twist cube)')}
            aria-label={t('按键映射键盘', 'Keymap keyboard')}
          >
            <Grid3x3 size={14} />
          </button>
        </div>
        {kbVariant === 'alg' && (
          <CubeVirtualKeyboard
            target={algElRef}
            onInput={() => {
              const el = algElRef.current;
              if (!el) return;
              const text = el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '');
              setAlgDraft(text);
              onAlgChange(text);
            }}
          />
        )}
        {kbVariant === 'qwerty' && (
          <StackQwertyKeypad keymap={keymap} onMove={applyMove} />
        )}
      </div>
      <PuzzleSettings
        order={order}
        onOrderChange={onOrderChange}
        settings={settings}
        onSettingsChange={onSettingsChange}
        t={t}
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
    </div>
  );
}

function StackQwertyKeypad({
  keymap,
  onMove,
}: {
  keymap: Record<string, KeyMove>;
  onMove: (k: KeyMove) => void;
}) {
  return (
    <div className="stack-keyboard stack-qwerty-keypad">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="stack-keyboard-row">
          {row.map((code) => {
            const m = keymap[code];
            return (
              <button
                key={code}
                type="button"
                className={'stack-key' + (!m ? ' empty' : '')}
                disabled={!m}
                onPointerDown={(e) => {
                  if (!m) return;
                  e.preventDefault();
                  onMove(m);
                }}
              >
                <span className="stack-key-label">{keyLabel(code)}</span>
                <span className="stack-key-move">{m ? displayMove(m) : '·'}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const STYLE_PRESETS: { id: string; zh: string; en: string; s: Pick<StackSettings, 'thickness' | 'hollow' | 'arrow' | 'hint'> }[] = [
  { id: 'std',    zh: '标准', en: 'Standard', s: { thickness: true,  hollow: false, arrow: false, hint: false } },
  { id: 'hollow', zh: '镂空', en: 'Hollow',   s: { thickness: true,  hollow: true,  arrow: false, hint: false } },
  { id: 'hint',   zh: '提示', en: 'Hint',     s: { thickness: true,  hollow: false, arrow: false, hint: true  } },
  { id: 'arrow',  zh: '箭头', en: 'Arrows',   s: { thickness: true,  hollow: false, arrow: true,  hint: false } },
  { id: 'flat',   zh: '平面', en: 'Flat',     s: { thickness: false, hollow: false, arrow: false, hint: false } },
];

function PuzzleSettings({
  order, onOrderChange, settings, onSettingsChange, t,
  keymap, onKeymapChange, onResetKeymap,
}: {
  order: number;
  onOrderChange: (n: number) => void;
  settings: StackSettings;
  onSettingsChange: (s: StackSettings) => void;
  t: (zh: string, en: string) => string;
  keymap: Record<string, KeyMove>;
  onKeymapChange: (km: Record<string, KeyMove>) => void;
  onResetKeymap: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [keymapOpen, setKeymapOpen] = useState(false);

  const activePreset = STYLE_PRESETS.find(
    (p) => p.s.thickness === settings.thickness && p.s.hollow === settings.hollow
      && p.s.arrow === settings.arrow && p.s.hint === settings.hint,
  )?.id ?? '';

  const [orderDraft, setOrderDraft] = useState<string>(String(order));
  useEffect(() => { setOrderDraft(String(order)); }, [order]);
  const commitOrder = () => {
    const raw = Number(orderDraft);
    if (!Number.isFinite(raw)) { setOrderDraft(String(order)); return; }
    const n = Math.max(2, Math.min(2000, Math.floor(raw)));
    setOrderDraft(String(n));
    if (n !== order) onOrderChange(n);
  };

  const set = <K extends keyof StackSettings>(key: K, value: StackSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <section className="stack-puzzle">
      <button
        type="button"
        className="stack-puzzle-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('魔方设置', 'Puzzle Settings')}
        title={t('魔方设置', 'Puzzle Settings')}
      >
        <ChevronRight size={14} className={'stack-puzzle-caret' + (open ? ' open' : '')} />
        <Settings size={14} />
      </button>
      {open && (
        <div className="stack-puzzle-body">
          <div className="stack-puzzle-row">
            <div className="stack-puzzle-section">
              <div className="stack-puzzle-section-title">{t('阶数', 'Order')}</div>
              <input
                type="number"
                className="stack-puzzle-num"
                min={2}
                max={2000}
                step={1}
                value={orderDraft}
                title={t('阶数 2–2000(回车 / 失焦应用)', 'Order 2–2000 (Enter / blur to apply)')}
                onChange={(e) => setOrderDraft(e.target.value)}
                onBlur={commitOrder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  else if (e.key === 'Escape') { setOrderDraft(String(order)); (e.target as HTMLInputElement).blur(); }
                }}
              />
            </div>
            <div className="stack-puzzle-section">
              <div className="stack-puzzle-section-title">{t('视觉风格', 'Style')}</div>
              <select
                className="stack-puzzle-select"
                value={activePreset}
                onChange={(e) => {
                  const p = STYLE_PRESETS.find((x) => x.id === e.target.value);
                  if (p) onSettingsChange({ ...settings, ...p.s });
                }}
              >
                {activePreset === '' && <option value="">{t('自定义', 'Custom')}</option>}
                {STYLE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{t(p.zh, p.en)}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="stack-keymap-open-btn"
              onClick={() => setKeymapOpen(true)}
            >
              <Keyboard size={14} />
              <span>{t('键盘 / 鼠标快捷键', 'Keyboard / mouse shortcuts')}</span>
            </button>
            <button
              type="button"
              className="stack-drawer-reset"
              onClick={() => onSettingsChange(DEFAULT_SETTINGS)}
            >
              {t('恢复默认', 'Reset to defaults')}
            </button>
          </div>

          <div className="stack-puzzle-sliders">
            <Slider label={t('灵敏度', 'Sensitivity')} value={settings.sensitivity} onChange={(v) => set('sensitivity', v)} />
            <Slider label={t('缩放', 'Scale')} value={settings.scale} onChange={(v) => set('scale', v)} />
            <Slider label={t('透视', 'Perspective')} value={settings.perspective} onChange={(v) => set('perspective', v)} />
            <Slider label={t('转动速度', 'Turn speed')} value={settings.speed} onChange={(v) => set('speed', v)} />
          </div>
          <div className="stack-puzzle-toggles">
            <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} />
            <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} />
            <Toggle label={t('显示朝向箭头', 'Orientation arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />
            <Toggle label={t('提示贴片 (背面)', 'Hint facelets (back faces)')} value={settings.hint} onChange={(v) => set('hint', v)} />
          </div>
        </div>
      )}
      <KeymapModal
        open={keymapOpen}
        onClose={() => setKeymapOpen(false)}
        keymap={keymap}
        onKeymapChange={onKeymapChange}
        onResetKeymap={onResetKeymap}
      />
    </section>
  );
}
