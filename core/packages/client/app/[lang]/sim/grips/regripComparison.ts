import { findGripMarks, type GripPose } from '@cuberoot/shared/alg-notation';
import { grips } from './catalog';

type Label = readonly [string, string];
type Hands = Record<'L' | 'R', GripPose>;

const wristMotion: Record<GripPose, Label> = {
  up: ['向上转四分之一圈，拇指从前面转向顶面', 'rolls up a quarter turn, taking the thumb from the front to the top'],
  down: ['向下转四分之一圈，拇指从前面转向底面', 'rolls down a quarter turn, taking the thumb from the front to the bottom'],
  home: ['从上握向下转四分之一圈，拇指从顶面回到前面', 'rolls down a quarter turn from up grip, bringing the thumb from the top back to the front'],
  half: ['向上转半圈，拇指经过顶面绕到背面', 'rolls up a half turn, taking the thumb over the top to the back'],
  halfDown: ['向下转半圈，拇指经过底面绕到背面', 'rolls down a half turn, taking the thumb under the bottom to the back'],
};

function gripLabel(pose: Hands): Label {
  return [`右手${grips[pose.R][0]} · 左手${grips[pose.L][0]}`,
    `Right ${grips[pose.R][1].toLowerCase()} · left ${grips[pose.L][1].toLowerCase()}`];
}

export function regripComparison(example: string) {
  const marks = findGripMarks(example);
  const start: Hands = { R: 'home', L: 'home' };
  // A home mark needs a visibly different entry grip on the selected hand.
  for (const { side, grip } of marks) if (grip === 'home') start[side] = 'up';
  const pose = { ...start };
  const steps = marks.map(({ side, grip }, index) => {
    const right = side === 'R', hand = right ? '右' : '左', other = right ? '左' : '右';
    const handEn = right ? 'right' : 'left', otherEn = right ? 'left' : 'right';
    const support = grips[pose[right ? 'L' : 'R']];
    const [zh, en] = wristMotion[grip];
    const sequence = marks.length > 1;
    const prefix = sequence ? (index === 0 ? '先看' : '再看') : '';
    const prefixEn = sequence ? (index === 0 ? 'First the' : 'Then the') : 'The';
    pose[side] = grip;
    return {
      watch: [`${prefix}${hand}腕${zh}，${other}手保持${support[0]}。`,
        `${prefixEn} ${handEn} wrist ${en} while the ${otherEn} hand stays in ${support[1].toLowerCase()} grip.`] as Label,
      moving: [`${hand}腕 → ${grips[grip][0]} · ${other}手${support[0]}`, `${right ? 'Right' : 'Left'} regrips · ${otherEn} stays ${support[1].toLowerCase()}`] as Label,
      seated: gripLabel(pose),
    };
  });
  return { start, startLabel: gripLabel(start), steps, after: { ...pose } };
}

export type RegripComparison = ReturnType<typeof regripComparison>;
