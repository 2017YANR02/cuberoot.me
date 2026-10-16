'use client';

import { useMemo, useState } from 'react';
import { Move } from 'cubing/alg';
import { Undo2, PencilLine, X } from 'lucide-react';
import { parseCubeAlg } from '@cuberoot/shared/alg-transform';
import { useT } from '@/hooks/useT';
import { mirrorAlg, rotateAlg } from '@/lib/cube3';
import { manipulateAlg, manipulationNodes, oppositeMove } from './alg-manipulation';

export default function AlgTransformPanel({ text, order, onApply }: {
  text: string; order: number; onApply: (text: string) => () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<{ result: string; undo: () => void }[]>([]);
  const parsed = useMemo(() => {
    try {
      rotateAlg(text, 'x');
      return { canonical: parseCubeAlg(text).toString(), moves: manipulationNodes(text).filter((node): node is Move => node instanceof Move) };
    } catch { return null; }
  }, [text]);
  const enabled = !!parsed?.moves.length;
  const index = selected !== null && parsed && selected < parsed.moves.length ? selected : null;
  const move = index !== null ? parsed?.moves[index] : null;
  const replacement = order === 3 && move ? oppositeMove(move) : null;
  const canUndo = history.length > 0 && history[history.length - 1].result === text;
  const apply = (next: string) => {
    if (next === text) return;
    const undo = onApply(next);
    setHistory(previous => [...(canUndo ? previous : []), { result: next, undo }].slice(-20));
  };
  const edit = (action: string) => {
    if (index === null) return;
    apply(manipulateAlg(text, index, action));
    setSelected(null);
  };
  const rotations = ['x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'"];
  const rotationNames = { x: t('前后翻', 'Tilt'), y: t('左右转', 'Turn'), z: t('侧着转', 'Roll') };
  return <>
    <select className="sim-transform-select" aria-label={t('换朝向', 'Orientation')} value="" disabled={!enabled}
      onChange={event => {
        const rotation = new Move(event.target.value);
        apply(rotateAlg(text, rotation.family as 'x' | 'y' | 'z', rotation.amount));
      }}>
      <option value="" disabled>{t('换朝向', 'Orientation')}</option>
      {rotations.map(value => <option key={value} value={value}>{rotationNames[value[0] as 'x' | 'y' | 'z']} {value.endsWith('2') ? '180°' : value.endsWith("'") ? '−90°' : '90°'} · {value}</option>)}
    </select>
    <select className="sim-transform-select" aria-label={t('镜像', 'Mirror')} value="" disabled={!enabled}
      onChange={event => { if (parsed) apply(mirrorAlg(parsed.canonical, event.target.value as 'M' | 'S' | 'E')); }}>
      <option value="" disabled>{t('镜像', 'Mirror')}</option>
      <option value="M">{t('左右对换', 'Left ↔ right')}</option>
      <option value="S">{t('前后对换', 'Front ↔ back')}</option>
      <option value="E">{t('上下对换', 'Top ↔ bottom')}</option>
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
          {rotations.map(value => <option key={value} value={value}>{rotationNames[value[0] as 'x' | 'y' | 'z']} {value.endsWith('2') ? '180°' : value.endsWith("'") ? '−90°' : '90°'} · {value}</option>)}
        </select>
        <span className="sim-move-note">{t('后续动作自动调整，末态朝向可能改变', 'Following moves adapt; the final orientation may change')}</span>
      </div>}
    </div>}
  </>;
}
