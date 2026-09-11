import World from '@/app/[lang]/sim/engine/world';
import { mountSimWorld as mount, type SimMountOpts as Options, type SimMount as Mount } from '@cuberoot/puzzle-render-core/sim/mountSimWorld';
export { resolveRenderPixelRatio, syncSimHintBackdrop } from '@cuberoot/puzzle-render-core/sim/mountSimWorld';
export type SimMountOpts = Options<World>;
export type SimMount = Mount<World>;
export function mountSimWorld(opts: SimMountOpts): SimMount { return mount({ ...opts, createWorld: () => new World() }); }
