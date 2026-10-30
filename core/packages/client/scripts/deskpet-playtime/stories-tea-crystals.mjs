// Two quiet, detailed stories. The shared stage supplies the canonical Clawd
// geometry and the same eight-second clock used by every existing story.
export function registerTeaCrystals({ add, r, p, l, at, t, o, star, heart, skin, ink, cream, gold, pink, blue, purple }) {
  add('tea-time', '暖茶时刻', 'A little tea',
    '稳稳倒一杯热茶，吹开袅袅蒸汽，捧起来慢慢享受。',
    'Pour a little tea, blow the curling steam aside, and enjoy a quiet sip.', ({ a, v, crab }) => {
      const mint = '#A7C8A6', mintShade = '#638A77', porcelain = '#E1E9CC';
      const tea = '#C9833D', wood = '#9D6C50', woodLight = '#D6A777';
      const defs = '<defs><linearGradient id="pt33-porcelain" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F4F1D8"/><stop offset=".48" stop-color="#C6D9B8"/><stop offset="1" stop-color="#83A98F"/></linearGradient><linearGradient id="pt33-amber" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#F4C878"/><stop offset="1" stop-color="#B37439"/></linearGradient></defs>';

      // The low tray leaves the face and four feet readable. Separate inset,
      // bevel and grain are real shapes, not a rectangular backdrop.
      const tray = p('M-7 14.4H21v1H22v1.1H-8v-1.1h1z', wood)
        + r(-6.5, 14.45, 27, .38, woodLight)
        + r(-6.1, 15.05, 26.2, .35, '#B77F58')
        + r(-6, 16.5, 1.2, .45, wood) + r(18.8, 16.5, 1.2, .45, wood)
        + l('M-4.5 15.1H1m12.5 0h4', '#E7BE91', .14);
      const sweets = at(p('M0 0l2.3-.6L4 .1 1.7.8z', cream)
        + p('M0 0v1.6l1.7.8V.8z', '#DFCBA5')
        + p('M1.7.8L4 .1v1.5l-2.3.8z', '#BDAA84')
        + r(.4, .45, .26, .3, '#F6E9CB') + r(2.3, .9, .25, .25, '#F6E9CB'), 15.2, 12.8)
        + at(p('M-1 0h3v.6h1V2H2v.6h-3V2h-1V.6h1z', '#DDA46C')
          + r(-.8, .65, 2.7, .35, '#F0C994') + r(.35, 1.15, .35, .35, wood), -5.8, 12.25);

      // A stepped porcelain teapot. Its spout and the stream share a fixed
      // pouring pose from 24–36%; the stream never floats away from the spout.
      const teapot = at(l('M-2-.7H-3.8v2.9H-2', mintShade, .7)
        + p('M1.7-.9h1.2l1.2-1.4h1.1v1.2L3.7.8H2z', mintShade)
        + p('M1.7-1.1h1.2l1.1-1.3h1.2v.5L3.4.4H2z', porcelain)
        + p('M-2-1.5h4v.6h.7v3.1H1.8v.6h-3.6v-.6h-.9V-.9h.7z', 'url(#pt33-porcelain)')
        + r(-1.8, -1.8, 3.6, .5, mintShade) + r(-1.5, -2.3, 3, .55, porcelain)
        + r(-.45, -2.9, .9, .6, gold) + r(-1.5, -.7, .35, 2, cream)
        + l('M-.7.5l.7-.6.7.6-.7.6z', mintShade, .22)
        + r(-1.35, 2.15, 2.7, .25, gold), -2, 8.8);
      const potMotion = [[0, t()], [10, t()], [15, t(0, 0, -7)], [23, t(0, 0, 32)],
        [36, t(0, 0, 32)], [43, t(0, 0, -3)], [48, t()], [100, t()]];
      const pot = a(teapot, potMotion, '0px 10px');
      // Spout tip (-2+5.2, 8.8-2.4), rotated 32° around (0,10).
      const pour = v(a(l('M4.62 8.64C5.8 8.8 6.7 9.55 7.2 11.5', tea, .38)
        + l('M4.65 8.62C5.8 8.8 6.7 9.55 7.2 11.5', '#F9CE88', .13),
        [[0, o(0)], [24, o(0)], [25, o(.95)], [35, o(.95)], [37, o(0)]]), 24, 37);

      // The cup is lifted without tilting, keeping its open tea surface level.
      const cupPose = [[0, t()], [50, t()], [58, t(0, -1.35)], [64, t(0, -1.35)],
        [70, t(0, -1.15)], [75, t(0, -1.35)], [82, t(0, -1.35)], [90, t()], [100, t()]];
      const cup = p('M5 11.35h5v3H9v.55H6v-.55H5z', 'url(#pt33-porcelain)')
        + l('M10 11.9h1.25v1.65H10', mintShade, .48)
        + r(5, 11.1, 5, .48, mintShade)
        + r(5.45, 11.2, 4.1, .38, '#5C6D53')
        + a(r(5.5, 11.2, 4, .37, 'url(#pt33-amber)'),
          [[0, t(0, .22, 0, 1, .15) + o(0)], [24, t(0, .22, 0, 1, .15) + o(0)],
            [28, t(0, .15, 0, 1, .5) + o(1)], [38, t() + o(1)], [83, t() + o(1)], [93, t() + o(0)],
            [100, t(0, .22, 0, 1, .15) + o(0)]], '7.5px 11.2px')
        + r(5.35, 11.8, .3, 1.8, cream) + r(5.8, 14.15, 3.4, .25, mint)
        + l('M7 12.7l.5-.45.5.45-.5.45z', '#7D9C76', .2);
      const saucer = p('M4.4 14.85h6.2v.4h-.8v.35H5.2v-.35h-.8z', '#B7C6A2')
        + r(5.4, 14.85, 4.2, .18, cream);

      let steam = '';
      for (const [i, begin] of [39, 49, 60, 69].entries()) {
        const side = i % 2 ? 1 : -1;
        const curl = l('M0 0C-1-1.5 1.2-2.3.2-3.8S-.3-6 .5-6.9', '#E3B88C', .38)
          + l('M0 0C-1-1.5 1.2-2.3.2-3.8S-.3-6 .5-6.9', cream, .16);
        steam += a(at(curl, 6.3 + i % 3, 10.8), [[0, t() + o(0)], [begin, t(0, -.1, 0, .8, .65) + o(0)],
          [begin + 3, t(side * .3, -.7, 0, .9, .85) + o(.8)],
          [begin + 9, t(side * .7 + (i > 1 ? 1.8 : 0), -2.8, 0, 1.1, 1) + o(.5)],
          [begin + 16, t(side + (i > 1 ? 4 : 0), -4.7, 0, 1.2, 1.1) + o(0)], [100, t() + o(0)]], '7.5px 10px');
      }
      const breath = v(a(l('M9.8 10.1q2.8-.8 4.2-2.6m-3.5 3q3-.2 5-1.7', '#D8BB95', .24),
        [[0, o(0)], [61, o(0)], [64, o(.8)], [68, o(0)], [100, o(0)]]), 61, 69);
      const warmth = v(a(at(heart, 15.1, 3.5, .48), [[0, t() + o(0)], [73, t(0, .5, 0, .6) + o(0)],
        [77, t(0, -.3) + o(.9)], [84, t(0, -1.4) + o(.8)], [90, t(0, -2.4, 0, .8) + o(0)]]), 73, 90);
      const actor = crab([[0, t()], [13, t(0, .2, -1)], [24, t(0, 0, -2)], [38, t(0, 0, -2)],
        [48, t()], [59, t(0, .05)], [71, t(0, .25, 0, 1.018, .98)], [80, t()], [100, t()]],
        v(r(3, 10.8, 1.4, .45, '#E9A48B') + r(10.6, 10.8, 1.4, .45, '#E9A48B'), 73, 89), {
          left: [[0, t()], [16, t(0, 0, -9)], [23, t(0, 0, 32)], [36, t(0, 0, 32)], [47, t()], [100, t()]],
          right: [[0, t()], [50, t()], [58, t(-2.7, -.3, 12)], [82, t(-2.7, -.3, 12)], [90, t()], [100, t()]],
          eyes: [[0, t()], [14, t(-.35, .3)], [24, t(0, .5)], [40, t(.35, .45)], [52, t(0, .3)],
            [60, t(0, 0, 0, 1, .8)], [69, t()], [91, t()], [94, t(0, 0, 0, 1, .1)], [96, t()], [100, t()]],
          mood: 'happy', moodAt: 73, moodEnd: 88,
        });
      return defs + actor + tray + sweets + saucer + pot + pour
        + a(cup + steam, cupPose, '7.5px 11.3px') + breath + warmth;
    }, .78);

  add('crystal-resonance', '水晶共鸣', 'Crystal resonance',
    '轻敲一颗水晶，光沿着晶簇流动，在头顶合奏出一枚小小光立方。',
    'One gentle tap sends light through the crystals, which gather around a little luminous cube.', ({ a, v, crab }) => {
      const lavender = '#B8A2F0', violet = '#7568B7', ice = '#D8F4F5', aqua = '#82D7DA';
      const defs = '<defs><linearGradient id="pt34-crystal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#EAFDFA"/><stop offset=".42" stop-color="#B1DDEE"/><stop offset="1" stop-color="#9B85D5"/></linearGradient><linearGradient id="pt34-gold" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFF2B1"/><stop offset="1" stop-color="#DBA65E"/></linearGradient></defs>';
      const outline = 'M0-4.5l2.2 2.7v4.2L0 5l-2.2-2.6v-4.2z';
      const crystal = p(outline, 'url(#pt34-crystal)')
        + p('M0-4.5v5L-2.2-1.8z', ice)
        + p('M0-4.5l2.2 2.7L0 .5z', '#C4B7F0')
        + p('M-2.2-1.8L0 .5v4.5l-2.2-2.6z', aqua)
        + p('M2.2-1.8L0 .5v4.5l2.2-2.6z', lavender)
        + p('M0 .5l1.05-1.8L0-3.15-1.05-1.3z', '#E4F9F7')
        + l(outline, violet, .13)
        + l('M-1.6-1.9l.75-1m-.9 2.2v2.3', cream, .18)
        + l('M0 .7v2.5', '#F1E8FF', .16);
      const ring = l('M-4 0l2-1.35h4L4 0 2 1.35h-4z', '#A1DADB', .2);
      const glow = p(outline, cream);
      const lowLeft = [[0, t(-3.6, 1, -12, .86)], [12, t(-3.6, .75, -12, .86)],
        [23, t(-3.6, 1, -12, .86)], [26, t(-4.3, .35, -21, .86)], [32, t(-3.5, .9, -9, .86)],
        [39, t(-3.6, 1, -12, .86)], [48, t(-3.6, 1, -12, .86)],
        [60, t(-1.5, -5, -25, .92)], [69, t(-1.5, -5.35, -25, .92)],
        [78, t(-1.5, -5, -25, .92)], [93, t(-3.6, 1, -12, .86)], [100, t(-3.6, 1, -12, .86)]];
      const high = [[0, t(7.5, -7.5, 0, 1.08)], [12, t(7.5, -7.9, 0, 1.08)],
        [29, t(7.5, -7.5, 0, 1.08)], [34, t(7.5, -8.25, 0, 1.12)], [41, t(7.5, -7.5, 0, 1.08)],
        [48, t(7.5, -7.5, 0, 1.08)], [60, t(7.5, -11.3, 0, 1)], [69, t(7.5, -11.55, 0, 1)],
        [78, t(7.5, -11.3, 0, 1)], [93, t(7.5, -7.5, 0, 1.08)], [100, t(7.5, -7.5, 0, 1.08)]];
      const lowRight = [[0, t(18.6, 1, 12, .86)], [12, t(18.6, 1.3, 12, .86)],
        [36, t(18.6, 1, 12, .86)], [41, t(19.1, .4, 20, .9)], [47, t(18.6, 1, 12, .86)],
        [49, t(18.6, 1, 12, .86)], [60, t(16.5, -5, 25, .92)], [69, t(16.5, -5.35, 25, .92)],
        [78, t(16.5, -5, 25, .92)], [93, t(18.6, 1, 12, .86)], [100, t(18.6, 1, 12, .86)]];
      const pulse = (beat) => a(glow, [[0, o(0)], [beat, o(0)], [beat + 1.8, o(.78)],
        [beat + 6, o(.1)], [beat + 11, o(0)], [100, o(0)]]);
      const stones = a(crystal + pulse(23), lowLeft) + a(crystal + pulse(31), high) + a(crystal + pulse(38), lowRight);

      let ripples = '';
      for (const [x, y, beat] of [[-3.6, 1, 24], [7.5, -7.5, 32], [18.6, 1, 40]]) {
        ripples += a(at(ring, x, y), [[0, t(0, 0, 0, .2) + o(0)], [beat, t(0, 0, 0, .2) + o(.85)],
          [beat + 5, t(0, 0, 0, 1.2) + o(.55)], [beat + 11, t(0, 0, 0, 1.55) + o(0)],
          [100, t(0, 0, 0, .2) + o(0)]], `${x}px ${y}px`);
      }
      const arc = v(a(l('M-2-1.3Q1.5-6.9 6-7.4M9-7.4Q14-6.9 17.1-1.3', '#D5B97B', .22),
        [[0, o(0)], [27, o(0)], [31, o(.6)], [42, o(.6)], [48, o(0)], [100, o(0)]]), 27, 49);
      const note = (x, y, begin) => v(a(at(star(cream), x, y, .34),
        [[0, o(0) + t(0, 0, 0, .4)], [begin, o(0) + t(0, 0, 0, .4)],
          [begin + 2, o(.95) + t()], [begin + 6, o(0) + t(0, -.7, 0, .7)], [100, o(0) + t(0, 0, 0, .4)]]), begin, begin + 7);

      // The striker pivots at the left hand. Only the first crystal is tapped;
      // the other two answer in sequence before all three form the final chord.
      const mallet = l('M1 10L-1.8 3.4', '#BD956B', .55)
        + l('M1 9.8L-1.8 3.4', '#E2C998', .16)
        + p('M-3.05 2.3l1.7-.75 1.05 2.3-1.7.8z', 'url(#pt34-gold)')
        + l('M-2.8 2.5l1.2-.5', cream, .18);
      const strike = [[0, t(0, 0, 35)], [10, t(0, 0, 35)], [17, t(0, 0, 61)],
        [23, t()], [26, t(0, 0, 12)], [31, t(0, 0, 7)], [40, t(0, 0, 35)], [100, t(0, 0, 35)]];
      const web = v(a(l('M-.1-6L7.5-10.1 15.1-6 7.5-2.9zM7.5-10.1v7.2M-.1-6h15.2', '#A1DADB', .17),
        [[0, o(0)], [54, o(0)], [61, o(.75)], [75, o(.65)], [83, o(0)], [100, o(0)]]), 54, 84);
      const cube = p('M0-2.1L2.65-.65 0 .8-2.65-.65z', '#FFF0BE')
        + p('M-2.65-.65L0 .8v3L-2.65 2.3z', '#E1B36F')
        + p('M2.65-.65L0 .8v3l2.65-1.5z', '#F7D68E')
        + l('M-2.3-.66L0 .58 2.3-.66M0 .8v2.6', '#FFF7D7', .17)
        + p('M-.6-.7L0-1.05.6-.7 0-.35z', '#F5D989');
      const chord = v(a(at(cube, 7.5, -5.5), [[0, t(0, 1, 0, .2) + o(0)],
        [57, t(0, 1, 0, .2) + o(0)], [63, t(0, 0, 0, 1.08) + o(1)],
        [68, t(0, -.25) + o(1)], [76, t(0, 0) + o(1)], [84, t(0, 1, 0, .2) + o(0)],
        [100, t(0, 1, 0, .2) + o(0)]], '7.5px -5.5px'), 57, 85);
      let glints = '';
      for (const [x, y, begin, color] of [[-6, -7, 61, gold], [20.5, -8, 65, ice], [2, -15, 69, pink], [13, -15.5, 73, cream]]) {
        glints += v(a(at(star(color), x, y, .35), [[0, t(0, 0, 0, .2) + o(0)],
          [begin, t(0, 0, 0, .2) + o(0)], [begin + 2, t(0, 0, 0, 1.15) + o(1)],
          [begin + 5, t() + o(.85)], [begin + 9, t(0, -.5, 0, .3) + o(0)],
          [100, t(0, 0, 0, .2) + o(0)]], `${x}px ${y}px`), begin, begin + 10);
      }
      const actor = crab([[0, t()], [17, t(0, .3)], [23, t()], [31, t()],
        [53, t()], [62, t(0, -.4)], [70, t(0, -.25)], [79, t()], [100, t()]], '', {
          left: strike,
          right: [[0, t()], [25, t(0, 0, -10)], [45, t()], [58, t(0, 0, -45)],
            [75, t(0, 0, -45)], [86, t()], [100, t()]],
          eyes: [[0, t(-.35, -.3)], [22, t(-.65, -.4)], [32, t(0, -.65)],
            [41, t(.65, -.4)], [53, t(0, -.6)], [88, t()], [95, t(-.35, -.3)], [100, t(-.35, -.3)]],
          mood: 'happy', moodAt: 63, moodEnd: 80,
        });
      return defs + web + arc + ripples + stones + note(1, -5.2, 28) + note(13.6, -5.2, 36)
        + chord + glints + actor + a(mallet, strike, '2px 10px');
    }, .69);
}
