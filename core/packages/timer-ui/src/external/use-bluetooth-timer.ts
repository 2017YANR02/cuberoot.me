import { useCallback, useEffect, useRef, useState } from 'react';
import { snapshotExternalTimer, type ExternalTimerSource, type ExternalTimerStatus, type ExternalTimerEvent } from '@cuberoot/shared/timer/external/types';
export type { ExternalTimerKind, ExternalTimerState } from '@cuberoot/shared/timer/external/types';
export interface ExternalTimerSourceOptions { onNeedMac?: (name: string, suggested?: string) => Promise<string | null>; onConnectionLost?: () => void; }
export interface UseBluetoothTimerOptions extends ExternalTimerSourceOptions {
  /** Every decoded state change, in arrival order. */
  onEvent?: (ev: ExternalTimerEvent) => void;
  /**
   * The one callback most consumers need: a solve was recorded BY THE DEVICE.
   * `ms` is the device's own measurement — do not re-time it locally.
   */
  onStop?: (ms: number, ev: ExternalTimerEvent) => void;
}

export interface BluetoothTimerHandle {
  refresh(): void;
  status: ExternalTimerStatus;
  /** Most recent event, or null before the first one. */
  lastEvent: ExternalTimerEvent | null;
  /** Open the picker + connect. Must be called from a user gesture. */
  connect(): Promise<void>;
  /** Connect a device already returned by a shared Web Bluetooth chooser. */
  disconnect(): void | Promise<void>;
  /** Escape hatch for callers that want the raw source (e.g. to subscribe). */
  source: ExternalTimerSource;
}

const DISCONNECTED_STATUS: ExternalTimerStatus = {
  connected: false,
  kind: 'unknown',
  deviceName: '',
  state: 'DISCONNECT',
  lastTimeMs: 0,
};

export function useBluetoothTimer(createSource: (options: ExternalTimerSourceOptions) => ExternalTimerSource, opts: UseBluetoothTimerOptions = {}): BluetoothTimerHandle {
  const [status, setStatus] = useState<ExternalTimerStatus>(DISCONNECTED_STATUS);
  const [lastEvent, setLastEvent] = useState<ExternalTimerEvent | null>(null);

  // Refs so the long-lived source closure never captures a stale callback.
  const onEventRef = useRef(opts.onEvent);
  const onStopRef = useRef(opts.onStop);
  const onNeedMacRef = useRef(opts.onNeedMac);
  const onConnectionLostRef = useRef(opts.onConnectionLost);
  useEffect(() => { onEventRef.current = opts.onEvent; }, [opts.onEvent]);
  useEffect(() => { onStopRef.current = opts.onStop; }, [opts.onStop]);
  useEffect(() => { onNeedMacRef.current = opts.onNeedMac; }, [opts.onNeedMac]);
  useEffect(() => { onConnectionLostRef.current = opts.onConnectionLost; }, [opts.onConnectionLost]);

  const sourceRef = useRef<ExternalTimerSource | null>(null);
  if (sourceRef.current === null) {
    sourceRef.current = createSource({
      onNeedMac: (name, suggested) => onNeedMacRef.current?.(name, suggested) ?? Promise.resolve(null),
      onConnectionLost: () => onConnectionLostRef.current?.(),
    });
  }
  const source = sourceRef.current;

  useEffect(() => {
    const unsub = source.subscribe((ev) => {
      setLastEvent(ev);
      setStatus(snapshotExternalTimer(source));
      onEventRef.current?.(ev);
      if (ev.state === 'STOPPED' && typeof ev.solveTime === 'number') {
        onStopRef.current?.(ev.solveTime, ev);
      }
    });
    return () => {
      unsub();
      void source.disconnect();
    };
  }, [source]);

  const connect = useCallback(async (): Promise<void> => {
    await source.connect();
    setStatus(snapshotExternalTimer(source));
  }, [source]);


  const disconnect = useCallback((): Promise<void> => {
    const pending = source.disconnect();
    setStatus(snapshotExternalTimer(source));
    return Promise.resolve(pending).then(() => setStatus(snapshotExternalTimer(source)));
  }, [source]);

  return { status, lastEvent, connect, disconnect, source, refresh: () => setStatus(snapshotExternalTimer(source)) };
}
