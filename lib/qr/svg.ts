import QRCode from "qrcode";

// 魔方六面配色,中心 logo 用(打乱面的视觉效果,比单色更"魔方")
const CUBE_FACES = [
  "#C41E3A", "#FFFFFF", "#0051BA",
  "#FF8A00", "#FFD500", "#009E60",
  "#FFFFFF", "#C41E3A", "#FFD500",
];

export type QrSvgOptions = {
  fg?: string;      // 码点颜色,默认品牌色
  bg?: string;      // 背景
  logo?: boolean;   // 中心嵌魔方 logo
  margin?: number;  // 静默区(模块数),默认 4(QR 规范)
  radius?: number;  // 码点圆角(0..0.5),默认 0.18
};

// 自绘 SVG:用 H 级纠错拿矩阵,品牌色码点 + 中心魔方 logo。
// 矢量、可缩放、可直接 inline 或下载,打印 2x4cm 卡片无锯齿。
export function qrSvg(text: string, opts: QrSvgOptions = {}): string {
  const fg = opts.fg ?? "#2A5DF4";
  const bg = opts.bg ?? "#FFFFFF";
  const margin = opts.margin ?? 4;
  const radius = opts.radius ?? 0.18;
  const withLogo = opts.logo ?? true;

  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const N = qr.modules.size;
  const data = qr.modules.data;
  const dim = N + margin * 2;

  // 中心 logo 清空区(模块索引空间 0..N-1),H 级纠错容忍 ~30% 遮挡
  let clearFrom = -1;
  let clearTo = -1;
  if (withLogo) {
    let span = Math.round(N * 0.3);
    span = Math.max(5, Math.min(N - 2, span));
    if (span % 2 === 0) span += 1;
    const start = Math.floor((N - span) / 2);
    clearFrom = start;
    clearTo = start + span - 1;
  }

  const rects: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!data[r * N + c]) continue;
      if (withLogo && r >= clearFrom && r <= clearTo && c >= clearFrom && c <= clearTo) continue;
      rects.push(
        `<rect x="${margin + c}" y="${margin + r}" width="1" height="1" rx="${radius}" ry="${radius}"/>`,
      );
    }
  }

  let logoSvg = "";
  if (withLogo) {
    const span = clearTo - clearFrom + 1;
    const pad = 0.6;
    const bx = margin + clearFrom - pad;
    const bsize = span + pad * 2;
    const inset = 0.45;
    const cubeX = margin + clearFrom + inset;
    const cubeY = margin + clearFrom + inset;
    const cubeSize = span - inset * 2;
    const cell = cubeSize / 3;
    const gap = cell * 0.14;
    const cells: string[] = [];
    for (let i = 0; i < 9; i++) {
      const cr = Math.floor(i / 3);
      const cc = i % 3;
      const x = cubeX + cc * cell + gap / 2;
      const y = cubeY + cr * cell + gap / 2;
      const s = cell - gap;
      cells.push(
        `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${s.toFixed(3)}" height="${s.toFixed(3)}" rx="${(s * 0.16).toFixed(3)}" fill="${CUBE_FACES[i]}" stroke="#11111A" stroke-width="${(cell * 0.05).toFixed(3)}"/>`,
      );
    }
    logoSvg =
      `<rect x="${bx.toFixed(3)}" y="${bx.toFixed(3)}" width="${bsize.toFixed(3)}" height="${bsize.toFixed(3)}" rx="${(bsize * 0.18).toFixed(3)}" fill="${bg}"/>` +
      `<rect x="${(cubeX - gap / 2).toFixed(3)}" y="${(cubeY - gap / 2).toFixed(3)}" width="${(cubeSize + gap).toFixed(3)}" height="${(cubeSize + gap).toFixed(3)}" rx="${(cubeSize * 0.12).toFixed(3)}" fill="#11111A"/>` +
      cells.join("");
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="二维码">` +
    `<rect width="${dim}" height="${dim}" fill="${bg}"/>` +
    `<g fill="${fg}">${rects.join("")}</g>` +
    logoSvg +
    `</svg>`
  );
}
