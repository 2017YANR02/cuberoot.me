export interface ManualScrambleQueueEditorProps {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: string;
}

/**
 * The manual-scramble textarea shared verbatim by Web, Android, and iOS.
 *
 * Parsing, cursor movement, persistence, and source selection stay in the host
 * adapters. There is intentionally no clear or submit button: website parity
 * is immediate persistence on every edit, and deleting the textarea contents
 * is the canonical clear action.
 */
export function ManualScrambleQueueEditor({
  ariaLabel,
  onChange,
  value,
}: ManualScrambleQueueEditorProps) {
  return (
    <div className="settings-row scramble-src-manual" data-no-timer>
      <textarea
        aria-label={ariaLabel}
        autoCapitalize="none"
        autoCorrect="off"
        className="scramble-src-manual-input"
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={3}
        spellCheck={false}
        value={value}
      />
    </div>
  );
}
