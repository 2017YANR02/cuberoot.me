import type { TrainingCubeStage } from './multi-cube-training';

export type TrainingCubeStatus = TrainingCubeStage | 'connected' | 'disconnected' | 'inspecting';

const LABELS: Record<TrainingCubeStatus, { en: string; zh: string }> = {
  idle: { zh: '等待打乱', en: 'Waiting for scramble' },
  preparing: { zh: '打乱中', en: 'Scrambling' },
  queued: { zh: '已就绪 · 待练', en: 'Ready · queued' },
  active: { zh: '就绪', en: 'Ready' },
  running: { zh: '计时中', en: 'Timing' },
  inspecting: { zh: '观察中', en: 'Inspecting' },
  connected: { zh: '已连接', en: 'Connected' },
  disconnected: { zh: '已断开', en: 'Disconnected' },
};

export function trainingCubeStatusLabel(status: TrainingCubeStatus) {
  return LABELS[status];
}
