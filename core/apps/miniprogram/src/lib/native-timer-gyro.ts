import { applyOrientation, mirrorForBrand, sensorBasisForBrand } from '@cuberoot/shared/smart-cube/orientation';
import { decodeGyroTrack, encodeGyroTrack, sampleGyroAt } from '@cuberoot/shared/smart-cube/gyro-track';
import { miniProgramApi } from './platform';

/** Native Base64 transport for the same persisted recording format. */
export const encodeNativeGyroTrack: typeof encodeGyroTrack = (samples, frame) => {
  try {
    return encodeGyroTrack(samples, frame, typeof btoa === 'function' ? undefined
      : bytes => miniProgramApi().arrayBufferToBase64(Uint8Array.from(bytes).buffer));
  } catch {
    // The solve's physical moves are still savable when the pose codec is unavailable.
    return null;
  }
};

/** The raw physics track and recorded gyro pose use the Web/Watch time origin. */
export function nativeTimerGyroPlayback(encoded: string | undefined, deviceModel?: string) {
  const samples = decodeGyroTrack(encoded, typeof atob === 'function' ? undefined
    : value => new Uint8Array(miniProgramApi().base64ToArrayBuffer(value)));
  const basis = sensorBasisForBrand(deviceModel), mirror = mirrorForBrand(deviceModel);
  return {
    hasGyro: samples.length > 0,
    poseAt(timeMs: number) {
      if (!samples.length) return null;
      const pose = sampleGyroAt(samples, timeMs);
      return samples[0].frame === 'scramble' ? pose : applyOrientation(pose, null, { basis, mirror });
    },
  };
}
