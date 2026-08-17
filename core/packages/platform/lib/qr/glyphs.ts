import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as opentype from "opentype.js";

// 把记法文本转成矢量轮廓(<path>),让母版的公式在任何查看器/印刷厂都精确显示
// JetBrains Mono,不依赖字体加载。坐标单位 = 传入的 fontSize(卡片里用 mm)。

type Font = ReturnType<typeof opentype.parse>;

let fontPromise: Promise<Font | null> | null = null;

async function loadFont(): Promise<Font | null> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const file = path.join(process.cwd(), "public", "fonts", "jetbrains-mono-500.ttf");
        const buf = await readFile(file);
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        return opentype.parse(ab);
      } catch {
        return null;
      }
    })();
  }
  return fontPromise;
}

// 返回居中放置所需的 path d + 文本宽度;失败返回 null(调用方回退到 <text>)
export async function movesPath(
  text: string,
  fontSize: number,
): Promise<{ d: string; width: number } | null> {
  const font = await loadFont();
  if (!font || !text.trim()) return null;
  try {
    const p = font.getPath(text, 0, 0, fontSize); // 基线在 y=0
    const d = p.toPathData(3);
    if (!d) return null;
    return { d, width: font.getAdvanceWidth(text, fontSize) };
  } catch {
    return null;
  }
}
