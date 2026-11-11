// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd, overrideConfigFile: 'eslint.auth.config.mjs' });

describe('standard ESLint auth import boundary', () => {
  it.each([
    "import { useAuthStore } from '@/lib/auth-store';",
    "import { useAuthStore as useSession } from '@/lib/auth-store';",
    "import { isAdmin } from '../lib/auth-store';",
    "import * as auth from '@/lib/auth-store';",
    "export { useAuthStore as useSession } from '@/lib/auth-store';",
    "export * from '@/lib/auth-store';",
    "import { useAuthStore } from '../lib/auth-store.ts';",
  ])('rejects unsafe imports and re-exports: %s', async code => {
    const [result] = await eslint.lintText(code, { filePath: 'components/Fixture.tsx' });
    expect(result.messages.some(message => message.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('accepts safe rendering and imperative commands in TSX', async () => {
    const [result] = await eslint.lintText(`
      import { useAuthUser, useIsAdmin, authActions, getAuthUser, type WcaUser } from '@/lib/auth-store';
      export function Controls() {
        const user: WcaUser | null = useAuthUser();
        const admin = useIsAdmin();
        return <button onClick={() => { if (!getAuthUser()) authActions.login(); }}>{user?.name}{admin && 'Edit'}</button>;
      }
    `, { filePath: 'components/Fixture.tsx' });
    expect(result.messages).toEqual([]);
  });

  it.each(['app/[lang]/example/page.tsx', 'hooks/useExample.ts', 'lib/example.tsx'])('covers %s', async filePath => {
    const [result] = await eslint.lintText("import { useAuthStore } from '@/lib/auth-store';", { filePath });
    expect(result.errorCount).toBe(1);
  });
});
