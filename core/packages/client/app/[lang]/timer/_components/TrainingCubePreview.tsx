import { useLayoutEffect, useMemo, type RefObject } from 'react';
import type { LiveSmartCubeAnchor } from '@cuberoot/shared/smart-cube/anchor';
import type { BluetoothCubeHandle } from '../_lib/bluetooth';
import { mirrorForBrand, sensorBasisForBrand } from '../_lib/bluetooth/orientation';
import { tr } from '@/i18n/tr';
import LiveCubeState, { type LiveCubeStateProps } from './LiveCubeState';
import { useLiveCubeAnchor } from '../_shared/useLiveCubeAnchor';
import { trainingCubeStatusLabel, type TrainingCubeStatus } from '../_lib/training-cube-status';

type Quaternion = NonNullable<LiveCubeStateProps['quat']>;
export interface TrainingCubeGyro { quat: Quaternion | null; calibration: Quaternion | null }

export default function TrainingCubePreview({ id, number, cube, name, status, orientation, mode, useGyro, calibrateToken, gyros, onSource }: {
  id: string;
  number: number;
  cube: BluetoothCubeHandle;
  name: string;
  status: TrainingCubeStatus;
  orientation: string;
  mode: LiveCubeStateProps['mode'];
  useGyro: boolean;
  calibrateToken: number;
  gyros: RefObject<Map<string, TrainingCubeGyro>>;
  onSource(id: string, source: LiveSmartCubeAnchor | null): void;
}) {
  const { anchor, moves, algAnchored } = useLiveCubeAnchor(cube.status.deviceId || id, cube.facelets);
  useLayoutEffect(() => {
    onSource(id, anchor);
    return () => onSource(id, null);
  }, [anchor, id, onSource]);
  // Read the current sensor sample in the renderer's frame loop, without React updates at BLE frequency.
  const quatRef = useMemo(() => ({ get current() { return gyros.current.get(id)?.quat ?? null; } }), [gyros, id]);
  return <figure className="training-cube-preview" data-cube-id={id}>
    <div className="timer-live-cube">
      <LiveCubeState facelets={cube.facelets} moves={moves} algAnchored={algAnchored} liveSource={anchor}
        mode={mode} displayOrientation={orientation} useGyro={useGyro} quatRef={useGyro ? quatRef : undefined}
        calibrateToken={calibrateToken}
        calibrationReference={gyros.current.get(id)?.calibration}
        sensorBasis={sensorBasisForBrand(cube.status.brand)} mirror={mirrorForBrand(cube.status.brand)} />
    </div>
    <figcaption className="training-cube-caption">
      <span className="training-cube-identity"><span className="bt-cube-number">{number}</span><span className="training-cube-name">{name}</span></span>
      <span className="training-cube-status" data-status={status}>{tr(trainingCubeStatusLabel(status))}</span>
    </figcaption>
  </figure>;
}
