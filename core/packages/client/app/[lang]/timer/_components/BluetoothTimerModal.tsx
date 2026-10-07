'use client';
import { useSyncExternalStore } from 'react';
import { installedBleAvailable, subscribeInstalledBleBridge } from '@/lib/installed-ble-bridge';
import { BluetoothTimerModal as SharedModal, type BluetoothTimerModalProps } from '@cuberoot/timer-ui/external';
import { tr } from '@/i18n/tr';
import { useIsMobile } from '@/hooks/useIsMobile';
import { detectBluetoothEnv, envAdvice, mayUseMiniProgramBridge } from '../_lib/bluetooth';
export default function BluetoothTimerModal(props: Omit<BluetoothTimerModalProps, 'localize' | 'compact'>) {
useSyncExternalStore(subscribeInstalledBleBridge, installedBleAvailable, () => false);
const env = detectBluetoothEnv();
return <SharedModal {...props} localize={tr} compact={useIsMobile(480)} supported={mayUseMiniProgramBridge() || env === 'available' || env === 'available-bluefy'} advice={envAdvice(env)}/>;
}
