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
import { useRT } from '../i18n';
import './FavListView.css';

// Confirm-dialog helper (upstream signature: warnDialog({ confirm })). Upstream
// shipped only an empty stub; here it is a functional Modal-backed confirm. It
// returns { open, render } — call open() to ask, render() to mount the dialog.
export function warnDialog(props: { confirm: () => void }) {
  const { t } = useRT();
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
      title={message ?? t('Are you sure?')}
      actions={
        <>
          <button type="button" className="roux-btn roux-btn-text" onClick={close}>
            {t('No')}
          </button>
          <button type="button" className="roux-btn roux-btn-text" onClick={onYes}>
            {t('Yes')}
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
  const { t, isZh } = useRT();
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
      title={t('Delete this alg from favorites?')}
      actions={
        <>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleClose}>
            {t('No')}
          </button>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleRemove}>
            {t('Yes')}
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
      title={t('Add New Cases')}
      actions={
        <>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleAddClose}>
            {t('Cancel')}
          </button>
          <button type="button" className="roux-btn roux-btn-text" onClick={handleAddSuccess}>
            {t('Add All')}
          </button>
        </>
      }
    >
      <p className="roux-fav-add-help">
        {isZh ? '在此输入情况（每行一条）' : 'Input your cases here. (one per line)'}
        <br />
        {isZh
          ? '格式：[类别], [打乱公式]。类别 := fb | fbdr | ss-front | ss-back'
          : 'Format: [category], [setup algorithm]. category := fb | fbdr | ss-front | ss-back'}
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
              <th className="roux-fav-th">{t('Scramble')}</th>
              <th className="roux-fav-th roux-fav-th-action">
                <button
                  type="button"
                  className="roux-icon-btn roux-icon-btn-active roux-fav-icon"
                  onClick={handleAdd}
                  aria-label={t('Add cases')}
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
                    aria-label={t('Replay')}
                  >
                    <ListVideo size={18} />
                  </button>
                  <button
                    type="button"
                    className="roux-icon-btn roux-icon-btn-active roux-fav-icon"
                    onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => setDialogID(i)}
                    aria-label={t('Delete')}
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
