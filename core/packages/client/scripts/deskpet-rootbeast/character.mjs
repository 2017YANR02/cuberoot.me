// The approved VTracer outlines are the skin; this rig owns articulation.
// Turns continuously deform the complete traced shell. No
// bitmap frames, perspective-flattened screenshot, or runtime script is used.
const base = {
  yaw: 28, b: [0, 0, 0, 1, 1],
  L: [-201, -58, 0, 1, 1], R: [40, -50, 0, 1.1, 1],
  HL: [-116, -70, 0, .8, .8], HR: [213, -84, 0, .9, 1.1],
  T: [145, -355, 0, 1, 1], rx: 0, ry: 0, spin: 0, zoom: 1,
};
export const poses = {
  rest: base,
  stand: { ...base, yaw: 8, b: [0, -48, 0, .9, 1], L: [-195, -65, 30, .94, 1], R: [166, -65, -30, .94, 1], HL: [-92, -81, -7, 1.03, 1.18], HR: [105, -80, 7, 1.03, 1.18], T: [124, -336, 16, .9, .9] },
  sit: { ...base, yaw: 12, b: [0, 19, -2, .94, .97], L: [-205, -25, 0, .93, .94], R: [180, -38, 20, .93, .94], HL: [-167, -17, 57, 1.1, .8], HR: [140, -13, -57, 1.1, .8], T: [153, -343, 23, .9, .9] },
  low: { ...base, b: [0, 68, -3, 1.07, .74], L: [-237, -16, 50, 1.04, .8], R: [58, -7, 49, 1.04, .8], HL: [-107, -22, -28, .8, .65], HR: [244, -40, -36, .95, .85], T: [164, -352, 47, 1, 1] },
  side: { ...base, yaw: 72, b: [0, -5, -4, 1, .95], L: [-166, -48, 20, .8, 1], R: [-103, -27, -20, .96, 1], HL: [124, -62, -18, .76, .9], HR: [184, -35, 21, 1, 1], T: [197, -305, 31, 1, 1] },
  back: { ...base, yaw: 160, L: [-131, -71, 10, .8, 1], R: [134, -72, -10, .8, 1], HL: [-187, -42, -12, 1, 1], HR: [195, -44, 12, 1, 1], T: [36, -221, -24, 1.13, 1.13] },
  air: { ...base, yaw: 6, b: [0, -26, 0, .91, 1.01], L: [-200, -60, 75, .9, 1], R: [176, -60, -75, .9, 1], HL: [-101, -60, 27, .95, .9], HR: [126, -53, -27, .95, .9], T: [165, -360, -16, .9, .9], ry: -44 },
  curl: { ...base, yaw: 28, b: [0, 68, 0, 1.03, .78], L: [-206, -7, 52, 1, .6], R: [55, -3, 47, 1, .6], HL: [-90, -11, -10, .75, .5], HR: [207, -12, -14, .9, .55], T: [147, -267, 52, .72, .72], ry: 8 },
  belly: { ...base, yaw: 0, b: [0, 0, 0, .87, .85], L: [-190, -45, 75, .95, .9], R: [166, -45, -75, .95, .9], HL: [-129, -58, -43, .95, 1], HR: [129, -58, 43, .95, 1], T: [180, -294, 45, .8, .8], spin: -85, ry: -15, zoom: .87 },
  bow: { ...base, yaw: 57, b: [-23, 43, -18, 1, .82], L: [-237, 1, 59, 1.1, .8], R: [-91, 22, 52, 1.1, .8], HL: [100, -106, -24, .85, 1.3], HR: [206, -119, -29, 1, 1.45], T: [147, -328, -14, 1, 1] },
  kneel: { ...base, yaw: 53, b: [8, 0, 12, .9, .96], L: [-175, -160, -51, .95, 1.12], R: [87, -161, 58, .95, 1.12], HL: [-74, -43, 78, .9, .9], HR: [188, -23, -67, 1, .9], T: [154, -342, 24, .9, .9] },
  oneleg: { ...base, yaw: 12, b: [0, -49, 7, .91, 1], L: [-195, -65, 65, .95, 1], R: [166, -65, -65, .95, 1], HL: [-60, -79, 0, 1.03, 1.15], HR: [119, -131, -55, 1, .94], T: [149, -331, -24, .9, .9], ry: -5 },
};

const number = n => Number(n.toFixed(4));
function view(yaw) {
  const angle = Math.abs(yaw) * Math.PI / 180;
  const front = Math.max(.12, Math.abs(Math.cos(angle)) * 1.11);
  // Keep a little rounded depth when facing forward; a zero-width side turns
  // the outer contour into a straight cut, even with a continuous projection.
  const side = Math.max(.28, 2.48 * Math.abs(Math.sin(angle)));
  const width = 386 * front + 124 * side;
  // The traced skin already has perspective. Applying the full cosine/sine
  // ratio again stretches its rounded flank into a wedge (over 3:1 at 55°).
  // Ease the extra depth toward a bounded ratio, preserving the projected
  // width and using the same front scale for the face and its paw clearance.
  const ratio = side / front;
  const depth = ratio <= 1 ? ratio : 1 + .65 * Math.tanh((ratio - 1) / .65);
  const f = width / (386 + 124 * depth), s = f * depth;
  return { f, s, width, tx: -width / 2 + 248 * f, face: Math.abs(yaw) < 89 ? 1 : 0 };
}

const bounds = points => ({
  left: Math.min(...points.map(p => p[0])), right: Math.max(...points.map(p => p[0])),
  top: Math.min(...points.map(p => p[1])), bottom: Math.max(...points.map(p => p[1])),
});
const rotate = (x, y, angle) => {
  const radians = angle * Math.PI / 180;
  return [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)];
};
// Samples of the approved traced paw outline in its 104×109 use viewport.
// Rotating an empty rectangular viewport exaggerated eye collisions and
// pushed the real paw away from its body, especially in curled poses.
const pawContour = [[23.9,-7.2],[36.4,-4.9],[46.3,3],[51.2,14.8],[50.4,27.2],[46.3,39.3],[39.4,50.3],[33.8,60.9],[28.9,72.6],[19,80.9],[6.9,84.7],[-5.6,85.9],[-18.4,85.9],[-30.9,84.3],[-42.2,78.7],[-49.8,68.5],[-50.9,56],[-46.8,43.9],[-39.2,33.7],[-29.4,25.3],[-18.8,18.5],[-7.8,11.7],[2.4,4.2],[11.5,-4.5]];

// Resolve the same pose for paws, connectors and props. Keep the full eye
// region clear even while blinking; expression changes must not move a hand.
export function resolvePose(name, change = {}) {
  if (!poses[name]) throw Error(`Unknown pose ${name}`);
  const state = { ...poses[name], ...change };
  const v = view(state.yaw);
  const [bx, by, angle, sx, sy] = state.b;
  // Paws grow directly from the lower shell. Keep their wrists inside that
  // short attachment band instead of filling distant targets with long limbs.
  for (const bone of ['L', 'R', 'HL', 'HR']) {
    const front = bone === 'L' || bone === 'R';
    const [px, py, rotation, scaleX, rawScaleY] = state[bone];
    const scaleY = Math.min(rawScaleY, 1);
    const wrist = rotate(front ? 28 * scaleX : 0, front ? 9 * scaleY : 0, rotation);
    const local = rotate(px + wrist[0] - bx, py + wrist[1] + 190 - by, -angle);
    const localX = Math.max(-v.width / 2 + 30, Math.min(v.width / 2 - 30, local[0] / sx));
    const localY = Math.max(100, Math.min(155, local[1] / sy));
    const anchor = rotate(localX * sx, localY * sy, angle);
    state[bone] = [anchor[0] + bx - wrist[0], anchor[1] + by - 190 - wrist[1], rotation, scaleX, scaleY];
  }
  if (!v.face) return state;
  const eyes = [-192, 45].map(eyeX => bounds([-37, 37].flatMap(dx => [-40, 40].map(dy => {
    const [x, y] = rotate(((eyeX + dx) * v.f + v.tx) * sx, (50 + dy) * sy, angle);
    return [x + bx, y + by - 190];
  }))));
  for (const bone of ['L', 'R']) {
    const [px, py, rotation, scaleX, scaleY] = state[bone];
    const paw = bounds(pawContour.map(([x, y]) => {
      const [rx, ry] = rotate(x * scaleX, y * scaleY, rotation);
      return [px + rx, py + ry];
    }));
    const obstacles = eyes.filter(eye => paw.right > eye.left - 5 && paw.left < eye.right + 5 && paw.bottom > eye.top - 5 && paw.top < eye.bottom + 5);
    if (obstacles.length) state[bone] = [px, py + Math.max(...obstacles.map(eye => eye.bottom + 5 - paw.top)), rotation, scaleX, scaleY];
  }
  return state;
}

export function animateCharacter({ a, part, at, t, plan, options, id, duration, pawGrip, colors }) {
  const { ink, cream, pink, blue } = colors;
  const { x = 320, y = 520, scale = .73, front = '', extra = '', held = [], carried = '' } = options;
  const keys = plan.poses.map(([time, name, change = {}, curve]) => {
    if (!poses[name]) throw Error(`Unknown pose ${name}`);
    const state = resolvePose(name, change);
    if (![state.yaw, state.rx, state.ry, state.spin, state.zoom, ...state.b, ...state.L, ...state.R, ...state.HL, ...state.HR, ...state.T].every(Number.isFinite)) throw Error('Non-finite pose coordinate');
    return [time, state, curve];
  });
  if (keys.at(-1)[0] !== 100) keys.push([100, keys[0][1]]);
  const frames = fn => keys.map(([time, state, curve]) => [time, fn(state), curve]);
  // This traced three-quarter shell is asymmetric: mirroring it in one frame
  // teleports the face relative to the paws. Use continuous front/side/back
  // views; a glance to the other side is performed by the eyes and head tilt.
  if (keys.some(([, s]) => s.yaw < 0 || s.yaw > 180)) throw Error('Yaw must stay between front and back (0–180 degrees)');
  const views = keys.map(([time, state, curve]) => [time, state.yaw, curve]);
  const viewFrames = fn => views.map(([time, yaw, curve]) => [time, fn(view(yaw)), curve]);
  const joint = values => t(...values);
  // Only the root-sign stalk needs a connector. Paws attach directly.
  let previousAngle;
  const connections = a(`<rect x="0" y="-7.5" width="100" height="15" rx="7.5" fill="${ink}"/>`, frames(s => {
    const cx = s.b[0], cy = -190 + s.b[1];
    const dx = s.T[0] - cx, dy = s.T[1] - cy;
    let direction = Math.atan2(dy, dx) * 180 / Math.PI;
    if (previousAngle !== undefined) {
      while (direction - previousAngle > 180) direction -= 360;
      while (direction - previousAngle < -180) direction += 360;
    }
    previousAngle = direction;
    return t(cx, cy, direction, Math.hypot(dx, dy) / 100, 1);
  }));
  const limb = (name, bone, w, h) => `<g data-rig-part="${bone}">${a(`<g transform="scale(1 ${name === 'rear' ? .64 : 1})">${part(name, -w / 2, -15, w, h)}</g>`, frames(s => joint(s[bone])))}</g>`;
  const hind = limb('rear', 'HL', 100, 120) + limb('rear', 'HR', 106, 123);
  const arms = limb('paw', 'L', 104, 109) + limb('paw', 'R', 106, 109);
  // A shared projection keeps every part of the original outline. Adjacent
  // strips meet at the same animated coordinate, including between keyframes.
  // Blend the front/side scales smoothly instead of cutting the roof and flank
  // into two independently moving rectangles.
  const project = (x, v) => {
    const z = x + 248, u = Math.max(0, Math.min(1, (z - 341) / 90));
    const depth = z >= 431 ? z - 386 : 90 * (u ** 3 - u ** 4 / 2);
    return -v.width / 2 + v.f * z + (v.s - v.f) * depth;
  };
  // Only the curved transition needs subdivisions; the broad front and far
  // side each stay a single strip to keep gallery playback inexpensive.
  const edges = [-248, 93, 108, 123, 138, 153, 168, 183, 262];
  // Composite the traced paints before clipping so their white underpaint
  // cannot leak along strip edges in <img>. Near-opaque group opacity keeps
  // this isolation without the identity filter's blurry scaled raster surface.
  // Keep this below 1: fully opaque groups lose the isolation in Chromium.
  const surface = edges.slice(0, -1).map((left, i) => {
    const right = edges[i + 1];
    const clip = `rb-view-${id}-${i}`;
    // Overlap neighboring strips and use hard clip edges: fractional clip
    // coverage blends the skin's white base through its colored paths, leaving
    // pale vertical seams. Only the invisible clip is crisp; traced contours
    // retain their normal antialiasing.
    return `<clipPath id="${clip}"><rect shape-rendering="crispEdges" x="${left - 2}" y="-390" width="${right - left + 4}" height="410"/></clipPath>`
      + a(`<g data-shell-strip="${i}" clip-path="url(#${clip})"><g opacity="0.999">${part('shell', -248, -371, 510, 352)}</g></g>`, viewFrames(v => {
        const sx = (project(right, v) - project(left, v)) / (right - left);
        return `transform:matrix(${number(sx)},0,0,1,${number(project(left, v) - sx * left)},0);`;
      }));
  }).join('');
  const whiteShape = `<g style="color:${cream}">${part('eye-outline', -34, -43, 68, 86)}</g>`;
  const expressions = [...new Set(plan.face.map(([, name]) => name))];
  const expressionLayer = (name, art) => a(art, plan.face.map(([time, expression]) => [time, `opacity:${expression === name ? 1 : 0};`]), '0px 0px', 'steps(1,end)');
  const path = (d, stroke = ink, width = 8) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ellipse = (cx, cy, rx, ry, fill = ink) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;
  const eye = (px, side) => {
    const clip = `rb-eye-${id}-${side}`;
    const pupil = ellipse(0, 0, 22, 29) + ellipse(-7, -13, 7, 9, cream);
    // An eye acquires a target in 85 ms, then holds it. Stretching the motion
    // over the whole beat made the character look unfocused and mechanical.
    // The original eye uses meet scaling: 68×86 contains a 68×72 traced
    // outline. Keep extreme glances inside that white rather than its frame.
    const targets = plan.gaze.map(([time, gx, gy, size = 1]) => [time, Math.max(-9, Math.min(9, gx)), Math.max(-7, Math.min(7, gy)), size]);
    if (targets.at(-1)[0] !== 100) targets.push([100, ...targets[0].slice(1)]);
    const gazeFrames = targets.flatMap(([time, gx, gy, size = 1], i) => {
      const current = [time, t(gx, gy, 0, size)];
      if (!i) return [current];
      const [previous, x, y, scale = 1] = targets[i - 1];
      return [[Math.max(previous, time - 8.5 / duration), t(x, y, 0, scale)], current];
    });
    const gaze = a(`<g data-rig-part="pupil">${pupil}</g>`, gazeFrames, undefined, 'linear');
    const open = `${whiteShape}<g clip-path="url(#${clip})">${gaze}</g>`;
    const emotion = expressions.map(name => {
      if (['sleep', 'laugh', 'cry', 'yawn'].includes(name) || name === 'wink' && side === 'right') {
        const smileEye = ['laugh', 'wink'].includes(name);
        return expressionLayer(name, path(`M-26 ${smileEye ? 7 : -4} Q0 ${smileEye ? -23 : 24} 26 ${smileEye ? 7 : -4}`));
      }
      const sx = name === 'surprise' ? 1.13 : 1;
      const sy = name === 'focus' || name === 'proud' ? .92 : name === 'angry' ? .85 : name === 'worried' ? .96 : 1;
      return expressionLayer(name, `<g transform="scale(${sx} ${sy})">${open}</g>`);
    }).join('');
    // Closing/opening takes 60/100 ms regardless of the scene length. A
    // sleeping or laughing eye is already closed and must not blink again.
    const blinkFrames = [[0, t()]];
    for (const time of duration >= 4 ? [23, 76] : [76]) {
      const expression = plan.face.filter(([at]) => at <= time).at(-1)?.[1];
      if (['sleep', 'laugh', 'cry', 'yawn'].includes(expression)) continue;
      blinkFrames.push([time, t()], [time + 6 / duration, t(0,0,0,1,.05)], [time + 16 / duration, t()]);
    }
    const blink = a(`<g data-rig-part="eyelids">${emotion}</g>`, blinkFrames, '0px 0px', 'linear');
    const brow = expressions.map(name => {
      let d = '';
      if (name === 'angry') d = side === 'left' ? 'M-30-50 25-30' : 'M-25-30 30-50';
      if (['sad','cry','worried'].includes(name)) d = side === 'left' ? 'M-27-41Q0-42 25-58' : 'M-25-58Q0-42 27-41';
      if (name === 'surprise') d = 'M-25-55Q0-70 25-55';
      if (name === 'proud') d = side === 'left' ? 'M-25-49 25-55' : 'M-25-56 25-45';
      return d ? expressionLayer(name, path(d, ink, 7)) : '';
    }).join('');
    const tear = expressionLayer('cry', a(ellipse(side === 'left' ? -23 : 23, 36, 10, 20, cream) + ellipse(side === 'left' ? -23 : 23, 34, 6, 15, blue), [[0,t(0,-4)+ 'opacity:0;'],[25,t(0,19)+'opacity:1;'],[49,t(0,46)+'opacity:0;'],[50,t(0,-4)+'opacity:0;'],[75,t(0,19)+'opacity:1;'],[99,t(0,46)+'opacity:0;']], undefined, 'linear'));
    // A clipPath cannot portably reference a symbol through a nested group.
    // Keep one direct clip geometry per eye, outside the expression layers.
    return at(`<clipPath id="${clip}"><ellipse cx="0" cy="0" rx="31" ry="34"/></clipPath>` + blink + brow + tear, px, -140);
  };
  const mouths = {
    neutral: path('M-17 0Q0 11 17 0', ink, 7),
    happy: path('M-24-3Q0 25 24-3', ink, 9),
    laugh: ellipse(0, 3, 31, 25) + ellipse(0, 15, 18, 9, pink),
    cry: ellipse(0, 8, 21, 25) + ellipse(0, 22, 13, 5, pink),
    angry: path('M-24 10Q0-11 24 10', ink, 8),
    surprise: ellipse(0, 5, 16, 22),
    sleep: path('M-12 3Q0 9 12 3', ink, 6),
    worried: path('M-24 7Q-8-3 0 7T24 7', ink, 7),
    proud: path('M-22 1Q6 19 26-11', ink, 8),
    wink: path('M-23-1Q0 22 23-1', ink, 8),
    focus: path('M-17 5H17', ink, 7),
    yawn: ellipse(0, 5, 19, 33) + ellipse(0, 23, 11, 6, pink),
    shy: path('M-15 1Q0 17 15 1', ink, 7),
    sad: path('M-22 10Q0-9 22 10', ink, 7),
  };
  for (const name of expressions) if (!mouths[name]) throw Error(`Unknown expression ${name}`);
  const mouth = at(expressions.map(name => expressionLayer(name, mouths[name])).join(''), -74, -112);
  const cheeks = expressions.filter(name => ['happy','laugh','shy','wink'].includes(name)).map(name => expressionLayer(name, `<g opacity=".72">${ellipse(-192,-95,22,10,pink)}${ellipse(45,-95,23,10,pink)}</g>`)).join('');
  const faceArt = eye(-192, 'left') + eye(45, 'right') + mouth + cheeks + extra;
  // Switch visibility at the profile crossing instead of fading a ghost face
  // across the back of the shell for the entire turning beat.
  const visibility = [[0, `opacity:${view(views[0][1]).face};`]];
  for (let i = 1; i < views.length; i++) {
    const [from, before] = views[i - 1], [to, after] = views[i];
    if (view(before).face === view(after).face) continue;
    const crossing = from + (to - from) * (89 - Math.abs(before)) / (Math.abs(after) - Math.abs(before));
    visibility.push([crossing, `opacity:${view(after).face};`]);
  }
  const face = a(a(`<g data-rig-part="face">${faceArt}</g>`, visibility, undefined, 'steps(1,end)'), viewFrames(v => {
    return `transform:matrix(${number(v.f)},0,0,1,${number(v.tx)},0);`;
  }));
  const shell = a(`<g data-rig-part="shell">${surface + face}</g>`, frames(s => joint(s.b)), '0px -190px');
  const tail = a(`<g class="rb-tail-outline">${part('tail', -59.4, -160.72, 180, 164)}</g>`, frames(s => joint(s.T)));
  const heldArt = held.map(({ bone = 'L', art, angle = 0, size = 1, inFront = false }) => {
    // Follow the wrist's rotation arc, not a straight line between grips.
    // Counter-rotate the artwork so books and cups keep their intended tilt.
    const item = a(`<g data-held-by="${bone}">${art}</g>`, frames(s => {
      const [, , rotation, , sy] = s[bone];
      const [gx, gy] = pawGrip([0, 0, 0, 1, sy]);
      return t(gx, gy, angle - rotation, size);
    }));
    return { inFront, svg: a(item, frames(s => t(...s[bone].slice(0, 3)))) };
  });
  const carriedArt = carried ? a(carried, frames(s => joint(s.b)), '0px -190px') : '';
  const model = connections + tail + hind + shell + carriedArt + heldArt.filter(item => !item.inFront).map(item => item.svg).join('') + arms + heldArt.filter(item => item.inFront).map(item => item.svg).join('') + front;
  // Rotation is about the body centre, so rolling never swings the entire
  // character around a distant ground anchor.
  const motion = a(model, frames(s => `transform:translate(${s.rx}px,${s.ry}px) translate(0,-190px) rotate(${s.spin}deg) scale(${s.zoom}) translate(0,190px);`));
  return `<g data-character-rig="articulated" data-pose-count="${keys.length}">${at(motion, x, y, scale)}</g>`;
}
