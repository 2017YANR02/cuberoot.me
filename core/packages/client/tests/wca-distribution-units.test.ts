import { afterEach, describe, expect, it, vi } from 'vitest';
import { wcaApi } from '@cuberoot/shared/wca-search';
import { fetchPlayerData, buildChannelDataForPlayer, fmtVal } from '@/components/distribution-viz/_engine/data_fetch';
import { download } from '@/components/distribution-viz/_engine/csv_export';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WCA distribution data and export', () => {
  it('preserves FMC raw singles and shows both official and rolling means in moves', async () => {
    vi.spyOn(wcaApi, 'get').mockImplementation(async path => ({ data: path.endsWith('/competitions')
      ? [{ id: 'FMC', name: 'FMC', start_date: '2026-01-01' }]
      : [{ competition_id: 'FMC', event_id: '333fm', round_type_id: 'f', attempts: [21, 17, 18], average: 1867, name: 'Test' }],
    }));
    const player = (await fetchPlayerData('fmc-distribution', '333fm'))!;
    expect(player.solveData.map(entry => entry[0])).toEqual([21, 17, 18]);
    expect(player.statsData.mo3).toEqual([null, null, 1867]);
    buildChannelDataForPlayer(player, 'mo3');
    expect(player.channelData[0][0]).toBe(18.67);
    buildChannelDataForPlayer(player, 'avg');
    expect(player.channelData[0][0]).toBe(18.67);
    expect(fmtVal(18.67, '333fm')).toBe('18.67 moves');

    let csvBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { csvBlob = blob as Blob; return 'blob:test'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('document', {
      createElement: () => ({ click() {} }),
      body: { appendChild() {}, removeChild() {} },
    });
    download({ ...player, stats: player.statsData });
    const csv = (await csvBlob!.text()).replace(/^\uFEFF/, '').split('\n').map(line => line.split(','));
    const header = csv[0];
    expect(header).toContain('single_moves');
    expect(csv[1][header.indexOf('single_moves')]).toBe('21');
    expect(csv[1][header.indexOf('avg')]).toBe('18.67');
    expect(csv[3][header.indexOf('mo3')]).toBe('18.67');
  });

  it('orders combined rounds chronologically before rolling calculations', async () => {
    vi.spyOn(wcaApi, 'get').mockImplementation(async path => ({ data: path.endsWith('/competitions')
      ? [{ id: 'Timed', name: 'Timed', start_date: '2026-01-01' }]
      : [
        { competition_id: 'Timed', event_id: '333', round_type_id: 'g', attempts: [400, 500, 600], average: 500, name: 'Test' },
        { competition_id: 'Timed', event_id: '333', round_type_id: '1', attempts: [100, 200, 300], average: 200, name: 'Test' },
      ],
    }));
    const player = (await fetchPlayerData('timed-distribution', '333'))!;
    expect(player.solveData.map(entry => entry[0])).toEqual([100, 200, 300, 400, 500, 600]);
    expect(player.statsData.mo3).toEqual([null, null, 200, 300, 400, 500]);
  });
});
