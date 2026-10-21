'use client';

import type { ReactNode, RefObject } from 'react';
import AlgInput, { type AlgInputProps } from '@/components/AlgInput';
import { Play, Shuffle, Search, Loader2 } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';

export type SimAlgHighlightSpan = { text: string; bad?: boolean; current?: boolean };

type Props = {
  setup: {
    text: string;
    elementRef: RefObject<HTMLTextAreaElement | null>;
    spans: readonly SimAlgHighlightSpan[] | null | undefined;
    error: string;
    invalid: boolean | undefined;
    onFocus: () => void;
    onInput: (element: HTMLTextAreaElement) => void;
  };
  alg: {
    text: string;
    elementRef: RefObject<HTMLTextAreaElement | null>;
    spans: readonly SimAlgHighlightSpan[];
    showOverlay: boolean;
    error: string;
    autoSpace: AlgInputProps['autoSpace'];
    onFocus: () => void;
    onClick: () => void;
    onChange: (text: string) => void;
    onCaretChange: (text: string, caretIndex: number) => void;
  };
  is3x3: boolean;
  algStm: number;
  scramble: {
    previewing: boolean;
    onRestore: () => void;
    onRandom: () => void;
    randomDisabled: boolean;
    onPreview: () => void;
    previewDisabled: boolean;
    onDerive?: () => void;
    busy: boolean;
    status: string | null;
    onCancel: () => void;
  };
  setupExtras: ReactNode;
  autofill: ReactNode;
  notationControls: ReactNode;
  algHelp: ReactNode;
  moveEditing?: boolean;
  moveEditorRef?: (element: HTMLDivElement | null) => void;
};

/** Input presentation only: the playback controller owns drafts, validation and
 * notation conversions. Keep its DOM refs attached for caret sync and keyboards. */
export default function SimAlgEditor({
  setup, alg, is3x3, algStm, scramble, setupExtras, autofill, notationControls, algHelp, moveEditing, moveEditorRef,
}: Props) {
  const t = useT();
  return (
    <>
      {scramble.previewing && <div className="sim-preview-notice" role="status">
        <span>{t('正在预览打乱', 'Previewing scramble')}</span>
        <button type="button" onClick={scramble.onRestore} title={t('返回公式', 'Return to algorithm')}>{t('返回公式', 'Return to algorithm')}</button>
      </div>}
      <label className="sim-field-label" htmlFor="sim-setup">{t('初始状态', 'Initial state')}</label>
      <div className="sim-player-row sim-player-row--top">
        <div className="sim-player-hlwrap">
          {setup.spans && (
            <div className="sim-player-hl" aria-hidden="true">
              {setup.spans.map((s, i) => (
                <span key={i} className={s.bad ? 'bad' : undefined}>{s.text}</span>
              ))}
            </div>
          )}
          <textarea
            ref={setup.elementRef}
            id="sim-setup"
            aria-describedby={setup.error ? 'sim-setup-error' : undefined}
            onFocus={setup.onFocus}
            defaultValue={setup.text}
            rows={1}
            spellCheck={false}
            className={setup.spans ? 'sim-player-input sim-player-input--hl' : 'sim-player-input'}
            aria-invalid={setup.invalid}
            placeholder={t('打乱', 'Scramble')}
            onInput={(e) => setup.onInput(e.currentTarget)}
          />
        </div>
        <button
          type="button"
          className="sim-player-scramble"
          onClick={scramble.onRandom}
          disabled={scramble.randomDisabled}
          title={t('随机打乱', 'Random scramble')}
          aria-label={t('随机打乱', 'Random scramble')}
        >
          <Shuffle size={14} />
          {t('随机打乱', 'Random scramble')}
        </button>
        {scramble.onDerive && (
          <button
            type="button"
            className="sim-player-scramble"
            onClick={scramble.onDerive}
            disabled={scramble.busy || !alg.text.trim()}
            title={t('从下方解法反推最优打乱(云端，需登录)', 'Derive an optimal scramble from the solution below (cloud, sign-in required)')}
            aria-label={t('反推最优打乱', 'Derive optimal scramble')}
          >
            {scramble.busy ? <Loader2 size={14} className="sim-spin" /> : <Search size={14} />}
          </button>
        )}
        <button
          type="button"
          className="sim-player-scramble"
          onClick={scramble.onPreview}
          disabled={scramble.previewDisabled}
          title={t('动画展示打乱', 'Animate scramble')}
          aria-label={t('动画展示打乱', 'Animate scramble')}
        >
          <Play size={14} />
        </button>
      </div>
      {setupExtras}
      {scramble.status && (
        <div className="sim-player-status">
          {scramble.busy && <Loader2 size={14} className="sim-spin" />}
          <span>{scramble.status}</span>
          {scramble.busy && (
            <ClearButton
              variant="standalone"
              onClick={scramble.onCancel}
              ariaLabel={t('取消', 'Cancel')}
              title={t('取消', 'Cancel')}
            />
          )}
        </div>
      )}
      {setup.error && <p id="sim-setup-error" className="sim-input-error" role="status">{setup.error}</p>}
      <label className="sim-field-label" htmlFor="sim-alg">{t('公式', 'Algorithm')}</label>
      <div className="sim-player-row">
        <div className={'sim-player-hlwrap' + (moveEditing ? ' sim-player-hlwrap--editing' : '')}>
          <div ref={moveEditorRef} hidden={!moveEditing} className="sim-move-editor-slot" />
          {alg.showOverlay && !moveEditing && (
            <div className="sim-player-hl" aria-hidden="true">
              {alg.spans.map((s, i) => (
                <span
                  key={i}
                  className={[s.bad && 'bad', s.current && 'current'].filter(Boolean).join(' ') || undefined}
                >
                  {s.text}
                </span>
              ))}
            </div>
          )}
          <AlgInput
            id="sim-alg"
            inputMode="text"
            ariaInvalid={Boolean(alg.error)}
            ariaDescribedBy={alg.error ? 'sim-alg-error' : undefined}
            elementRef={alg.elementRef as RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
            initialText={alg.text}
            rows={1}
            spellCheck={false}
            autoSpace={alg.autoSpace}
            autoResize
            className={alg.showOverlay ? 'sim-player-input sim-player-input--hl' : 'sim-player-input'}
            placeholder={t('解法', 'Solution')}
            title={is3x3 ? t('支持换握记号:↑ 上手(拇指起手 U 面)、↓ 下手(D 面)、· 回 home 握', 'Grip marks supported: ↑ thumb-up grip, ↓ thumb-down grip, · back to home grip') : undefined}
            onFocus={alg.onFocus}
            onClick={alg.onClick}
            onChange={alg.onChange}
            onCaretChange={alg.onCaretChange}
          />
          {!moveEditing && autofill}
        </div>
        {is3x3 && algStm > 0 && (
          <output
            className="sim-player-count"
            aria-label={t(`解法步数:${algStm} STM`, `Solution length: ${algStm} STM`)}
          >
            {algStm} STM
          </output>
        )}
        {notationControls}
      </div>

      {alg.error && <p id="sim-alg-error" className="sim-input-error" role="status">{alg.error}</p>}
      {algHelp}
    </>
  );
}
