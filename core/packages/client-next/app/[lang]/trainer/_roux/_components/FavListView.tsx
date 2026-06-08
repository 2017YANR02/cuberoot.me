'use client';

// Faithful de-MUI port of roux-trainers/src/components/FavListView.tsx — the
// bookmarks sidebar. Lists saved cases for the current mode; each row has a
// "play" (replay) and a "delete" (confirm-then-remove) action, plus an "add"
// dialog that parses pasted `category, setup` lines. Logic / dispatch /
// parseAddString preserved verbatim. MUI: Table*→<table>, Paper→div,
// IconButton→button, Dialog*→../ui Modal, TextField→input/textarea.
// Icons: PlaylistPlay→ListVideo, DeleteOutline→Trash2, Add→Plus (lucide).

import React from 'react';
import { ListVideo, Trash2, Plus } from 'lucide-react';

import { AppState, Action, FavCase } from '@/lib/roux/Types';
import { all_solvers } from '@/lib/roux/CachedSolver';

import { Modal } from './ui';
import './FavListView.css';

// Confirm-dialog helper (upstream signature: warnDialog({ confirm })). Upstream
// shipped only an empty stub; here it is a functional Modal-backed confirm. It
// returns { open, render } — call open() to ask, render() to mount the dialog.
export function warnDialog(props: { confirm: () => void }) {
  const [shown, setShown] = React.useState(false);
  const open = () => setShown(true);
  const close = () => setShown(false);
  const onYes = () => {
    props.confirm();
    setShown(false);
  };
  const render = (message?: React.ReactNode) => (
    <Modal
      open={shown}
      onClose={close}
      title={message ?? 'Are you sure?'}
      actions={
        <>
          <button type="button" className="roux-btn roux-btn-text" onClick={close}>
            No
          </button>
          <button type="button" className="roux-btn roux-btn-text" onClick={onYes}>
            Yes
          </button>
        </>
      }
    >
      {null}
    </Modal>
  );
  return { open, close, render, shown };
}

function parseAddString(state: AppState, s: string): [FavCase[], boolean] {
  const res: FavCase[] = [];

  const allSolvers = new Set(all_solvers);
  for (const line of s.split('\n')) {
    let cols = line.split(',');
    if (cols.length !== 2) continue;
    let solver = cols[0].trim().split('|');
    let setup = cols[1].trim();

    if (solver.every((x) => allSolvers.has(x))) {
      let case_: FavCase = {
        mode: state.mode,
        solver,
        setup,
      };
      res.push(case_);
    }
  }
  if (res.length > 0) return [res, true];
  else return [[], false];
}

export default function FavListView(props: { state: AppState; dispatch: React.Dispatch<Action> }) {
  const { state, dispatch } = props;
  const favList = state.favList.filter((c) => c.mode === state.mode);

  const play = (i: number) => {
    dispatch({ type: 'favList', content: [favList[i]], action: 'replay' });
  };
  const remove = () => {
    if (dialogID >= 0 && dialogID < favList.length)
      dispatch({ type: 'favList', content: [favList[dialogID]], action: 'remove' });
  };
  const [dialogID, setDialogID] = React.useState(-1);

  const handleClose = () => setDialogID(-1);
  const handleRemove = () => {
    remove();
    setDialogID(-1);
  };
  const dialogDelete = (
    <Modal
      open={dialogID >= 0}
      onClose={handleClose}
      title="Delete this alg from favorites?"
      actions={
        <>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleClose}>
            No
          </button>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleRemove}>
            Yes
          </button>
        </>
      }
    >
      {null}
    </Modal>
  );

  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [addString, setAddString] = React.useState('');
  const handleAdd = () => setAddDialogOpen(true);
  const handleAddClose = () => setAddDialogOpen(false);
  const handleAddSuccess = () => {
    let [res, status] = parseAddString(state, addString);
    if (status) {
      dispatch({ type: 'favList', content: res, action: 'add' });
    }
    handleAddClose();
  };
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAddString(event.target.value);
  };
  const dialogAdd = (
    <Modal
      open={addDialogOpen}
      onClose={handleAddClose}
      title="Add New Cases"
      actions={
        <>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleAddClose}>
            Cancel
          </button>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleAddSuccess}>
            Add All
          </button>
        </>
      }
    >
      <p className="roux-fav-add-help">
        Input your cases here. (one per line) <br />
        Format: [category], [setup algorithm]. category := fb | fbdr | ss-front | ss-back
      </p>
      <textarea
        autoFocus
        className="roux-fav-add-input"
        rows={4}
        onChange={handleTextChange}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      />
    </Modal>
  );

  return (
    <div>
      {dialogDelete}
      {dialogAdd}
      <div className="roux-fav-card">
        <table className="roux-fav-table">
          <thead>
            <tr>
              <th className="roux-fav-th">Scramble</th>
              <th className="roux-fav-th roux-fav-th-action">
                <button
                  type="button"
                  className="roux-icon-btn roux-icon-btn-active roux-fav-icon"
                  onClick={handleAdd}
                  aria-label="Add cases"
                >
                  <Plus size={18} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {favList.map((value, i) => (
              <tr key={i}>
                <td className="roux-fav-td roux-fav-td-case">
                  {value.solver.join('|') + ',' + value.setup}
                </td>
                <td className="roux-fav-td roux-fav-td-action">
                  <button
                    type="button"
                    className="roux-icon-btn roux-icon-btn-active roux-fav-icon"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => play(i)}
                    aria-label="Replay"
                  >
                    <ListVideo size={18} />
                  </button>
                  <button
                    type="button"
                    className="roux-icon-btn roux-icon-btn-active roux-fav-icon"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => setDialogID(i)}
                    aria-label="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
