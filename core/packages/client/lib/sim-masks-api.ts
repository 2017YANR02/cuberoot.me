// /sim 阶段遮罩下拉的管理员自定义 CRUD(/v1/sim-masks)。
// 公共 GET 无认证;写端点走 WCA OAuth Bearer(ADMIN_WCA_IDS)或 X-Admin-Key。
//
// 清单本体在代码里(engine stickering.ts + visualcube 位串),这里只是「管理员改过什么」:
// builtin 行覆盖标签 / 顺序 / 显隐,custom 行是点选贴纸存出来的新遮罩。合并逻辑是纯函数,
// 在 app/[lang]/sim/engine/nxn/maskConfig.ts(可测),本文件只管传输。
import { API_ORIGIN } from './api-base';
import { authHeaders, handleApi } from './admin-api';

const BASE = API_ORIGIN + '/v1/sim-masks';

/** 自建遮罩在下拉 / URL 里的值前缀(`?stickering=preset:my-drill`)。 */
export const PRESET_PREFIX = 'preset:';

export interface SimMaskRow {
  id: number;
  /** 内置条目 = 下拉里的阶段名(`xcross` / `OLL`);自建 = `preset:<slug>`。 */
  maskKey: string;
  kind: 'builtin' | 'custom';
  cubeSize: number;
  position: number;
  hidden: boolean;
  /** 空 = 沿用代码里的标签(内置条目常见)。 */
  labelEn: string;
  labelZh: string;
  /** 自建遮罩的贴纸清单,mask-core 编码 `U:0,2;F:3-5`。 */
  sids: string;
  pick: string;
  rest: string;
}

export type SimMaskInput = Pick<SimMaskRow,
  'maskKey' | 'kind' | 'cubeSize' | 'hidden' | 'labelEn' | 'labelZh' | 'sids' | 'pick' | 'rest'>;

export async function listSimMasks(): Promise<SimMaskRow[]> {
  return handleApi<SimMaskRow[]>(await fetch(BASE));
}

/** 按 maskKey upsert(admin)。 */
export async function saveSimMask(body: SimMaskInput): Promise<SimMaskRow> {
  return handleApi<SimMaskRow>(
    await fetch(BASE, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }),
  );
}

/** 某阶数的全量顺序(admin)。keys 必须是该阶下拉里的全部条目,顺序即显示顺序。 */
export async function reorderSimMasks(cubeSize: number, keys: string[]): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(
    await fetch(`${BASE}/reorder`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ cubeSize, keys }) }),
  );
}

/** 删一行:内置条目 = 恢复代码默认,自建 = 删掉这条遮罩(admin)。 */
export async function deleteSimMask(maskKey: string): Promise<{ ok: boolean }> {
  return handleApi<{ ok: boolean }>(
    await fetch(`${BASE}/${encodeURIComponent(maskKey)}`, { method: 'DELETE', headers: authHeaders() }),
  );
}
