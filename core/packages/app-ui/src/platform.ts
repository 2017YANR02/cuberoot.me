import type {
  MobileAuthProvider,
  WebSession,
  WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';
import type {
  NetBattleClient,
  NetBattleSession,
  TimerPhase,
} from '@cuberoot/shared/timer';

import type { SupportedLanguage } from './copy';

export interface InstalledAppAuth {
  busy: boolean;
  error: boolean;
  issueWebSessionTicket(): Promise<WebSessionTicketEnvelope>;
  loading: boolean;
  login(provider?: MobileAuthProvider | null): Promise<void>;
  logout(): Promise<void>;
  session: WebSession | null;
}

export interface InstalledAppSmartCubeOptions {
  language: SupportedLanguage;
  onMove(move: string, timestamp: number, facelets: string): void;
  onSolved?(timestamp: number): void;
}

export interface InstalledAppSmartCube {
  connect(): Promise<string>;
  deviceName: string;
  disconnect(): Promise<void>;
  facelets: string;
  lastMove: string;
  phase: 'idle' | 'requesting' | 'connecting' | 'connected' | 'error';
}

export interface InstalledAppListener {
  remove(): Promise<void>;
}

export interface InstalledAppNetBattleSessionStore {
  clear(): Promise<void>;
  load(): Promise<NetBattleSession | null>;
  save(session: NetBattleSession): Promise<void>;
}

/** Host-only transport and protected capability persistence for online rooms. */
export interface InstalledAppNetBattle {
  client: NetBattleClient;
  sessions: InstalledAppNetBattleSessionStore;
}

export interface InstalledAppHost {
  addBackButtonListener?(listener: () => void): Promise<InstalledAppListener>;
  addNetworkListener(listener: (connected: boolean) => void): Promise<InstalledAppListener>;
  exitApp?(): Promise<void>;
  getNetworkStatus(): Promise<boolean>;
  isInstalled(): boolean;
  netBattle?: InstalledAppNetBattle;
  openExternal(url: string): Promise<void>;
  print(title: string): Promise<void>;
  useAuth(language: SupportedLanguage): InstalledAppAuth;
  useSmartCube(options: InstalledAppSmartCubeOptions): InstalledAppSmartCube;
  useTimerEffects(phase: TimerPhase): void;
  version: string;
}
