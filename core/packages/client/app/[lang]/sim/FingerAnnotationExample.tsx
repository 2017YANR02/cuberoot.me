'use client';

import { useT } from '@/hooks/useT';

export const pinExampleHref = '/sim?puzzle=3&alg=R%5BR2%3A%40C%3EQ%5D&anchor=start';

export default function FingerAnnotationExample() {
  const t = useT();
  return <>
    <code>{'R[R2:@C>Q]'}</code>
    <p>{t('右手食指先贴住顶面的 C。转动右层时，指尖跟着同一张贴纸一起转到背面的 Q。', 'Place your right index finger on C on the top face. As you turn the right layer, keep your fingertip on that sticker until it reaches Q on the back face.')}</p>
    <dl>
      <dt><code>R</code></dt><dd>{t('开头的 R 表示转右层。正对魔方右面看，顺时针转 90°。', 'The first R is the move. Looking straight at the right face, turn that layer 90° clockwise.')}</dd>
      <dt><code>[ ]</code></dt><dd>{t('左括号开始说明这一步的指法，右括号结束说明。', 'The opening bracket starts the finger instructions for this move. The closing bracket ends them.')}</dd>
      <dt><code>R2</code></dt><dd>{t('括号里的 R 表示右手。手指从拇指开始数，2 是食指，所以 R2 在这里读作「右手食指」。', 'Inside the brackets, R means right hand. Count from the thumb as 1. The index finger is 2, so R2 here means right index finger.')}</dd>
      <dt><code>:</code></dt><dd>{t('冒号把手指和动作分开。左边写哪根手指，右边写它怎么动。', 'The colon separates the finger on the left from its action on the right.')}</dd>
      <dt><code>@</code></dt><dd>{t('指尖贴住后面字母指定的贴纸，转动时一直贴在同一点。', 'Pin your fingertip to the sticker named next. Keep it on the same spot throughout the turn.')}</dd>
      <dt><code>C</code></dt><dd>{t('起点。找到顶面、正面和右面交会的角块，指尖贴在它朝上的那张贴纸上。', 'The starting position. Find the corner where the top, front and right faces meet. Touch its upward-facing sticker.')}</dd>
      <dt><code>{'>'}</code></dt><dd>{t('读作「到」。左边是贴纸的起点，右边是它随右层转动后到达的位置。', 'Read this as “to”. The left letter gives the starting position and the right letter gives the position after the turn.')}</dd>
      <dt><code>Q</code></dt><dd>{t('终点。转完后，这张贴纸位于右后上角，朝向背面。', 'The end position. After the turn, the sticker is on the upper back right corner, facing the back.')}</dd>
    </dl>
    <p>{t('从 C 做一次 R，终点就确定是 Q，因此也可简写为', 'An R turn takes C to Q, so you can omit the endpoint and write')} <code>{'R[R2:@C]'}</code>{t('。输入时整条记号连写。', '. Type the notation without spaces.')}</p>
  </>;
}
