// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { toggleSideViolations } from '../scripts/toggle-side-guard.mts';

const packages = resolve(import.meta.dirname, '../..');
describe('label-left / switch-right contract', () => {
  it('rejects CSS reversal across all three consumers, including multiline selectors', () => {
    for (const pkg of ['client', 'timer-ui', 'app-ui']) {
      for (const rule of ['flex-direction: row-reverse', 'order: -1', 'direction: rtl']) {
        expect(toggleSideViolations(`${packages}/${pkg}/src/example.css`, `.settings-panel\n.bool-toggle { ${rule}; }`)).toHaveLength(1);
      }
    }
    expect(toggleSideViolations(`${packages}/client/components/example.css`, '.unrelated { flex-direction: row-reverse; }')).toEqual([]);
  });
  it('rejects a regression of the two canonical JSX orders', () => {
    expect(toggleSideViolations(`${packages}/timer-ui/src/BoolToggle.tsx`, '{(renderSwitch ?? factory)(props)} <button className="bool-toggle-label">Label</button>')).toHaveLength(1);
    expect(toggleSideViolations(`${packages}/timer-ui/src/TimerTimingSettingsSections.tsx`, 'export function TimerBooleanSettingRow() { return <div><span className="settings-row-control"/><span className="settings-row-label"/></div> }')).toHaveLength(1);
  });
  it('keeps current Web and App source free of reversal overrides', () => {
    const problems: string[] = [];
    for (const dir of ['client/app', 'client/components', 'timer-ui/src', 'app-ui/src']) {
      const base = resolve(packages, dir);
      for (const file of readdirSync(base, { recursive: true, encoding: 'utf8' })) {
        if (!/\.(css|tsx)$/.test(file) || /\.test\./.test(file)) continue;
        const path = resolve(base, file);
        problems.push(...toggleSideViolations(path, readFileSync(path, 'utf8')).map((message) => `${path}: ${message}`));
      }
    }
    expect(problems).toEqual([]);
  });
});
