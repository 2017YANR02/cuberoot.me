import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({db:null as unknown,userId:0}));
vi.mock('../src/db/connection.js',()=>({get sql(){return state.db;}}));
vi.mock('../src/platform/auth.js',()=>({requirePlatformActor:async()=>({userId:state.userId,ownerKey:`u${state.userId}`,displayName:'Learning fixture',isAdmin:false,viaApiKey:false,wcaId:null}),requirePlatformAdmin:async()=>{throw new Error('Not an administrator');}}));
import {platformLearningRoutes as app} from '../src/routes/platform_learning.js';
import {encryptPlatformPrivateData} from '../src/platform/data_encryption.js';
import {learningDate,learningStreak} from '../src/platform/learning_completion.js';
const url=process.env.PLATFORM_LEARNING_TEST_DATABASE_URL;
it('uses local calendar days and preserves consecutive streaks across DST',()=>{
 expect(learningDate('America/Los_Angeles',new Date('2026-03-08T07:59:00Z'))).toBe('2026-03-07');
 expect(learningDate('Asia/Shanghai',new Date('2026-03-08T07:59:00Z'))).toBe('2026-03-08');
 expect(learningStreak(['2026-03-07','2026-03-08','2026-03-08','2026-03-09'],'2026-03-10')).toEqual({current:3,longest:3,checkedToday:false,total:3});
 expect(learningStreak(['2026-03-07'],'2026-03-10').current).toBe(0);
});
describe.skipIf(!url)('learning HTTP routes with isolated PostgreSQL',()=>{
 let db:ReturnType<typeof postgres>;let first:number,second:number,outsider:number;const course=randomUUID(),lesson=randomUUID(),otherLesson=randomUUID(),quiz=randomUUID(),question=randomUUID();
 const write=(path:string,body:unknown,method='POST')=>app.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
 const json=async(response:Response,status=200)=>{const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(status);return body;};
 beforeAll(async()=>{
  const parsed=new URL(url!);if(!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/platform_completion')throw new Error('Explicit isolated platform_completion database required');
  process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1=Buffer.alloc(32,47).toString('base64');db=postgres(url!,{max:4,onnotice:()=>{}});state.db=db;
  await db.begin(async tx=>{
   const users=await tx.unsafe("INSERT INTO app_users(display_name) VALUES('Learning fixture A'),('Learning fixture B'),('Learning outsider') RETURNING id");[first,second,outsider]=users.map(row=>Number(row.id));state.userId=first;
   await tx.unsafe("INSERT INTO platform_courses(id,slug,status,current_revision,published_at) VALUES($1,$2,'published',1,NOW())",[course,`test-${course}`]);
   await tx.unsafe("INSERT INTO platform_course_revisions(course_id,revision,title_en,status,content_hash,published_at) VALUES($1,1,'Learning test','published',decode(repeat('ab',32),'hex'),NOW())",[course]);
   for(const [index,id] of [lesson,otherLesson].entries()){
    await tx.unsafe("INSERT INTO platform_lessons(id,course_id,slug,ordinal,status,current_revision) VALUES($1,$2,$3,$4,'published',1)",[id,course,`lesson-${index}`,index]);
    await tx.unsafe("INSERT INTO platform_lesson_revisions(lesson_id,revision,title_en,status,content_hash,published_at) VALUES($1,1,'Lesson','published',decode(repeat('ab',32),'hex'),NOW())",[id]);
   }
   for(const user of [first,second])await tx.unsafe("INSERT INTO platform_course_entitlements(user_id,course_id,valid_from) VALUES($1,$2,NOW())",[user,course]);
   await tx.unsafe("INSERT INTO platform_quizzes(id,lesson_id,slug,status,current_revision) VALUES($1,$2,'quiz','published',1)",[quiz,lesson]);
   await tx.unsafe("INSERT INTO platform_quiz_revisions(quiz_id,revision,title_en,passing_score_bps,status,content_hash,published_at) VALUES($1,1,'Quiz',10000,'published',decode(repeat('ab',32),'hex'),NOW())",[quiz]);
   const encrypted=encryptPlatformPrivateData({answer:1,explanation:'Private explanation'});
   await tx.unsafe(`INSERT INTO platform_quiz_questions(id,quiz_id,quiz_revision,ordinal,question_type,prompt_en,choices,answer_key_encrypted,answer_key_version) VALUES($1,$2,1,0,'single_choice','Choose','["Wrong","Correct"]',$3,$4)`,[question,quiz,encrypted.payload,encrypted.keyVersion]);
  });
 },30000);
 afterAll(async()=>{await db?.end();});
 it('enforces completion, averages untouched lessons, and awards completion and certificate once',async()=>{
  await json(await write('/me/certificates',{courseId:course}),409);
  await json(await write(`/me/progress/${lesson}`,{progressBps:10000,positionSeconds:90,status:'completed'},'PUT'));
  await json(await write(`/me/progress/${lesson}`,{progressBps:10000,positionSeconds:90,status:'completed'},'PUT'));
  const courses=await json(await app.request(`/me/courses?courseId=${course}`));expect(Number(courses.items[0].progressBps)).toBe(5000);
  await json(await write('/me/certificates',{courseId:course}),409);
  await json(await write(`/me/progress/${otherLesson}`,{progressBps:10000,status:'completed'},'PUT'));
  const issued=await json(await write('/me/certificates',{courseId:course}),201);const repeated=await json(await write('/me/certificates',{courseId:course}));expect(repeated).toEqual(issued);
  const own=await json(await app.request('/me/certificates'));expect(own.items.find((item:{id:string})=>item.id===issued.id).verificationCode).toBe(issued.verificationCode);
  await json(await app.request(`/certificates/${issued.verificationCode}`));expect((await app.request(`/certificates/${issued.verificationCode}/image`)).headers.get('content-type')).toContain('image/svg+xml');
  const rewards=await db.unsafe("SELECT COUNT(*)::int n,SUM(delta_points)::int points FROM platform_point_ledger WHERE user_id=$1 AND reason LIKE 'learning:lesson:%'",[first]);expect(rewards[0]).toEqual({n:2,points:16});
 });
 it('keeps private notes and answer history scoped to the authenticated learner',async()=>{
  const note=await json(await write(`/me/notes/${lesson}`,{contentMarkdown:'Private fixture note',positionSeconds:42},'PUT'),201);
  const grade=await json(await write(`/learning/lessons/${lesson}/quiz`,{quizId:quiz,answers:{[question]:1}}),201);expect(grade.scoreBps).toBe(10000);expect(grade.feedback[0].explanation).toBe('Private explanation');
  const stateA=await json(await app.request(`/learning/lessons/${lesson}/state`));expect(stateA.notes).toHaveLength(1);expect(stateA.attempts[0].feedback[0].expected).toBe(1);
  state.userId=second;const stateB=await json(await app.request(`/learning/lessons/${lesson}/state`));expect(stateB.notes).toEqual([]);expect(stateB.attempts).toEqual([]);expect((await json(await app.request('/me/notes'))).items).toEqual([]);
  await json(await write(`/me/notes/${lesson}`,{noteId:note.id,contentMarkdown:'Unauthorized edit'},'PUT'),404);
  await json(await write(`/me/notes/${note.id}`,{},'DELETE'),404);
  state.userId=outsider;await json(await app.request(`/learning/lessons/${lesson}/state`),403);await json(await write('/me/certificates',{courseId:course}),403);await json(await write(`/me/progress/${lesson}`,{progressBps:10000},'PUT'),403);
  state.userId=first;const gradeAgain=await json(await write(`/learning/lessons/${lesson}/quiz`,{quizId:quiz,answers:{[question]:1}}),201);expect(gradeAgain.awardedPoints).toBe(false);expect((await db.unsafe("SELECT COUNT(*)::int n FROM platform_point_ledger WHERE user_id=$1 AND reason LIKE 'learning:quiz:%'",[first]))[0].n).toBe(1);
 });
 it('rejects backdating and makes repeated check-ins and achievement rewards idempotent',async()=>{
  await json(await write('/me/checkins',{timezone:'UTC',localDate:'2000-01-01'}),400);
  const one=await json(await write('/me/checkins',{timezone:'UTC'}));const two=await json(await write('/me/checkins',{timezone:'UTC'}));expect(two.id).toBe(one.id);expect(two.balance).toBe(one.balance);
  expect((await db.unsafe("SELECT COUNT(*)::int n,SUM(delta_points)::int points FROM platform_point_ledger WHERE user_id=$1 AND entry_type='checkin'",[first]))[0]).toEqual({n:1,points:5});
  await json(await write('/me/badges/refresh',{}));const before=await db.unsafe('SELECT SUM(delta_points)::int points FROM platform_point_ledger WHERE user_id=$1',[first]);await json(await write('/me/badges/refresh',{}));const after=await db.unsafe('SELECT SUM(delta_points)::int points FROM platform_point_ledger WHERE user_id=$1',[first]);expect(after).toEqual(before);
 });
 it('derives forum, points and net CNY milestones from canonical facts',async()=>{
  const user=Number((await db.unsafe("INSERT INTO app_users(display_name) VALUES('Milestone fixture') RETURNING id"))[0].id);state.userId=user;const owner=`u${user}`;
  const category=(await db.unsafe("INSERT INTO forum_categories(slug,name_en,name_zh) VALUES($1,'Fixture','测试') RETURNING id",[randomUUID()]))[0].id;
  const forum=(await db.unsafe("INSERT INTO forum_forums(category_id,slug,name_en,name_zh) VALUES($1,$2,'Fixture','测试') RETURNING id",[category,randomUUID()]))[0].id;
  const thread=(await db.unsafe("INSERT INTO forum_threads(forum_id,title,author_id,author_name) VALUES($1,'Fixture',$2,'Fixture') RETURNING id",[forum,owner]))[0].id;
  await db.unsafe("INSERT INTO forum_posts(thread_id,author_id,author_name,content) SELECT $1,$2,'Fixture','Content' FROM generate_series(1,10)",[thread,owner]);
  await db.unsafe("INSERT INTO forum_posts(thread_id,author_id,author_name,content,status,is_deleted) VALUES($1,$2,'Fixture','Pending','pending',false),($1,$2,'Fixture','Deleted','approved',true),($1,'u0','Other','Other owner','approved',false)",[thread,owner]);
  const order=async(amount:number,currency:string)=>{const number=`PLT-${randomUUID().replaceAll('-','').toUpperCase()}`;return(await db.unsafe("INSERT INTO platform_orders(order_number,buyer_user_id,client_order_key,status,currency,subtotal_amount_minor,total_amount_minor,pricing_snapshot,paid_at) VALUES($1,$2,$1,'paid',$3,$4,$4,'{}',NOW()) RETURNING id",[number,user,currency,amount]))[0].id;};
  const cny=await order(100000,'CNY');await order(10000000,'USD');
  const attempt=(await db.unsafe("INSERT INTO platform_payment_attempts(order_id,attempt_number,provider,merchant_account,provider_order_id,provider_transaction_id,status,amount_minor,currency,request_hash,succeeded_at) VALUES($1,1,'fixture','fixture',$2,$2,'succeeded',100000,'CNY',decode(repeat('ab',32),'hex'),NOW()) RETURNING id",[cny,randomUUID()]))[0].id;
  await db.unsafe("INSERT INTO platform_refunds(order_id,payment_attempt_id,refund_number,provider,status,reason_code,amount_minor,currency,succeeded_at) VALUES($1,$2,1,'fixture','succeeded','fixture',100,'CNY',NOW())",[cny,attempt]);
  await db.unsafe("UPDATE platform_orders SET status='partially_refunded' WHERE id=$1",[cny]);
  await db.unsafe("INSERT INTO platform_point_ledger(user_id,entry_type,delta_points,balance_after,reason,actor_user_id) VALUES($1,'adjustment',999,999,'Fixture',$1)",[user]);
  const badges=await json(await app.request('/me/badges'));const byKey=(key:string)=>badges.items.find((row:{achievementKey:string})=>row.achievementKey===key);
  expect(byKey('posts_10').progress).toBe(10);expect(byKey('spend_1000').progress).toBe(999);expect(byKey('points_1000').progress).toBe(999);
  await json(await write('/me/badges/refresh',{}));
  const earned=async()=> (await db.unsafe('SELECT a.achievement_key FROM platform_user_achievements ua JOIN platform_achievements a ON a.id=ua.achievement_id WHERE ua.user_id=$1',[user])).map(row=>row.achievement_key);
  expect(await earned()).toContain('first_post');expect(await earned()).toContain('posts_10');expect(await earned()).not.toContain('points_1000');expect(await earned()).not.toContain('spend_1000');
  await order(200,'CNY');await json(await write('/me/badges/refresh',{}));expect(await earned()).toContain('points_1000');expect(await earned()).toContain('spend_1000');
  const rewards=await db.unsafe("SELECT SUM(delta_points)::int points FROM platform_point_ledger WHERE user_id=$1 AND entry_type='achievement'",[user]);await json(await write('/me/badges/refresh',{}));expect(await db.unsafe("SELECT SUM(delta_points)::int points FROM platform_point_ledger WHERE user_id=$1 AND entry_type='achievement'",[user])).toEqual(rewards);
 });

});
