'use client';

// Shared color-scheme controls (de-MUI port of roux-trainers src/components/Input.tsx).
// Used by BOTH BlockTrainerView and CmllTrainerView, hence it lives in the shared
// foundation rather than a per-view file. Logic/dispatch preserved verbatim.
import React, { Fragment } from 'react';

import { AppState, Action } from '@/lib/roux/Types';
import { ColorScheme } from '@/lib/roux/CubeLib';

import { MultiSelectContent } from './SelectorViews';
import { Modal, FieldLabel } from './ui';
import { Settings } from 'lucide-react';
import './Input.css';

export function ColorSetter(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const [text, setText] = React.useState(props.state.colorScheme.toUserInput().join(','));
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => setText(event.target.value);
  const handleClick = () => {
    const arr = text.split(',');
    props.dispatch({
      type: 'colorScheme',
      content: arr.length === 7 ? arr : ColorScheme.default_colors,
    });
  };
  return (
    <Fragment>
      <div className="roux-color-setter">
        <label className="roux-color-field">
          <span className="roux-color-field-label">Color</span>
          <input className="roux-color-input" onChange={handleChange} value={text} />
          <span className="roux-color-help">G,B,R,O,Y,W,Gray</span>
        </label>
      </div>
      <div>
        <button type="button" className="roux-btn roux-btn-outline" onClick={handleClick}>
          Set color
        </button>
      </div>
    </Fragment>
  );
}

export function ColorPanel(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  const select = 'orientationSelector';
  const { content } = MultiSelectContent({ state, dispatch, select });

  const [open, setOpen] = React.useState(false);
  return (
    <div className="roux-color-panel">
      <FieldLabel>Orientation and Color Scheme</FieldLabel>
      <button type="button" className="roux-btn roux-btn-outline" onClick={() => setOpen(true)}>
        <Settings size={15} style={{ marginRight: 3 }} />
        Edit
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        disableBackdropClose
        title="Set Orientation (U-F) and Color Scheme"
        actions={
          <button type="button" className="roux-btn roux-btn-text" onClick={() => setOpen(false)}>
            Close
          </button>
        }
      >
        {content}
        <hr className="roux-color-divider" />
        <ColorSetter {...{ state, dispatch }} />
      </Modal>
    </div>
  );
}
