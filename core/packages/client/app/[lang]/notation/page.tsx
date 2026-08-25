'use client';

import { useEffect, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { parseAsBoolean, parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import Link from '@/components/AppLink';
import AlgNotationStyleSelect from '@/components/AlgNotationStyleSelect';
import BoolToggle from '@/components/BoolToggle';
import { CompactSelect, type CompactSelectItem } from '@/components/CompactSelect';
import MoveNotationDemo, { type MoveNotationOption } from '@/components/MoveNotationDemo/MoveNotationDemo';
import NxNOrderInput from '@/components/NxNOrderInput';
import PuzzlePicker, { type PuzzlePickerGroup } from '@/components/PuzzlePicker/PuzzlePicker';
import NotationTrainer, {
  NOTATION_TRAINING_MODES,
  type NotationTrainingMode,
} from './_components/NotationTrainer';
import { useT } from '@/hooks/useT';
import { T } from '@/i18n/tr';
import {
  ALG_NOTATION_STYLES,
  formatAlgNotation,
  type AlgNotationStyle,
} from '@/lib/alg-notation-display';
import {
  cubeMovesForOrder,
  cubeWcaMovesForOrder,
  CLOCK_WCA_MOVES,
  FTO_FACE_MOVES,
  FTO_MACRO_MOVES,
  FTO_ROTATION_MOVES,
  FTO_SLICE_MOVES,
  FTO_WIDE_MOVES,
  MEGAMINX_WCA_MOVES,
  PYRAMINX_EXTENSION_MOVES,
  PYRAMINX_WCA_MOVES,
  SKEWB_EXTENSION_MOVES,
  SKEWB_WCA_MOVES,
  SQUARE1_MOVES,
} from '@/lib/move-notation-catalog';
import {
  formatClockMoveDescription,
  formatMegaminxMoveDescription,
  formatPyraminxMoveDescription,
  formatSkewbMoveDescription,
  formatSquare1MoveDescription,
} from '@/lib/puzzle-notation-display';
import { eventDisplayName } from '@/lib/wca-events';
import { NXN_ORDER_DEFAULT, clampNxNOrder } from '@/lib/nxn-order';
import '@/components/NotationGuide/notation-guide.css';

const NOTATION_PUZZLES = ['333', 'minx', 'pyram', 'skewb', 'sq1', 'clock', 'fto'] as const;
type NotationPuzzle = (typeof NOTATION_PUZZLES)[number];
type NotationViewMode = 'learn' | NotationTrainingMode;

function K({ children }: { children: ReactNode }) {
  return <code className="notation-key">{children}</code>;
}

function cubeDemoOptions(moves: readonly string[]): MoveNotationOption[] {
  return moves.map(move => ({
    move,
    symbol: formatAlgNotation(move, 'zh-compact'),
  }));
}

function demoOption(move: string, caption: ReactNode): MoveNotationOption {
  return {
    move,
    symbol: formatAlgNotation(move, 'zh-compact'),
    caption,
  };
}

function CubeRuleNotes({ order }: { order: number }) {
  const t = useT();
  return (
    <section className="notation-rule-notes" aria-labelledby="cube-rule-notes-title">
      <h2 id="cube-rule-notes-title">{t('WCA 第 12a 条说明', 'WCA Article 12a guide')}</h2>
      <p>
        <T
          zh={<>六个面分别用 <K>F</K> 前、<K>B</K> 后、<K>R</K> 右、<K>L</K> 左、<K>U</K> 上、<K>D</K> 下表示。单独一个字母表示从正对该面的视角顺时针转 90 度。</>}
          en={<>The six faces are <K>F</K> front, <K>B</K> back, <K>R</K> right, <K>L</K> left, <K>U</K> up and <K>D</K> down. A bare letter means 90 degrees clockwise when looking straight at that face.</>}
        />
      </p>
      <div className="notation-rule-grid">
        <div>
          <h3>{t('方向与角度', 'Direction and angle')}</h3>
          <p><K>R</K> {t('顺时针 90 度；', 'is 90 degrees clockwise; ')}<K>R&apos;</K> {t('逆时针 90 度；', 'is 90 degrees counter-clockwise; ')}<K>R2</K> {t('转 180 度。', 'is 180 degrees.')}</p>
        </div>
        <div>
          <h3>{t('宽层', 'Wide turns')}</h3>
          <p><T zh={<>字母后加 <K>w</K> 表示外侧两层一起转，例如 <K>Rw</K> 和 <K>Uw</K>。</>} en={<>Add <K>w</K> to turn the outer two layers together, as in <K>Rw</K> and <K>Uw</K>.</>} /></p>
        </div>
        <div>
          <h3>{t('整体转体', 'Whole-puzzle rotations')}</h3>
          <p><T zh={<><K>x</K> 与 <K>R</K> 同向，<K>y</K> 与 <K>U</K> 同向，<K>z</K> 与 <K>F</K> 同向；它们用于改变观察方向。</>} en={<><K>x</K> follows <K>R</K>, <K>y</K> follows <K>U</K>, and <K>z</K> follows <K>F</K>; they change the viewing orientation.</>} /></p>
        </div>
        {order > 3 && <div>
          <h3>{t('大方块', 'Big cubes')}</h3>
          <p><T zh={<>数字前缀表示从该面向内一共转动多少层。<K>3Rw</K> 是右侧外三层一起转，省略数字的 <K>Rw</K> 等同于 <K>2Rw</K>。</>} en={<>A numeric prefix counts how many outer layers turn from that face. <K>3Rw</K> turns the outer three right layers, while <K>Rw</K> is shorthand for <K>2Rw</K>.</>} /></p>
        </div>}
      </div>
      <p className="notation-rule-summary">
        {t('字母选面或层，撇号反向，数字 2 转半圈，nXw 带动外侧多层。', 'Letters select faces or layers, a prime reverses direction, 2 makes a half turn, and nXw moves multiple outer layers.')}
      </p>
    </section>
  );
}

export default function NotationPage() {
  const t = useT();
  const params = useParams<{ lang: string }>();
  const isZh = params.lang === 'zh';
  const [puzzle, setPuzzle] = useQueryState(
    'puzzle',
    parseAsStringEnum<NotationPuzzle>([...NOTATION_PUZZLES])
      .withDefault('333')
      .withOptions({ history: 'push' }),
  );
  const [order, setOrder] = useQueryState(
    'order',
    parseAsInteger.withDefault(NXN_ORDER_DEFAULT),
  );
  const [notationStyle, setNotationStyle] = useQueryState(
    'notation',
    parseAsStringEnum<AlgNotationStyle>([...ALG_NOTATION_STYLES]).withDefault('standard'),
  );
  const [wcaOnly, setWcaOnly] = useQueryState(
    'wca',
    parseAsBoolean.withDefault(false),
  );
  const [training, setTraining] = useQueryState(
    'train',
    parseAsBoolean.withDefault(false).withOptions({ history: 'push' }),
  );
  const [trainingMode, setTrainingMode] = useQueryState(
    'trainingMode',
    parseAsStringEnum<NotationTrainingMode>([...NOTATION_TRAINING_MODES]).withDefault('perform'),
  );
  const cubeOrder = clampNxNOrder(order);
  const activePuzzle: NotationPuzzle = wcaOnly && puzzle === 'fto' ? '333' : puzzle;
  useEffect(() => {
    if (order !== cubeOrder) void setOrder(cubeOrder);
  }, [cubeOrder, order, setOrder]);
  useEffect(() => {
    if (activePuzzle !== puzzle) void setPuzzle(activePuzzle);
  }, [activePuzzle, puzzle, setPuzzle]);
  const pickerGroups: readonly PuzzlePickerGroup[] = [
    {
      id: 'wca',
      label: t('WCA 项目', 'WCA events'),
      items: NOTATION_PUZZLES.filter(id => id !== 'fto').map(id => ({
        id,
        label: eventDisplayName(id, isZh),
        iconClass: `event-${id}`,
      })),
    },
    ...(!wcaOnly ? [{
      id: 'non-wca',
      label: t('非 WCA 项目', 'Non-WCA puzzles'),
      items: [{
        id: 'fto',
        label: eventDisplayName('fto', isZh),
        iconClass: 'unofficial-fto',
      }],
    }] : []),
  ];
  const ftoMoves: MoveNotationOption[] = [
    ...FTO_FACE_MOVES.map(move => demoOption(move, t('单面', 'Face'))),
    ...FTO_WIDE_MOVES.map(move => demoOption(move, t('宽层', 'Wide'))),
    ...FTO_SLICE_MOVES.map(move => demoOption(move, t('中层', 'Slice'))),
    ...FTO_ROTATION_MOVES.map(move => demoOption(move, t('转体', 'Rotation'))),
    ...FTO_MACRO_MOVES.map(move => demoOption(move, t('组合动作', 'Macro'))),
  ];
  const cubeMoves = wcaOnly ? cubeWcaMovesForOrder(cubeOrder) : cubeMovesForOrder(cubeOrder);
  const cubeOptions = cubeDemoOptions(cubeMoves);
  const megaminxOptions = MEGAMINX_WCA_MOVES.map(move => demoOption(move, formatMegaminxMoveDescription(move, t)));
  const pyraminxOptions = (wcaOnly ? PYRAMINX_WCA_MOVES : [...PYRAMINX_WCA_MOVES, ...PYRAMINX_EXTENSION_MOVES])
    .map(move => demoOption(move, formatPyraminxMoveDescription(move, t)));
  const skewbOptions = (wcaOnly ? SKEWB_WCA_MOVES : [...SKEWB_WCA_MOVES, ...SKEWB_EXTENSION_MOVES])
    .map(move => demoOption(move, formatSkewbMoveDescription(move, t)));
  const square1Options = SQUARE1_MOVES.map(move => demoOption(move, formatSquare1MoveDescription(move, t)));
  const clockOptions = CLOCK_WCA_MOVES.map(move => demoOption(move, formatClockMoveDescription(move, t)));
  const activeOptions: readonly MoveNotationOption[] = activePuzzle === '333' ? cubeOptions
    : activePuzzle === 'minx' ? megaminxOptions
      : activePuzzle === 'pyram' ? pyraminxOptions
        : activePuzzle === 'skewb' ? skewbOptions
          : activePuzzle === 'sq1' ? square1Options
            : activePuzzle === 'clock' ? clockOptions
              : ftoMoves;
  const activePlayerPuzzle = activePuzzle === '333' ? '3x3'
    : activePuzzle === 'minx' ? 'megaminx'
      : activePuzzle === 'pyram' ? 'pyraminx'
        : activePuzzle;
  const viewMode: NotationViewMode = training ? trainingMode : 'learn';
  const viewModeItems: readonly CompactSelectItem<NotationViewMode>[] = [
    { value: 'learn', label: t('学习', 'Learn') },
    { value: 'perform', label: t('训练:转魔方', 'Train: turn puzzle') },
    { value: 'identify', label: t('训练:选转动', 'Train: choose move') },
  ];
  const setViewMode = (next: NotationViewMode) => {
    if (next === 'learn') {
      void setTraining(false);
      return;
    }
    void setTrainingMode(next);
    void setTraining(true);
  };

  return (
    <main className="notation-page">
      <div className="alg-notation-shell notation-shell">
        <header className="alg-notation-hero">
          <h1>{t('转动记号', 'Move notation')}</h1>
          <Link href="/regulation/full#article-12" className="alg-notation-reference">
            {t('查看 WCA 规则第 12 条', 'Read WCA Regulations Article 12')}
          </Link>
        </header>

        <p className="alg-fto-notation-intro">
          {t(
            '记号把每一步转动写成文字，让同一个打乱、解法和裁判记录能被一致还原。这里集中收录 WCA 第 12 条的正式记号、本站公式系统支持的常用扩展，以及非 WCA 魔方记号；教学说明与动画共用同一份记号目录和统一播放器。',
            'Notation records every turn in text so the same scramble, solution and judging record can be reproduced consistently. This guide combines the official notation from WCA Article 12, common extensions supported by the algorithm system, and notation for non-WCA puzzles; its explanations and animations share one catalog and one player.',
          )}
        </p>

        <nav className="notation-project-picker" aria-label={t('选择魔方项目与记号范围', 'Choose a puzzle and notation scope')}>
          <PuzzlePicker
            isZh={isZh}
            selectedEvent={activePuzzle}
            groups={pickerGroups}
            onSelect={id => void setPuzzle(id as NotationPuzzle)}
          />
          {activePuzzle === '333' && (
            <NxNOrderInput
              value={cubeOrder}
              onCommit={nextOrder => void setOrder(nextOrder)}
              aria-label={t('魔方阶数', 'Cube order')}
            />
          )}
          {activePuzzle !== 'sq1' && (
            <AlgNotationStyleSelect
              value={notationStyle}
              onChange={value => void setNotationStyle(value)}
            />
          )}
          <BoolToggle
            value={wcaOnly}
            onChange={next => void setWcaOnly(next)}
            label={t('仅 WCA 记号', 'WCA notation only')}
          />
          <CompactSelect
            className="notation-mode-select"
            label={viewModeItems.find(item => item.value === viewMode)?.label}
            items={viewModeItems}
            value={viewMode}
            onChange={setViewMode}
            ariaLabel={t('学习与训练模式', 'Learning and training mode')}
          />
        </nav>

        {training && (
          <NotationTrainer
            key={`${activePuzzle}-${cubeOrder}-${notationStyle}-${wcaOnly}-${trainingMode}`}
            puzzle={activePlayerPuzzle}
            puzzleOrder={activePuzzle === '333' ? cubeOrder : undefined}
            moves={activeOptions}
            notationStyle={activePuzzle === 'sq1' ? 'standard' : notationStyle}
            mode={trainingMode}
          />
        )}

        {!training && activePuzzle === '333' && <div id="cube" className="notation-catalog-section">
          <div className="alg-notation-demo-section">
            <MoveNotationDemo
              puzzle="3x3"
              puzzleOrder={cubeOrder}
              moves={cubeOptions}
              notationStyle={notationStyle}
              transposeGroups
              variant="compact"
            />
          </div>
          <CubeRuleNotes order={cubeOrder} />
        </div>}

        {!training && activePuzzle === 'minx' && <section id="megaminx" className="notation-catalog-section">
          <MoveNotationDemo
            puzzle="megaminx"
            moves={megaminxOptions}
            notationStyle={notationStyle}
            transposeGroups
            variant="compact"
          />
        </section>}

        {!training && activePuzzle === 'pyram' && <section id="pyraminx" className="notation-catalog-section">
          <MoveNotationDemo
            puzzle="pyraminx"
            moves={pyraminxOptions}
            notationStyle={notationStyle}
            transposeGroups
            variant="compact"
          />
        </section>}

        {!training && activePuzzle === 'skewb' && <section id="skewb" className="notation-catalog-section">
          <MoveNotationDemo
            puzzle="skewb"
            moves={skewbOptions}
            notationStyle={notationStyle}
            transposeGroups
            variant="compact"
          />
        </section>}

        {!training && activePuzzle === 'sq1' && <section id="square1" className="notation-catalog-section" aria-labelledby="square1-title">
          <div className="notation-section-heading">
            <h2 id="square1-title">Square-1</h2>
            <span>{t('WCA 第 12c 条', 'WCA Article 12c')}</span>
          </div>
          <p className="notation-section-copy">{t('每一步写成数对 (x, y)：上层顺时针转 x 个 30 度单位，下层顺时针转 y 个 30 度单位，负数表示逆时针。斜线 / 表示把右半部翻转 180 度。例如 (1,0) 只转上层一格，(0,-1) 只将下层逆时针转一格。', 'Each step is a pair (x, y): turn the top layer x 30-degree units clockwise and the bottom layer y units clockwise; negative values go counter-clockwise. A slash / flips the right half by 180 degrees. For example, (1,0) turns only the top by one unit and (0,-1) turns only the bottom counter-clockwise by one unit.')}</p>
          <MoveNotationDemo puzzle="sq1" moves={square1Options} layout="square1-grid" variant="compact" />
        </section>}

        {!training && activePuzzle === 'clock' && <section id="clock" className="notation-catalog-section">
          <MoveNotationDemo
            puzzle="clock"
            moves={clockOptions}
            notationStyle={notationStyle}
            transposeGroups
            variant="compact"
          />
        </section>}

        {!training && activePuzzle === 'fto' && <section id="fto" className="notation-catalog-section">
          <MoveNotationDemo
            puzzle="fto"
            moves={ftoMoves}
            notationStyle={notationStyle}
            transposeGroups
            variant="compact"
          />
        </section>}
      </div>
    </main>
  );
}
