'use client';

/**
 * Compatibility entry for the repository-wide RangeSlider API. The actual
 * React interaction and CSS live in `@cuberoot/timer-ui`, which lets Web and
 * Capacitor consume one implementation.
 */
export {
  TimerRangeSlider as RangeSlider,
  orderedDragRange,
} from '@cuberoot/timer-ui';
export type {
  TimerRangeSliderProps as RangeSliderProps,
} from '@cuberoot/timer-ui';
