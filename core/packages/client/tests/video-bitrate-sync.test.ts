// 视频码率跨包耦合守卫:服务端按 PER_STREAM_MBPS 守带宽预算,客户端按 VIDEO_MAX_BITRATE
// 真发流 —— 这是同一个数的两个副本,而两边在不同的包里,谁也不会 import 谁。
//
// 为什么必须守:两个数一旦分叉,失败是**静默**的,没有任何报错。
//   客户端 > 服务端  → 服务端按低估值算带宽,放进来的房间实际推流超出实例峰值,
//                      表现是所有房间一起卡顿丢帧,而监控上「预算还没满」。
//   客户端 < 服务端  → 服务端高估占用,明明还有带宽却拒发 token,用户看到
//                      「服务器视频带宽已满」但服务器其实闲着。
// 两种都不会有人报 bug —— 只会觉得「这功能不好用」。
//
// 顺带钉住第三处:VideoStrip 的 videoEncoding 必须引用 VIDEO_MAX_BITRATE 这个常量,
// 不许就地写一个数字字面量(那样改常量根本不生效,是最容易犯的一种)。
//
// CI 跑 vitest(server 包无测试集),故跨包扫源码当红灯。
// guard-registry: tracked at /dev/guards (app/[lang]/dev/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { workspaceFixturePath } from './workspace-fixture-path';

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/client/tests
const CLIENT = join(HERE, '..');
const SERVER_ROUTE = workspaceFixturePath('@cuberoot/server', 'src', 'routes', 'video_rooms.ts');
const CLIENT_API = join(CLIENT, 'lib', 'video-room-api.ts');
// 连接参数是 /timer 对战房与 /meet 会议室共用的一份(两边只有授权方式不同)。
const VIDEO_STRIP = join(CLIENT, 'components', 'video', 'video-call.ts');

/** 去掉数字字面量里的下划线分隔符(3_000_000)再转数。 */
function num(raw: string): number {
  return Number(raw.replace(/_/g, ''));
}

describe('video bitrate — server budget and client publish must agree', () => {
  const serverSrc = readFileSync(SERVER_ROUTE, 'utf8');
  const clientSrc = readFileSync(CLIENT_API, 'utf8');
  const stripSrc = readFileSync(VIDEO_STRIP, 'utf8');

  it('both constants are still declared where the guard expects them', () => {
    expect(serverSrc, 'server route lost PER_STREAM_MBPS').toMatch(/const PER_STREAM_MBPS\s*=\s*[\d_]+\s*;/);
    expect(clientSrc, 'client api lost VIDEO_MAX_BITRATE').toMatch(/VIDEO_MAX_BITRATE\s*=\s*[\d_]+\s*;/);
  });

  it('client bitrate (bps) equals server budget unit (Mbps) × 1e6', () => {
    const mbps = num(/const PER_STREAM_MBPS\s*=\s*([\d_]+)\s*;/.exec(serverSrc)![1]);
    const bps = num(/VIDEO_MAX_BITRATE\s*=\s*([\d_]+)\s*;/.exec(clientSrc)![1]);

    expect(
      bps,
      `码率两处不一致:server PER_STREAM_MBPS=${mbps} Mbps,client VIDEO_MAX_BITRATE=${bps} bps。\n` +
        `服务端按前者守带宽预算、客户端按后者真发流,分叉会静默地要么超卖带宽(全体卡顿),` +
        `要么白拒房间(报「带宽已满」但服务器闲着)。改一个必须同时改另一个。`,
    ).toBe(mbps * 1_000_000);
  });

  it('screen-share bitrate agrees too — it is an EXTRA stream outside the n*(n-1) model', () => {
    // 屏幕共享不在摄像头那个二次项里,是额外的 (n-1) 一路。服务端按 SCREEN_SHARE_MBPS
    // 给它预留带宽,客户端按 SCREEN_SHARE_MAX_BITRATE 真发 —— 分叉同样是静默超发/白拒。
    const mbps = Number(/const SCREEN_SHARE_MBPS\s*=\s*([\d.]+)\s*;/.exec(serverSrc)![1]);
    const bps = num(/SCREEN_SHARE_MAX_BITRATE\s*=\s*([\d_]+)\s*;/.exec(clientSrc)![1]);
    expect(
      bps,
      `屏幕共享码率两处不一致:server ${mbps} Mbps,client ${bps} bps。`,
    ).toBe(mbps * 1_000_000);
  });

  it('the shared room options publish via the constant, not an inline number', () => {
    const enc = /videoEncoding:\s*\{[^}]*\}/.exec(stripSrc)?.[0] ?? '';
    expect(enc, 'components/video/video-call.ts 没有 videoEncoding 配置了?').not.toBe('');
    expect(
      enc,
      `LIVEKIT_ROOM_OPTIONS 的 maxBitrate 必须写 VIDEO_MAX_BITRATE,不能就地写数字 —— ` +
        `写死了改常量不生效,而服务端仍按常量算预算。实际:${enc}`,
    ).toContain('VIDEO_MAX_BITRATE');
  });
});
