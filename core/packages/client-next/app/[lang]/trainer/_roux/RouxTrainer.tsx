'use client';

// De-MUI port of roux-trainers/src/components/AppView.tsx (the orchestrator).
// - MUI removed; plain HTML + ../roux.css.
// - Mode lives in the URL via nuqs (?m=), not window.location.hash.
// - Dual-theme: follows the SITE theme (useEffectiveTheme) → 'bright'|'dark'
//   string that CubeSim/CubeSim2D expect. The upstream in-app bright/dark toggle
//   is intentionally DROPPED.
// - Mounted-gate: getInitialState() reads localStorage, so we render nothing
//   until mounted (SSG-first repo).

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Info, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import ReactMarkdown from 'react-markdown';

import { reducer, getInitialState } from '@/lib/roux/reducers/Reducer';
import { AppState, Action, Mode } from '@/lib/roux/Types';
import { useEffectiveTheme } from '@/lib/theme';

import { CmllTrainerView, OllcpTrainerView } from './_components/CmllTrainerView';
import BlockTrainerView from './_components/BlockTrainerView';
import AnalyzerView from './_components/AnalyzerView';
import TrackerView from './_components/TrackerView';
import FavListView from './_components/FavListView';
import { Modal } from './_components/ui';
import { rt } from './i18n';

import './roux.css';
import i18n from "@/i18n/i18n-client";

// [mode key, long label, short label] — ported from AppView.tab_modes.
// (OLLCP / tracking were commented out upstream; we keep them wired so the
// mode→view map below is complete, but they are not listed in the dropdown by
// default — uncomment to expose.)
export const tab_modes: [Mode, string, string][] = [
  ['fb', 'First Block (Fixed)', 'FB (fixed)'],
  ['analyzer', 'First Block Analyzer (x2y | CN)', 'FB analyzer (x2y | CN)'],
  ['fs', 'First Block Square', 'FB square'],
  ['fsdr', 'First Block Square + DR edge', 'FB square + DR'],
  ['fbdr', 'First Block Last Pair (+ DR edge)', 'FB last pair (+DR)'],
  ['fbss', 'First Block Last Pair + Second Square', 'FB last pair + SS'],
  ['ss', 'Second Block Square', 'SB square'],
  ['cmll', 'CMLL', 'CMLL'],
  // ['misc-algs', 'OLLCP', 'OLLCP'],
  ['4c', 'LSE 4c', 'LSE 4c'],
  ['eopair', 'EOLR / EOLRb', 'EOLR(b)'],
  // ['tracking', 'Tracking Trainer (Beta)', 'Tracking'],
];

const MODES = tab_modes.map((m) => m[0]) as Mode[];
const DEFAULT_MODE: Mode = 'fbdr';

// mode → which view component renders the body (mirrors AppView exactly).
function ViewForMode(props: { mode: Mode; state: AppState; dispatch: React.Dispatch<Action> }) {
  const { mode, state, dispatch } = props;
  switch (mode) {
    case 'fb':
    case 'fs':
    case 'fsdr':
    case 'fbdr':
    case 'fbss':
    case 'ss':
    case '4c':
    case 'eopair':
      return <BlockTrainerView state={state} dispatch={dispatch} />;
    case 'cmll':
      return <CmllTrainerView state={state} dispatch={dispatch} />;
    case 'misc-algs':
      return <OllcpTrainerView state={state} dispatch={dispatch} />;
    case 'analyzer':
      return <AnalyzerView state={state} dispatch={dispatch} />;
    case 'tracking':
      return <TrackerView state={state} dispatch={dispatch} />;
    default:
      return <BlockTrainerView state={state} dispatch={dispatch} />;
  }
}

const introText = `# Onionhoney's Roux Trainers
- A trainer collection that caters to all your Roux training needs  ❤️
- Inspired by http://cubegrass.appspot.com/, but with everything that it is missing.

## Modes supported
- FB analyzer
    - Solves for all x2y FBs, and suggests the best FB to start with!
    - Also suggests the best FS/Pseudo FS/Line to start with!
    - Can be presented as a 'can you find the x-mover' quiz with solution revealed in the spoiler.
    - More orientations supported too (CN, blue/green x2y, red/orange x2y)
- FB last slot (+ DR) trainer
    - \`HIGHLY USEFUL\` if you're learning FB or FB + DR. Get a random scramble, think on your own, and check with our solutions!
    - **Note**: while I try my best, the solver can still miss out on the best overall solution. So please, consult your human fellows when you're unsure, and always be careful with what you choose to learn.
- FS/FB/SS trainer
    - You can specify by piece positions. It seems these modes are pretty useful in providing new insights into blockbuilding  (for us dumb humans).
- CMLL trainer
    - Truly random L10P scrambles so you can't tell the cases. You can specify different OCLLs. You can even start with a random SB last pair (to simulate how real recognition works)
    - Show only the stickers necessary for recognition!
- LSE trainers (EOLR, 4c)
    - Good for reviewing EOLR and practicing your 4c recognition method. You can filter by MC/Non-MC cases too.

## Shortcuts
- Space for the next scramble.
- Enter to reset the virtual cube to current scramble.
- Control your cube with cstimer key mapping.

## Functionalities
- Scrambles are all random state. Solver is Roux-optimized with M and r moves as first-class citizens, with up to 25 different solutions provided.
- You can control the virtual cube with keyboard (CStimer mapping). You can also drag on the cube to change its perspective.
- You can bookmark your favorite cases and these will be saved in your browser.
- You can input your own scrambles as a list and our trainer will drain them one by one!

---

This is a faithful de-MUI port for React 19 / Next.js. Original by Onionhoney:
https://github.com/onionhoney/roux-trainers
`;

const introTextZh = `# Onionhoney 的桥式（Roux）训练器
- 一套覆盖桥式（Roux）各类训练需求的工具集 ❤️
- 灵感来自 http://cubegrass.appspot.com/，并补齐了它缺失的功能。

## 支持的模式
- 左桥分析器（FB analyzer）
    - 求解全部 x2y 左桥，并推荐最佳起手的左桥！
    - 也会推荐最佳起手的 FS / 伪 FS / Line！
    - 可作为“找到 x 步解”的小测验，答案藏在折叠里。
    - 支持更多朝向（CN、蓝/绿 x2y、红/橙 x2y）。
- 左桥末槽（+ DR）训练
    - 学左桥或左桥 + DR 时 \`非常实用\`。拿一个随机打乱，先自己想，再对照解法！
    - **注意**：求解器已尽力，但仍可能错过整体最优解。拿不准时请咨询身边的高手，挑要学的解法务必谨慎。
- 左桥方块 / 左桥 / 右桥方块 训练
    - 可按块的位置指定。这些模式在拼块（blockbuilding）上能带来不少新思路。
- CMLL 训练
    - 真随机 L10P 打乱，看不出情况。可指定不同 OCLL，甚至可从随机的 SB 最后一对起手（模拟真实识别过程）。
    - 只显示识别所需的贴纸！
- LSE 训练（EOLR、4c）
    - 适合复习 EOLR、练习 4c 识别。也可按 MC / 非 MC 情况筛选。

## 快捷键
- 空格：下一个打乱。
- 回车：把虚拟魔方重置回当前打乱。
- 用 cstimer 键位控制魔方。

## 功能
- 打乱全部为随机态。求解器针对桥式优化，M、r 转为一等公民，最多提供 25 种解法。
- 可用键盘控制虚拟魔方（cstimer 键位），也可拖动魔方改变视角。
- 可收藏喜欢的情况，保存在你的浏览器里。
- 可粘贴一组自己的打乱，训练器会逐个发给你！

---

这是为 React 19 / Next.js 重写（去 MUI）的忠实移植。原作者 Onionhoney：
https://github.com/onionhoney/roux-trainers
`;

function RouxTrainer(props: { embedded?: boolean }) {
  const { embedded } = props;
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const tt = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);

  // Mode in the URL (?m=). push history so the back gesture returns between modes.
  const [mode, setMode] = useQueryState(
    'm',
    parseAsStringEnum<Mode>(MODES).withDefault(DEFAULT_MODE).withOptions({ history: 'push' }),
  );

  // Reducer drives the whole app. lazy-init reads localStorage → mount-gated.
  const [state, dispatch] = useReducer(reducer, undefined, () => getInitialState(mode));

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // On first mount, sync the reducer to the URL's mode (the URL is the source of
  // truth — a deep link to ?m=cmll must land on cmll, not the lazy-init default).
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!mounted || syncedRef.current) return;
    syncedRef.current = true;
    if (state.mode !== mode) {
      dispatch({ type: 'mode', content: mode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    dispatch({ type: 'mode', content: newMode });
  };

  const [infoOpen, setInfoOpen] = useState(false);
  const [showFav, setShowFav] = useState(false);

  // Site theme → "bright" | "dark" string CubeSim/CubeSim2D expect.
  // Views read this via the `theme` prop we expose, OR can call useEffectiveTheme
  // themselves; we pass it down explicitly to keep a single source.
  const effective = useEffectiveTheme();
  const cubeTheme = effective === 'dark' ? 'dark' : 'bright';

  if (!mounted) {
    // Lightweight skeleton (no localStorage / no reducer state reads).
    return <div className="roux-root roux-skeleton" data-embedded={embedded ? '1' : undefined} />;
  }

  return (
    <div className="roux-root" data-embedded={embedded ? '1' : undefined} data-cube-theme={cubeTheme}>
      <div className="roux-topbar">
        {/* When embedded under the 333 hub's 桥式 section heading, the section title
            already names it — drop the internal title to avoid a double label. */}
        {!embedded && <div className="roux-topbar-title">{tt('桥式训练器', 'Roux Trainer', "橋式訓練器")}</div>}

        <select
          className="roux-mode-select"
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as Mode)}
          aria-label={tt('选择模式', 'Select mode', "選擇模式")}
        >
          {tab_modes.map(([m, long, short]) => (
            <option key={m} value={m} title={rt(long, !!isZh)}>
              {rt(long || short, !!isZh)}
            </option>
          ))}
        </select>

        <div className="roux-topbar-spacer" />

        <div className="roux-topbar-actions">
          <button
            type="button"
            className={'roux-icon-btn' + (showFav ? ' roux-icon-btn-active' : '')}
            onClick={() => setShowFav((v) => !v)}
            aria-label={tt('收藏', 'Favorites')}
            title={tt('收藏', 'Favorites')}
          >
            <Star size={20} fill={showFav ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="roux-icon-btn"
            onClick={() => setInfoOpen(true)}
            aria-label={tt('说明', 'Info', "說明")}
            title={tt('说明', 'Info', "說明")}
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      <div className={'roux-body' + (showFav ? ' roux-body-with-fav' : '')}>
        {showFav && (
          <div className="roux-fav-sidebar">
            <FavListView state={state} dispatch={dispatch} />
          </div>
        )}
        <div className="roux-main">
          <ViewForMode mode={state.mode as Mode} state={state} dispatch={dispatch} />
        </div>
      </div>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={tt('关于', 'About', "關於")}
        actions={
          <button
            type="button"
            className="roux-btn roux-btn-text"
            onClick={() => setInfoOpen(false)}
          >
            {tt('知道了', 'Got it!')}
          </button>
        }
      >
        <div className="roux-markdown">
          <ReactMarkdown>{isZh ? introTextZh : introText}</ReactMarkdown>
        </div>
      </Modal>
    </div>
  );
}

export default RouxTrainer;
