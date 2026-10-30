// Two eight-second stories drawn from the shared canonical Clawd geometry.
// Fixed pigments below belong to the illustrations, not application surfaces.
export function registerMoonRain({ add, r, p, l, at, t, o, star, skin, ink, cream, gold, blue }) {
  const copper = '#BD8055', copperLight = '#EFBE83', copperShade = '#795943';
  const teal = '#588D98', tealDark = '#315E70', tealLight = '#A3D4CC';
  const paper = '#FFF1D5', paperShade = '#D8BE94', moonLight = '#FFEAB1';
  const water = '#7BBACA', waterLight = '#BEECE1', waterShade = '#4D8FAD';

  add('moonlight-courier', '月亮邮差', 'Moonlight courier',
    '把贴着月亮邮票的信投进铜蓝邮筒。信封长出纸翅膀，飞向弯月，留下温柔的星光回信。',
    'Post a moon-stamped letter in a copper-blue mailbox. Paper wings carry it to the crescent, which answers with a gentle shower of stars.',
    ({ a, crab }) => {
      const envelope = r(14.3, 8.8, 4.6, 2.8, paperShade)
        + r(14.3, 8.8, 4.6, 2.45, paper)
        + l('M14.4 8.95l2.2 1.35 2.2-1.35', copper, .17)
        + l('M14.4 11.1l1.65-1.15m2.7 1.15-1.65-1.15', paperShade, .12)
        + r(17.85, 9.05, .65, .7, '#719BBA')
        + p('M18.23 9.14h.18v.1h-.13v.26h.13v.1h-.25v-.1h-.06v-.26h.13z', cream)
        + r(16.35, 10, .5, .5, '#D87964');

      // The letter and the right arm share the same lift. The letter then
      // flattens at the slot and slides into it while the hand stays outside.
      const armLift = [[0, t()], [7, t()], [12, t(.4, -1.1)],
        [20, t(2.3, -4.1)], [31, t(2.3, -4.1)], [39, t()],
        [53, t()], [61, t(.2, -1.3, -57)], [65, t(.2, -1.3, -39)],
        [69, t(.2, -1.3, -57)], [74, t(.2, -1.3, -39)], [81, t()],
        [92, t()], [100, t()]];
      const heldLetter = a(a(envelope,
        [[0, t() + o(1)], [20, t() + o(1)], [24, t(0, 0, 0, 1, .18) + o(1)],
          [29, t(3.4, 0, 0, .2, .18) + o(1)], [30, t(3.4, 0, 0, .2, .18) + o(0)],
          [91, t() + o(0)], [96, t() + o(1)], [100, t() + o(1)]], '16.6px 10.2px'),
        armLift, '13px 10px');
      const satchel = l('M2.5 6.5L-1.4 10.9', copperShade, .58)
        + p('M-3.6 10h4v4.5h-.5v.6h-3v-.6h-.5z', copperShade)
        + r(-3.45, 10.45, 3.65, 3.8, copper)
        + r(-3.45, 10.45, .4, 3.5, copperLight)
        + p('M-3.6 10h4v1.4h-.7v.6h-2.6v-.6h-.7z', '#DB9D69')
        + r(-2.15, 11.4, .85, .75, moonLight)
        + r(-1.95, 11.5, .45, .4, copperShade)
        + l('M-2.9 13.35h2.4', paperShade, .13);

      const postalFlag = a(l('M24.2 6.4V3.7', copper, .38)
          + p('M24 3.5h2.2v1.3h-2.2z', '#DF8B72')
          + r(24.2, 3.65, 1.8, .25, '#F3B794')
          + r(24.65, 3.95, .55, .55, cream),
        [[0, t(0, 0, 65)], [29, t(0, 0, 65)], [38, t(0, 0, -6)],
          [43, t()], [81, t()], [92, t(0, 0, 65)]], '24.2px 6.4px');

      const mailboxStand = r(20.05, 9.3, 1.4, 6.1, copperShade)
        + r(20.05, 9.3, .5, 5.8, copper)
        + r(19.1, 14.6, 3.35, .65, copper)
        + r(18.35, 15.2, 4.85, .55, copperShade)
        + r(18.35, 15.2, 4.85, .18, copperLight);
      const mailboxBody = p('M17.05 3.4v-.9h.8v-.75h1.15v-.45h3.2v.45h1.2v.75h.75v.9h.55v6h-.55v.6h-7.1v-.6h-.55v-6z', tealDark)
        + p('M17.6 3.45v-.8h.8v-.65h4v.65h.8v.8h.5v5.7h-.5v.35h-5.1v-.35h-.5v-5.7z', 'url(#pt36-mailbox)')
        + l('M17.9 4V3.2h.75v-.7h3.4', tealLight, .23)
        + r(17.6, 5.6, 5.7, 1.15, tealDark)
        + r(17.6, 5.6, 5.7, .22, copperLight)
        + r(17.9, 6.5, 5.15, .17, '#76B5B7')
        + r(17.75, 7.5, 5.6, .25, '#5C8F99')
        + r(19.2, 7.9, 2.55, 1.15, copperLight)
        + r(19.4, 8.1, 2.15, .72, paper)
        + l('M19.8 8.47h1.4', copperShade, .16)
        + r(17.3, 9.2, 6.7, .24, tealLight)
        + r(17.8, 8.3, .24, .24, copperLight)
        + r(23.05, 8.3, .24, .24, copperLight);
      const mailbox = mailboxStand + postalFlag + a(mailboxBody,
        [[0, t()], [30, t()], [32, t(-.16, 0, -1)], [34, t(.2, 0, 1.4)],
          [36, t(-.15, 0, -1)], [39, t()], [100, t()]], '20.7px 9.8px');

      const crescentShape = p('M1.5-17.4h3v.55H3.1v.65H1.85v.8h-.8v1.2H.5v2.4h.55v1.2h.8v.8H3.1v.65h1.4v.55h-3v-.55H.1v-.8h-.95v-1.05h-.6v-1.15h-.45v-1.7h.45v-1.15h.6v-1.05H.1v-.8h1.4z', copper)
        + p('M1.5-17.4h3v.55H3.1v.65H1.85v.8h-.8v1.2H.5v2.4h.55v1.2h.8v.8H3.1v.65h1.4v.55h-2.4v-.7H.65v-.8h-.9v-1.25h-.55v-2.5h.55v-1.25h.9v-.8h.85z', 'url(#pt36-moon)')
        + r(.15, -15.15, .42, 1.15, moonLight)
        + r(.7, -16.05, .55, .5, cream);
      const crescent = a(crescentShape,
        [[0, t()], [35, t(0, -.25, -2)], [60, t(0, 0, 2)],
          [73, t(0, -.3, -2)], [91, t()], [100, t()]], '1.5px -13.4px');
      const moonHalo = a('<circle cx="1.8" cy="-13.4" r="5.5" fill="url(#pt36-glow)"/>',
        [[0, o(0)], [56, o(0)], [64, o(1)], [77, o(.6)], [88, o(0)]]);

      // A winged envelope carries the postal theme; the two folded wings have
      // different phases so it banks naturally along its curved route.
      const nearWing = p('M-.5-.5L-4-4.7l.65 3.2 2.1 1.3z', '#EFE2C7')
        + p('M-.5-.5L-4-4.7-2-1.1z', paper)
        + l('M-3.7-4.25L-1-.65', paperShade, .14);
      const farWing = p('M.5-.5L3.5-4.2l-.35 2.65-1.85 1.2z', '#C8DEE1')
        + p('M.5-.5L3.5-4.2 1.9-1.1z', '#EEF4E7');
      const wingTrack = [[0, t()]];
      for (let n = 38; n <= 80; n += 3) wingTrack.push([n, t(0, 0, 0, 1, n % 6 === 2 ? .28 : 1)]);
      wingTrack.push([89, t()]);
      const airLetter = a(farWing, wingTrack, '.5px -.5px', 'linear')
        + a(nearWing, wingTrack.map(([n, css]) => [n === 0 || n === 89 ? n : n + .7, css.replace('1,0.28', '1,0.42')]), '-.5px -.5px', 'linear')
        + r(-1.75, -.55, 3.5, 2.25, paperShade)
        + r(-1.75, -.55, 3.5, 1.95, paper)
        + l('M-1.65-.4L0 .55 1.65-.4', copper, .16)
        + r(-.3, .35, .6, .6, '#DB7E68')
        + r(.9, -.25, .5, .55, teal);
      const flyingLetter = a(airLetter,
        [[0, t(20.6, 2.6, -16, .12) + o(0)], [37, t(20.6, 2.6, -16, .12) + o(0)],
          [41, t(21, -.6, -18, .55) + o(1)], [47, t(18.8, -5.4, -23, .7) + o(1)],
          [54, t(12.7, -10.7, -16, .72) + o(1)], [61, t(6.6, -13.1, -7, .64) + o(1)],
          [68, t(3.9, -13.3, 7, .5) + o(1)], [74, t(3.5, -13.2, 0, .25) + o(0)],
          [100, t(20.6, 2.6, -16, .12) + o(0)]], '0px 0px');
      const starReply = [[-.8, -10.3, 72, 2.5, 3.3], [3, -8.8, 75, 1.8, 4.1],
        [7, -7.2, 78, -.2, 4.7], [11.1, -5.4, 80, -.4, 4.0]].map(([x, y, begin, dx, dy], i) =>
        a(at(star(i % 2 ? cream : gold), x, y, .23 + (i % 2) * .05),
          [[0, t() + o(0)], [begin, t(0, -1) + o(0)], [begin + 2, t() + o(1)],
            [begin + 8, t(dx, dy, 30) + o(.75)], [begin + 12, t(dx, dy + .5, 50) + o(0)],
            [100, t() + o(0)]], `${x}px ${y}px`)).join('');
      const trail = [[19.5, -.5, 42], [16.7, -5, 49], [10.7, -9.4, 56], [5.5, -11.4, 63]].map(([x, y, begin]) =>
        a(at(star(copperLight), x, y, .16), [[0, o(0)], [begin, o(0)], [begin + 2, o(.9)], [begin + 8, o(0)]])).join('');
      const slotGlint = a(l('M18.3 4.1l-.35-.65m2.45.25V2.9m2.3 1.25.45-.65', moonLight, .23),
        [[0, o(0)], [33, o(0)], [36, o(1)], [40, o(0)]]);

      const courier = crab([[0, t()], [33, t()], [39, t(-.2, 0, -3)],
        [51, t()], [66, t(0, -.35, -2)], [80, t()], [89, t(-.3, .3, -3)], [100, t()]],
        satchel + heldLetter, {
          right: armLift,
          left: [[0, t()], [31, t()], [41, t(-.2, -.5, 20)], [52, t()],
            [81, t()], [90, t(-.5, 1, 12)], [96, t()]],
          eyes: [[0, t(.3, 0)], [18, t(.7, -.4)], [31, t(.7, -.4)], [40, t(.7, -.8)],
            [52, t(.25, -.9)], [64, t(-.6, -.85)], [76, t(-.6, -.85)],
            [88, t(-.2, .4)], [96, t(.3, 0)], [98, t(.3, 0, 0, 1, .15)], [100, t(.3, 0)]],
          mood: 'happy', moodAt: 76, moodEnd: 86,
        });
      return '<defs><linearGradient id="pt36-mailbox" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#A3D4CC"/><stop offset=".25" stop-color="#6CA4A7"/><stop offset="1" stop-color="#426F82"/></linearGradient><linearGradient id="pt36-moon" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFF4D2"/><stop offset=".6" stop-color="#FFE0A0"/><stop offset="1" stop-color="#E6B869"/></linearGradient><radialGradient id="pt36-glow"><stop stop-color="#FFE4A2" stop-opacity=".25"/><stop offset=".6" stop-color="#FFE4A2" stop-opacity=".1"/><stop offset="1" stop-color="#FFE4A2" stop-opacity="0"/></radialGradient></defs>'
        + moonHalo + crescent + trail + starReply + courier + mailbox + slotGlint + flyingLetter;
    }, .61);

  add('puddle-ballet', '雨后水洼', 'Puddle ballet',
    '穿好蓝雨靴，蓄力一跳，溅起晶亮的水花。再轻轻跳一下，小彩虹在水洼上方展开。',
    'Blue rain boots, a brave little jump, and a splash of shining droplets. One softer hop unfurls a tiny rainbow over the puddle.',
    ({ a, crab }) => {
      const puddleShape = 'M-8.8 16h1.7v-.55h3v-.5H1v-.4h11v.4h4.9v.5h3.4V16h2.6v.6h1.1v.65h-1.1v.6h-2.8v.45h-4.5v.35H-2.2v-.35h-3.7v-.45h-2.9v-.5h-1.1v-.7h1.1z';
      const puddle = p(puddleShape, '#8AC1CD')
        + p('M-6.8 16.3h3v-.4H2v-.3h10v.3h4.6v.4h4.3v.8h-4.7v.4H-.8v-.3h-6z', 'url(#pt37-water)')
        + l('M-6.4 16h2.2m1-.55H1m13.7.3h3.6m1.3 1h2.9m-26.5.7h2.2', waterLight, .19);
      const boots = p('M2.6 12.7h3.8v2.2h.65v.8H2.35V15h.25z', tealDark)
        + r(2.8, 13.05, 3.35, 2.05, '#6AADC4')
        + r(2.8, 13.05, .52, 2.05, '#A7DEDF')
        + r(2.5, 15.1, 4.55, .35, '#E8D7AB')
        + r(5.15, 13.45, .55, .55, gold)
        + p('M8.6 12.7h3.8V15h.8v.7H8.4V15h.2z', tealDark)
        + r(8.8, 13.05, 3.35, 2.05, '#6AADC4')
        + r(8.8, 13.05, .52, 2.05, '#A7DEDF')
        + r(8.55, 15.1, 4.65, .35, '#E8D7AB')
        + r(11.15, 13.45, .55, .55, gold);
      const jumpTrack = [[0, t(-2)], [9, t(-2)], [15, t(-1, .45, -3, 1.04, .94)],
        [20, t(-1, .9, -4, 1.08, .86)], [24, t(0, -3.3, 2, .94, 1.06)],
        [29, t(1.5, -6.4, 5)], [33, t(2.7, -3.1, 2, .97, 1.04)],
        [36, t(3, .85, 0, 1.13, .84)], [40, t(3, -.45, -2, .98, 1.03)],
        [44, t(3)], [52, t(3)], [56, t(3, .45, 2, 1.06, .92)],
        [60, t(1, -3.7, -7)], [64, t(-1.7, -2, -2)],
        [67, t(-2, .65, 0, 1.09, .88)], [71, t(-2, -.2, 2)],
        [76, t(-2)], [100, t(-2)]];
      const dancer = crab(jumpTrack, boots, {
        left: [[0, t()], [17, t(0, .4, -18)], [25, t(-.3, -.6, 63)],
          [31, t(-.3, -.6, 63)], [36, t(0, 0, 25)], [44, t()],
          [55, t(0, .4, -15)], [60, t(-.2, -.3, 54)], [67, t(0, 0, 22)],
          [76, t()], [100, t()]],
        right: [[0, t()], [17, t(0, .4, 18)], [25, t(.3, -.6, -63)],
          [31, t(.3, -.6, -63)], [36, t(0, 0, -25)], [44, t()],
          [55, t(0, .4, 15)], [60, t(.2, -.3, -54)], [67, t(0, 0, -22)],
          [76, t()], [100, t()]],
        eyes: [[0, t(0, .3)], [17, t(.2, .5)], [21, t(0, .3, 0, 1, .18)],
          [24, t(0, -.1)], [33, t(.15, .3)], [36, t(0, .3, 0, 1, .18)],
          [39, t()], [52, t(0, -.75)], [57, t(0, -.2)], [66, t(0, .3)],
          [70, t(0, -.7)], [90, t(0, -.7)], [96, t(0, .3)], [100, t(0, .3)]],
        mood: 'happy', moodAt: 72, moodEnd: 89,
      });
      const reflection = `<g clip-path="url(#pt37-reflection)" opacity=".19"><g transform="translate(0 19.3) scale(1 -.23)">${dancer}</g></g>`;

      const ripples = [36, 67].map((begin, n) => [0, 4, 8].map((delay, i) => {
        const x = n ? 5.4 : 10.6, y = 16.2 + i * .22;
        return a(`<ellipse cx="${x}" cy="${y}" rx="4.4" ry=".7" fill="none" stroke="${i % 2 ? waterLight : waterShade}" stroke-width=".22"/>`,
          [[0, t(0, 0, 0, .3, .2) + o(0)], [begin + delay, t(0, 0, 0, .3, .2) + o(0)],
            [begin + delay + .4, t(0, 0, 0, .5, .45) + o(.9)],
            [begin + delay + 11, t(0, 0, 0, n ? 1.9 : 2.5, 1.1) + o(.6)],
            [begin + delay + 19, t(0, 0, 0, n ? 2.1 : 2.8, 1.25) + o(0)],
            [100, t(0, 0, 0, .3, .2) + o(0)]], `${x}px ${y}px`, 'linear');
      }).join('')).join('');

      // Every drop follows a sampled ballistic arc and lands back on the
      // surface. Separate launch times prevent a rigid fan-shaped splash.
      const droplets = [36, 67].map((begin, splash) => Array.from({ length: splash ? 7 : 11 }, (_, i) => {
        const direction = i % 2 ? 1 : -1;
        const startX = (splash ? 5.5 : 10.5) + direction * (3.1 + (i % 3) * .35);
        const distance = direction * (2.8 + (i % 4) * 1.05);
        const height = (splash ? 3.2 : 4.8) + (i % 3) * .9;
        const start = begin + (i % 3) * .45;
        const life = (splash ? 11 : 14) + i % 3;
        const frames = [[0, t(startX, 15.85, 0, .1) + o(0)],
          [start, t(startX, 15.85, 0, .1) + o(0)]];
        for (let sample = 1; sample <= 8; sample++) {
          const u = sample / 8;
          frames.push([start + life * u,
            t(startX + distance * u, 15.85 - 4 * height * u * (1 - u), direction * (u * 75 - 25), .26 + (i % 2) * .09)
              + o(sample === 8 ? 0 : 1)]);
        }
        frames.push([100, t(startX, 15.85, 0, .1) + o(0)]);
        return a(p('M0-1.7l.9 1.3v1H.4v.35h-.8V.6H-.9v-1z', waterShade)
            + p('M0-1.5l.65 1v.9H.2v.25h-.5V.4H-.6v-.85z', waterLight)
            + r(-.25, -.55, .3, .7, cream), frames, '0px 0px', 'linear');
      }).join('')).join('');
      const crownSplash = [36, 67].map((begin, i) => {
        const x = i ? 5.5 : 10.5;
        return a(at(p('M-6.5 0l-1.7-2.3 2.6 1 1-3 1 2.6 2.2-1.1.8 2h1.2l.8-2 2.2 1.1 1-2.6 1 3 2.6-1L6.5 0z', water)
          + l('M-6.5 0h13', waterLight, .25), x, 16),
          [[0, t(0, 0, 0, .5, .1) + o(0)], [begin - .2, t(0, 0, 0, .5, .1) + o(0)],
            [begin + .5, t() + o(.95)], [begin + 3, t(0, 0, 0, 1.2, .8) + o(.75)],
            [begin + 6, t(0, 0, 0, 1.45, .12) + o(0)],
            [100, t(0, 0, 0, .5, .1) + o(0)]], `${x}px 16px`);
      }).join('');

      const rainbow = ['#E7A593', '#F0CF89', '#A6CAB1', '#91BACA'].map((color, i) => {
        const radius = 12.2 - i * .85;
        const arch = `<path d="M${7.5 - radius} 4.4 A${radius} ${radius} 0 0 1 ${7.5 + radius} 4.4" fill="none" stroke="${color}" stroke-width=".68"/>`;
        return a(arch, [[0, t(0, 1.6, 0, .72, .4) + o(0)],
          [42 + i * 2, t(0, 1.6, 0, .72, .4) + o(0)], [51 + i * 2, t() + o(.85)],
          [78, t() + o(.85)], [91, t(0, -.4, 0, 1.025) + o(0)],
          [100, t(0, 1.6, 0, .72, .4) + o(0)]], '7.5px 4.4px');
      }).join('');
      const rainbowCloud = p('M-2.7 0v-1h.8v-.7h1.5v.4h1.2v-.3H2v.6h.8v1H2v.6h-4.7z', '#C5DADD')
        + p('M-2.7 0v-1h.8v-.7h1.5v.4h1.2v-.3H2v.6h.8v1z', '#F2EAD5');
      const clouds = a(at(rainbowCloud, -4.6, 4.5, .7) + at(rainbowCloud, 19.6, 4.5, .7),
        [[0, o(0)], [44, o(0)], [51, o(1)], [79, o(1)], [91, o(0)]]);
      const sunlight = a(at(star(moonLight), 20.4, -7.8, .4),
        [[0, o(0)], [51, o(0)], [58, o(1)], [66, o(.3)], [73, o(1)], [84, o(0)]]);
      const puddleLeaf = a(p('M-5 14.5l1.2-1.3h2l-1.2 1.3z', '#A5B77C')
          + l('M-4.8 14.45l2.5-1.1', '#6F926F', .13),
        [[0, t()], [35, t()], [43, t(-1.2, .15, -11)], [62, t(-1.5, 0, -7)],
          [71, t(-2.2, .15, -18)], [84, t(-1.1, 0, -7)], [100, t()]], '-3.5px 14.2px');
      const shine = [[-4, 16.9, 48], [19.4, 15.9, 52], [.8, 17.5, 74]].map(([x, y, begin]) =>
        a(at(star(cream), x, y, .15), [[0, o(0)], [begin, o(0)], [begin + 3, o(1)], [begin + 8, o(0)]])).join('');
      return `<defs><linearGradient id="pt37-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#B5E5DB"/><stop offset=".5" stop-color="#8AC6CF"/><stop offset="1" stop-color="#6BA9C0"/></linearGradient><clipPath id="pt37-reflection">${p(puddleShape, '#FFFFFF')}</clipPath></defs>`
        + rainbow + clouds + sunlight + puddle + reflection + ripples + puddleLeaf + dancer + crownSplash + droplets + shine;
    }, .745);
}
