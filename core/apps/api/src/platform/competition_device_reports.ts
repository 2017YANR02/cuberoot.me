import { badRequest } from './errors.js';
import { arrayField, booleanField, integerField, isObject, stringField, type JsonObject } from './validation.js';

// Client reports are supporting evidence only. They do not certify hardware or create results.
export function validateCompetitionDeviceReport(body: JsonObject) {
  const runId=stringField(body,'runId',{required:true,max:36,pattern:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i})!;
  const serverIssuedAt=stringField(body,'serverIssuedAt',{required:true,max:64})!;
  if (!Number.isFinite(Date.parse(serverIssuedAt))) badRequest('serverIssuedAt must be a valid timestamp');
  const scramble=stringField(body,'scramble',{required:true,max:2000})!;
  const durationMs=integerField(body,'durationMs',{required:true,min:0,max:86_400_000})!;
  const disconnected=booleanField(body,'disconnected');
  if(disconnected===undefined)badRequest('disconnected is required');
  if(!disconnected&&durationMs===0)badRequest('A completed device report requires a positive duration');
  const facelets=(key:string)=>{
    const value=stringField(body,key,{required:true,min:54,max:54,pattern:/^[URFDLB]{54}$/})!;
    if([... 'URFDLB'].some(face=>[...value].filter(v=>v===face).length!==9))badRequest(`${key} must contain nine stickers of each face`);
    return value;
  };
  let previous=-1;
  const moves=arrayField(body,'moves',{required:true,maxItems:2000})!.map(raw=>{
    if(!isObject(raw))badRequest('Every move must be an object');
    const move=stringField(raw,'move',{required:true,max:3,pattern:/^[URFDLB](?:2|')?$/})!;
    const elapsedMs=integerField(raw,'elapsedMs',{required:true,min:0,max:durationMs})!;
    if(elapsedMs<previous)badRequest('Move times must be in chronological order');
    previous=elapsedMs;return {move,elapsedMs};
  });
  if(!moves.length&&!disconnected)badRequest('A completed device report requires recorded moves');
  return {runId,serverIssuedAt:new Date(serverIssuedAt).toISOString(),scramble,durationMs,moves,
    startFacelets:facelets('startFacelets'),endFacelets:facelets('endFacelets'),
    deviceBrand:stringField(body,'deviceBrand',{required:true,max:100})!,
    deviceName:stringField(body,'deviceName',{max:100})??'',disconnected};
}
