/**
 * Compatibility boundary for the Web timer.
 * Canonical room state derivations live in runtime-neutral `@cuberoot/shared`.
 */
export {
  NET_EVENTS,
  OFFLINE_MS,
  blendClockOffset,
  decodeNetBattleSession,
  effectiveNetMs,
  isNetAdmin,
  isNetOnline,
  isRoundComplete,
  myScramble,
  netErrorMessage,
  netEventToSelectorId,
  normalizeNetBattleRoomCode,
  pendingCount,
  preferLatestNetRoomState,
  playerEventOf,
  playerStats,
  playerTimeline,
  roundViews,
  roundWinners,
  selectorIdToNetEvent,
  sortedNetPlayers,
  syncGate,
} from '@cuberoot/shared/timer';

export type { NetBattleSession, NetRoundView, NetStats, NetSyncGate } from '@cuberoot/shared/timer';
