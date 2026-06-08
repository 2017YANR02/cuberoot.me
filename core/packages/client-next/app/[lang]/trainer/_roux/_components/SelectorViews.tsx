'use client';

// De-MUI faithful port of roux-trainers/src/components/SelectorViews.tsx.
// Same props / exports / dispatch behavior. MUI form controls → plain
// <label>/<input>; MUI <Slider> → <input type="range"> + rendered tick labels;
// MUI <Dialog> → ../ui Modal. Styles in ../roux.css (.roux-sel-*).

import React from 'react';
import { Settings } from 'lucide-react';

import { AppState, Action, SliderOpt } from '@/lib/roux/Types';
import Selector from '@/lib/roux/Selector';

import { Modal, FieldLabel } from './ui';

// ---- Slider --------------------------------------------------------------
// MUI Slider had an "Any" mark at value=l-1, then numeric marks l..r with an
// optional "-"/"+" suffix when extend_l/extend_r. track={false}, min=l-1, max=r.

function SliderView(props: { slider: SliderOpt; onChange: (n: number) => void }) {
  const { slider } = props;
  const handleChange = (v: number) => {
    if (slider.l - 1 <= v && v <= slider.r) props.onChange(v);
  };
  const marks = React.useMemo(() => {
    const obj = [{ value: slider.l - 1, label: 'Any' }];
    for (let i = slider.l; i <= slider.r; i++) {
      let suffix = '';
      if (i === slider.l && slider.extend_l) suffix = '-';
      if (i === slider.r && slider.extend_r) suffix = '+';
      obj.push({ value: i, label: i.toString() + suffix });
    }
    return obj;
  }, [slider.l, slider.r, slider.extend_l, slider.extend_r]);

  return (
    <div className="roux-sel-slider">
      <FieldLabel className="roux-sel-label">Level</FieldLabel>
      <div className="roux-sel-slider-track-wrap">
        <input
          type="range"
          className="roux-sel-range"
          min={slider.l - 1}
          max={slider.r}
          step={1}
          value={slider.value}
          onChange={(e) => handleChange(Number(e.target.value))}
          onFocus={(e) => e.target.blur()}
        />
        <div className="roux-sel-marks">
          {marks.map((m) => (
            <button
              type="button"
              key={m.value}
              className={
                'roux-sel-mark' + (m.value === slider.value ? ' roux-sel-mark-active' : '')
              }
              onClick={() => handleChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SliderSelect(props: { state: AppState; dispatch: React.Dispatch<Action>; select: string }) {
  const sliderName = props.select;
  const sliderOpt = (props.state.config as any)[sliderName] as SliderOpt;
  return (
    <SliderView
      slider={(props.state.config as any)[sliderName] as SliderOpt}
      onChange={(n: number) => {
        props.dispatch({
          type: 'config',
          content: { [sliderName]: { ...sliderOpt, value: n } },
        });
      }}
    />
  );
}

// ---- SingleSelect (radio group) -----------------------------------------

function SingleSelect(props: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  select: string;
  label?: string;
}) {
  const { state, dispatch, select } = props;
  const { config } = state;
  const sel = (config as any)[select] as Selector;

  const handleChange = (value: string) => {
    const { names } = sel;
    const n = names.length;
    const new_flags = Array(n).fill(0);
    for (let i = 0; i < names.length; i++) {
      if (names[i] === value) new_flags[i] = 1;
    }
    dispatch({ type: 'config', content: { [select]: sel.setFlags(new_flags) } });
  };

  const radioValue = (() => {
    const { names, flags } = sel;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] === 1) return names[i];
    }
    return '';
  })();

  const label = sel.label || props.label || '';
  return (
    <fieldset className="roux-sel roux-sel-single">
      <FieldLabel className="roux-sel-label">{label}</FieldLabel>
      <div className="roux-sel-row">
        {sel.names.map((name) => (
          <label key={name} className="roux-sel-radio">
            <input
              type="radio"
              name={'roux-' + select}
              value={name}
              checked={radioValue === name}
              onChange={(e) => handleChange(e.target.value)}
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---- MultiSelect (checkbox group, optionally inside a dialog) ------------

type MultiSelectOptions = {
  label?: string;
  noDialog?: boolean;
  manipulators?: { name: string; enableIdx: number[] }[];
};

function MultiSelectContent(props: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  select: string;
  options?: MultiSelectOptions;
}) {
  const { state, dispatch, select } = props;
  const options = props.options || {};
  const { config } = state;

  const sel = (config as any)[select] as Selector;
  const handleChange = (value: string, checked: boolean) => {
    const { names, flags } = sel;
    const new_flags = [...flags];
    for (let i = 0; i < names.length; i++) {
      if (names[i] === value) new_flags[i] = checked ? 1 : 0;
    }
    dispatch({ type: 'config', content: { [select]: sel.setFlags(new_flags) } });
  };

  const makeBox = (name: string, checked: boolean) => (
    <label key={name} className="roux-sel-check">
      <input
        type="checkbox"
        checked={checked}
        value={name}
        onChange={(e) => handleChange(e.target.value, e.target.checked)}
      />
      <span>{name}</span>
    </label>
  );

  const [manipChecked, setManipChecked] = React.useState<{ [name: string]: boolean }>({});
  const label = sel.label || options.label || '';
  const makeManipulator = (manip: { name: string; enableIdx: number[] }) => {
    const { name, enableIdx } = manip;
    const handleManip = (checked: boolean) => {
      setManipChecked({ ...manipChecked, [name]: checked });
      const fillValue = checked;
      const { flags } = sel;
      const new_flags = [...flags];
      for (const i of enableIdx) {
        new_flags[i] = fillValue ? 1 : 0;
      }
      dispatch({ type: 'config', content: { [select]: sel.setFlags(new_flags) } });
    };
    return (
      <label key={name} className="roux-sel-check">
        <input
          type="checkbox"
          checked={!!manipChecked[name]}
          value={name}
          onChange={(e) => handleManip(e.target.checked)}
        />
        <span>{name}</span>
      </label>
    );
  };

  const manipulator_row = options.manipulators ? (
    <div className="roux-sel-row">{options.manipulators.map((x) => makeManipulator(x))}</div>
  ) : null;

  const content = (
    <>
      {manipulator_row}
      <div className="roux-sel-row">{sel.names.map((name, i) => makeBox(name, !!sel.flags[i]))}</div>
    </>
  );
  return { label, content };
}

function MultiSelect(props: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  select: string;
  options?: MultiSelectOptions;
}) {
  const { state, dispatch, select } = props;
  const { label, content } = MultiSelectContent({ state, dispatch, select, options: props.options });
  const options = props.options || {};

  const [open, setOpen] = React.useState(false);
  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  if (options.noDialog) {
    return (
      <fieldset className="roux-sel multi-select">
        <FieldLabel className="roux-sel-label">{label}</FieldLabel>
        {content}
      </fieldset>
    );
  }

  return (
    <div className="multi-select roux-sel">
      <FieldLabel className="roux-sel-label">{label}</FieldLabel>
      <button type="button" className="roux-btn roux-btn-outline" onClick={handleClickOpen}>
        <Settings size={16} />
        Edit
      </button>
      <Modal
        open={open}
        onClose={handleClose}
        disableBackdropClose
        title={label}
        actions={
          <button type="button" className="roux-btn roux-btn-text" onClick={handleClose}>
            Ok
          </button>
        }
      >
        {content}
      </Modal>
    </div>
  );
}

export { SingleSelect, MultiSelectContent, MultiSelect, SliderSelect };
