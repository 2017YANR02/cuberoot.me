import { at, circle, cream, gold, ink, line, opacity, star, t } from './rig.mjs';

// Both takes start on a planted forepaw. The torso changes direction first;
// the superscript at the end of the tail takes another beat to catch up.
const brake = { yaw: 60, rx: -25, b: [-6, 2, -7, 1, .94],
  L: [-184, -43, 32, .86, 1], R: [-122, -22, 19, 1, 1], T: [192, -303, 43, 1, 1] };
const gather = { L: [-116, -58, -31, .94, 1], R: [36, -52, 28, 1, 1] };
const clap = { L: [-84, -69, -47, .96, 1], R: [10, -63, 50, .98, 1] };
const open = { L: [-206, -66, 82, .98, .98], R: [178, -77, -74, 1, 1] };

const celebration = {
  once: true,
  poses: [
    [0, 'side', brake, 'ease-out'],
    [6, 'side', { yaw: 47, rx: -12, b: [3, 12, 3, 1.02, .9], T: [185, -310, 55, 1, 1] }],
    [13, 'stand', { yaw: 18, ry: -3, ...gather, T: [136, -349, 7, 1, 1] }],
    // Look up, draw the forepaws in, compress, then launch off the hind paws.
    [20, 'low', { yaw: 13, ...gather, b: [0, 49, -4, 1.08, .78], T: [157, -280, 31, .97, .97] }, 'ease-in'],
    [24, 'air', { ...open, rx: 8, ry: -42, spin: -5, b: [0, -26, -2, .94, 1.04], T: [168, -307, 43, 1, 1] }, 'ease-out'],
    [32, 'air', { ...open, rx: 43, ry: -146, spin: 13, yaw: 30, HL: [-91, -72, 56, .95, .9],
      HR: [130, -64, -65, 1, .86], T: [140, -349, -19, 1, 1] }, 'linear'],
    [36, 'air', { ...open, rx: 56, ry: -139, spin: 7, yaw: 22, T: [135, -351, -33, 1, 1] }, 'ease-in'],
    [43, 'rest', { ...gather, rx: 70, ry: -2, b: [0, 3, 6, .99, .98], T: [151, -363, -8, 1, 1] }, 'ease-out'],
    [47, 'low', { ...gather, rx: 75, b: [4, 57, 4, 1.09, .78], T: [167, -295, 32, 1, 1] }, 'ease-out'],
    // Recoil into two distinct claps: the second is closer and quicker.
    [54, 'oneleg', { ...open, rx: 64, ry: -9, spin: -7, T: [144, -342, 2, 1, 1] }, 'ease-in'],
    [59, 'sit', { ...clap, rx: 59, spin: -3, T: [155, -326, 23, 1, 1] }, 'ease-out'],
    [64, 'stand', { rx: 57, L: [-174, -50, 28, .94, 1], R: [108, -55, -32, 1, 1], T: [149, -348, 9, 1, 1] }, 'ease-in'],
    [68, 'sit', { ...clap, rx: 55, b: [0, 16, 3, 1, .94], T: [152, -328, 25, 1, 1] }, 'ease-out'],
    [75, 'oneleg', { rx: 50, spin: 5, L: [-207, -78, 87, 1, 1], R: [30, -67, 41, 1, 1], T: [131, -353, -9, 1, 1] }],
    [84, 'stand', { rx: 44, b: [0, -33, -5, .98, 1], L: [-195, -70, 63, 1, 1], T: [139, -350, 8, 1, 1] }],
    [91, 'rest', { rx: 40, yaw: 20, b: [0, 4, -3, 1, .97], T: [146, -341, 18, 1, 1] }],
    [100, 'rest', { rx: 40, yaw: 20, T: [145, -351, 4, 1, 1] }],
  ],
  face: [[0, 'focus'], [9, 'surprise'], [18, 'happy'], [28, 'laugh'], [43, 'focus'],
    [48, 'happy'], [59, 'laugh'], [71, 'proud'], [79, 'wink'], [85, 'proud'], [93, 'happy']],
  gaze: [[0, -7, 3], [10, 6, -6], [19, 5, -6], [34, 0, -4], [42, 3, 7],
    [54, -6, 6], [68, -4, 5], [76, 0, -3], [94, 0, 0], [100, 0, 0]],
};

const loweredPaws = { L: [-153, -29, -8, .94, .96], R: [39, -14, 12, .99, .96] };
const slumped = { ...loweredPaws, yaw: 42, rx: -6, b: [-9, 48, -12, 1.03, .8], T: [171, -247, 72, .95, .95] };
const disappointment = {
  once: true,
  poses: [
    [0, 'side', brake, 'ease-out'],
    [7, 'side', { rx: -4, yaw: 54, b: [5, -1, 7, .96, .98], T: [193, -297, 51, 1, 1] }],
    // A second look. One paw hovers as if to try again, then slowly drops.
    [15, 'stand', { rx: 3, yaw: 34, b: [5, -23, 8, .98, 1], R: [61, -80, 58, .96, 1], T: [151, -338, 16, 1, 1] }],
    [23, 'stand', { rx: 3, yaw: 26, b: [-5, -16, -5, .98, .96], R: [51, -73, 77, .96, 1], T: [148, -329, 19, 1, 1] }],
    [31, 'rest', { ...loweredPaws, yaw: 38, b: [-7, 11, -8, 1, .92], T: [155, -310, 29, 1, 1] }, 'ease-in'],
    [37, 'sit', { ...slumped, b: [-10, 54, -14, 1.07, .77], T: [164, -275, 49, .97, .97] }, 'ease-out'],
    [43, 'sit', { ...slumped, T: [177, -239, 84, .95, .95] }],
    // Scuff the ground twice, then breathe in. The tip still hangs low.
    [49, 'sit', { ...slumped, L: [-181, -21, 37, .97, 1], T: [168, -255, 63, .95, .95] }],
    [54, 'sit', { ...slumped, L: [-129, -18, -22, .97, 1] }],
    [59, 'sit', { ...slumped, L: [-156, -23, 8, .95, 1], b: [-8, 27, -9, .97, .93], T: [164, -279, 52, .96, .96] }],
    [64, 'sit', { ...slumped, L: [-136, -19, -14, .96, 1], b: [-9, 39, -11, 1, .86], T: [166, -262, 58, .95, .95] }],
    [72, 'sit', { ...slumped, b: [-12, 54, -15, 1.05, .76], T: [178, -238, 79, .94, .94] }],
    [78, 'sit', { ...slumped, b: [-10, 49, -13, 1.03, .8], T: [173, -246, 74, .95, .95] }],
    // The eyes come back first. Plant the near paw; the tail follows last.
    [85, 'sit', { ...loweredPaws, yaw: 25, rx: -3, b: [-5, 26, -6, 1, .91], T: [164, -265, 66, .96, .96] }],
    [92, 'sit', { yaw: 18, b: [0, 14, 2, .98, .94], L: [-168, -32, 15, .97, 1], T: [155, -306, 44, .99, .99] }],
    [100, 'sit', { yaw: 18, b: [0, 19, -2, 1, .93], L: [-162, -29, 10, .97, 1], T: [153, -313, 36, .99, .99] }],
  ],
  face: [[0, 'focus'], [8, 'surprise'], [17, 'worried'], [32, 'sad'], [61, 'worried'],
    [67, 'sad'], [82, 'worried'], [92, 'sad']],
  gaze: [[0, -8, 0], [9, 7, -4], [18, -7, 2], [27, -5, 7], [46, -9, 7],
    [55, 1, 7], [62, -6, 4], [73, -8, 7], [81, 2, 1], [92, 0, -2], [100, 0, 0]],
};

// A shadow narrows and softens at the apex, then spreads on impact. Its
// contact point moves with the jump, so the pet actually lands where it leapt.
function jumpShadow({ a }) {
  const beats = [[0,-18,.83,.13],[20,0,1,.19],[32,31,.57,.07],[36,41,.6,.08],
    [43,51,.91,.15],[47,55,1.04,.2],[54,47,.86,.12],[68,40,.99,.17],[100,29,.89,.13]];
  return at(a(`<ellipse rx="175" ry="15" fill="${ink}"/>`,
    beats.map(([time, x, size, alpha]) => [time, t(x, 0, 0, size) + opacity(alpha)])), 320, 555);
}

function sparklingJump({ pet, a, grip }) {
  // A short staggered arc at the apex; the paw glint is anchored to the
  // actual wrist at the second clap, even if the rig proportions change.
  const glint = (x, y, start, size, fill) => at(a(star(fill), [
    [0, t(0, 8, -18, .1) + opacity(0)], [start, t(0, 8, -18, .1) + opacity(0)],
    [start + 3, t(0, 0, 0, size) + opacity(1)], [start + 10, t(5, -15, 27, .12) + opacity(0)],
  ]), x, y);
  const [x, y] = grip(68, 'L');
  return pet() + glint(112, 241, 24, .94, gold) + glint(154, 182, 28, .65, cream)
    + glint(496, 180, 32, .85, gold) + glint(x, y + 22, 68, .8, cream);
}

function sigh({ pet, a }) {
  // The breath stays attached to the projected mouth as the shell slumps.
  const curl = 'M-3 1Q-19 9 -33 4Q-42 0 -39-8';
  const breath = line(curl, ink, 9) + line(curl, cream, 5) + circle(-50, -5, 4, ink) + circle(-50, -5, 2.5, cream);
  const puff = at(a(breath, [
    [0, t(0, 0, 0, .3) + opacity(0)], [62, t(0, 0, 0, .3) + opacity(0)],
    [66, t(-16, 3, -6, .85) + opacity(.92)], [71, t(-58, 0, 6, 1.15) + opacity(.85)],
    [77, t(-92, -11, 12, .9) + opacity(0)],
  ]), -102, -113);
  return pet({ extra: puff });
}

export const reconReactions = {
  'recon-success': { plan: celebration, draw: sparklingJump, shadow: jumpShadow, poster: .32,
    description: '根号兽跃起、落地拍爪，再抬爪眨眼。', descriptionEn: 'Root Beast springs up, lands, claps twice and winks.' },
  'recon-failure': { plan: disappointment, draw: sigh, poster: .46,
    description: '根号兽停下，垂尾坐低，轻叹一口气，再抬起眼睛。', descriptionEn: 'Root Beast stops, lets its tail droop, sighs, then looks up again.' },
};
