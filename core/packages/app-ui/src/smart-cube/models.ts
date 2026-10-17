import { matchesGiikerName } from '@cuberoot/shared/smart-cube/giiker';
import { matchesGoCubeName } from '@cuberoot/shared/smart-cube/gocube';
import { matchesMoyuName } from '@cuberoot/shared/smart-cube/moyu';
import { matchesGanV2Name } from '@cuberoot/shared/smart-cube/gan-v2';
import { matchesGanV3Name } from '@cuberoot/shared/smart-cube/gan-v3';
import { matchesGanV4Name } from '@cuberoot/shared/smart-cube/gan-v4';
import { matchesMoyu32Name } from '@cuberoot/shared/smart-cube/moyu32';
import { matchesQiyiName } from '@cuberoot/shared/smart-cube/qiyi';

export type InstalledCubeModel = 'gan-v1' | 'gan-v2' | 'gan-v3' | 'gan-v4' | 'moyu32' | 'qiyi' | 'giiker' | 'gocube' | 'moyu';

export function modelForDeviceName(name: string): InstalledCubeModel | null {
  if (matchesMoyu32Name(name)) return 'moyu32';
  if (matchesQiyiName(name)) return 'qiyi';
  if (matchesGanV4Name(name)) return 'gan-v4';
  if (matchesGanV3Name(name)) return 'gan-v3';
  if (matchesGanV2Name(name)) return 'gan-v2';
  if (matchesGiikerName(name)) return 'giiker';
  if (matchesGoCubeName(name)) return 'gocube';
  if (matchesMoyuName(name)) return 'moyu';
  return null;
}

