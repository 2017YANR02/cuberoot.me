# 根号兽 B2

The approved CubeRoot B2 character has a rounded red/blue shell, four short paws and a radical tail with a superscript 3. Its visible three rows stay red/red/red, blue/red/blue, blue/red/blue.

`parts/*.svg` contains actual VTracer outlines from the approved B2 sprite artwork, quantized to four colors sampled from its pixels. The originals remain in the design archive under `.tmp/png/`; these source outlines make rebuilding independent of that archive. `parts.json` records the source dimensions and palette. Do not redraw the character by guessing path coordinates.

`character.mjs` articulates the traced skin through twelve base poses: standing, sitting, crouching, profile, back, airborne, curled, rolling onto the side, bowing, kneeling, balancing on one foot, and resting on all fours. Four independent paw joints remain attached beneath the shell; hand-held props follow the paws. Turns deform the complete original outline through adjoining strips of one continuous projection, with a smooth transition between front and side widths. The rounded side retains depth when facing forward. The asymmetric skin never flips in one frame: glances use gaze and head tilt, while full turns use continuous front/side/back views. The face disappears at the profile crossing instead of fading across the back.

Eyes have separate whites, clipped pupils, lids and brows. Gaze and fourteen facial expressions have independent timelines: neutral, happy, laughing, crying, angry, surprised, sleeping, worried, proud, winking, focused, yawning, shy and sad. Crying adds falling tears. Only the sleeping loop intentionally keeps its closed gaze still. The approved shell's original smile is detached so it cannot show through a different mouth.

Gaze changes take 85 ms followed by a held target. Blinks close in 60 ms and open in 100 ms, independent of scene length; already closed expressions skip blinking. Active scenes run in 1.6–3.8 seconds with distinct anticipation, action and settling beats; idle/sleep retain quiet breathing. Pose tuples optionally supply an outgoing easing curve, so takeoff, airborne rotation and landing do not all ease in and out. Timer digits use actual elapsed centiseconds from the scene duration. Every puzzle prop uses `cube-motion.mjs`: each quarter-turn projects twelve intermediate U-layer positions while the lower layers stay fixed. Solving practice starts at U2 and performs two U' turns to reach the solved state. POP ejects the actual UF edge, leaves a notch, and returns the same piece.

`choreography.mjs` owns the body, gaze and expression timelines. `rig.mjs` supplies the shared SVG animation and prop helpers. `build-rootbeast.mjs` owns props, descriptions, durations and the generated manifest. Cube props use `@cuberoot/visualcube`. The existing Clawd interaction and gallery player are reused, with original choreography for this character.

Standing keeps short, weight-bearing hind legs; resting seated paws sit below the eyes. Walking alternates diagonal foot contacts, and skateboard feet stay fixed to the deck while the torso balances. Blocks and the falling star transfer from moving paws at explicit contact beats. Timer paws meet the two pads at both start and stop. Small reactions use a flinch and recovery instead of an unrelated full-body roll.

From `core/packages/client`:

```sh
node scripts/deskpet-rootbeast/build-rootbeast.mjs
node scripts/deskpet-rootbeast/build-rootbeast.mjs --check
```

The traced shell already includes perspective, so turns smoothly limit the side/front stretch ratio to 1.65 while preserving projected width. This keeps its bread-like contour instead of stretching the flank into a wedge. Face placement and eye/paw clearance use the same bounded projection.

The generated transparent SVGs contain their own paths and CSS timelines; they use no scripts, bitmap sprites, video, network fonts or remote images. Every loop has a reduced-motion poster. When revising published assets, bump `ROOTBEAST_VERSION` in `lib/deskpet-rootbeast.ts` because `/deskpet/` uses immutable caching.

The same manifest supplies gallery previews and character-specific event states (`rootbeast:<id>`). Gallery playback can pause, seek, replay and switch within the selected collection. Selecting “Play on the pet” switches to Root Beast and exits edge-cling/rest before starting a full loop. Regular application reactions use the existing state names, including `happy`, `thinking`, `working` and `sleeping`.

`ROOTBEAST_COLLECTIONS` in `lib/deskpet-rootbeast.ts` is the single source for WeChat release membership. The gallery offers all animations, 第一期 日常回应 (Everyday Reactions), 第二期 魔方奇遇 (Cube Adventures), and 候选 (Candidates). Each release contains 24 distinct scenes; the cube-pop scene belongs to Cube Adventures. Idle, walk and stretch remain candidates, available on the website without duplicating scenes to fill another release. The collection selector affects Root Beast only; other pets keep their complete galleries. Future export tooling should consume these scene IDs instead of maintaining another release list.
