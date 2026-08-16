// 会议码的跨包契约:**客户端生成、服务端校验**,两边各写一份字符表。
//
// 为什么必须守:分叉的失败是全量的但看不出原因 —— 客户端多一个服务端不认的字符,
// 平均每 9/32 次「新建会议」就会撞上它并被 400 挡掉,用户看到的只是「有时候能建有时候不能」。
// 反过来客户端少字符则只是白白丢熵,而熵是会议室**唯一**的防线(没有在册名单可查,
// 拿到码就能进)。
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
  newMeetCode,
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

describe('会议码 — 客户端生成的,服务端必须全认', () => {
  const re = serverRegex();

  it('随机生成 300 个都过服务端校验', () => {
    for (let i = 0; i < 300; i++) {
      const code = newMeetCode();
      expect(re.test(code), `服务端不认这个码:${code}`).toBe(true);
    }
  });

  it('字母表里每一个字符都被服务端接受', () => {
    for (const ch of MEET_CODE_ALPHABET) {
      const code = ch.repeat(MEET_CODE_LEN);
      expect(re.test(code), `字符 ${ch} 在客户端表里,服务端却不认`).toBe(true);
    }
  });

  it('长度必须正好 MEET_CODE_LEN', () => {
    const body = MEET_CODE_ALPHABET.slice(0, MEET_CODE_LEN);
    expect(re.test(body.slice(0, -1))).toBe(false);
    expect(re.test(body + MEET_CODE_ALPHABET[0])).toBe(false);
  });

  it('易混字符 0 1 I O 两边都不收', () => {
    for (const ch of '01IO') {
      expect(MEET_CODE_ALPHABET.includes(ch), `${ch} 混进客户端字母表了`).toBe(false);
      expect(re.test(ch.repeat(MEET_CODE_LEN)), `服务端收了 ${ch}`).toBe(false);
    }
  });

  it('小写不收 —— 服务端只在 toUpperCase 之后校验,收了就等于两个码指向同一个房', () => {
    expect(re.test('abcdefghj')).toBe(false);
  });

  it('熵不低于 45 bit', () => {
    const bits = Math.log2(MEET_CODE_ALPHABET.length) * MEET_CODE_LEN;
    expect(
      bits,
      `会议码只有 ${bits.toFixed(1)} bit。链接即凭证,熵是唯一的防线 —— ` +
        `缩短长度或删字符前先想清楚被扫穿的后果(陌生人直接出现在别人的摄像头里)。`,
    ).toBeGreaterThanOrEqual(45);
  });
});

describe('normalizeMeetCode — 用户会粘进来什么', () => {
  const code = newMeetCode();

  it('整条邀请链接:从 ?room= 里挖,而不是把 https/meet 的字母拼成假码', () => {
    expect(normalizeMeetCode(`https://cuberoot.me/zh/meet?room=${code}`)).toBe(code);
    expect(normalizeMeetCode(`https://cuberoot.me/meet?players=1&room=${code}#x`)).toBe(code);
  });

  it('裸码带空格 / 小写 / 连字符都能救回来', () => {
    const spaced = `${code.slice(0, 3)} ${code.slice(3, 6)}-${code.slice(6)}`.toLowerCase();
    expect(normalizeMeetCode(spaced)).toBe(code);
  });

  it('没有 room= 的链接不会被拼出一个假码来', () => {
    // 只保证不等于任何合法码:能过 isMeetCode 就意味着用户会被送进一个陌生房间。
    expect(isMeetCode(normalizeMeetCode('https://cuberoot.me/'))).toBe(false);
  });

  it('生成的码自己认得', () => {
    expect(isMeetCode(code)).toBe(true);
    expect(isMeetCode(code.slice(0, -1))).toBe(false);
    expect(isMeetCode(code.toLowerCase())).toBe(false);
  });
});
