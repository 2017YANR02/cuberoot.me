'use client';

/**
 * TimerPage — DEPRECATED shim.
 *
 * The Solo timer was redesigned in Phase 1 into a clean shell. All of the
 * engine wiring (useTimer / scramble / storage / bluetooth / stackmat /
 * multistage / bldMemo / modals / fullscreen / replay / import-export) now
 * lives in `_shell/SoloView.tsx`, hosted by `_shell/TimerShell.tsx`. The page
 * entry (`page.tsx`) renders TimerShell directly.
 *
 * This file is kept only as a backward-compatible re-export so any lingering
 * `import TimerPage from './TimerPage'` resolves. It renders the full shell
 * (mode pill + Solo) so behavior is unchanged. New work goes in _shell/.
 */

export { default } from './_shell/TimerShell';
