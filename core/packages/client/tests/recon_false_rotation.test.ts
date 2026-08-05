import { describe, expect, it } from 'vitest';

import { decodeGyroTrack } from '@/app/[lang]/timer/_lib/bluetooth/gyro_track';
import { buildCoreTrack } from '@/app/[lang]/timer/_lib/reconstruct/core_track';
import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { normalizeSolve } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { buildReconText } from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { decodeReplayParam } from '@/app/[lang]/timer/_lib/share/decode';

const REPLAY = 'eyJlIjoiMzMzIiwicyI6IkIyIFUgUicgRDIgVTIgUicgQjIgVSBMMiBSJyBEIFInIFUgQiBEJyBVJyBSJyBEIiwibSI6W1siTCIsMF0sWyJGIiwxMjVdLFsiTCIsMjI3XSxbIlUiLDM0NV0sWyJMJyIsNTE2XSxbIkYiLDYxMF0sWyJMIiw3MThdLFsiUiIsOTE3XSxbIlUiLDEzNDBdLFsiRCIsMTgyNF0sWyJEIiwxOTE1XSxbIlIiLDIxMTZdLFsiRCIsMjI0OV0sWyJSJyIsMjM3M10sWyJEJyIsMjYwOF0sWyJMJyIsMjc0Nl0sWyJGIiwyODA3XSxbIkwiLDI4NjldLFsiTCIsMjkyNF0sWyJEJyIsMjk3Ml0sWyJMJyIsMzA4Nl0sWyJEIiwzMTI3XSxbIkQiLDMyMDNdLFsiRiciLDM0NDBdLFsiTCIsNDUzNV0sWyJEIiw0NjM1XSxbIkwnIiw0NzQzXSxbIkQiLDQ3ODddLFsiRiciLDUyMTZdLFsiRCciLDUzMjldLFsiRiIsNTQwOF0sWyJEJyIsNjA2M10sWyJCIiw2MjE5XSxbIkQnIiw2MjY4XSxbIkInIiw2MzU2XSxbIkQiLDY1MTRdLFsiUiciLDY3NDFdLFsiTCIsNjc5M10sWyJVIiw2ODQ0XSxbIkInIiw2OTExXSxbIlUnIiw3MDA4XSxbIlIiLDcxMDVdLFsiTCciLDc2MzBdLFsiRCciLDgxNTVdLFsiTCIsODM2Ml0sWyJEIiw4NDQzXSxbIkIiLDg1MjddLFsiRCciLDg1NjhdLFsiQiciLDg2NjZdLFsiRCIsODcyMl0sWyJCIiw4ODE0XSxbIkQnIiw4ODY1XSxbIkQnIiw4OTE1XSxbIkInIiw5MDI2XSxbIkQnIiw5MTEyXSxbIkIiLDkxOThdLFsiRCIsOTI5N10sWyJCJyIsOTM2Ml0sWyJMJyIsOTQ5OF0sWyJGIiwxMDYzM10sWyJCJyIsMTA2NjZdLFsiRiIsMTA2OTldLFsiQiciLDEwNzQyXSxbIlUiLDEwNzg1XSxbIlUiLDEwODU5XSxbIkYnIiwxMDk4M10sWyJCIiwxMTAwMF0sWyJMIiwxMTE1M10sWyJGIiwxMTI1Nl0sWyJCJyIsMTEyOTNdLFsiRiIsMTEzMzBdLFsiQiciLDExMzYwXSxbIlIiLDExMzg5XSxbIkYiLDExNTUxXSxbIkInIiwxMTU3OV0sWyJGIiwxMTYwN10sWyJCJyIsMTE2NDBdLFsiTCIsMTE2NzJdLFsiRiciLDExNzk1XSxbIkIiLDExOTgwXSxbIkQnIiwxMjE2NF1dLCJ0IjoxMzQ4MiwiZyI6IlJ3RUFlQUFNL3lkb3dnQUJBaFYyMVFCTkJScHd5d0JhREFwODZRQmFDZ1o5N0FDMENRUjUyUUF0Q0F0dHdBQmFDQTl3eHdCYUNBZDYzd0JhQkFGODV3QmFBZ1I1MmdCYkJBRjYzd0JaQlFKOTdRQmFDd0IrK2dDMERnRitCUUF0RGdKOUR3QmFEQUY3SHdCYUJRRitDZ0JhQ0FoOTdnQmVDQUYrOXdDR0NmeCsrQUJYQy85Kyt3QmEvLzUvOXdCYUEveDg1QUJmQXY5KzdnQ0NCZ0IrOHdEaEFnTis4d0NIQWc5NDJ3QmVBdzk3NVFCVytQdDhHQUJhL1B4K0RnQmgvUDUvK1FCVEFmMS8rZ0JhL0FKLytnQ0gvQVorOWdBdEF3Wi8rUUNIQWdsKzlBQzBCUWgrK0FCYUJ3dDk4QUVPQmdkKzh3RGhBd1IvOWdDNytQZDlFUUJULys1N0dnQmFCZngvL0FCYUNRUi8vQUJhQnpweC93QmFBa3BuK1FDMENWaGIvd0F0QlY5UUdnQmFCMlZLRlFCYUVHQlMvUUJhRGw1VTlnQmFEV0JTK1FCYUQxNVUvQUJhREZ0WSt3RU9CMWRjL2dBdEFsUmYvUUJhKzFSZkJBRTdMMEJQUFFCYUkwNDZTZ0JkSTA0L1JRQmJPa2RITkFCWC9WdFkrd0RnLzFwYUJBQzBBVlpkQmdGby9GWmRBd0MwL0ZGaENBQ0grRkpoQlFCYSsxVmVBQUJmQWwxWC9nQlYvMWhjQXdCYTZrNWhEUUMwL0ZkYy9RQUUvRmxaN2dCVzZGdFM1d0NINlUxZjZnQmFFMWhYN2dCZkIxRmc3d0JWM0VaaTh3Q0kvRkZmNmdDekVGWlo2Z0FHQmxaYzdnQlVCMUZnN3dDSEMxTmU3Z0F0RDFoWjhRQzBEMVJkOHdFT0NWUmU4d0MwQWxOZjlBQ0hDRk5jNWdCZ1dBb2VxZ0N1WGUwSnJBQ0xTd0lyb3dCZE54dy9wQUJUT1I5QXFBQmFXT0FKcWdDSVA2bkczQUN6SWFtdEZ3Qm0zTmF2VUFBaDZOR29TZ0MwSmJDdUtRQXRJcXV5S2dBd0Q2V3ZJQUN5QTZTckZRQXNCYVNzR1FCYUFLV3NHd0NIQTZTdklRQmFFcC9FTlFBdEhKelhQUUNISTUvYlFRQXRJYUhWUVFDSElLYlJSUUJhSXF2TlNBQmFINi9IU1FCYUhiUEVTd0JhR3JlNlNRQmFHc0d0UkFDSEg4Nm1SQT09IiwiZCI6WyJnYW4tdjQiLCJHQU4xNnVpXyAoQzI6QUYpIl19';

describe('真实握持倾斜和转体要分开', () => {
  it('十字不写假 x，第三组保留真实 y', async () => {
    const replay = decodeReplayParam(REPLAY);
    expect(replay).not.toBeNull();
    if (!replay?.gyro || !replay.device) return;

    const segs = computeStageSegments(replay.scramble, replay.moves, replay.totalMs)!;
    const metrics = computeStepMetrics(replay.scramble, replay.moves, replay.totalMs)!;
    const slots = computeF2lSlots(replay.scramble, replay.moves, replay.totalMs, segs);
    const view = normalizeSolve(replay.scramble, replay.moves);
    // 聊天记录复制这条长链接时少了 3 个完整姿态样本；按实际剩余字节修正头部数量。
    // 缺口不破坏样本边界，且十字阶段的姿态仍完整，足以锁住本次假 x 回归。
    const rawGyro = Buffer.from(replay.gyro, 'base64');
    rawGyro[2] = 0;
    rawGyro[3] = Math.floor((rawGyro.length - 4) / 6);
    const samples = decodeGyroTrack(rawGyro.toString('base64'));
    const core = buildCoreTrack(samples, { brand: replay.device.model });
    const result = await buildReconText({
      scramble: view.scramble,
      moves: view.moves,
      totalMs: replay.totalMs,
      segs,
      metrics,
      slots,
      core,
      physical: { scramble: replay.scramble, moves: replay.moves },
      viewRotation: view.rotation,
    });

    const cross = result.lines.find(line => line.kind === 'cross');
    expect(cross?.moves).toEqual(['R', 'F', 'R', 'D', "R'", 'F', 'R', 'L', 'D']);
    const thirdPair = result.lines.find(line => line.key === 'slot-FR');
    expect(thirdPair?.moves).toEqual(['R', 'U', "R'", 'U', 'y', "L'", "U'", 'L']);
    expect(result.rotations).toContainEqual({ tMs: 5175, token: 'y' });
    const pll = result.lines.find(line => line.kind === 'pll');
    expect(pll?.moves).toEqual(["M2'", 'U2', 'M', 'U', "M2'", 'U', "M2'", 'U', 'M', "U'"]);
  });
});
