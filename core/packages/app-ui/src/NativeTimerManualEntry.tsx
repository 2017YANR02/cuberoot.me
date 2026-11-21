import {
  checkTimerFmcSolvedness,
  createTimerManualEntryDraft,
  timerManualEntryKind,
  validateTimerManualEntry,
  type TimerManualEntryDraft,
  type TimerManualEntryValue,
} from '@cuberoot/shared/timer';
import { TimerManualEntryModal, type TimerManualEntryLabels } from '@cuberoot/timer-ui';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { InstalledAppListener } from './platform';

type DraftInput = Pick<TimerManualEntryDraft,
  'time' | 'penalty' | 'scramble' | 'comment' | 'fmcSolution' | 'fmcMoveCount' | 'mbldSolved' | 'mbldAttempted'>;
type Field = {
  key: Exclude<keyof DraftInput, 'penalty'>;
  label: string;
  placeholder: string;
  keyboard?: 'number' | 'time';
  multiline?: true;
};

interface SheetConfig {
  id: string;
  title: string;
  cancel: string;
  save: string;
  resultFields: Field[];
  notesFields: Field[];
  penalty?: string;
}

interface SheetFeedback {
  canSave: boolean;
  message?: string;
  moveCount?: number;
}

type SheetEvent = { id: string; type: 'dismiss' } | {
  id: string;
  type: 'change' | 'save';
  revision: number;
  input: DraftInput;
};

export interface ManualEntrySheetHost {
  present(config: SheetConfig): Promise<boolean>;
  update(data: SheetFeedback & { id: string; revision: number; saveFailed?: true }): Promise<void>;
  dismiss(id: string): Promise<void>;
  addListener(listener: (event: SheetEvent) => void): Promise<InstalledAppListener>;
}

type Props = Omit<ComponentProps<typeof TimerManualEntryModal>, 'onSubmit'> & {
  host: ManualEntrySheetHost;
  saveError: string;
  onSubmit(value: TimerManualEntryValue): Promise<boolean>;
};

function sheetConfig(id: string, draft: TimerManualEntryDraft, labels: TimerManualEntryLabels): SheetConfig {
  const kind = timerManualEntryKind(draft.event);
  const time: Field = { key: 'time', label: labels.time, placeholder: labels.timePlaceholder, keyboard: 'time' };
  const resultFields: Field[] = kind === 'fmc' ? [
    { key: 'fmcSolution', label: labels.fmcSolution, placeholder: labels.fmcSolutionPlaceholder, multiline: true },
    { key: 'fmcMoveCount', label: labels.fmcMoveCount, placeholder: labels.fmcMoveCountPlaceholder, keyboard: 'number' },
  ] : kind === 'mbld' ? [
    { key: 'mbldSolved', label: labels.solved, placeholder: labels.solvedPlaceholder, keyboard: 'number' },
    { key: 'mbldAttempted', label: labels.attempted, placeholder: labels.attemptedPlaceholder, keyboard: 'number' },
    { ...time, label: labels.mbldTime, placeholder: labels.mbldTimePlaceholder },
  ] : [time];
  return {
    id,
    title: labels.title,
    cancel: labels.cancel,
    save: labels.save,
    resultFields,
    notesFields: [
      { key: 'scramble', label: labels.scramble, placeholder: draft.currentScramble, multiline: true },
      { key: 'comment', label: kind === 'fmc' ? labels.fmcComment : labels.comment, placeholder: labels.commentPlaceholder, multiline: true },
    ],
    penalty: kind === 'time' ? labels.penalty : undefined,
  };
}

let nextSheet = 0;

export function NativeTimerManualEntry({ host, saveError, ...props }: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const id = String(++nextSheet);
    const { currentScramble, event, labels } = latest.current;
    const initial = createTimerManualEntryDraft(event, currentScramble);
    let active = true;
    let latestRevision = -1;
    let feedbackGeneration = 0;
    let saving = false;

    const subscription = host.addListener(message => {
      if (!active || message.id !== id) return;
      if (message.type === 'dismiss') {
        latest.current.onClose();
        return;
      }
      const { revision } = message;
      if (revision < latestRevision) return;
      latestRevision = revision;
      const generation = ++feedbackGeneration;
      const draft = { ...initial, ...message.input, event, currentScramble };
      const validation = validateTimerManualEntry(draft);
      const canSave = validation.value !== null;
      const parsed = validation.fmc;
      const moveCount = parsed?.kind === 'parsed' ? parsed.count : undefined;
      const update = (feedback: SheetFeedback & { saveFailed?: true }) => {
        if (active && generation === feedbackGeneration) void host.update({ id, revision, moveCount, ...feedback }).catch(() => {});
      };

      if (message.type === 'save' && validation.value) {
        if (saving) return;
        saving = true;
        const failed = () => {
          saving = false;
          update({ canSave, message: saveError, saveFailed: true });
        };
        void latest.current.onSubmit(validation.value).then(saved => {
          if (!saved) failed();
        }).catch(failed);
        return;
      }

      const retry = message.type === 'save' ? { saveFailed: true as const } : {};
      if (parsed?.kind === 'invalid') {
        update({ canSave, message: labels.fmcInvalidToken(parsed.token), ...retry });
      } else if (validation.error) {
        const touched = validation.kind === 'time' ? draft.time.length > 0
          : validation.kind === 'fmc' ? draft.fmcSolution.length + draft.fmcMoveCount.length > 0
          : draft.mbldSolved.length + draft.mbldAttempted.length + draft.time.length > 0;
        update({ canSave, message: touched || message.type === 'save' ? labels.error(validation.error) : undefined, ...retry });
      } else if (validation.mbld) {
        const result = validation.mbld;
        update({ canSave, message: [
          result.result, labels.mbldPoints(result.points), ...(result.dnf ? [labels.mbldDnf] : []),
        ].join(' · ') });
      } else if (parsed?.kind === 'parsed') {
        update({ canSave, message: labels.fmcChecking(parsed.count) });
        void checkTimerFmcSolvedness(draft.scramble.trim() || currentScramble, parsed).then(status => {
          const statusLabel = status === 'solved' ? labels.fmcSolved
            : status === 'unsolved' ? labels.fmcUnsolved : labels.fmcUnchecked;
          update({ canSave, message: statusLabel(parsed.count) });
        }).catch(() => update({ canSave, message: labels.fmcUnchecked(parsed.count) }));
      } else {
        update({ canSave });
      }
    });

    void subscription.then(async () => {
      if (active && !(await host.present(sheetConfig(id, initial, labels))) && active) setFallback(true);
    }).catch(() => { if (active) setFallback(true); });

    return () => {
      active = false;
      void subscription.then(handle => handle.remove()).catch(() => {});
      void host.dismiss(id).catch(() => {});
    };
  }, [host, saveError]);

  return fallback ? <TimerManualEntryModal {...props} /> : null;
}
