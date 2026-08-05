// /meet 第二轮上线审查的四条回归守卫。它们跨 server token、第三方组件和响应式 CSS,
// 单靠 typecheck 看不见:代码照样能编译,但会留下可批量制造的空房、键盘下的聊天框、
// 被侧栏挤烂的控制条或 /zh 里突然冒出的英文连接提示。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(HERE, '..');
const SERVER = join(CLIENT, '..', 'server', 'src', 'routes', 'video_rooms.ts');
const MEET = join(CLIENT, 'app', '[lang]', 'meet');

const server = readFileSync(SERVER, 'utf8');
const css = readFileSync(join(MEET, 'meet.css'), 'utf8');
const controls = readFileSync(join(MEET, 'MeetControlBar.tsx'), 'utf8');
const stage = readFileSync(join(MEET, 'MeetStage.tsx'), 'utf8');

describe('/meet production invariants', () => {
  it('puts the hard participant cap in the token instead of pre-creating empty rooms', () => {
    expect(server).toContain('at.roomConfig = new RoomConfiguration({');
    expect(server).toMatch(/roomConfig\s*=\s*new RoomConfiguration\(\{[\s\S]*?maxParticipants/);
    expect(server, 'HTTP token requests must not allocate LiveKit rooms').not.toContain('.createRoom(');
    expect(server).not.toContain('ensureRoom(');
  });

  it('anchors mobile chat and roster panels to the visual-viewport-sized meeting stage', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 600px)'));
    expect(mobile).toMatch(/\.lk-chat,\s*\.meet-roster\s*\{[\s\S]*?position:\s*absolute/);
    expect(mobile).toMatch(/inset:\s*0 0 var\(--lk-control-bar-height, 69px\)/);
    expect(mobile).not.toMatch(/\.meet-roster\s*\{[\s\S]*?position:\s*fixed/);
  });

  it('switches the control bar to compact mode earlier while a side panel is open', () => {
    expect(controls).toContain('useIsMobile(showChat || showRoster ? 1000 : 760)');
  });

  it('owns the connection-state toast so every visible state is bilingual', () => {
    expect(stage).not.toContain('ConnectionStateToast');
    expect(stage).toContain("zh: '连接中…', en: 'Connecting…'");
    expect(stage).toContain("zh: '正在重新连接…', en: 'Reconnecting…'");
    expect(stage).toContain("zh: '连接已断开', en: 'Disconnected'");
  });
});
