import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

const source = (pkg: string, ...path: string[]) => readFileSync(workspaceFixturePath(pkg, ...path), 'utf8');
const repo = resolve(workspaceFixturePath('@cuberoot/client'), '../../..');
describe('shared friend chat integration contracts', () => {
  it('exposes an independent UI entry and keeps the website on shared chat', () => {
    const app = JSON.parse(source('@cuberoot/app-ui', 'package.json'));
    const shared = JSON.parse(source('@cuberoot/shared', 'package.json'));
    expect(app.exports['./chat']).toBe('./src/chat/index.ts');
    expect(app.exports['./chat.css']).toBe('./src/chat/chat.css');
    expect(shared.cuberoot.runtime['./chat']).toBe('runtime-neutral');
    expect(source('@cuberoot/app-ui', 'src/chat/index.ts')).not.toMatch(/\.\.\/App|timer/);
    const page = source('@cuberoot/client', 'app/[lang]/friends/page.tsx');
    expect(page).toContain("from '@cuberoot/app-ui/chat'");
    expect(page).toContain('renderIdentity={renderChatIdentity}');
    expect(page).toContain('onSignIn={login}');
  });
  it('includes shared UI changes in website validation and deployment triggers', () => {
    for (const workflow of ['test.yml', 'deploy_next.yml']) {
      const appPath = relative(repo, workspaceFixturePath('@cuberoot/app-ui')).replaceAll('\\', '/');
      expect(readFileSync(resolve(repo, '.github/workflows', workflow), 'utf8')).toContain(`${appPath}/**`);
    }
    expect(source('@cuberoot/client', 'next.config.ts')).toContain('@cuberoot/app-ui');
  });
  it('keeps private chat notifications transactional and out of email delivery', () => {
    const repository = source('@cuberoot/server', 'src/utils/chat_repository.ts');
    expect(repository).toContain('INSERT INTO notifications');
    expect(repository).not.toMatch(/sendEmail|sendNotification|createNotification/);
    expect(repository).toContain("'好友聊天 / Friend chat', ''");
    expect(source('@cuberoot/server', 'src/utils/account_delete.ts')).toContain("kind = 'friend_message'");
  });
});
