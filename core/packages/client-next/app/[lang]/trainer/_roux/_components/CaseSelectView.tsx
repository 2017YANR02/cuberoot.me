'use client';

// Faithful de-MUI port of roux-trainers/src/components/CaseSelectView.tsx.
//
// Upstream structure: a `CaseSelectContent` (the group/case grid) wrapped by the
// `makeDialog` HOC (Dialog.tsx) — which is why the exported default takes the
// dialog props `label` / `title?` on top of the content props. We inline both
// here: `CaseSelectDialog` renders the FieldLabel + "Select" trigger button and a
// <Modal> containing <CaseSelectContent>.
//
// All selection logic (group/case/all flag toggling + dispatch) is preserved
// verbatim. MUI presentation → plain HTML + ./CaseSelectView.css. clsx replaced
// with a filter().join().

import React from 'react';
import { CheckCircle2, XCircle, Settings } from 'lucide-react';

import { AppState, Action } from '@/lib/roux/Types';
import Selector from '@/lib/roux/Selector';
import * as SRVisualizer from 'sr-visualizer';

import CaseVisualizer from './CaseVisualizer';
import { Modal, FieldLabel } from './ui';
import { useIsMobile } from '@/hooks/useIsMobile';
import './CaseSelectView.css';

export type CaseSelectSettings = {
  selector: string;
  algs: [string, string][];
  groups: string[];
  cubeOptions?: Partial<SRVisualizer.ICubeOptions>;
  visualizeMask: string;
};

function splitAlgIntoGroups(algs: [string, string][], groups: string[]) {
  const algGroups: { [k: string]: [[string, string], number][] } = Object.fromEntries(
    groups.map((g) => [g, []]),
  );
  algs.forEach((alg, i) => {
    const prefix = alg[0].split('_', 1)[0];
    if (prefix in algGroups) algGroups[prefix].push([alg, i]);
  });
  return algGroups;
}

function CaseSelectContent(props: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  settings: CaseSelectSettings;
}) {
  const { selector, groups, algs, visualizeMask } = props.settings;
  const sel = (props.state.config as Record<string, unknown>)[selector] as Selector;
  const algGroups = splitAlgIntoGroups(algs, groups);

  const handleSelectGroup = (groupname: string, value: number) => () => {
    const newFlags = [...sel.flags];
    algGroups[groupname].forEach(([, i]) => {
      newFlags[i] = value;
    });
    props.dispatch({ type: 'config', content: { [selector]: sel.setFlags(newFlags) } });
  };
  const handleSelectCase = (caseIdx: number) => () => {
    const newFlags = [...sel.flags];
    newFlags[caseIdx] = newFlags[caseIdx] === 0 ? 1 : 0;
    props.dispatch({ type: 'config', content: { [selector]: sel.setFlags(newFlags) } });
  };
  const handleSelectAll = (value: number) => () => {
    const newFlags = Array(sel.flags.length).fill(value);
    props.dispatch({ type: 'config', content: { [selector]: sel.setFlags(newFlags) } });
  };

  const gt_sm = !useIsMobile(599);

  return (
    <div className="roux-caseselect-content">
      <div className="roux-caseselect-allrow">
        <div className="roux-caseselect-btngroup">
          <button type="button" className="roux-btn roux-btn-outline" onClick={handleSelectAll(1)}>
            <CheckCircle2 size={16} />
            Select All
          </button>
          <button type="button" className="roux-btn roux-btn-outline" onClick={handleSelectAll(0)}>
            <XCircle size={16} />
            Deselect All
          </button>
        </div>
      </div>

      {groups.map((groupname, i) => (
        <div
          className={
            'roux-caseselect-group' + (gt_sm ? ' is-row' : ' is-col')
          }
          key={i}
        >
          <div className={'roux-caseselect-grouphead' + (gt_sm ? ' is-col' : ' is-row')}>
            <div className="roux-caseselect-groupname">
              {groupname[0].toUpperCase() + groupname.substr(1)}
            </div>
            <div className="roux-caseselect-grouptoggle">
              <button
                type="button"
                className="roux-btn roux-btn-outline roux-caseselect-iconbtn"
                onClick={handleSelectGroup(groupname, 1)}
                aria-label="Select group"
              >
                <CheckCircle2 size={16} />
              </button>
              <button
                type="button"
                className="roux-btn roux-btn-outline roux-caseselect-iconbtn"
                onClick={handleSelectGroup(groupname, 0)}
                aria-label="Deselect group"
              >
                <XCircle size={16} />
              </button>
            </div>
          </div>

          <div className="roux-caseselect-cases">
            {algGroups[groupname].map(([[name, alg], idx]) => (
              <div
                key={name}
                onClick={handleSelectCase(idx)}
                className={
                  ['roux-caseselect-case', sel.flags[idx] && 'is-on']
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <CaseVisualizer
                  name={name}
                  size={100}
                  alg={alg}
                  mask={visualizeMask}
                  cubeOptions={props.settings.cubeOptions || {}}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// makeDialog(CaseSelectContent) — inlined. The trigger renders the FieldLabel +
// a "Select" button; the dialog body holds CaseSelectContent. Upstream used
// `disableEscapeKeyDown` on the MUI Dialog → we mirror with disableBackdropClose
// on <Modal> (its own Escape handler closes, matching MUI default Escape).
function CaseSelectDialog(props: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  settings: CaseSelectSettings;
  label: string;
  title?: string;
}) {
  const title = props.title || props.label;
  const [open, setOpen] = React.useState(false);

  return (
    <div className="roux-caseselect">
      <FieldLabel>{props.label}</FieldLabel>
      <button
        type="button"
        className="roux-btn roux-btn-outline"
        onClick={() => setOpen(true)}
      >
        <Settings size={16} />
        Select
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        maxWidth={900}
        actions={
          <button
            type="button"
            className="roux-btn roux-btn-text"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        }
      >
        <CaseSelectContent
          state={props.state}
          dispatch={props.dispatch}
          settings={props.settings}
        />
      </Modal>
    </div>
  );
}

export default CaseSelectDialog;
