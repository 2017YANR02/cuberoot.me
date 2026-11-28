import type { CSSProperties, KeyboardEvent } from 'react';
import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTrash, FaSyncAlt } from 'react-icons/fa';

import Button from './Button';
import TextInput from './TextInput';
import Kbd from './Kbd';
import type { FrameCountSolve } from '../hooks/useFrameCount';


const panelStyle: CSSProperties = {
  padding: '.75em',
  display: 'flex',
  flexDirection: 'column',
  gap: '.6em',
  borderBottom: '1px solid var(--gray-6)',
  background: 'var(--gray-2)',
  fontSize: '.85em',
};

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '.4em' };
const headingStyle: CSSProperties = { fontWeight: 600, fontSize: '1em', margin: 0 };
const helpStyle: CSSProperties = { color: 'var(--gray-11)', fontSize: '.85em', lineHeight: 1.5 };
const solveRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '.4em',
  padding: '.25em .35em',
  borderRadius: 4,
  cursor: 'pointer',
};
const deltaStyle = (delta: number): CSSProperties => ({
  fontVariantNumeric: 'tabular-nums',
  color: Math.abs(delta) < 0.01 ? 'var(--gray-11)' : (delta > 0 ? 'var(--amber-11)' : 'var(--blue-11)'),
});


// eslint-disable-next-line react/display-name
const FrameCountPanel = memo(({
  inputTimeStr,
  setInputTimeStr,
  solves,
  nextSolveIndex,
  addSolve,
  removeSolve,
  updateSolveTime,
  detectedFps,
  onJumpToSolve,
}: {
  inputTimeStr: string,
  setInputTimeStr: (s: string) => void,
  solves: FrameCountSolve[],
  nextSolveIndex: number,
  addSolve: () => void,
  removeSolve: (solveIndex: number) => void,
  updateSolveTime: (solveIndex: number, newInputTimeStr: string) => void,
  detectedFps: number | undefined,
  onJumpToSolve: (solve: FrameCountSolve) => void,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSolve();
    }
  }, [addSolve]);

  const handleUpdate = useCallback(() => {
    if (solves.length === 0) return;
    const last = solves.at(-1)!;
    updateSolveTime(last.solveIndex, inputTimeStr);
  }, [solves, updateSolveTime, inputTimeStr]);

  const handleRemove = useCallback(() => {
    if (solves.length === 0) return;
    const last = solves.at(-1)!;
    removeSolve(last.solveIndex);
  }, [solves, removeSolve]);

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <h3 style={headingStyle}>{t('Frame count')}</h3>
        <span style={{ marginLeft: 'auto', color: 'var(--gray-11)', fontSize: '.85em' }}>
          {detectedFps != null ? `${detectedFps.toFixed(2)} fps` : t('(no video)')}
        </span>
      </div>

      <div style={rowStyle}>
        <TextInput
          ref={inputRef}
          value={inputTimeStr}
          onChange={(e) => setInputTimeStr(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t('Solve {{n}} — time (s)', { n: nextSolveIndex })}
          inputMode="decimal"
          style={{ flexGrow: 1 }}
          title={t('Enter the solve time displayed on the timer, e.g. 1.07')}
        />
      </div>

      <div style={rowStyle}>
        <Button onClick={addSolve} title={t('Add solve at current frame')} style={{ flex: 1, padding: '.4em .6em' }}>
          <FaPlus style={{ verticalAlign: 'middle', marginRight: '.35em' }} />{t('Add')} <Kbd code="KeyM" />
        </Button>
        <Button onClick={handleUpdate} disabled={solves.length === 0} title={t('Update last solve with current input time')} style={{ padding: '.4em .6em' }}>
          <FaSyncAlt style={{ verticalAlign: 'middle' }} />
        </Button>
        <Button onClick={handleRemove} disabled={solves.length === 0} title={t('Delete last solve')} style={{ padding: '.4em .6em' }}>
          <FaTrash style={{ verticalAlign: 'middle' }} />
        </Button>
      </div>

      {solves.length === 0 ? (
        <div style={helpStyle}>
          <div style={{ fontWeight: 600, marginBottom: '.3em' }}>{t('How to count frames')}</div>
          <ol style={{ paddingLeft: '1.2em', margin: 0 }}>
            <li>{t('Enter the displayed solve time')}</li>
            <li>{t('Seek to the frame where the hand hits the timer')}</li>
            <li>
              {t('Press')} <Kbd code="KeyM" /> {t('to add — the start frame is calculated automatically')}
            </li>
          </ol>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.15em', maxHeight: 200, overflowY: 'auto' }}>
          {solves.map((solve) => {
            const measured = solve.stopTime - solve.startTime;
            const delta = measured - solve.inputTime;
            return (
              <div
                key={solve.solveIndex}
                style={solveRowStyle}
                role="button"
                tabIndex={0}
                onClick={() => onJumpToSolve(solve)}
                onKeyDown={(e) => { if (e.key === 'Enter') onJumpToSolve(solve); }}
                title={t('Click to seek to start frame')}
              >
                <span style={{ minWidth: '4em', color: 'var(--gray-11)' }}>#{solve.solveIndex}</span>
                <span style={{ minWidth: '3.5em', fontVariantNumeric: 'tabular-nums' }}>{solve.inputTime}s</span>
                <span style={deltaStyle(delta)}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(3)}s
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSolve(solve.solveIndex); }}
                  style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-10)', padding: '.1em .3em' }}
                  title={t('Remove this solve')}
                >
                  <FaTrash size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default FrameCountPanel;
