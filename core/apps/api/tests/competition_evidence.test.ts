import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({actor:vi.fn(),query:vi.fn(),receive:vi.fn(),rename:vi.fn(),unlink:vi.fn(),access:vi.fn(),readdir:vi.fn(),stat:vi.fn(),rate:vi.fn(),response:vi.fn()}));
vi.mock('../src/platform/auth.js',() => ({requirePlatformActor:mocks.actor}));
vi.mock('../src/platform/db.js',() => ({platformDb:() => ({}),platformQuery:mocks.query,platformTransaction:async(run:(db:object)=>Promise<unknown>)=>run({})}));
vi.mock('../src/utils/drive_storage.js',() => ({DRIVE_STORAGE_ROOT:'private-test-storage'}));
vi.mock('../src/utils/recon_helpers.js',() => ({checkRateLimit:mocks.rate}));
vi.mock('node:fs',() => ({promises:{rename:mocks.rename,unlink:mocks.unlink,access:mocks.access,readdir:mocks.readdir,stat:mocks.stat}}));
vi.mock('../src/utils/video_upload.js',() => ({receiveVideoUpload:mocks.receive,storedVideoResponse:mocks.response,VideoUploadError:class extends Error {status=400;}}));
import {platformCompetitionEvidenceRoutes,pruneCompetitionEvidence} from '../src/routes/platform_competition_evidence.js';
import {PlatformApiError} from '../src/platform/errors.js';

const app = new Hono().route('/v1',platformCompetitionEvidenceRoutes);
const id='11111111-1111-4111-8111-111111111111';
const evidenceId='22222222-2222-4222-8222-222222222222';
const endpoint=`/v1/platform/competitions/registrations/${id}/evidence`;
let registration:Record<string,unknown>;
let files:Record<string,unknown>[];
const upload=()=>app.request(endpoint,{method:'POST',body:'video'});
beforeEach(() => {
  vi.resetAllMocks();
  registration={user_id:1,supervisor_user_id:2,status:'confirmed',finalized_at:null,disputed:false};
  files=[];
  mocks.actor.mockResolvedValue({userId:1,isAdmin:false});
  mocks.receive.mockResolvedValue({stem:evidenceId,tempPath:'private-test-storage/part',mime:'video/webm',sizeBytes:100});
  mocks.rename.mockResolvedValue(undefined);mocks.unlink.mockResolvedValue(undefined);mocks.access.mockResolvedValue(undefined);
  mocks.readdir.mockResolvedValue([]);
  mocks.response.mockImplementation(()=>new Response(null,{headers:{'Cache-Control':'public, max-age=300, s-maxage=31536000'}}));
  mocks.query.mockImplementation(async(_db,sql,params)=>{
    if(sql.includes('SELECT r.user_id')) return [registration];
    if(sql.includes('SELECT registration_id::text')) return [{registration_id:id,mime:'video/webm',size_bytes:100}];
    if(sql.includes('SELECT id::text,registration_id::text')) return [{id:evidenceId,registration_id:id}];
    if(sql.includes('DELETE FROM platform_competition_evidence')) return registration.disputed ? [] : [{id:evidenceId}];
    if(sql.includes('INSERT INTO platform_competition_evidence')) {files.push({id:params[0]});return [];}
    if(sql.includes('FROM platform_competition_evidence WHERE registration_id')) return files;
    return [];
  });
});

describe('private competition evidence',()=>{
  it('requires authentication before reading files',async()=>{
    mocks.actor.mockRejectedValue(new PlatformApiError('UNAUTHENTICATED',401,'Login required'));
    expect((await app.request(endpoint)).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('denies outsiders for metadata, content and upload before receiving bytes',async()=>{
    mocks.actor.mockResolvedValue({userId:3,isAdmin:false});
    expect((await app.request(endpoint)).status).toBe(403);
    expect((await app.request(`/v1/platform/competitions/evidence/${evidenceId}/content`)).status).toBe(403);
    expect((await upload()).status).toBe(403);
    expect(mocks.receive).not.toHaveBeenCalled();
  });
  it.each([1,2])('allows the entrant or assigned supervisor (%i) to upload',async(userId)=>{
    mocks.actor.mockResolvedValue({userId,isAdmin:false});
    const result=await upload();
    expect(result.status).toBe(201);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.receive.mock.calls[0][2]).toBe(67108864);
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  });
  it('allows admin reading but not uploading on behalf of entrants',async()=>{
    mocks.actor.mockResolvedValue({userId:3,isAdmin:true});
    expect((await app.request(endpoint)).status).toBe(200);
    expect((await upload()).status).toBe(403);
  });
  it('overrides public video helper cache headers on private content',async()=>{
    const result=await app.request(`/v1/platform/competitions/evidence/${evidenceId}/content`,{headers:{Range:'bytes=0-9'}});
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(mocks.response.mock.calls[0][0].rangeHeader).toBe('bytes=0-9');
  });
  it('rejects finalized registrations before upload',async()=>{
    registration.finalized_at='2026-09-10T00:00:00Z';
    expect((await upload()).status).toBe(409);
    expect(mocks.receive).not.toHaveBeenCalled();
  });
  it('rechecks cancellation after receiving the file and removes its temporary bytes',async()=>{
    mocks.receive.mockImplementation(async()=>{
      registration.status='refunded';
      return {stem:evidenceId,tempPath:'private-test-storage/part',mime:'video/webm',sizeBytes:100};
    });
    expect((await upload()).status).toBe(409);
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(mocks.unlink).toHaveBeenCalledWith('private-test-storage/part');
  });
  it('serializes the two-file limit and cleans a rejected extra file',async()=>{
    files=[{id:'a'},{id:'b'}];
    expect((await upload()).status).toBe(409);
    expect(mocks.rename).not.toHaveBeenCalled();
    expect(mocks.unlink).toHaveBeenCalledTimes(1);
  });
  it('does not delete evidence held by an unresolved dispute',async()=>{
    registration.disputed=true;
    await pruneCompetitionEvidence();
    expect(mocks.unlink).not.toHaveBeenCalled();
    registration.disputed=false;
    await pruneCompetitionEvidence();
    expect(mocks.unlink).toHaveBeenCalledTimes(1);
  });
  it('removes only old unregistered UUID files, preserving held evidence and unrelated files',async()=>{
    registration.disputed=true;
    const orphan='33333333-3333-4333-8333-333333333333';
    mocks.readdir.mockResolvedValue([evidenceId,`${orphan}.part`,'notes.txt'].map(name=>({name,isFile:()=>true})));
    mocks.stat.mockResolvedValue({mtimeMs:Date.now()-31*86400_000});
    const query=mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async(db,sql,params)=>sql.startsWith('SELECT id FROM platform_competition_evidence') ? (params[0]===evidenceId?[{id:evidenceId}]:[]) : query(db,sql,params));
    await pruneCompetitionEvidence();
    expect(mocks.unlink).toHaveBeenCalledTimes(1);
    expect(mocks.unlink.mock.calls[0][0]).toContain(`${orphan}.part`);
  });
  it('preserves recent uncommitted uploads',async()=>{
    registration.disputed=true;
    mocks.readdir.mockResolvedValue([{name:`${evidenceId}.part`,isFile:()=>true}]);
    mocks.stat.mockResolvedValue({mtimeMs:Date.now()});
    await pruneCompetitionEvidence();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });
});
