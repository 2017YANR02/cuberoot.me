import { mobileApiUrl } from '@cuberoot/app-ui';
import {
  createNetBattleClient,
  createNetBattleSessionStore,
} from '@cuberoot/shared/timer';

import { harmonySecureStorage } from './harmony-native';

export const harmonyNetBattleClient = createNetBattleClient({ apiUrl: mobileApiUrl });

export const harmonyNetBattleSessionStore = createNetBattleSessionStore(harmonySecureStorage);
