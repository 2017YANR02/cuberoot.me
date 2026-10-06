/**
 * 摄像头切换 —— 只做一件事:前置 ↔ 后置。纯函数,不碰 DOM,好让它能被测到
 * (真正调 restartTrack 的那几行在 components/video/VideoTiles.tsx 里)。
 *
 * 判据是「这颗摄像头有没有朝向」:手机、平板报得出 user / environment,桌面摄像头没有
 * 「朝向」这回事 —— 于是切换按钮在桌面上自动不出现,这正是我们要的。
 *
 * 曾经还有一条「桌面按 deviceId 顺序轮换」的路,删了。浏览器报的 videoinput 条目里绝大多数
 * 不是你想切过去的摄像头:实测一台装了直播软件的 Windows 机器报 7 个 —— 1 个真摄像头
 * 加上 WebcastMate、vMix ×4、OBS 这六个虚拟摄像头,groupId 各不相同,按硬件去重也去不掉;
 * 而几乎每台带 Windows Hello 的机器还会多报一路红外镜头,切过去是一片黑白噪点。
 * 要在桌面上选摄像头,该做的是一个带标签的下拉,不是轮换 —— 在那之前,不给按钮。
 */

export type CameraFacing = 'user' | 'environment';

/** 当前采集参数,取自 MediaStreamTrack.getSettings()。 */
export interface CameraSettings {
  facingMode?: string;
}

/** 采集能力,取自 MediaStreamTrack.getCapabilities()。 */
export interface CameraCapabilities {
  facingMode?: string[];
}

/**
 * 画面该不该镜像,看的是「是不是后置」。前置(以及所有没有朝向概念的桌面摄像头)镜像 ——
 * 不镜像的自拍会让人对不准手和魔方的左右;后置拍的是外部世界,镜像了反而是错的(字全反)。
 */
export function facingOf(settings: CameraSettings | undefined): CameraFacing {
  return settings?.facingMode === 'environment' ? 'environment' : 'user';
}

/** settings 里报得出朝向。left / right 是规范里两个罕见值,不当作可翻面。 */
export function hasFacing(settings: CameraSettings | undefined): boolean {
  return settings?.facingMode === 'user' || settings?.facingMode === 'environment';
}

/**
 * 这颗摄像头能不能翻面 —— 决定切换按钮出不出现。两个来源任一报得出朝向就算:
 *
 *   getSettings().facingMode      Chrome / Android 一定有。
 *   getCapabilities().facingMode  Safari 那边 settings 是否填 facingMode 没人验证过
 *                                 (MDN browser-compat-data 里 safari / safari_ios 都是
 *                                 null = 未知),所以再问一次能力表兜底。
 *
 * 桌面摄像头和虚拟摄像头两处都报不出,按钮因此在那里不出现。
 */
export function canFlipCamera(
  settings: CameraSettings | undefined,
  caps: CameraCapabilities | undefined,
): boolean {
  if (hasFacing(settings)) return true;
  return !!caps?.facingMode?.some((f) => f === 'user' || f === 'environment');
}

/**
 * 翻到另一面。参数是**我们自己记着的**当前朝向,不是每次现从 settings 读 —— 万一某个浏览器
 * 的 settings 里没有 facingMode(能力表却说有前后置),现读会永远拿不到值、翻不动。
 * 只带 facingMode,**不带 deviceId**:两个一起给等于同时要求「后置」和「就是这一颗镜头」,
 * 必然冲突。
 */
export function oppositeFacing(current: CameraFacing): CameraFacing {
  return current === 'user' ? 'environment' : 'user';
}
