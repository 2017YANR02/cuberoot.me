'use client';

// Faithful de-MUI port of roux-trainers/src/components/ScrambleInputView.tsx.
// An "Input" toggle button opens a dialog with a textarea where the user pastes
// scrambles / a solution (one per line); the two action buttons dispatch
// `scrambleInput` (raw, or inverted "use as solution"). Logic / dispatch / state
// preserved. MUI: Button→button, TextField(multiline)→textarea, Dialog→../ui
// Modal, EditIcon→lucide Pencil. useMediaQuery(up('sm'))→!useIsMobile(599).
// react-ga removed (was not present here). props: { display, scrambles, dispatch }.

import React from 'react';
import { Pencil } from 'lucide-react';

import { Action } from '@/lib/roux/Types';
import { MoveSeq } from '@/lib/roux/CubeLib';
import { useIsMobile } from '@/hooks/useIsMobile';

import { Modal } from './ui';
import './ScrambleInputView.css';

export function ScrambleInputView(props: {
  display: string;
  scrambles: string[];
  dispatch: React.Dispatch<Action>;
}) {
  let [editing, setEditing] = React.useState(false);
  let [value, setValue] = React.useState(props.scrambles.join('\n'));
  let textField = React.useRef<HTMLTextAreaElement | null>(null);

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    event.stopPropagation();
  };
  const onKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
  };
  const toggleEdit = () => {
    setEditing(!editing);
  };
  const handleClose = () => {
    setEditing(false);
  };
  const handleSubmit = () => {
    setEditing(false);
    props.dispatch({
      type: 'scrambleInput',
      content: value.split('\n').filter((s) => s.trim()),
    });
  };
  const handleInvert = () => {
    setEditing(false);
    const inverted = value.split('\n').map((x) => new MoveSeq(x).inv().toString());
    props.dispatch({ type: 'scrambleInput', content: inverted });
  };
  React.useEffect(() => {
    setValue(props.scrambles.join('\n'));
  }, [props.scrambles]);

  const gt_sm = !useIsMobile(599);

  return (
    <>
      <div>
        <button
          type="button"
          className={
            'roux-btn ' + (editing ? 'roux-btn-primary' : 'roux-btn-outline') + ' roux-scrin-btn'
          }
          onClick={toggleEdit}
        >
          <Pencil size={gt_sm ? 16 : 18} />
          {gt_sm && <span>Input</span>}
        </button>
      </div>

      <Modal
        open={editing}
        onClose={handleClose}
        title="Input your own solution / scrambles (one per line)"
        actions={
          <div className="roux-scrin-actions">
            <button
              type="button"
              className="roux-btn roux-btn-outline roux-scrin-action"
              onClick={handleInvert}
            >
              Use as solution
            </button>
            <button
              type="button"
              className="roux-btn roux-btn-outline roux-scrin-action"
              onClick={handleSubmit}
            >
              Use as scramble
            </button>
          </div>
        }
      >
        <textarea
          ref={textField}
          className="roux-scrin-textarea"
          rows={3}
          autoFocus
          value={value}
          onChange={onChange}
          onKeyDown={onKeyPress}
          onKeyUp={onKeyPress}
        />
      </Modal>
    </>
  );
}
