/**
 * Web transport adapter for the shared online-battle client.
 * Next owns API-origin resolution; all room DTOs, paths and payloads stay shared.
 */
import { createNetBattleClient } from '@cuberoot/shared/timer';
import { apiUrl } from './api-base';

const client = createNetBattleClient({ apiUrl });

export const {
  createNetRoom,
  ensureNetScramble,
  getNetRoom,
  joinNetRoom,
  leaveNetRoom,
  nextNetRound,
  postNetAdmin,
  postNetEvent,
  postNetKick,
  postNetResult,
  postNetStatus,
  postNetSyncStart,
  renameNetPlayer,
} = client;

export type {
  NetBattleClient,
  NetBattleCredentials,
  NetBattleEventId,
  NetIdentity,
  NetPenalty,
  NetPhase,
  NetPlayerEntry,
  NetResult,
  NetRoomState,
  NetRoundHistory,
} from '@cuberoot/shared/timer';
