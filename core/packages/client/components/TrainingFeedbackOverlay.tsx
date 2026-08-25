import { Check, X } from 'lucide-react';
import styles from './TrainingFeedbackOverlay.module.css';

export type TrainingFeedbackKind = 'correct' | 'wrong';

interface TrainingFeedbackOverlayProps {
  kind: TrainingFeedbackKind | null;
  correctLabel: string;
  wrongLabel: string;
}

/** Shared, non-interactive answer signal for puzzle-training stages. */
export default function TrainingFeedbackOverlay({
  kind,
  correctLabel,
  wrongLabel,
}: TrainingFeedbackOverlayProps) {
  if (!kind) return null;

  const correct = kind === 'correct';
  return (
    <div
      className={`${styles.overlay} ${correct ? styles.correct : styles.wrong}`}
      role={correct ? 'status' : 'alert'}
    >
      {correct
        ? <Check size={120} strokeWidth={3} aria-hidden="true" />
        : <X size={120} strokeWidth={3} aria-hidden="true" />}
      <span className={styles.srOnly}>{correct ? correctLabel : wrongLabel}</span>
    </div>
  );
}
