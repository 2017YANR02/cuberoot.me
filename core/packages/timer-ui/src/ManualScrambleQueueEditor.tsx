import { useEffect, useState } from 'react';

export interface ManualScrambleQueueEditorProps {
  ariaLabel: string;
  /** Edit in the scramble strip; Enter commits, Shift+Enter keeps queue editing. */
  inline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  value: string;
}

/**
 * The manual-scramble textarea shared verbatim by Web, Android, and iOS.
 *
 * Parsing, cursor movement, persistence, and source selection stay in the host
 * adapters. Inline editing commits with Enter; the existing standalone queue
 * editor persists each edit. Deleting its contents remains the clear action.
 */
export function ManualScrambleQueueEditor({
  ariaLabel,
  inline = false,
  disabled,
  placeholder,
  onChange,
  value,
}: ManualScrambleQueueEditorProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const Wrapper = inline ? 'span' : 'div';
  return (
    <Wrapper className={inline ? "scramble-manual-inline" : "settings-row scramble-src-manual"} data-no-timer>
      <textarea
        aria-label={ariaLabel}
        disabled={disabled}
        autoCapitalize="none"
        autoCorrect="off"
        className="scramble-src-manual-input"
        onChange={(event) => inline ? setDraft(event.currentTarget.value) : onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (!inline || event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.stopPropagation();
          onChange(draft);
          event.currentTarget.blur();
        }}
        placeholder={placeholder}
        rows={inline ? Math.max(1, draft.split("\n").length) : 3}
        spellCheck={false}
        value={inline ? draft : value}
      />
    </Wrapper>
  );
}
