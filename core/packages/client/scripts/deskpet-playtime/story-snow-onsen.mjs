// A winter bathing vignette. The stage supplies the unchanged canonical Clawd
// geometry, the eight-second clock and the accessible/reduced-motion wrapper.
// Pigments here describe illustration materials, not application UI surfaces.
export function registerSnowOnsen({ add, r, p, l, at, t, o, cream, gold, ink }) {
  add('snow-onsen', '雪中温泉', 'Snowfall onsen',
    '伸爪试试水温，慢慢浸入暖泉。柚子随木盘轻晃，细雪融进涟漪，头上的小毛巾也暖起来。',
    'Test the warm water, settle in and close your eyes. A little cedar tray drifts past as snow melts into gentle ripples.',
    ({ a, v, crab }) => {
      const snow = '#F2F3DC', snowShade = '#CBD9D4', stone = '#849795';
      const stoneDark = '#526D70', stoneLight = '#B2C2B6', water = '#8ACBC9';
      const wood = '#A77E55', woodLight = '#DABD8C', cedar = '#527D73';
      const defs = '<defs><linearGradient id="pt40-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#B7E1D6"/><stop offset=".58" stop-color="#8FCBCD"/><stop offset="1" stop-color="#6BABA9"/></linearGradient><linearGradient id="pt40-light" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#FFE6A4"/><stop offset="1" stop-color="#D9A65A"/></linearGradient></defs>';

      // Small winter props frame the bath without forming an opaque backdrop.
      const pineTrunk = p('M-7.9 2.8h.9v9.8h-1.2V8.9h.3z', '#7D7964')
        + l('M-7.4 4.5v7.4', woodLight, .18);
      const pine = p('M-7.5-4.5l-2.8 4h1.5l-3 4.3h2l-3 4.7h5.3v.5h5.2L-5.2 4h1.8L-6.2-.3h1.5z', cedar)
        + p('M-7.5-4.5v13h4.8L-5.7 4h1.5L-6.7-.3h1.5z', '#395F60')
        + p('M-7.5-4.5l-2.8 4h1.5l.8-1.1.6.5.8-.7.7.7h1.2z', snow)
        + p('M-8.8-.2l-3 4h1.4l.8-1 .8.5.9-.5.7.5.7-.4.7.5h1.6l-1.1-1.4-2.2.3-2.3-.3z', snow)
        + p('M-10.3 4.2l-2.5 3.9h1.5l1-.7 1 .5.8-.6 1 .6 1.1-.4 1 .5 1.2-.4h1.8L-5 6.5l-2.4.3-2.1-.3z', snowShade)
        + r(-8.1, 2.3, .3, .8, '#8AA793')
        + r(-6.1, 5.8, .35, .75, '#6B9380');
      const pineSway = a(pine, [[0, t()], [18, t(0, 0, -1.2)], [35, t(0, 0, 1.1)],
        [60, t(0, 0, -.8)], [84, t(0, 0, .5)], [100, t()]], '-7.5px 10px');
      const lamp = r(20.35, 5.9, 1.45, 6.65, stoneDark)
        + r(20.35, 6.7, .3, 4.8, stone)
        + p('M18.7 11.6h4.7l.8 1.1h-6.3z', stone)
        + r(18.9, 11.6, 4.3, .26, stoneLight)
        + p('M18.6 2.2h5v3.95h-5z', stoneDark)
        + r(19.15, 2.65, 3.9, 2.85, 'url(#pt40-light)')
        + r(20.9, 2.65, .32, 2.85, wood)
        + r(19.15, 4.05, 3.9, .27, wood)
        + r(18.4, 5.8, 5.4, .58, stone)
        + r(18.4, 5.8, 5.4, .18, stoneLight)
        + p('M21.1-.4l4.3 2.9h-8.6z', stoneDark)
        + p('M21.1-.8l4.4 2.85h-1.7l-1-.42-.9.35-1.2-.4-1 .3-1-.3h-1.9z', snow)
        + r(20.8, -.7, .6, .6, snowShade);
      const lampGlow = a(p('M19.35 2.9h3.5v2.35h-3.5z', cream),
        [[0, o(.12)], [15, o(.26)], [29, o(.16)], [46, o(.3)], [65, o(.18)], [84, o(.28)], [100, o(.12)]]);

      // Far stones and the spring surface precede the crab. Foreground stones
      // naturally conceal submerged feet; the face and both claws stay clear.
      const backRim = p('M-6.8 10.8l2.7-1.6 6.2-.4 4.1.6 5.1-.3 6.9.4 4.3 1.9.7 3.1-4.5 1.5H-3.2l-4.7-1.6z', stoneDark)
        + p('M-6.8 10.8l2.7-1.6 4.4-.3 1.2 1.8-4.9 1.1z', stone)
        + p('M.5 9.4l5.6.1 1 1.5-5.7.6z', stoneLight)
        + p('M7 9.5l4.4-.4 5.9.4-.2 1.7-8.3.5z', stone)
        + p('M17.4 9.5l5.1 1.9.2 2.1-4.5-1.5z', stoneLight)
        + l('M-5.8 10.8l2.3-.9 3.4-.2M18 10.2l3.2 1', snowShade, .24);
      const poolWater = p('M-5.6 11.8l3.5-1h18.6l5 1.15 1 1.65-4.1 2.15H-2.8l-3.9-1.75z', 'url(#pt40-water)')
        + l('M-4.5 12l2.8-.7h3.5m13.8 0h1.5l3.5.8', '#D6EFE1', .19);
      const surface = p('M-5.8 13.2l3.8-.25 3.3.35 5.1-.2 3.7.25 5.5-.3 6.4.15-3.7 2.2H-2.8z', water);
      const stoneFront = p('M-7 13.6l3.7 1.3H17l5.7-1.5-.1 2.6-4.6 2.1H-2.8L-7 16z', stoneDark)
        + p('M-7 13.6l3.7.75.3 3.2-3.2-1.15-.9-1.1z', stone)
        + p('M-3.1 14.4l5.7.2 1.1 2.8-6.5.15-.3-1.5z', stoneLight)
        + p('M2.8 14.6l4.8-.1.9 3.15-4.9-.1z', stone)
        + p('M7.9 14.5l4.2.05 1.5 2.8-5 .3z', '#9EADA7')
        + p('M12.4 14.55l5-.05 1 2.65-4.5.3z', stone)
        + p('M17.7 14.5l5-1.1-.4 2.8-3.6 1.15z', '#96AAA4')
        + l('M-2.4 15.1l3.8.1M4.4 15.1h2.1M9 15.1l2.8.1M14.1 15h2.2M18.8 15.1l2.3-.6', '#CBD6C5', .22)
        + p('M-7.1 13.4l2.1-.8 2.5.8-.4 1.1-1.5-.3-.8.4-1.6-.4z', snow)
        + p('M18.6 13.65l3.8-1.2 1 .7-.4 1.1-1.2-.1-.9.6-1-.2z', snow)
        + r(3, 17.6, 4.8, .25, '#708A85')
        + r(13.3, 17.5, 3.3, .22, '#708A85');

      const towel = p('M4.3 5h6.2v.75H4.3z', snowShade)
        + p('M4.7 3.85h5.4v1.4H4.7z', snow)
        + r(4.7, 4.72, 5.4, .25, '#D8E2CF')
        + r(5.1, 3.85, .24, 1.1, '#B5C9BE')
        + r(9.3, 3.85, .24, 1.1, '#B5C9BE')
        + l('M5.8 4.17h2.6', '#FCF6E2', .21)
        + p('M6.8 3.4h2.65v.6H6.8z', snowShade)
        + r(6.8, 3.35, 2.65, .3, snow);
      const actorMotion = [[0, t()], [8, t(0, .1)], [18, t(0, .15, 1)], [27, t()],
        [38, t(0, .45)], [49, t(0, 1.15)], [60, t(0, 1.32, 0, 1.015, .985)],
        [72, t(0, 1.15)], [79, t(0, 1.3, 0, 1.012, .987)], [87, t(0, .55)], [96, t()], [100, t()]];
      const cheeks = v(r(3.1, 10.55, 1.4, .42, '#EBA68B') + r(10.5, 10.55, 1.4, .42, '#EBA68B'), 46, 86);
      const actor = crab(actorMotion, towel + cheeks, {
        left: [[0, t(0, 0, -8)], [10, t(.3, .3, -15)], [17, t(.1, .15, -7)],
          [25, t(0, 0, -8)], [42, t(-.4, -.2, 14)], [58, t(-.5, -.3, 21)],
          [77, t(-.5, -.3, 21)], [92, t(0, 0, -8)], [100, t(0, 0, -8)]],
        right: [[0, t(0, 0, 8)], [8, t(.1, .15, 12)], [18, t(1, 2, 20)],
          [22, t(1, 2, 20)], [30, t(.5, -.75, -23)], [38, t(.2, -.4, -12)],
          [49, t(.4, -.25, -14)], [77, t(.4, -.25, -14)], [90, t(0, 0, 8)], [100, t(0, 0, 8)]],
        eyes: [[0, t()], [10, t(.45, .45)], [21, t(.6, .5)], [29, t(.5, -.1)],
          [39, t(0, .1)], [44, t(0, 0, 0, 1, .55)], [86, t(0, 0, 0, 1, .55)],
          [91, t()], [96, t(0, 0, 0, 1, .12)], [98, t()], [100, t()]],
        mood: 'sleep', moodAt: 46, moodEnd: 85,
      });

      // Hand test produces two expanding ripples; the droplets lift with the
      // withdrawing claw and fall back onto the same patch of warm water.
      const rippleShape = l('M-2 0q2-1 4 0-2 1-4 0z', '#DFEEE0', .2);
      const ripple = (x, y, beat, size = 1) => a(at(rippleShape, x, y, size),
        [[0, t(0, 0, 0, .1, .5) + o(0)], [beat, t(0, 0, 0, .1, .5) + o(0)],
          [beat + 1.5, t(0, 0, 0, .5, .8) + o(.9)], [beat + 7, t(0, 0, 0, 1.3, 1) + o(.55)],
          [beat + 12, t(0, 0, 0, 1.9, 1) + o(0)], [100, t(0, 0, 0, .1, .5) + o(0)]], `${x}px ${y}px`);
      const handRipples = ripple(15.5, 13.2, 20, .65) + ripple(15.5, 13.2, 25, .55);
      const wetClaw = [0, 1].map(i => a(r(14.2 + i * .7, 10.1 - i * .3, .24, .5, '#D8EEE2'),
        [[0, t() + o(0)], [29 + i, t() + o(0)], [30 + i, t() + o(.9)],
          [35 + i, t(.2, 2.9 + i * .3) + o(.75)], [36 + i, t(.2, 2.9 + i * .3) + o(0)], [100, t() + o(0)]], '0px 0px', 'linear')).join('');

      const cedarTray = p('M16.35 12.05l1-.5h4.6l1.1.5v.55l-1.1.6h-4.6l-1-.6z', wood)
        + p('M16.6 12.05l.9-.37h4.2l1.05.37-1.05.42h-4.2z', woodLight)
        + l('M17.5 12.08h4.1M18.2 12.95h2.8', '#D8B88A', .13)
        + p('M17.45 9.8h1.6v2.15h-.25v.28h-1.1v-.28h-.25z', '#CCDCC7')
        + r(17.45, 9.72, 1.6, .35, '#628E83')
        + r(17.72, 9.79, 1.06, .14, '#D5B779')
        + r(17.65, 10.2, .19, 1.26, '#F0F0D8')
        + p('M20.35 10.1h1.1v.4h.4v1.1h-.4v.4h-1.1v-.4h-.4v-1.1h.4z', '#E4BB53')
        + p('M20.35 10.1h.75v.35h-.75v.45h-.4v-.4h.4z', '#FFDF7E')
        + r(21.1, 10.65, .24, .24, '#C8963D')
        + p('M20.8 10.2l-.45-.5.75-.1.4.35z', '#648B69');
      const trayMotion = [[0, t()], [18, t(.2, -.08, 1.3)], [32, t(-.18, .08, -1.4)],
        [50, t(.38, -.12, 1.4)], [66, t(.1, .1, -.9)], [83, t(-.15, -.04, -.6)], [100, t()]];
      const floatingTray = a(cedarTray, trayMotion, '19.6px 12.2px');
      const poolGlints = a(l('M-3.5 13.15h2.6M1.4 13.7h2M11.2 13.7h2.4', '#D8EEE2', .2),
        [[0, o(.55)], [25, o(.85)], [50, o(.5)], [75, o(.9)], [100, o(.55)]]);

      // Steam packets disappear before reset. Their curved silhouettes stay
      // behind the face, with slow lateral drift rather than full-frame haze.
      let steam = '';
      for (const [i, beat] of [0, 10, 21, 32, 43, 54].entries()) {
        const x = i % 2 ? 16.4 : -1.5, side = i % 2 ? -1 : 1;
        const curl = l('M0 0C-1.2-1.9 1.1-2.8.1-4.8S-1.2-7.4.6-9.2', '#A4C9C4', .48)
          + l('M0 0C-1.2-1.9 1.1-2.8.1-4.8S-1.2-7.4.6-9.2', snow, .19);
        steam += a(at(curl, x, 10.6), [[0, t() + o(0)],
          ...(beat ? [[beat, t(0, 0, 0, .7, .7) + o(0)]] : []),
          [beat + 5, t(side * .45, -1.8, 0, .82, .9) + o(.62)],
          [beat + 17, t(side * .95, -5, 0, 1.05, 1.12) + o(.48)],
          [beat + 29, t(side * 1.7, -8.4, 0, 1.25, 1.3) + o(0)], [100, t() + o(0)]], `${x}px 10.6px`);
      }
      const breath = a(l('M7.5 9.6q1-.25 1.55-1.2t1.35-1.2', '#C8DBCD', .28),
        [[0, t() + o(0)], [47, t() + o(0)], [51, t(.3, -.45) + o(.7)],
          [58, t(1.2, -1.4) + o(0)], [100, t() + o(0)]]);

      let flakes = '', meltRipples = '';
      const snowflake = l('M-.6 0H.6M0-.6V.6M-.42-.42L.42.42M.42-.42L-.42.42', snow, .16);
      for (const [i, x, endX, beat, landing] of [[0, -3.5, -2, 5, 12.7], [1, 17.3, 16, 13, 12.7],
        [2, 3.4, 6.8, 25, 4.5], [3, 24, 23, 36, .5], [4, -7.2, -9, 48, -2.0], [5, 16.7, 15.8, 57, 12.7]]) {
        const end = beat + 27, size = i % 2 ? .7 : .8;
        flakes += a(at(snowflake, x, -13 + i % 3, size),
          [[0, t() + o(0)], [beat, t() + o(0)], [beat + 2, t(.15, 1.1, 10) + o(.86)],
            [beat + 13, t((endX - x) * .3, (landing + 13 - i % 3) * .43, 55) + o(.9)],
            [end, t(endX - x, landing + 13 - i % 3, 105) + o(.85)],
            [end + 2, t(endX - x, landing + 13 - i % 3, 105, .35) + o(0)], [100, t() + o(0)]], `${x}px ${-13 + i % 3}px`, 'linear');
        if (landing === 12.7) meltRipples += ripple(endX, 13.05, end + .5, .45);
      }
      return defs + pineTrunk + pineSway + lamp + lampGlow + backRim + poolWater
        + steam + actor + surface + poolGlints + handRipples + meltRipples
        + floatingTray + stoneFront + wetClaw + breath + flakes;
    }, .68);
}
