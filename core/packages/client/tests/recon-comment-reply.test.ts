import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(
  join(here, '..', 'app', '[lang]', 'recon', '[id]', 'ReconDetailClient.tsx'),
  'utf8',
);
const serverSource = readFileSync(
  join(here, '..', '..', 'server', 'src', 'routes', 'recon.ts'),
  'utf8',
);

describe('recon comment replies', () => {
  it('opens an empty reply composer without inserting an @ mention', () => {
    const startReply = clientSource.match(
      /const startReply = \(parent: ReconComment\) => \{([\s\S]*?)\n  \};/,
    )?.[1] ?? '';
    expect(startReply).toContain('setReplyingToId(parent.id)');
    expect(startReply).toContain("setReplyText('')");
    expect(startReply).not.toContain('`@${');
  });

  it('still submits parentId and notifies the parent author in-site and by email', () => {
    expect(clientSource).toContain('addComment(reconId, txt, parentId)');
    expect(serverSource).toContain("kind: 'recon_reply', recipients: [parentAuthor]");

    const notifySource = readFileSync(
      join(here, '..', '..', 'server', 'src', 'utils', 'notify.ts'),
      'utf8',
    );
    expect(notifySource).toContain('INSERT INTO notifications');
    expect(notifySource).toContain('await sendEmail({');
  });
});
