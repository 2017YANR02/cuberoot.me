import type { CubeCorners } from './geometry';
import type { PhotoRecognition } from './recognize';
import type { PhotoAlgResult, PhotoAlgSet } from './lookup';

/** No image bytes or public image URLs. Geometry is in the normalized pixel frame. */
export interface CubePhotoResult {
  width: number;
  height: number;
  corners?: CubeCorners;
  status: 'no-grid' | PhotoRecognition['status'];
  recognition?: PhotoRecognition;
  results: PhotoAlgResult[];
  requestedSets?: PhotoAlgSet[];
  assumptions: { f2lSolved: true; standardColorScheme: true };
}
export interface CubePhotoArtifact extends CubePhotoResult {
  kind: 'cube-photo';
  title: string;
  imageRef: string;
  attachmentId?: string;
}
