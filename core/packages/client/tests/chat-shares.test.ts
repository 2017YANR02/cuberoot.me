import { describe, expect, it } from 'vitest';
import { parseChatShare } from '@/lib/chat-shares';

describe('chat sharing into existing apps', () => {
  it('maps valid meeting and music links to language-aware internal paths', () => {
    expect(parseChatShare('https://cuberoot.me/meet?room=1234')).toEqual({ kind: 'meet', id: '1234', href: '/meet?room=1234' });
    expect(parseChatShare('https://www.cuberoot.me/zh/music?track=api%3A123')).toEqual({ kind: 'music', id: 'api:123', href: '/music?track=api%3A123&view=player' });
  });
  it('never turns arbitrary, credential-bearing or malformed links into privileged cards', () => {
    for (const text of ['https://evil.example/meet?room=1234', 'https://cuberoot.me.evil.example/meet?room=1234', 'javascript:alert(1)', 'https://a@cuberoot.me/meet?room=1234', 'https://cuberoot.me/meet?room=12', 'https://cuberoot.me/music?track=', 'https://cuberoot.me/music?track=%00', '<img onerror=alert(1)>']) expect(parseChatShare(text)).toBeNull();
  });
});
