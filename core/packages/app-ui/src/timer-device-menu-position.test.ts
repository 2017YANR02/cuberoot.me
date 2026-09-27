// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const styles = document.createElement('style');
const here = dirname(fileURLToPath(import.meta.url));
styles.textContent = readFileSync(resolve(here, '../../timer-ui/src/timer-chrome.css'), 'utf8')
  + readFileSync(resolve(here, 'app.css'), 'utf8');

afterEach(() => { styles.remove(); document.body.replaceChildren(); });

describe('installed device menu containing block', () => {
  it.each(['app-shell app-shell--device-footer', 'battle-local-tools', 'battle-net-timer'])(
    'anchors the absolute menu inside the normal-flow %s trigger', (className) => {
      document.head.append(styles);
      const parent = document.createElement('div');
      parent.className = className;
      parent.innerHTML = '<div class="shell-device-center"><button class="shell-device-center-trigger">Bluetooth</button><div class="shell-device-center-menu">Connect</div></div>';
      document.body.append(parent);
      const center = parent.firstElementChild!;
      const menu = center.lastElementChild!;
      // Static centers let bottom:100% resolve against the viewport (solo) or
      // a distant stage (battle). Relative keeps the menu above the button.
      expect(getComputedStyle(center).position).toBe('relative');
      expect(getComputedStyle(center).inset).toBe('auto');
      expect(getComputedStyle(menu).position).toBe('absolute');
    },
  );
});
