/**
 * 摄像头切换 —— 「下一个摄像头是哪个」这一个决策。纯函数,不碰 DOM,边界全在这里收,
 * 好让它能被测到(真正调 restartTrack 的那几行在 VideoStrip 里)。
 *
 * 两条路,由**当前轨道自己报的** facingMode 决定走哪条:
 *   报得出 user / environment(手机、平板)→ 翻面。一次点击 = 前后互换,和所有视频 App 一致。
 *   报不出(桌面摄像头没有「朝向」这回事)→ 按 deviceId 顺序轮换,插了两个摄像头的台式机也能换。
 *
 * 手机上**不能**走 deviceId 轮换:Android 会把主摄 / 广角 / 长焦 / 深度都列成独立 videoinput,
 * 轮一圈要点四五次,中间还会停在没法用的深度相机上。反过来桌面也不能走 facingMode ——
 * 那里所有摄像头都匹配不上任何 facing,约束直接失败。所以必须按设备实际情况分流,不能二选一写死。
 */
import type { VideoCaptureOptions } from 'livekit-client';

export type CameraFacing = 'user' | 'environment';

/** 当前采集参数,取自 MediaStreamTrack.getSettings() 的两个字段。 */
export interface CameraSettings {
  facingMode?: string;
  deviceId?: string;
}

/** enumerateDevices 给的 videoinput 里我们用得上的三个字段。 */
export interface CameraDevice {
  deviceId: string;
  groupId?: string;
}

/**
 * 真正「切得过去」的摄像头。浏览器报的 videoinput 条目不都是另一个摄像头:
 *
 *   - Windows Hello 的红外镜头和彩色镜头是同一颗模组的两路输出,groupId 相同。切过去是
 *     一片黑白噪点 —— 而绝大多数 Windows 笔记本都有这么一路,于是「只有一个摄像头」的人
 *     也会看到切换按钮。
 *   - deviceId 为空的是没拿到权限时的占位条目,根本切不过去。
 *
 * 所以按 groupId 去重、丢掉空 id。**只在 groupId 非空时才去重** —— iOS Safari 对所有
 * 设备都报空 groupId,一律去重会把前后置合成一个,手机上反而没得切了。
 */
export function usableCameras<T extends CameraDevice>(devices: readonly T[]): T[] {
  const seenGroups = new Set<string>();
  const out: T[] = [];
  for (const d of devices) {
    if (!d.deviceId) continue;
    if (d.groupId) {
      if (seenGroups.has(d.groupId)) continue;
      seenGroups.add(d.groupId);
    }
    out.push(d);
  }
  return out;
}

/**
 * 画面该不该镜像,看的是「是不是后置」。前置(以及所有没有朝向概念的桌面摄像头)镜像 ——
 * 不镜像的自拍会让人对不准手和魔方的左右;后置拍的是外部世界,镜像了反而是错的(字全反)。
 */
export function facingOf(settings: CameraSettings | undefined): CameraFacing {
  return settings?.facingMode === 'environment' ? 'environment' : 'user';
}

/**
 * 下一个摄像头的采集约束;只有一个摄像头(或一个都枚举不到)时返回 null —— 调用方据此
 * 隐藏按钮,而不是给一个点了没反应的按钮。
 */
export function nextCamera(
  current: CameraSettings | undefined,
  cameras: readonly { deviceId: string }[],
): VideoCaptureOptions | null {
  if (cameras.length < 2) return null;

  const facing = current?.facingMode;
  if (facing === 'user' || facing === 'environment') {
    return { facingMode: facing === 'user' ? 'environment' : 'user' };
  }

  // 当前设备不在列表里(deviceId 拿不到 / 摄像头被拔了)就从头开始 —— 换到第一个总比
  // 什么都不做强,下一次点击就能接上正常轮换。
  const i = cameras.findIndex((d) => d.deviceId === current?.deviceId);
  return { deviceId: cameras[(i + 1) % cameras.length]!.deviceId };
}
