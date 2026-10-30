// Two original eight-second Clawd stories. The caller owns the canonical crab,
// CSS keyframe serializer, accessible SVG wrapper, manifest and reduced motion.
// These fixed pigments are illustration materials, not application UI colors.
export function registerObservatoryGarden({ add, r, p, l, at, t, o, star, cream, gold, blue, purple, green }) {
  const brass = '#D7A45C', brassShade = '#89613F', brassLight = '#FFE5A0';
  const midnight = '#293B58', indigo = '#3C5676', mint = '#B6E7CE';
  const leafShade = '#4D8A70', leafLight = '#C3EBAC', lilac = '#D8BFF1';

  add('star-chart', '星图观测员', 'Star chart keeper',
    '支起黄铜望远镜，轻轻对焦。星图展开，一颗带着光环的小星球从眼前经过。',
    'Unfold the brass telescope and turn the focus wheel. A star chart opens as a tiny ringed planet glides past.',
    ({ a, crab }) => {
      // The tripod pivots at a fixed joint; spreading the feet never moves the
      // telescope's optical axis. All visible parts fit inside the story canvas.
      const tripod = a(l('M17.3 8.3L14.1 15.4', brassShade, .64)
          + l('M17.3 8.3L14.35 15.3', brassLight, .19)
          + r(13.55, 15.15, 1.1, .65, midnight),
        [[0, t(0, 0, -22)], [7, t(0, 0, -22)], [20, t()], [85, t()], [96, t(0, 0, -22)]], '17.3px 8.3px')
        + a(l('M17.3 8.3L21.5 15.4', brassShade, .74)
          + l('M17.4 8.5L21.25 15.1', brass, .25)
          + r(20.95, 15.15, 1.25, .65, midnight),
        [[0, t(0, 0, 29)], [8, t(0, 0, 29)], [21, t()], [85, t()], [96, t(0, 0, 29)]], '17.3px 8.3px')
        + r(16.95, 8.05, .7, 7.65, brassShade)
        + r(16.95, 9, .2, 5.8, brass)
        + r(16.45, 15.2, 1.65, .65, midnight)
        + r(16.25, 7.15, 2.1, 1.5, brassShade)
        + r(16.5, 7.15, 1.7, .4, brassLight);

      const focusWheel = a(p('M-.7-1h1.4v.3h.3V.7H.7V1H-.7V.7H-1V-.7h.3z', brassShade)
          + r(-.65, -.65, 1.3, 1.3, brass)
          + l('M-.42 0h.84M0-.42v.84', cream, .2),
        [[0, t()], [23, t()], [28, t(0, 0, 38)], [33, t(0, 0, -24)],
          [38, t(0, 0, 12)], [42, t()], [100, t()]]);

      // Local x is the optical axis. The extension slides, with the larger
      // barrel drawn over its joint so it cannot visually separate.
      const extension = a(r(.1, -.8, 5.4, 1.6, brass)
          + r(.1, -.8, 5.4, .32, brassLight)
          + r(.1, .49, 5.4, .31, brassShade)
          + r(-.7, -.58, 1.1, 1.16, midnight)
          + r(-.8, -.72, .3, 1.44, indigo),
        [[0, t(1.35)], [11, t(1.35)], [22, t()], [84, t()], [95, t(1.35)]]);
      const barrel = r(2.2, -1.08, 4.8, 2.16, brassShade)
        + r(2.2, -.93, 4.8, 1.6, 'url(#pt31-brass)')
        + r(2.35, -.93, 4.45, .23, brassLight)
        + r(2.35, .7, 4.45, .27, brassShade)
        + r(2.2, -1.17, .42, 2.34, brass)
        + r(6.68, -1.45, .8, 2.9, brassShade)
        + r(6.68, -1.45, .8, .3, brassLight)
        + r(7.35, -1.15, .5, 2.3, midnight)
        + r(7.5, -.92, .22, 1.83, blue)
        + r(7.5, -.92, .22, .56, cream);
      const scope = at(extension + barrel + l('M1 .7v.8', brassShade, .32)
        + at(focusWheel, 1, 1.63), 13.75, 7.12, 1, -27);
      const telescope = tripod + a(scope,
        [[0, t(0, 0, 13)], [10, t(0, 0, 13)], [21, t()], [83, t()], [96, t(0, 0, 13)]],
        '17.3px 8.3px');

      // A small physical folded map, rather than a full-frame background.
      const chartPaper = p('M-1.8-13.7h15.6v.65h.65v7.6h-.65v.65H-1.8v-.65h-.65v-7.6h.65z', brassShade)
        + r(-1.8, -13.05, 15.6, 7.6, midnight)
        + r(-1.8, -13.05, 5.2, 7.6, indigo)
        + r(8.6, -13.05, 5.2, 7.6, '#314763')
        + r(-1.8, -13.05, 15.6, .22, '#7E97AE')
        + r(3.3, -13.05, .18, 7.6, '#233148')
        + r(8.5, -13.05, .18, 7.6, '#667E98')
        + r(-2.55, -14.1, 1, 9.7, brass)
        + r(-2.55, -14.1, .25, 9.7, brassLight)
        + r(13.55, -14.1, 1, 9.7, brass)
        + r(14.25, -14.1, .3, 9.7, brassShade)
        + r(-2.8, -14.5, 1.5, .55, brassLight)
        + r(13.3, -14.5, 1.5, .55, brassLight)
        + r(-2.8, -4.55, 1.5, .55, brassShade)
        + r(13.3, -4.55, 1.5, .55, brassShade);
      const constellation = l('M-.5-8.2L2.2-10.8 5.4-8.6 8.3-11.5 11.8-9.1', '#9CC4D8', .21)
        + [[-.5, -8.2, .28], [2.2, -10.8, .38], [5.4, -8.6, .26], [8.3, -11.5, .36], [11.8, -9.1, .28]]
          .map(([x, y, s]) => at(star(cream), x, y, s)).join('')
        + r(.4, -11.7, .25, .25, blue)
        + r(6.5, -6.7, .3, .3, cream)
        + r(10.8, -12.1, .22, .22, cream)
        + r(1.7, -6.7, .3, .3, gold);
      const chart = a(chartPaper + a(constellation,
        [[0, o(0)], [39, o(0)], [47, o(1)], [78, o(1)], [86, o(0)]]),
        [[0, t(0, 1, 0, .06, .08) + o(0)], [32, t(0, 1, 0, .06, .08) + o(0)],
          [36, t(0, 0, 0, .06, 1) + o(1)], [44, t() + o(1)], [79, t() + o(1)],
          [87, t(0, 0, 0, .06, 1) + o(1)], [91, t(0, 1, 0, .06, .08) + o(0)]], '6px -9px');

      const planetBody = p('M-1.3-2.3h2.6v.5h.7v.7h.5v2.2H2v.7h-.7v.5h-2.6v-.5H-2v-.7h-.5v-2.2H-2v-.7h.7z', purple)
        + p('M-1.3-2.3h2.6v.5h.7v.7H.5v-.5h-1.8v.5H-2v-.7h.7z', lilac)
        + p('M.6-.3h1.9v1.4H2v.7h-.7v.5H-.6v-.6H.6z', '#8066BA')
        + r(-1.2, -.9, .65, .38, '#F6D7E8');
      const backRing = l('M-3.6 1.1l.65-1.2L-.8-1.3l2.8-.8 1.5.25.45.7', brass, .65);
      const frontRing = l('M-3.6 1.1l.8.55 2.8-.2L2.8.2 4-1.15', gold, .65)
        + l('M-2.4 1.65L0 1.4 2.65.4', brassLight, .22);
      const planet = a(backRing + planetBody + frontRing,
        [[0, t(-5, -5, -12, .05) + o(0)], [45, t(-5, -5, -12, .05) + o(0)],
          [49, t(-3.4, -7.2, -10, .55) + o(1)], [56, t(2.1, -15.15, -3, .8) + o(1)],
          [64, t(10.5, -15.3, 6, .86) + o(1)], [72, t(18.3, -9, 12, .75) + o(1)],
          [79, t(21, -3.7, 18, .3) + o(0)], [100, t(-5, -5, -12, .05) + o(0)]]);
      const glints = [[-5, -10, .22, 49], [17, -15, .32, 57], [22, -6, .24, 68]].map(([x, y, s, start]) =>
        a(at(star(brassLight), x, y, s), [[0, o(0)], [start, o(0)], [start + 3, o(1)], [start + 9, o(0)]])).join('');

      const observer = crab([[0, t()], [10, t(0, 0, 2)], [24, t(.15, 0, 5)],
        [39, t(.15, 0, 5)], [48, t(0, 0, -2)], [59, t(0, 0, -3)],
        [72, t(0, 0, 2)], [87, t()], [100, t()]], '', {
        right: [[0, t()], [12, t(.25, -.5, -18)], [23, t(1.05, -2.1, -39)],
          [28, t(1.05, -2.1, -29)], [33, t(1.05, -2.1, -46)],
          [39, t(1.05, -2.1, -34)], [46, t(.3, -.4, -15)], [56, t()],
          [83, t()], [91, t(.2, -.5, -18)], [98, t()]],
        left: [[0, t()], [43, t()], [53, t(-.2, -.9, 39)], [68, t(-.2, -.9, 52)],
          [77, t(-.2, -.9, 42)], [91, t()]],
        eyes: [[0, t()], [7, t(0, 0, 0, 1, .15)], [9, t()], [21, t(.65, -.35)],
          [38, t(.65, -.35)], [49, t(-.45, -.7)], [59, t(0, -.9)],
          [71, t(.65, -.55)], [86, t()], [94, t(0, 0, 0, 1, .15)], [96, t()]],
        mood: 'happy', moodAt: 73, moodEnd: 85,
      });
      return '<defs><linearGradient id="pt31-brass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFE5A0"/><stop offset=".34" stop-color="#D7A45C"/><stop offset="1" stop-color="#AA7543"/></linearGradient></defs>'
        + chart + glints + planet + observer + telescope;
    }, .64);

  add('firefly-garden', '萤火花园', 'Firefly garden',
    '给小苗浇一点水，花瓣一层层展开。萤火虫绕着花飞，最后轻轻落在伸出的手上。',
    'Water a tiny sprout and watch its petals unfold. Fireflies circle the flower, then one lands softly on the waiting hand.',
    ({ a, crab }) => {
      // The can begins and ends on the ground. Pickup, pouring, and setting it
      // down are separate beats, leaving an empty hand for the firefly landing.
      const can = l('M15.2 11.9h-1.5v2.5h1.5', leafShade, .52)
        + l('M15.2 11.9h-1.5v2.5', mint, .18)
        + p('M17.7 12.4l2.5-1.8.7-1.5.85.4-.6 2.1-3.1 2.5z', leafShade)
        + p('M17.6 12.2l2.4-1.8.7-1.5.65.3-.6 1.75-3.15 2.6z', mint)
        + r(20.6, 8.65, 1.1, .65, cream)
        + p('M15.2 11.1h2.5v.6h.5v3.6h-.5v.55h-2.5v-.55h-.5v-3.6h.5z', leafShade)
        + r(15.2, 11.5, 2.55, 3.7, mint)
        + r(15.2, 11.5, .45, 3.7, '#E2F2D6')
        + r(17.2, 11.5, .55, 3.7, '#83BFA5')
        + r(14.9, 11.05, 3.05, .52, brass)
        + r(15.1, 11.05, 2.65, .17, brassLight)
        + r(15.65, 12.55, 1.25, 1.25, cream)
        + r(16.08, 12.75, .42, .85, leafShade);
      const canMotion = [[0, t()], [6, t()], [15, t(0, -4.2, -5)],
        [21, t(0, -4.2, 25)], [31, t(0, -4.2, 25)],
        [36, t(0, -4.2, -5)], [45, t()], [100, t()]];
      const wateringCan = a(can, canMotion, '14.4px 12.7px');
      const droplets = Array.from({ length: 5 }, (_, i) => {
        const start = 21.2 + i * 2.1;
        return a(r(22.15, 7.7, .35, .8, blue) + r(22.2, 7.7, .14, .25, cream),
          [[0, t() + o(0)], [start, t() + o(0)], [start + .6, t() + o(1)],
            [start + 4.8, t(-.75, 3.8) + o(.9)], [start + 5, t(-.75, 3.8) + o(0)], [100, t() + o(0)]], '0px 0px', 'linear');
      }).join('');
      const splash = a(l('M18.65 11.9l-.55-.65M20.9 11.7l.6-.8M21.6 12.2h.65', blue, .23),
        [[0, o(0)], [25, o(0)], [27, o(.7)], [29, o(0)], [31, o(.8)], [33, o(0)], [35, o(.7)], [37, o(0)]]);

      const stem = l('M20 12.55V8.2l.25-1.8V4.5', leafShade, .55)
        + l('M19.85 12.3V8.1L20.1 6.3V4.65', leafLight, .15)
        + p('M19.8 10h-1v-.5h-1v-.55h-.7V7.7h1.25v.55h.85v.6h.6z', leafShade)
        + p('M19.75 9.5h-.95v-.5h-.9v-.8h.7v.5h.8z', green)
        + p('M20.2 8.25h1v-.55h1V6.3H21v.55h-.8z', leafShade)
        + p('M20.3 7.65h.8v-.55h.65v-.35h-.75v.5h-.7z', leafLight);

      // Five stepped petals open in a short cascade around one fixed flower
      // centre; only the stem grows, keeping the flower attached throughout.
      const petal = p('M-.8-.35v-.7h-.55v-1.4h.55v-.65H.8v.65h.55v1.4H.8v.7z', '#A58AC9')
        + p('M-.8-.8v-.7h-.3v-.95h.55v-.4h1.1v.4h.55v.95H.8v.7z', lilac)
        + r(-.55, -2.45, .5, .55, '#F8DAE8');
      const petals = [0, 72, 144, 216, 288].map((angle, i) => {
        const begin = 44 + i * 1.6;
        return a(at(petal, 20.15, 4.5, 1, angle),
          [[0, t(0, 0, 0, .08) + o(0)], [begin, t(0, 0, 0, .08) + o(0)],
            [begin + 3, t(0, 0, 0, 1.13) + o(1)], [begin + 5.4, t() + o(1)],
            [84, t() + o(1)], [91, t(0, 0, 0, .08) + o(0)]], '20.15px 4.5px');
      }).join('');
      const bud = a(p('M19.5 5V3.6h1.3V5z', purple) + r(19.5, 3.6, .45, 1.1, lilac),
        [[0, o(1)], [47, o(1)], [51, o(0)], [89, o(0)], [93, o(1)]]);
      const centre = a(r(19.4, 3.75, 1.5, 1.5, gold) + r(19.4, 3.75, .9, .45, cream)
          + r(20.3, 4.65, .6, .6, brass),
        [[0, o(0)], [48, o(0)], [54, o(1)], [85, o(1)], [91, o(0)]]);
      const plant = a(stem + petals + bud + centre,
        [[0, t(0, 0, 0, 1, .27)], [35, t(0, 0, 0, 1, .27)],
          [43, t(0, 0, -2, 1, .68)], [50, t(0, 0, 2, 1, 1.02)],
          [55, t()], [62, t(0, 0, -2)], [70, t(0, 0, 2)], [78, t()],
          [87, t()], [97, t(0, 0, 0, 1, .27)]], '20px 12.55px');
      const pot = p('M17.55 12.1h5.2v1.1h-.45v2.2h-.6v.65h-3.1v-.65H18v-2.2h-.45z', '#8F5E4F')
        + r(18.05, 13.2, 4.2, 2.15, '#C68466')
        + r(18.05, 13.2, .6, 2.15, '#E6AA80')
        + r(21.6, 13.2, .65, 2.15, '#AD6D56')
        + r(17.55, 12.05, 5.2, 1.1, '#DFAC83')
        + r(17.55, 12.05, 5.2, .25, '#F5D6A9')
        + r(18.2, 11.8, 3.8, .45, '#604D42')
        + r(19.4, 14.0, 1.1, .45, cream)
        + r(19.75, 13.65, .4, 1.15, cream);

      const firefly = (resting = false) => {
        const wings = p('M-.3-.65h-.75v-.8h-.8v.8h.3v.7h.9z', cream)
          + p('M.3-.65h.75v-.8h.8v.8h-.3v.7h-.9z', '#D5EBD4');
        const wingFrames = [[0, t()]];
        for (let percent = 2; percent < 100; percent += 2) {
          const closed = percent % 4 === 2;
          wingFrames.push([percent, t(0, 0, 0, resting && percent >= 76 && percent <= 85 ? .38 : closed ? .32 : 1, 1)]);
        }
        return `<g opacity=".22">${p('M-2-.5h1v-1h2v1h1v2H1v1h-2v-1h-1z', gold)}</g>`
          + a(wings, wingFrames, '0px -.5px', 'linear')
          + r(-.5, -.8, 1, 1.6, leafShade)
          + r(-.55, .05, 1.1, 1.05, gold)
          + r(-.3, .2, .6, .6, cream)
          + l('M-.2-.8l-.3-.45M.2-.8l.3-.45', leafShade, .18);
      };
      const companion = a(firefly(true),
        [[0, t(23.1, 5, 0, .45) + o(0)], [52, t(23.1, 5, 0, .45) + o(0)],
          [55, t(23.1, 2.5, -10, .5) + o(1)], [61, t(18, -1.6, -15, .52) + o(1)],
          [66, t(10, -.7, -7, .52) + o(1)], [70, t(8.8, 2.7, 12, .52) + o(1)],
          [76, t(14.05, 5.4, 0, .5) + o(1)], [85, t(14.05, 5.4, 0, .5) + o(1)],
          [90, t(18.6, 2.7, -12, .45) + o(1)], [94, t(23.1, 5, 0, .45) + o(0)]]);
      const companionTwo = a(firefly(),
        [[0, t(22.6, 8.2, 0, .34) + o(0)], [55, t(22.6, 8.2, 0, .34) + o(0)],
          [60, t(24, 2.3, -18, .36) + o(1)], [66, t(20.4, -.9, 0, .36) + o(1)],
          [73, t(16.2, 2.6, 15, .36) + o(1)], [80, t(18.4, 7.3, 10, .36) + o(1)],
          [86, t(22.6, 8.2, 0, .34) + o(1)], [92, t(22.6, 8.2, 0, .34) + o(0)]]);
      const pollen = [[17.0, 3.5], [22.8, 5.2], [20.7, -.4]].map(([x, y], i) => a(at(star(gold), x, y, .17),
        [[0, o(0)], [53 + i * 2, o(0)], [56 + i * 2, o(1)], [62 + i * 2, o(0)],
          [72 + i * 2, o(.75)], [81 + i * 2, o(0)]])).join('');
      const gardener = crab([[0, t()], [7, t(0, 0, 2)], [16, t(0, 0, 2)],
        [32, t(0, 0, 2)], [44, t(0, 0, 1)], [52, t()], [61, t()], [100, t()]], '', {
        right: [[0, t()], [6, t(.1, 2, 8)], [15, t(.25, -2.3, -12)],
          [21, t(.15, -2.3, 4)], [31, t(.15, -2.3, 4)], [36, t(.25, -2.3, -12)],
          [45, t(.1, 2, 8)], [49, t()], [60, t(.4, -2.8, -50)],
          [86, t(.4, -2.8, -50)], [96, t()]],
        left: [[0, t()], [12, t(.3, 0, -14)], [37, t(.3, 0, -14)],
          [47, t()], [57, t(0, -.4, 18)], [76, t(0, -.4, 18)], [91, t()]],
        eyes: [[0, t(.3, .2)], [10, t(.5, .3)], [30, t(.65, .2)],
          [44, t(.65, -.35)], [56, t(.65, -.7)], [65, t(.2, -.85)],
          [76, t(.6, -.5)], [90, t(.3, .2)], [96, t(.3, .2, 0, 1, .15)], [98, t(.3, .2)]],
        mood: 'happy', moodAt: 77, moodEnd: 87,
      });
      // The rooted stem is behind the pot rim, water falls in front of the
      // sprout, and the firefly is always in front of the offered hand.
      return plant + pot + gardener + wateringCan + droplets + splash + pollen + companionTwo + companion;
    }, .79);
}
