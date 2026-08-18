import type {
  TeachingTrainingAssignmentGoalMetric,
  TrainingEvidenceSource,
  TrainingGoalMetricKey,
  TrainingGoalOperator,
} from '@cuberoot/shared/teaching';

export function trainingSourceLabel(source: TrainingEvidenceSource, language: 'zh' | 'en'): string {
  const labels: Record<TrainingEvidenceSource, [string, string]> = {
    timer: ['计时器', 'Timer'],
    predict: ['预判训练', 'Prediction trainer'],
    'alg-trainer': ['公式训练', 'Algorithm trainer'],
  };
  return language === 'zh' ? labels[source][0] : labels[source][1];
}

export function trainingToolHref(source: TrainingEvidenceSource, orgSlug: string, assignmentId: string): string {
  const path: Record<TrainingEvidenceSource, string> = {
    timer: '/timer',
    predict: '/predict',
    'alg-trainer': '/alg',
  };
  const query = new URLSearchParams({ trainingOrg: orgSlug, trainingAssignment: assignmentId });
  return `${path[source]}?${query.toString()}`;
}

export function trainingGoalLabel(metric: TrainingGoalMetricKey, language: 'zh' | 'en'): string {
  const labels: Record<TrainingGoalMetricKey, [string, string]> = {
    evidence_count: ['训练次数', 'Attempts'],
    duration_ms: ['训练时长', 'Duration'],
    success_count: ['成功次数', 'Successes'],
    best_result_ms: ['最佳成绩', 'Best result'],
  };
  return language === 'zh' ? labels[metric][0] : labels[metric][1];
}

export function trainingGoalOperatorLabel(operator: TrainingGoalOperator): string {
  return operator === 'gte' ? '≥' : '≤';
}

export function formatTrainingGoal(goal: TeachingTrainingAssignmentGoalMetric, language: 'zh' | 'en'): string {
  const raw = goal.metricKey === 'duration_ms' || goal.metricKey === 'best_result_ms'
    ? `${goal.targetValue / 1000}s`
    : String(goal.targetValue);
  return `${trainingGoalLabel(goal.metricKey, language)} ${trainingGoalOperatorLabel(goal.operator)} ${raw}`;
}
