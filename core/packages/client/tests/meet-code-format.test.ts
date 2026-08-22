// 会议码的跨包契约:客户端归一 / 校验、服务端分配 / 校验必须都是四位数字。
//
// 为什么必须守:任何一侧仍接受旧字母码或长度不一致，都会让有效邀请在另一侧被 400 挡掉。
//
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  MEET_CODE_ALPHABET,
  MEET_CODE_LEN,
  isMeetCode,
  normalizeMeetCode,
} from '@/lib/video-room-api';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/client/tests
const SERVER_ROUTE = join(HERE, '..', '..', 'server', 'src', 'routes', 'video_rooms.ts');

/** 服务端那条正则,从源码里抠出来重建 —— 免得两边各自维护一份「说明」而不是同一个事实。 */
function serverRegex(): RegExp {
  const src = readFileSync(SERVER_ROUTE, 'utf8');
  const m = /const MEET_CODE_RE = \/(.+?)\/;/.exec(src);
  expect(m, 'server 的 MEET_CODE_RE 不见了 / 改了写法,这条守卫已经守不住东西了').not.toBeNull();
  return new RegExp(m![1]!);
}

describe('会议码 — 客户端与服务端统一为四位数字', () => {
  const re = serverRegex();

  it('0–9 每一个数字都被服务端接受', () => {
    for (const ch of MEET_CODE_ALPHABET) {
      const code = ch.repeat(MEET_CODE_LEN);
      expect(re.test(code), `字符 ${ch} 在客户端表里,服务端却不认`).toBe(true);
    }
  });

  it('长度必须正好 MEET_CODE_LEN', () => {
    const body = '0123';
    expect(re.test(body.slice(0, -1))).toBe(false);
    expect(re.test(body + MEET_CODE_ALPHABET[0])).toBe(false);
  });

  it('前导零保留，字母不收', () => {
    expect(re.test('0000')).toBe(true);
    expect(isMeetCode('0000')).toBe(true);
    expect(re.test('12A4')).toBe(false);
    expect(isMeetCode('12A4')).toBe(false);
  });

  it('字符表就是十进制数字，长度就是四位', () => {
    expect(MEET_CODE_ALPHABET).toBe('0123456789');
    expect(MEET_CODE_LEN).toBe(4);
  });

  it('新建会议由服务端避开活跃房与刚分配的号码', () => {
    const src = readFileSync(SERVER_ROUTE, 'utf8');
    expect(src).toContain("post('/video/meet/code'");
    expect(src).toContain('svc().listRooms()');
    expect(src).toContain('pendingMeetCodes');
    expect(src).toContain('pickAvailableRoomCode(occupied)');
  });
});

describe('normalizeMeetCode — 用户会粘进来什么', () => {
  const code = '0427';

  it('整条邀请链接:从 ?room= 里挖,而不是把 https/meet 的字母拼成假码', () => {
    expect(normalizeMeetCode(`https://cuberoot.me/zh/meet?room=${code}`)).toBe(code);
    expect(normalizeMeetCode(`https://cuberoot.me/meet?players=1&room=${code}#x`)).toBe(code);
  });

  it('裸码带空格 / 字母 / 连字符会只保留数字', () => {
    expect(normalizeMeetCode('0a4 2-7')).toBe(code);
  });

  it('没有 room= 的链接不会被拼出一个假码来', () => {
    expect(isMeetCode(normalizeMeetCode('https://cuberoot.me/'))).toBe(false);
    expect(normalizeMeetCode('https://example.test/2026/page/1234')).toBe('');
  });

  it('合法码自己认得', () => {
    expect(isMeetCode(code)).toBe(true);
    expect(isMeetCode(code.slice(0, -1))).toBe(false);
    expect(isMeetCode('042A')).toBe(false);
  });
});
