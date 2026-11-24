type Label = readonly [string, string];
interface ContactCue {
  degrees: number;
  sticker: string;
  finger: Label;
}

export interface ContactStroke {
  view: readonly [pitch: number, yaw: number];
  cues: readonly ContactCue[];
}

export interface ContactComparison {
  reference: string;
  watch: Label;
  marked: ContactStroke;
  ordinary: ContactStroke;
}

function upperTurn(right: boolean, back: string, side: string): ContactComparison {
  const hand = right ? '右' : '左', other = right ? '左' : '右';
  const en = right ? 'Right' : 'Left', otherEn = right ? 'Left' : 'Right';
  const reference = right ? 'Up' : "U'p";
  return {
    reference,
    watch: [`从还原态起拨，留意最后 25°。标记动作的${hand}食指甲勾住背面上角 ${back}，${reference} 的${other}食指用指腹推侧面上角 ${side}。`,
      `From solved, watch the last 25°. The ${en.toLowerCase()} index nail hooks the upper back sticker ${back}. In ${reference}, the ${otherEn.toLowerCase()} index pad pushes the upper side sticker ${side}.`],
    marked: { view: [.20, right ? -2.40 : 2.40], cues: [
      { degrees: 0, sticker: back, finger: [hand + '食指指腹', en + ' index pad'] },
      { degrees: 65, sticker: back, finger: [hand + '食指甲', en + ' index nail'] },
    ] },
    ordinary: { view: [.20, right ? 2.25 : -2.25], cues: [
      { degrees: 0, sticker: side, finger: [other + '食指甲', otherEn + ' index nail'] },
      { degrees: 45, sticker: side, finger: [other + '食指转向指腹', otherEn + ' index rolls onto the pad'] },
      { degrees: 60, sticker: side, finger: [other + '食指指腹', otherEn + ' index pad'] },
    ] },
  };
}

function innerHalf(right: boolean, bottom: string, front: string, back: string, top: string): ContactComparison {
  const hand = right ? '右' : '左', en = right ? 'Right' : 'Left';
  const reference = right ? '2R2' : "2L2'";
  const view = [-.82, right ? -2.70 : 2.70] as const;
  return {
    reference,
    watch: [`从还原态看${hand}手。前 90°，无名指甲拨底面 ${bottom}，对照的无名指指腹拨背面 ${back}。后 90°，小指甲接前面 ${front}，对照的小指指腹接顶面 ${top}。`,
      `From solved, watch the ${en.toLowerCase()} hand. For the first 90°, compare the ring nail on ${bottom} (bottom) with the ring pad on ${back} (back). For the next 90°, compare the little fingernail on ${front} (front) with the little finger pad on ${top} (top).`],
    marked: { view, cues: [
      { degrees: 0, sticker: bottom, finger: [hand + '无名指甲', en + ' ring nail'] },
      { degrees: 90, sticker: front, finger: [hand + '小指甲', en + ' little fingernail'] },
    ] },
    ordinary: { view, cues: [
      { degrees: 0, sticker: back, finger: [hand + '无名指指腹', en + ' ring pad'] },
      { degrees: 90, sticker: top, finger: [hand + '小指指腹', en + ' little finger pad'] },
    ] },
  };
}

// Sticker identities are the solved cubelets' own facelets. They travel with the layer.
export const nailComparisons: Readonly<Record<string, ContactComparison | undefined>> = {
  U: upperTurn(true, 'B0', 'L1'),
  "U'": upperTurn(false, 'B1', 'R0'),
  "2R2'": innerHalf(true, 'D2', 'F2', 'B13', 'U2'),
  '2L2': innerHalf(false, 'D1', 'F1', 'B14', 'U1'),
};

function frontQuarter(order: 2 | 4, prime: boolean): ContactComparison {
  const move = prime ? "F'" : 'F';
  const thumb = prime ? '右' : '左', index = prime ? '左' : '右';
  const thumbEn = prime ? 'Right' : 'Left', indexEn = prime ? 'Left' : 'Right';
  const bottom = 'D' + (prime ? order - 1 : 0);
  const top = 'U' + (prime ? order * (order - 1) : order * order - 1);
  const yaw = prime ? -.55 : .55;
  return {
    reference: move,
    watch: [`从还原态看起拨。斜体用${thumb}拇指从底面${thumb}前角 ${bottom} 向上拨。普通转动用${index}食指从顶面${index}前角 ${top} 向下拨。描边跟随各自起拨的贴纸。`,
      `Watch the start from solved. The ${thumbEn.toLowerCase()} thumb pushes up from ${bottom} on the bottom front ${thumbEn.toLowerCase()}. The plain turn uses the ${indexEn.toLowerCase()} index to push down from ${top} on the top front ${indexEn.toLowerCase()}. Each outline follows its starting sticker.`],
    marked: { view: [-.80, yaw], cues: [
      { degrees: 0, sticker: bottom, finger: [thumb + '拇指起拨', thumbEn + ' thumb start'] },
    ] },
    ordinary: { view: [.80, -yaw], cues: [
      { degrees: 0, sticker: top, finger: [index + '食指起拨', indexEn + ' index start'] },
    ] },
  };
}

export const thumbComparisons: Record<2 | 4, Readonly<Record<string, ContactComparison | undefined>>> = {
  2: { F: frontQuarter(2, false), "F'": frontQuarter(2, true) },
  4: { F: frontQuarter(4, false), "F'": frontQuarter(4, true) },
};
