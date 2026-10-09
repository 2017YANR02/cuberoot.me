import type { GanCubeStatus } from './smart-cube/gan-cube';
import type { LegacyCubeStatus } from './smart-cube/legacy-cube';
import type { BleTransport } from './smart-cube/transport';
import type { StackmatMicSource } from '@cuberoot/shared/timer/external/stackmat-state';
import type { AppleMembershipRequest, AppleMembershipResult } from '@cuberoot/shared/apple-membership';
import type { GoogleMembershipRequest, GoogleMembershipResult } from '@cuberoot/shared/google-membership';
import type {
  MobileAuthProvider,
  WebSession,
  WebSessionTicketEnvelope,
} from '@cuberoot/shared/auth/web-session';
import type {
  NetBattleClient,
  NetBattleSession,
  TimerDeviceAvailableDevice,
  TimerDeviceConnectionEvent,
  TimerDeviceConnectionPhase,
  TimerPhase,
} from '@cuberoot/shared/timer';

import type { SupportedLanguage } from './copy';
import type { GyroQuaternion, GyroVelocity } from '@cuberoot/shared/smart-cube/gan-crypto';
import type { GanV4CubeStatus } from './smart-cube/gan-v4-cube';
import type { Moyu32CubeStatus } from './smart-cube/moyu32-cube';
import type { QiyiCubeStatus } from './smart-cube/qiyi-cube';

export interface InstalledAppAuth {
  busy: boolean;
  error: boolean;
  issueWebSessionTicket(): Promise<WebSessionTicketEnvelope>;
  loading: boolean;
  login(provider?: MobileAuthProvider | null): Promise<void>;
  logout(): Promise<void>;
  session: WebSession | null;
}

export interface InstalledSmartCubeMoveMetadata {
  futureHistory?: boolean;
}

export interface InstalledAppSmartCubeOptions {
  language: SupportedLanguage;
  onConnectionEvent?(event: TimerDeviceConnectionEvent): void;
  onMove(
    move: string,
    timestamp: number,
    facelets: string,
    metadata?: InstalledSmartCubeMoveMetadata,
  ): void;
  onSolved?(timestamp: number): void;
  onGyro?(quaternion: GyroQuaternion, timestamp: number, velocity?: GyroVelocity): void;
}

/** @deprecated Use TimerDeviceAvailableDevice from @cuberoot/shared/timer. */
export type InstalledAppSmartCubeDevice = TimerDeviceAvailableDevice;

export interface InstalledAppSmartCube {
  error?: string | null;
  macPrompt?: { deviceName: string; onSubmit(mac: string): void; onCancel(): void } | null;
  availableDevices?: readonly TimerDeviceAvailableDevice[];
  connect(deviceId?: string): Promise<string>;
  deviceName: string;
  model?: string | null;
  disconnect(): Promise<void>;
  facelets: string;
  lastMove: string;
  phase: TimerDeviceConnectionPhase;
  /** Optional for older host/test adapters; the shared smart-cube adapter supplies these. */
  quaternion?: GyroQuaternion | null;
  status?: GanCubeStatus | GanV4CubeStatus | Moyu32CubeStatus | QiyiCubeStatus | LegacyCubeStatus | null;
  solved?: boolean;
  scanning?: boolean;
  scanDevices?(): Promise<void>;
  stopScan?(): Promise<void>;
  resetState?(): void;
  resetDeviceState?(): Promise<void>;
  requestState?(): Promise<void>;
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
  createBleTransport?(): BleTransport;
  createStackmatSource?(): StackmatMicSource;
  appleMembership?(request: AppleMembershipRequest, session: WebSession): Promise<Omit<AppleMembershipResult, 'type' | 'requestId'>>;
  googleMembership?(request: GoogleMembershipRequest, session: WebSession): Promise<Omit<GoogleMembershipResult, 'type' | 'requestId'>>;
  addBackButtonListener?(listener: () => void): Promise<InstalledAppListener>;
  addNetworkListener(listener: (connected: boolean) => void): Promise<InstalledAppListener>;
  exitApp?(): Promise<void>;
  getNetworkStatus(): Promise<boolean>;
  isInstalled(): boolean;
  netBattle?: InstalledAppNetBattle;
  openExternal(url: string): Promise<void>;
  print(title: string): Promise<void>;
  exportFile?(text: string, filename: string, mime: string): Promise<void>;
  writeClipboardText(text: string): Promise<void>;
  useAuth(language: SupportedLanguage): InstalledAppAuth;
  useSmartCube(options: InstalledAppSmartCubeOptions): InstalledAppSmartCube;
  useTimerEffects(phase: TimerPhase): void;
  version: string;
}
