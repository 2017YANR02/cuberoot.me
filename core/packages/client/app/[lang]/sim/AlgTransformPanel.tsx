'use client';

import { useMemo, useState } from 'react';
import { Move } from 'cubing/alg';
import { Undo2, PencilLine, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { mirrorAlg, rotateAlg } from '@/lib/cube3';
import { manipulateAlg, cubeTextMoves, oppositeMove, transformCubeText, hasHandNotation } from './alg-manipulation';

export default function AlgTransformPanel({ text, setup, order, onApply }: {
  text: string; setup: string; order: number; onApply: (setup: string, text: string) => () => void;
}) {
  const t = useT();
  const [scopeChoice, setScopeChoice] = useState<'solution' | 'both' | null>(null);
  const scope = scopeChoice ?? (setup.trim() ? 'both' : 'solution');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<{ setup: string; result: string; undo: () => void }[]>([]);
  const parsed = useMemo(() => {
    try {
      return { moves: cubeTextMoves(text).map(token => token.move) };
    } catch { return null; }
  }, [text]);
  const enabled = !!parsed?.moves.length;
  const index = selected !== null && parsed && selected < parsed.moves.length ? selected : null;
  const move = index !== null ? parsed?.moves[index] : null;
  const replacement = order === 3 && move ? oppositeMove(move) : null;
  const canUndo = history.length > 0 && history[history.length - 1].result === text && history[history.length - 1].setup === setup;
  const apply = (next: string, nextSetup = setup) => {
    if (next === text && nextSetup === setup) return;
    const undo = onApply(nextSetup, next);
    setHistory(previous => [...(canUndo ? previous : []), { setup: nextSetup, result: next, undo }].slice(-20));
  };
  const setupValid = useMemo(() => {
    try { transformCubeText(setup, move => move); return true; } catch { return false; }
  }, [setup]);
  const transformEnabled = !!parsed && (enabled || (scope === 'both' && !!setup.trim())) && (scope !== 'both' || setupValid);
  const transform = (fn: (move: string) => string) => {
    const next = transformCubeText(text, fn);
    const nextSetup = scope === 'both' ? transformCubeText(setup, fn) : setup;
    apply(next, nextSetup);
  };
  const edit = (action: string) => {
    if (index === null) return;
    apply(manipulateAlg(text, index, action));
    setSelected(null);
  };
  const rotations = ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"];
  return <>
    <select className="sim-transform-select" aria-label={t('转换范围', 'Transform scope')} value={scope}
      aria-describedby="sim-transform-scope-note"
      onChange={event => setScopeChoice(event.target.value as 'solution' | 'both')}>
      <option value="solution">{t('仅解法', 'Solution only')}</option>
      <option value="both">{t('打乱与解法', 'Scramble and solution')}</option>
    </select>
    <span id="sim-transform-scope-note" className="sim-move-note">{t('范围用于换朝向和镜像；取逆、消步、改单步仅作用于解法。', 'Scope applies to orientation and mirror; invert, reduce and move edits affect only the solution.')}</span>
    <select className="sim-transform-select" aria-label={t('换朝向', 'Orientation')} value="" disabled={!transformEnabled}
      onChange={event => {
        const rotation = new Move(event.target.value);
        transform(move => rotateAlg(move, rotation.family as 'x' | 'y' | 'z', rotation.amount));
      }}>
      <option value="" disabled>{t('换朝向', 'Orientation')}</option>
      {rotations.map(value => <option key={value} value={value}>{value}</option>)}
    </select>
    <select className="sim-transform-select" aria-label={t('镜像', 'Mirror')} value="" disabled={!transformEnabled}
      onChange={event => { const axis = event.target.value as 'M' | 'S' | 'E'; transform(move => mirrorAlg(move, axis)); }}>
      <option value="" disabled>{t('镜像', 'Mirror')}</option>
      <option value="M">{t('LR 镜像', 'LR mirror')}</option>
      <option value="S">{t('FB 镜像', 'FB mirror')}</option>
      <option value="E">{t('UD 镜像', 'UD mirror')}</option>
    </select>
    <button type="button" aria-expanded={editing} className={editing ? 'sim-transform-active' : undefined}
      disabled={!enabled && !editing} onClick={() => { setEditing(!editing); setSelected(null); }}>
      <PencilLine size={14} />{t('改一步', 'Edit move')}
    </button>
    {canUndo && <button type="button" onClick={() => {
      history[history.length - 1].undo();
      setHistory(previous => previous.slice(0, -1));
      setSelected(null);
    }}><Undo2 size={14} />{t('撤销', 'Undo')}</button>}
    {(hasHandNotation(text) || (scope === 'both' && hasHandNotation(setup))) && <span className="sim-move-note" role="status">
      {t('含指法记号，暂不支持无损转换；原文保留。', 'Finger notation cannot yet be transformed losslessly; the original is preserved.')}
    </span>}
    {scope === 'solution' && !!setup.trim() && <span className="sim-move-note">
      {t('仅转换解法可能不再还原原打乱；保持同一打乱请用转体插入。', 'Transforming only the solution may no longer solve this scramble; use rotation insertion to keep it.')}
    </span>}
    {editing && <div className="sim-move-editor" onKeyDown={event => {
      if (event.key === 'Escape') { setEditing(false); setSelected(null); }
    }}>
      <div className="sim-move-editor-heading">
        <span>{parsed ? t('点一下要修改的动作', 'Choose a move to edit') : t('公式过长或记号有误，请先调整公式', 'Shorten the algorithm or check its notation')}</span>
        <button type="button" aria-label={t('完成修改', 'Done editing')} onClick={() => setEditing(false)}><X size={15} /></button>
      </div>
      <div className="sim-move-tokens" aria-label={t('选择动作', 'Select move')}>
        {parsed?.moves.map((item, i) => <button type="button" key={i} aria-pressed={index === i}
          aria-label={t('动作 ', 'Move ') + (i + 1) + ': ' + item.toString()}
          onClick={() => setSelected(index === i ? null : i)}>{item.toString()}</button>)}
      </div>
      {move && <div className="sim-move-actions">
        {replacement && <button type="button" onClick={() => edit('opposite')}>
          <span>{move.toString()} → {replacement.toString()}</span><small>{t('换到另一侧', 'Use opposite side')}</small>
        </button>}
        {/^[xyz]$/.test(move.family) && <button type="button" onClick={() => edit('remove')}>{t('去掉', 'Remove')} {move.toString()}</button>}
        <select className="sim-transform-select" aria-label={t('在选中动作后插入转体', 'Insert rotation after selected move')} value="" onChange={event => edit(event.target.value)}>
          <option value="" disabled>{t('在这步后转体…', 'Rotate after this move…')}</option>
          {rotations.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <span className="sim-move-note">{t('后续动作自动调整，末态朝向可能改变', 'Following moves adapt; the final orientation may change')}</span>
      </div>}
    </div>}
  </>;
}
