import { continuousCornerRadii, toSvgPath, type Command } from '@2017yanr02/continuous-corners';

export type ChatBubbleTail = 'left' | 'right' | 'top' | 'bottom' | 'none';
export const BUBBLE_OUTSET = 8;

/** One closed outline, with library corners and a tangent-continuous tail. */
export function chatBubblePath(width: number, height: number, tail: ChatBubbleTail): string {
  if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 1e7 - 16)) return '';
  // Construct a top tail once, then rotate the whole outline to the requested edge.
  const sideways = tail === 'left' || tail === 'right';
  const w = sideways ? height : width;
  const h = sideways ? width : height;
  const radius = Math.min(6, w / 4, h / 4);
  const { commands } = continuousCornerRadii({ width: w, height: h, radii: [radius, radius, radius, radius] });
  const outline: Command[] = [];
  let previous = [0, 0];
  for (const command of commands) {
    const end = command.values.slice(-2);
    if (tail !== 'none' && command.op === 'L' && previous[1] === 0 && end[1] === 0 && previous[0] < w / 2 && end[0] > w / 2) {
      const center = w / 2;
      const half = Math.min(8, center - previous[0], end[0] - center);
      const depth = Math.min(BUBBLE_OUTSET, half);
      outline.push(
        { op: 'L', values: [center - half, 0] },
        { op: 'C', values: [center - half / 2, 0, center - half * .3, -depth * .65, center - half * .1, -depth * .9] },
        // These handles continue the side tangents; the center rounds off the tip.
        { op: 'C', values: [center - half / 30, -depth * (59 / 60), center + half / 30, -depth * (59 / 60), center + half * .1, -depth * .9] },
        { op: 'C', values: [center + half * .3, -depth * .65, center + half / 2, 0, center + half, 0] },
      );
    }
    outline.push(command);
    if (end.length) previous = end;
  }
  return toSvgPath(outline.map(command => {
    const values: number[] = [];
    for (let i = 0; i < command.values.length; i += 2) {
      const x = command.values[i], y = command.values[i + 1];
      const point = tail === 'left' ? [y, height - x]
        : tail === 'right' ? [width - y, x]
          : tail === 'bottom' ? [width - x, height - y] : [x, y];
      values.push(point[0] + BUBBLE_OUTSET, point[1] + BUBBLE_OUTSET);
    }
    return { op: command.op, values };
  }));
}
