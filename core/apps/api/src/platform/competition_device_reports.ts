import { COMPETITION_OBSERVATION_WINDOW_MS, COMPETITION_STAGE_LIMIT_MS } from '@cuberoot/shared/timer';
import { applyCubieAlg, cubieStateFromFacelets, cubieToFacelets, smartCubeTargetFacelets, SOLVED_SMART_CUBE_FACELETS } from '@cuberoot/shared/smart-cube/cubie';
import { badRequest } from './errors.js';
import { arrayField, booleanField, integerField, isObject, stringField, type JsonObject } from './validation.js';

function readDeviceFacelets(body: JsonObject, key: string) {
  const value = stringField(body, key, { required: true, trim: false, min: 54, max: 54, pattern: /^[URFDLB]{54}$/ })!;
  if ([...'URFDLB'].some(face => value.split(face).length !== 10)) badRequest(`${key} must contain nine stickers of each face`);
  return value;
}

export function validateCompetitionDeviceCheckIn(body: JsonObject) {
  stringField(body, 'deviceBrand', { required: true, max: 100 });
  stringField(body, 'deviceName', { required: true, max: 100 });
  readDeviceFacelets(body, 'facelets');
}

// Device evidence is validated before a result is recorded.
export function validateCompetitionDeviceReport(body: JsonObject) {
  const runId=stringField(body,'runId',{required:true,max:36,pattern:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i})!;
  const serverIssuedAt=stringField(body,'serverIssuedAt',{required:true,max:64})!;
  if (!Number.isFinite(Date.parse(serverIssuedAt))) badRequest('serverIssuedAt must be a valid timestamp');
  const scramble=stringField(body,'scramble',{required:true,max:2000})!;
  const durationMs=integerField(body,'durationMs',{required:true,min:0,max:86_400_000})!;
  const inspectionMs = integerField(body, 'inspectionMs', { min: 0, max: COMPETITION_OBSERVATION_WINDOW_MS });
  const disconnected=booleanField(body,'disconnected');
  if(disconnected===undefined)badRequest('disconnected is required');
  if(!disconnected&&durationMs===0)badRequest('A completed device report requires a positive duration');
  let previous=-1;
  const moves=arrayField(body,'moves',{required:true,maxItems:2000})!.map(raw=>{
    if(!isObject(raw))badRequest('Every move must be an object');
    const move=stringField(raw,'move',{required:true,max:3,pattern:/^[URFDLB](?:2|')?$/})!;
    const elapsedMs=integerField(raw,'elapsedMs',{required:true,min:0,max:durationMs})!;
    if(elapsedMs<previous)badRequest('Move times must be in chronological order');
    previous=elapsedMs;return {move,elapsedMs};
  });
  if(!moves.length&&!disconnected)badRequest('A completed device report requires recorded moves');
  return {runId,...(inspectionMs === undefined ? {} : { inspectionMs }),serverIssuedAt:new Date(serverIssuedAt).toISOString(),scramble,durationMs,moves,
    startFacelets:readDeviceFacelets(body, 'startFacelets'),endFacelets:readDeviceFacelets(body, 'endFacelets'),
    deviceBrand:stringField(body,'deviceBrand',{required:true,max:100})!,
    deviceName:stringField(body,'deviceName',{max:100})??'',gyro:stringField(body,'gyro',{max:140000,pattern:/^[A-Za-z0-9_+/=.-]+$/})??null,disconnected};
}

export function verifyCompletedCompetitionDeviceReport(report: ReturnType<typeof validateCompetitionDeviceReport>) {
  if (report.durationMs >= COMPETITION_STAGE_LIMIT_MS) badRequest('The solve exceeds the competition time limit');
  if (report.durationMs - (report.moves.at(-1)?.elapsedMs ?? 0) > 1000) badRequest('The end time does not match the final turn');
  const state = cubieStateFromFacelets(report.startFacelets);
  if (!state || report.startFacelets !== smartCubeTargetFacelets(report.scramble)
    || report.endFacelets !== SOLVED_SMART_CUBE_FACELETS
    || cubieToFacelets(applyCubieAlg(state, report.moves.map(move => move.move).join(' '))) !== report.endFacelets) {
    badRequest('The recorded moves do not connect the issued scramble to a solved cube');
  }
}

export function competitionDeviceResult(report: ReturnType<typeof validateCompetitionDeviceReport>) {
  if (report.disconnected) return { centiseconds: null, penalty: 'DNF' } as const;
  return { centiseconds: Math.max(1, Math.floor(report.durationMs / 10)), penalty: 'none' } as const;
}

export function competitionReplay(report: (ReturnType<typeof validateCompetitionDeviceReport> & { timestamp?: string }) | null, timestamp: Date | null, penalty?: string | null) {
  if (!report || report.disconnected || !report.moves.length) return null;
  return { scramble: report.scramble, durationMs: report.durationMs, moves: report.moves,
    gyro: report.gyro ?? null, inspectionMs: report.inspectionMs, timestamp: report.timestamp ?? timestamp, penalty: penalty ?? 'none' };
}
