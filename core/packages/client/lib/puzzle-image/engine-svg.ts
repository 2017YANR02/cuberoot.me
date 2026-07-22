// 引擎矢量镜像(sim 的示意/BSP 导出器)输出尺寸调整。导出器产的是**贴拼图裁剪的
// 紧凑非方 viewBox**、width/height = 画布像素;而「图片尺寸(PX)」控件要的是方形输出。
//
// 把 root <svg> 的 width/height 钉成 size×size(preserveAspectRatio 默认 xMidYMid meet
// → 等比缩放居中、不拉伸变形)。这是图片尺寸控件对引擎路径的唯一落点,显示 / studio
// 预览 / SVG 下载三处共用同一份,免三份 replace 漂移(退役对照表 §2b「图片尺寸」)。
//
// PNG 下载不走这里:downloadPng 直接把 canvas 设成 imageSize² 再 contain-fit 原始
// engineSvg,天然等价方形 + meet。

/** engineSvg 的 root <svg> 宽高钉成 size×size(等比 meet 保比例)。找不到宽高属性则原样返回。 */
export function sizeEngineSvg(svg: string, size: number): string {
  return svg.replace(
    /<svg\b([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
    `<svg$1 width="${size}" height="${size}"`,
  );
}
