/** Public, credential-free protocol for the two-team AI puzzle experiment. */
export const CUBE_AGENT_MODELS = [
  { id: 'qwen3.8-flash', provider: 'qwen', name: 'Qwen3.8 Flash', inputPerMillion: 0.8, outputPerMillion: 2.7,
    priceUrl: 'https://help.aliyun.com/zh/model-studio/qwen3-8-flash' },
  { id: 'deepseek-flash', provider: 'deepseek', name: 'DeepSeek V4.1 Flash', inputPerMillion: 2, outputPerMillion: 8,
    priceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/' },
] as const;
export const CUBE_AGENT_LIMITS = { agents: 4, rounds: 6, timeoutMs: 120_000, outputTokens: 512, dailyRuns: 20 } as const;
export interface CubeAgentTrial { atMs: number; moves: string; solved: boolean; correct: number }
export interface CubeAgent {
  status: 'waiting' | 'thinking' | 'solved' | 'exhausted' | 'stopped' | 'error';
  trials: CubeAgentTrial[];
}
export interface CubeAgentTeam {
  model: string;
  name: string;
  status: 'planning' | 'running' | 'solved' | 'exhausted' | 'stopped' | 'error';
  agents: CubeAgent[];
  winner: number | null;
  solvedMs: number | null;
  finishedMs: number | null;
  positions: number;
  toolCalls: number;
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  estimatedCny: number;
  usageComplete: boolean;
  returnedModel?: string;
  pricing?: { inputPerMillion: number; outputPerMillion: number; source: string; basis: 'list-before-discounts' };
  error?: 'provider_access_denied' | 'provider_rate_limited' | 'provider_error' | 'provider_invalid_response';
}
export interface CubeAgentRun {
  version: 1;
  id: string;
  startedAt: string;
  scramble: string;
  elapsedMs: number;
  status: 'running' | 'done' | 'stopped';
  teams: CubeAgentTeam[];
}
export interface CubeAgentOverview {
  available: boolean;
  busy: boolean;
  models: typeof CUBE_AGENT_MODELS;
  latest: CubeAgentRun | null;
}
