// /scramble/pattern/search 示例预设 CRUD。
// 公共 GET 无认证;写端点走 WCA OAuth Bearer(ADMIN_WCA_IDS)或 X-Admin-Key。
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/pattern-examples';

export interface PatternExample {
  id: number;
  position: number;
  nameZh: string;
  nameEn: string;
  /** 页面 ?q= 的同一份编码:45 位色类 + '-' + 5 × 2 位面分配十六进制掩码。 */
  q: string;
  continuous: boolean;
}

export type PatternExampleInput = Pick<PatternExample, 'nameZh' | 'nameEn' | 'q' | 'continuous'>;

export async function listPatternExamples(): Promise<PatternExample[]> {
  return handleApi<PatternExample[]>(await fetch(BASE));
}

export async function createPatternExample(body: PatternExampleInput): Promise<PatternExample> {
  return handleApi<PatternExample>(
    await fetch(BASE, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }),
  );
}

export async function updatePatternExample(id: number, body: PatternExampleInput): Promise<PatternExample> {
  return handleApi<PatternExample>(
    await fetch(`${BASE}/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }),
  );
}

export async function deletePatternExample(id: number): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: authHeaders() }));
}

export async function reorderPatternExamples(ids: number[]): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(
    await fetch(`${BASE}/reorder`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ids }) }),
  );
}
