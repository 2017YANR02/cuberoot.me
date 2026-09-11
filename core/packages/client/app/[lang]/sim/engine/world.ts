import SharedWorld from '@cuberoot/puzzle-render-core/engine/world';
import type HandsRig from './hands/handsRig';
export * from '@cuberoot/puzzle-render-core/engine/world';
/** Web-only hands are injected; all scene and puzzle behavior stays shared. */
export default class World extends SharedWorld<HandsRig> {}
