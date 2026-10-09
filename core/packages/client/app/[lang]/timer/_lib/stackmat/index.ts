import { useStackmat as useSharedStackmat, type UseStackmatOptions } from '@cuberoot/timer-ui/external';
import { createStackmatMicSource } from './source';
export type { StackmatHandle, StackmatStatus, UseStackmatOptions } from '@cuberoot/timer-ui/external';
export * from './source';
export type { StackmatPacket } from './packet';
export function useStackmat(options: UseStackmatOptions = {}) { return useSharedStackmat(createStackmatMicSource, options); }
