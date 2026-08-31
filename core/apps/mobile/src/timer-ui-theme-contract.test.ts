import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

describe('shared timer UI host theme contract', () => {
  it.each(['--popover', '--faint-foreground', '--border-strong']) (
    'defines %s for light, explicit dark, and system dark',
    (token) => {
      const definitions = css.match(new RegExp(`${token}:`, 'g')) ?? [];
      expect(definitions).toHaveLength(3);
    },
  );

  it.each(['--shell-chip', '--shell-divider', '--shell-hover']) (
    'defines derived shell token %s once so it follows the active foreground',
    (token) => {
      const definitions = css.match(new RegExp(`${token}:`, 'g')) ?? [];
      expect(definitions).toHaveLength(1);
    },
  );
});
