import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(
  join(here, '..', 'app', '[lang]', 'recon', '[id]', 'ReconDetailClient.tsx'),
  'utf8',
);
const serverSource = readFileSync(
  workspaceFixturePath('@cuberoot/server', 'src', 'routes', 'recon.ts'),
  'utf8',
);

describe('recon comment replies', () => {
  it('shows a localized comment count without a leading icon', () => {
    expect(clientSource).toContain("t('recon.commentCount', { count: comments.length })");
    expect(clientSource).not.toContain('<MessageCircle');
  });

  it('shows a localized alternative count without a leading icon', () => {
    expect(clientSource).toContain("t('recon.alternativeCount', { count: alts.length })");
    expect(clientSource).not.toContain('<GitFork');
    expect(clientSource).not.toContain("t('recon.emptyAlternatives')");
  });

  it('shows the same-round heading without a source icon', () => {
    expect(clientSource).toContain("{t('recon.sameRound')}");
    expect(clientSource).not.toContain('same-round-source');
  });

  it('opens an empty reply composer without inserting an @ mention', () => {
    const startReply = clientSource.match(
      /const startReply = \(parent: ReconComment\) => \{([\s\S]*?)\n  \};/,
    )?.[1] ?? '';
    expect(startReply).toContain('setReplyingToId(parent.id)');
    expect(startReply).toContain("setReplyText('')");
    expect(startReply).not.toContain('`@${');
    expect(clientSource).not.toContain("placeholder={t('recon.writeReply')}");
    expect(clientSource).toContain("submitLabel={t('recon.reply')}");
  });

  it('still submits parentId and notifies the parent author in-site and by email', () => {
    expect(clientSource).toContain('addComment(reconId, txt, parentId)');
    expect(serverSource).toContain("kind: 'recon_reply', recipients: [parentAuthor]");

    const notifySource = readFileSync(
      workspaceFixturePath('@cuberoot/server', 'src', 'utils', 'notify.ts'),
      'utf8',
    );
    expect(notifySource).toContain('INSERT INTO notifications');
    expect(notifySource).toContain('await sendEmail({');
  });
});
