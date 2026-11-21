'use client';

import type { ReactNode, RefObject } from 'react';
import AlgInput, { type AlgInputProps } from '@/components/AlgInput';
import { Play, Shuffle, Search, Loader2 } from '@app-foundation/icons/lucide';
import { ClearButton } from '@/components/ClearButton';
import { useT } from '@/hooks/useT';
import { algHtmlText, sanitizeAlgHtml } from '@/lib/alg_html';
import { hasFingerMarks, sliceAlgHtml, spliceAlgHtml } from '@/lib/alg-finger-marks';

export type SimAlgHighlightSpan = { text: string; bad?: boolean; current?: boolean; html?: string };

type Props = {
  idPrefix?: string;
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
    html?: string;
    onMarkedChange?: (text: string, html: string) => void;
    onKeyDown?: AlgInputProps['onKeyDown'];
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
  idPrefix = '', setup, alg, is3x3, algStm, scramble, setupExtras, autofill, notationControls, algHelp, moveEditing, moveEditorRef,
}: Props) {
  const t = useT();
  const formatted = !!alg.onMarkedChange && alg.showOverlay && hasFingerMarks(alg.html ?? '');
  return (
    <>
      {scramble.previewing && <div className="sim-preview-notice" role="status">
        <span>{t('正在预览打乱', 'Previewing scramble')}</span>
        <button type="button" onClick={scramble.onRestore} title={t('返回公式', 'Return to algorithm')}>{t('返回公式', 'Return to algorithm')}</button>
      </div>}
      <label className="sim-field-label" htmlFor={`${idPrefix}sim-setup`}>{t('初始状态', 'Initial state')}</label>
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
            autoComplete="off"
            ref={setup.elementRef}
            id={`${idPrefix}sim-setup`}
            aria-describedby={setup.error ? `${idPrefix}sim-setup-error` : undefined}
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
          <span className="sim-random-label-full">{t('随机打乱', 'Random scramble')}</span>
          <span className="sim-random-label-short">{t('随机', 'Random')}</span>
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
          className="sim-player-scramble sim-setup-preview"
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
      {setup.error && <p id={`${idPrefix}sim-setup-error`} className="sim-input-error" role="status">{setup.error}</p>}
      <label className="sim-field-label" htmlFor={`${idPrefix}sim-alg`}>{t('公式', 'Algorithm')}</label>
      <div className="sim-player-row">
        <div className={'sim-player-hlwrap' + (moveEditing ? ' sim-player-hlwrap--editing' : '')}
          onCopy={e => {
            const el = alg.elementRef.current;
            if (!alg.html || !el || e.target !== el || el.selectionStart === el.selectionEnd) return;
            e.preventDefault();
            e.clipboardData.setData('text/plain', el.value.slice(el.selectionStart, el.selectionEnd));
            e.clipboardData.setData('text/html', sliceAlgHtml(alg.html, el.selectionStart, el.selectionEnd));
          }}
          onPaste={e => {
            const el = alg.elementRef.current;
            const raw = e.clipboardData.getData('text/html');
            if (!raw || !el || e.target !== el || !alg.onMarkedChange) return;
            const html = sanitizeAlgHtml(raw);
            if (!/<(?:s|u|em)[ >]/.test(html)) return;
            e.preventDefault();
            const caret = el.selectionStart + algHtmlText(html).length;
            const next = spliceAlgHtml(alg.html ?? '', el.selectionStart, el.selectionEnd, html);
            el.value = algHtmlText(next);
            el.setSelectionRange(caret, caret);
            alg.onMarkedChange(el.value, next);
          }}
        >
          <div ref={moveEditorRef} hidden={!moveEditing} className="sim-move-editor-slot" />
          {alg.showOverlay && !moveEditing && (
            <div className={'sim-player-hl' + (formatted ? ' sim-player-hl--formatted' : '')} aria-hidden="true">
              {alg.spans.map((s, i) => (
                <span
                  key={i}
                  className={[s.bad && 'bad', s.current && 'current'].filter(Boolean).join(' ') || undefined}
                >
                  {s.html ? <span dangerouslySetInnerHTML={{ __html: s.html }} /> : s.text}
                </span>
              ))}
            </div>
          )}
          <AlgInput
            id={`${idPrefix}sim-alg`}
            inputMode="text"
            ariaInvalid={Boolean(alg.error)}
            ariaDescribedBy={alg.error ? `${idPrefix}sim-alg-error` : undefined}
            elementRef={alg.elementRef as RefObject<HTMLTextAreaElement | HTMLDivElement | null>}
            initialText={alg.text}
            rows={1}
            spellCheck={false}
            autoSpace={alg.autoSpace}
            autoResize
            className={'sim-player-input' + (alg.showOverlay ? ' sim-player-input--hl' : '') + (formatted ? ' sim-player-input--formatted' : '')}
            placeholder={t('解法', 'Solution')}
            title={is3x3 ? t('换握：↑ 上起手、↓ 下起手、↑↑ 向上半转换握（右手 R2／左手 L′2 方向）、↓↓ 向下半转换握（手指落点相同、腕臂扭转相反）、· 中起手。↑↑／↓↓ 后无空格为右手、有空格为左手（含串尾）；↑／↓／· 沿用紧贴为右手、空白或串尾为左手；↑｜↑ 为右、左依次上起手。', 'Grips: ↑ up, ↓ down, ↑↑ half-turn via up (right R2 / left L′2), ↓↓ half-turn via down (same finger contacts, opposite wrist and forearm twist), · home. ↑↑/↓↓: no following space means right, whitespace means left, including at the end. ↑/↓/·: glued means right; whitespace or end means left. ↑｜↑ sets right then left hand up.') : undefined}
            onFocus={alg.onFocus}
            onClick={alg.onClick}
            onChange={alg.onChange}
            onKeyDown={alg.onKeyDown}
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

      {alg.error && <p id={`${idPrefix}sim-alg-error`} className="sim-input-error" role="status">{alg.error}</p>}
      {algHelp}
    </>
  );
}
