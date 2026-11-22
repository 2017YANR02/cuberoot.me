# cuberoot.js

Embed an interactive twisty-puzzle replay. Give the player a scramble and a solution, then play, pause, step or scrub through the moves. Each player has its own playback state.

The puzzle catalogue comes from the CubeRoot `/sim` selector. It includes NxN from order 1 to 400, shape mods, Square puzzles, Clock, Magic, named PuzzleGeometry puzzles and custom cuts. Playback uses the same puzzle geometry and move notation as the corresponding simulator backend.

## Embed in HTML

Extract the npm archive and copy the contents of `package/dist/` to a folder served by your site, such as `cuberoot-js/`. Serve the HTML and package files over HTTP or HTTPS in a browser with WebGL 2 support.

```html
<script type="module" src="./cuberoot-js/element.js"></script>
<cuberoot-player setup-alg="R U F2" alg="F2 U' R'"></cuberoot-player>
<cuberoot-player puzzle="4x4x4" setup-alg="Rw U" alg="U' Rw'"></cuberoot-player>
<cuberoot-player puzzle="sq1" setup-alg="(1,0)" alg="(-1,0)"></cuberoot-player>
<cuberoot-player puzzle="custom" puzzle-description="c f 0.255" alg="R U"></cuberoot-player>
```

| Attribute | Behavior |
| --- | --- |
| `puzzle` | Use a simulator ID such as `sq1`, `clock`, `mirror2` or `baby_fto`, or an NxN size such as `4x4x4`. The default is `3x3x3`. |
| `order` | Set the NxN order when `puzzle` is omitted or `nxn`. |
| `puzzle-description` | Supply a PuzzleGeometry description for custom cuts. A description also selects `custom` when `puzzle` is omitted. |
| `setup-alg` | Apply these moves before playback. The default starts from a solved cube. |
| `alg` | Animate these moves. |
| `autoplay` | Start on mount and when the sequence changes. |
| `playback-rate` | Set playback speed. Use a finite number greater than zero. The default is `1`. |
| `no-interaction` | Disable dragging to orbit the cube. |
| `lang` | Set to `zh` for Chinese controls. The element also picks up the surrounding document language. |

The element uses the same playback bar as `/sim`, with a progress slider, five transport buttons and playback speed controls. In narrow embeds, adjust the speed from the gear menu. The element fills the available width. To limit its size, style `cuberoot-player` with `max-width`. To style internal areas, use `::part(viewport)`, `::part(controls)`, `::part(seek)`, or `::part(settings)`. For error handling, listen for `cuberoot-error` on the element. The event’s `detail` contains the error.

## Install a local build with npm

Install the archive in your own project.

```sh
npm install /path/to/cuberoot.js-0.2.1.tgz
```

Load the Web Component from your application with `import 'cuberoot.js/element'`, or use the JavaScript API with your own controls. Give the host element a width and height so the canvas has room to render.

```html
<div id="replay" style="max-width: 24rem; aspect-ratio: 4 / 3"></div>
```

```js
import { createPlayer } from 'cuberoot.js';

const host = document.getElementById('replay');
if (!host) throw new Error('Replay container was not found');
const player = createPlayer(host, { puzzle: '4x4x4', setupAlg: 'Rw U', alg: "U' Rw'" });
await player.ready;

const unsubscribe = player.subscribe(({ step, moveCount }) => {
  console.log(`${step} / ${moveCount}`);
});

player.play();

// On teardown:
// unsubscribe();
// player.dispose();
```

`supportedPuzzles` lists the accepted simulator IDs. Adding a new catalogued puzzle to `/sim` and its backend makes it available to consumers of the rebuilt package. Setup and replay use the selected puzzle's notation. NxN accepts wide turns, slices, rotations, groups, commutators, conjugates and `//` comments. Use `.` for a timed replay pause.

| API | Behavior |
| --- | --- |
| `createPlayer(host, options?)` | Mount a player. Options are `puzzle`, `order`, `puzzleDescription`, `setupAlg`, `alg`, `playbackRate` and `interactive`. |
| `player.ready` | Await model and sequence loading before changing the algorithm, seeking or reading facelets. Loads synchronously on NxN and its shape mods. |
| `player.puzzle` | Read the active simulator ID or numeric NxN order. |
| `player.play()` | Play, resume a paused turn, or start from the beginning after the last step. |
| `player.pause()` | Pause playback at the current position. |
| `player.seek(step)` | Pause and show the exact state after `step` completed moves. Step `0` shows the setup state. |
| `player.setAlgorithm({ setupAlg, alg })` | Replace the sequence and return to step `0`. Each omitted string defaults to empty. |
| `player.setPlaybackRate(rate)` | Change playback speed. |
| `player.state` | Read `ready`, `step`, `moveCount`, `playing` and `playbackRate`. |
| `player.getFacelets()` | Read the current committed NxN or shape-mod facelets in URFDLB order. |
| `player.subscribe(listener)` | Receive the current state immediately and future changes. Returns an unsubscribe function. |
| `player.dispose()` | Release the canvas and playback resources. |

## Build from this repository

From `core/`, build the browser modules and produce a local npm archive.

```sh
pnpm --filter cuberoot.js pack:local
```

The browser entry is `packages/cuberoot-js/dist/element.js`. The local npm archive is `packages/cuberoot-js/dist/cuberoot.js-0.2.1.tgz`.
