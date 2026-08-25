import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { NotificationKind } from '@/lib/notifications-api';
import { workspaceFixturePath } from './workspace-fixture-path';

const CLIENT = join(__dirname, '..');
const PAGE = readFileSync(join(CLIENT, 'app/[lang]/notifications/page.tsx'), 'utf8');
const SERVER_NOTIFY = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'utils', 'notify.ts'),
  'utf8',
);

describe('teaching message notification wire contract', () => {
  it('keeps teaching_message in the client wire union', () => {
    const kind: NotificationKind = 'teaching_message';
    expect(kind).toBe('teaching_message');
  });

  it('keeps the server kind and bilingual label in sync', () => {
    expect(SERVER_NOTIFY).toContain("| 'teaching_message'");
    expect(SERVER_NOTIFY).toContain(
      "teaching_message: { zh: '发送了教学消息', en: 'sent a teaching message' }",
    );
  });

  it('renders a known icon and bilingual inbox label', () => {
    expect(PAGE).toContain('teaching_message: MessagesSquare');
    expect(PAGE).toContain("teaching_message: t('发送了教学消息', 'sent a teaching message')");
  });
});
