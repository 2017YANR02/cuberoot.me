import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { liveCubeSceneRotation } from '@cuberoot/puzzle-render-core/engine/viewControls';
import tweener from '@cuberoot/puzzle-render-core/engine/tweener';
import { Color, Group, type MeshLambertMaterial } from '@cuberoot/puzzle-render-core/support/three';
import { LiveTurnCadence, liveSimNeedsCatchUp, LIVE_VISUAL_BUDGET_MS, appendedSlicePair } from '@cuberoot/shared/timer/sim-log';
import { applyOrientation, calibrate, mirrorForBrand, sensorBasisForBrand,
  quatAngleTo, slerpTowards, SLICE_ORIENTATION_FOLLOW_MS, SLICE_ORIENTATION_TAU_MS,
  type Quat } from '@cuberoot/shared/smart-cube/orientation';

/** iOS NxN scene without the DOM/WebGL host. Native code only draws its meshes
 * and matrices; layer selection, geometry and tweening remain in the original
 * engine. Run in an isolated JS context, never the timer's. */
export function createNativeCubeScene() {
  const cube = new Cube(3), root = new Group();
  root.add(cube);
  const view = liveCubeSceneRotation('smart', false);
  root.rotation.set(view.x, view.y, view.z);
  const renderer = cube.instancedRenderer;
  renderer.hint = false;
  const meshes = [renderer.staticFrame, renderer.movingFrame, renderer.staticInner,
    renderer.movingInner, renderer.staticSticker, renderer.movingSticker];
  const geometries = [...new Set(meshes.map(mesh => mesh.geometry))];
  const cache = meshes.map(() => ({ matrix: '', instances: -1, colors: -1, count: -1 }));
  const cadence = new LiveTurnCadence(), color = new Color();
  let authoritative: string | null = null, lastFrame = 0, replayMode = false;
  let previousMove = '', sliceFollowUntil = 0;
  let reference: Quat | null = null, target: Quat | null = null, smoothed: Quat | null = null;

  function reset(facelets: string, resetCadence = true) {
    if (!/^[URFDLB]{54}$/.test(facelets)) throw new Error('Invalid display facelets');
    cube.twister.setup('');
    for (const piece of cube.initials.values()) for (let face = 0; face < 6; face++) {
      if (!piece.initialColors[face]) continue;
      const sid = engineHomeSid(piece.initial, face, 3);
      cube.stick(piece.initial, face, facelets['URFDLB'.indexOf(sid[0]) * 9 + Number(sid.slice(1))]);
    }
    authoritative = facelets;
    if (resetCadence) { cadence.reset(); previousMove = ''; sliceFollowUntil = 0; }
  }
  function advance(now: number) {
    now = Math.max(lastFrame, now);
    const dt = lastFrame ? Math.max(0, now - lastFrame) : 0;
    lastFrame = now;
    if (!replayMode && dt > LIVE_VISUAL_BUDGET_MS && authoritative && cube.twister.backlog) reset(authoritative);
    else tweener.update(dt * 60 / 1000);
    if (target) {
      smoothed = smoothed ? slerpTowards(smoothed, target, dt,
        now < sliceFollowUntil ? SLICE_ORIENTATION_TAU_MS : undefined) : target;
      cube.quaternion.set(smoothed.x, smoothed.y, smoothed.z, smoothed.w);
      cube.updateMatrix();
    }
  }
  return {
    assets() {
      return {
        geometries: geometries.map(geometry => ({
          positions: Array.from(geometry.getAttribute('position').array),
          normals: Array.from(geometry.getAttribute('normal').array),
          indices: geometry.index ? Array.from(geometry.index.array) :
            Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i),
        })),
        meshes: meshes.map(mesh => {
          const material = mesh.material as MeshLambertMaterial;
          return { geometry: geometries.indexOf(mesh.geometry), capacity: mesh.instanceMatrix.count,
            color: material.color.getHexString(), opacity: material.opacity };
        }),
      };
    },
    reset, advance,
    /** Replay uses the same NxN setup/append path as SimCubeView, including
     * wide/slice moves and rotations. No facelet tracker reinterprets them. */
    replaySetup(alg: string) {
      replayMode = true;
      cube.twister.setup(alg);
      authoritative = cube.serialize();
    },
    replayMove(token: string, durationTicks: number) {
      cube.twister.push(token, false, 1, durationTicks, 'linear');
    },
    /** Recorded v2 poses are already calibrated by the shared attempt producer. */
    pose(q: Quat) {
      target = smoothed = q;
      cube.quaternion.set(q.x, q.y, q.z, q.w);
      const rotation = liveCubeSceneRotation('smart', true);
      root.rotation.set(rotation.x, rotation.y, rotation.z);
    },
    resetOrientation(q: Quat | null) {
      reference = q ? calibrate(q) : null;
      target = smoothed = q ? applyOrientation(q, reference!, {
        basis: sensorBasisForBrand('gan-v4'), mirror: mirrorForBrand('gan-v4'),
      }) : null;
      cube.quaternion.set(0, 0, 0, 1);
      if (smoothed) cube.quaternion.set(smoothed.x, smoothed.y, smoothed.z, smoothed.w);
      const rotation = liveCubeSceneRotation('smart', !!q);
      root.rotation.set(rotation.x, rotation.y, rotation.z);
      previousMove = ''; sliceFollowUntil = 0;
    },
    move(move: string, facelets: string, timestamp: number, now: number) {
      if (!authoritative) { reset(facelets); return; }
      const durationMs = cadence.durationMs(timestamp, now), ticks = durationMs * 60 / 1000;
      cube.twister.accelerateRealtime(ticks);
      if (now - timestamp > LIVE_VISUAL_BUDGET_MS) {
        // Resync to the real current snapshot, never to a fabricated solved log.
        reset(facelets);
        return;
      }
      if (liveSimNeedsCatchUp(cube.twister.remainingTicks * 1000 / 60, 1, durationMs)) {
        // Finish stale work at the prior real state, preserving the newest turn.
        reset(authoritative, false);
      }
      if (appendedSlicePair(previousMove, `${previousMove} ${move}`.trim())) {
        sliceFollowUntil = now + SLICE_ORIENTATION_FOLLOW_MS;
      }
      previousMove = move;
      authoritative = facelets;
      cube.twister.push(move, false, 1, ticks, 'linear');
    },
    gyro(q: Quat) {
      if (![q.w, q.x, q.y, q.z].every(Number.isFinite) || Math.hypot(q.w, q.x, q.y, q.z) < 1e-6) return;
      if (!reference) {
        reference = calibrate(q);
        const rotation = liveCubeSceneRotation('smart', true);
        root.rotation.set(rotation.x, rotation.y, rotation.z);
      }
      target = applyOrientation(q, reference, { basis: sensorBasisForBrand('gan-v4'), mirror: mirrorForBrand('gan-v4') });
    },
    frame(now: number) {
      advance(now);
      root.updateMatrixWorld(true);
      const updates: Record<string, unknown>[] = [];
      meshes.forEach((mesh, id) => {
        const previous = cache[id], matrix = mesh.matrixWorld.elements.join(',');
        const instances = mesh.instanceMatrix.version, colors = mesh.instanceColor?.version ?? 0;
        const count = mesh.visible ? mesh.count : 0;
        const update: Record<string, unknown> = { id };
        if (matrix !== previous.matrix) update.matrix = [...mesh.matrixWorld.elements];
        if (instances !== previous.instances || count !== previous.count) {
          update.count = count;
          update.instances = Array.from(mesh.instanceMatrix.array.slice(0, count * 16));
        }
        if (colors !== previous.colors && mesh.instanceColor) {
          update.colors = Array.from({ length: mesh.instanceColor.count }, (_, i) => {
            mesh.getColorAt(i, color); return color.getHexString();
          });
        }
        if (Object.keys(update).length > 1) updates.push(update);
        cache[id] = { matrix, instances, colors, count };
      });
      return { updates, active: cube.twister.backlog > 0 || !!(target && smoothed && quatAngleTo(target, smoothed) > 1e-4),
        ready: authoritative !== null, facelets: cube.twister.backlog ? null : cube.serialize() };
    },
    dispose() { cube.dispose(); },
  };
}
