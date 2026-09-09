import { EARLY_MODELS } from './history-models-early';
import { MIDDLE_MODELS } from './history-models-middle';
import { LATE_MODELS } from './history-models-late';

// Geometry is imported only by the lazy Three.js scene; the page reads the small design manifests.
export const HISTORY_MODELS = { ...EARLY_MODELS, ...MIDDLE_MODELS, ...LATE_MODELS };
