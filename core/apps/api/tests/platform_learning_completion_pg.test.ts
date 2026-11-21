import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({db:null as unknown,userId:0}));
vi.mock('../src/db/connection.js',()=>({get sql(){return state.db;}}));
vi.mock('../src/platform/auth.js',()=>({requirePlatformActor:async()=>({userId:state.userId,ownerKey:`u${state.userId}`,displayName:'Learning fixture',isAdmin:false,viaApiKey:false,wcaId:null}),requirePlatformAdmin:async()=>{throw new Error('Not an administrator');}}));
import {platformLearningRoutes as app} from '../src/routes/platform_learning.js';
import {encryptPlatformPrivateData} from '../src/platform/data_encryption.js';
import {learningDate,learningStreak} from '../src/platform/learning_completion.js';
import {PUBLIC_DIRECTORY_ENTRY_PREDICATE} from '../src/platform/db.js';
const url=process.env.PLATFORM_LEARNING_TEST_DATABASE_URL;
it('uses local calendar days and preserves consecutive streaks across DST',()=>{
 expect(learningDate('America/Los_Angeles',new Date('2026-03-08T07:59:00Z'))).toBe('2026-03-07');
 expect(learningDate('Asia/Shanghai',new Date('2026-03-08T07:59:00Z'))).toBe('2026-03-08');
 expect(learningStreak(['2026-03-07','2026-03-08','2026-03-08','2026-03-09'],'2026-03-10')).toEqual({current:3,longest:3,checkedToday:false,total:3});
 expect(learningStreak(['2026-03-07'],'2026-03-10').current).toBe(0);
});
it('applies course-scoped teaching-team and validity checks to both instructor learner queries', async () => {
 const previousDb = state.db;
 const previousUser = state.userId;
 const unsafe = vi.fn(async (statement: string) => statement.includes('FROM platform_instructors\n    WHERE user_id') ? [{ id: randomUUID() }] : []);
 state.db = { unsafe };
 state.userId = 42;
 try {
  const dashboard=await app.request('/instructor/dashboard?view=overview&v=2');
  expect(dashboard.status).toBe(200);
  expect(await dashboard.json()).toMatchObject({availableMinor:0,availableCurrency:'CNY',currentMonth:expect.stringMatching(/^\d{4}-\d{2}$/),recentCourses:[],payouts:[]});
  expect((await app.request('/instructor/students')).status).toBe(200);
  const statements = unsafe.mock.calls.map(call => call[0]).filter(statement => statement.includes('JOIN platform_course_entitlements e'));
  expect(statements).toHaveLength(2);
  for (const statement of statements) {
   expect(statement).toContain('teaching_owner.course_id=e.course_id AND teaching_instructor.user_id=e.user_id');
   expect(statement).toContain('e.valid_from<=NOW()');
   expect(statement).toContain('e.valid_until>NOW()');
   expect(statement).toContain('reversal.reversal_of_ledger_id=l.id');
  }
  expect(unsafe.mock.calls.map(call=>call[0]).find(statement=>statement.includes('AS "learnerCount"'))).toContain('teaching_owner.course_id=e.course_id AND teaching_instructor.user_id=e.user_id');
  expect(unsafe.mock.calls.map(call=>call[0]).find(statement=>statement.includes('AS "learnerCount"'))).toContain("c.status<>'archived'");
 } finally {
  state.db = previousDb;
  state.userId = previousUser;
 }
});
describe.skipIf(!url)('learning HTTP routes with isolated PostgreSQL',()=>{
 const schema=`platform_learning_${randomUUID().replaceAll('-','')}`;
 const originalEncryptionKey=process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1;
 let admin:ReturnType<typeof postgres>;
 let db:ReturnType<typeof postgres>;let first:number,second:number,outsider:number;const course=randomUUID(),lesson=randomUUID(),otherLesson=randomUUID(),quiz=randomUUID(),question=randomUUID();
 const write=(path:string,body:unknown,method='POST')=>app.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
 const json=async(response:Response,status=200)=>{const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(status);return body;};
 beforeAll(async()=>{
  const parsed=new URL(url!);if(!['127.0.0.1','localhost'].includes(parsed.hostname))throw new Error('Explicit loopback PostgreSQL required');
  admin=postgres(url!,{max:1,onnotice:()=>{}});
  await admin.unsafe(`CREATE SCHEMA "${schema}"`);
  process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1=Buffer.alloc(32,47).toString('base64');
  db=postgres(url!,{max:4,onnotice:()=>{},connection:{search_path:schema}});state.db=db;
  await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;
    CREATE TABLE app_users(id BIGSERIAL PRIMARY KEY, display_name TEXT NOT NULL,wca_id VARCHAR(20) UNIQUE);`);
  for(const file of ['0066_forum.sql','0074_forum_review.sql','0126_teacher_directory.sql','0128_teacher_directory_visibility.sql','0130_teacher_directory_contacts.sql','0141_teacher_directory_images.sql','0167_platform_core.sql','0219_platform_lesson_grants.sql','0259_platform_learning_completion.sql']) {
    await db.unsafe(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
  }
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
 afterAll(async()=>{
  await db?.end();
  if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
  if(originalEncryptionKey===undefined)delete process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1;
  else process.env.PLATFORM_DATA_ENCRYPTION_KEY_V1=originalEncryptionKey;
 });
 it('enforces completion, averages untouched lessons, and awards completion and certificate once',async()=>{
  await json(await write('/me/certificates',{courseId:course}),409);
  await json(await write(`/me/progress/${lesson}`,{progressBps:10000,positionSeconds:90,status:'completed'},'PUT'));
  await json(await write(`/me/progress/${lesson}`,{progressBps:10000,positionSeconds:90,status:'completed'},'PUT'));
  const courses=await json(await app.request(`/me/courses?courseId=${course}`));expect(Number(courses.items[0].progressBps)).toBe(5000);expect(courses.items[0].courseStatus).toBe('published');
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

 it.each(['unlisted', 'draft', 'archived'])('reports %s course visibility without deleting learning history', async status => {
  state.userId = first;
  await db.unsafe("UPDATE platform_courses SET status=$2,archived_at=CASE WHEN $2::varchar='archived' THEN NOW() END WHERE id=$1", [course, status]);
  try {
   const courses = await json(await app.request('/me/courses'));
   expect(courses.items).toContainEqual(expect.objectContaining({ id: course, courseStatus: status, status: 'active' }));
  } finally {
   await db.unsafe("UPDATE platform_courses SET status='published',archived_at=NULL WHERE id=$1", [course]);
  }
 });
 it.each(['draft', 'archived'])('conceals %s course lessons from active learning routes', async status => {
  await db.unsafe("UPDATE platform_courses SET status=$2,archived_at=CASE WHEN $2::varchar='archived' THEN NOW() END WHERE id=$1", [course, status]);
  try {
   for (const access of ['public', 'entitled']) {
    await db.unsafe('UPDATE platform_lessons SET access_scope=$2 WHERE id=$1', [lesson, access]);
    for (const user of [first, outsider]) {
     state.userId = user;
     const before = await db.unsafe('SELECT COUNT(*)::int n FROM platform_quiz_attempts WHERE user_id=$1', [user]);
     await json(await write(`/learning/lessons/${lesson}/quiz`, { quizId: quiz, answers: { [question]: 1 } }), 404);
     await json(await app.request(`/learning/lessons/${lesson}/state`), 404);
     await json(await write(`/me/progress/${lesson}`, { progressBps: 10000 }, 'PUT'), 404);
     await json(await write(`/me/notes/${lesson}`, { contentMarkdown: 'Hidden lesson' }, 'PUT'), 404);
     expect(await db.unsafe('SELECT COUNT(*)::int n FROM platform_quiz_attempts WHERE user_id=$1', [user])).toEqual(before);
    }
   }
  } finally {
   state.userId = first;
   await db.unsafe("UPDATE platform_courses SET status='published',archived_at=NULL WHERE id=$1", [course]);
   await db.unsafe("UPDATE platform_lessons SET access_scope='entitled' WHERE id=$1", [lesson]);
  }
 });
 it('counts only effective learners, excludes each course teaching team and deduplicates across courses', async () => {
  const [teacherA, teacherB, learner, invalid] = (await db.unsafe(
   "INSERT INTO app_users(display_name) VALUES('Teacher A'),('Teacher B'),('Learner'),('Invalid learner') RETURNING id"
  )).map(row => Number(row.id));
  const [idA, idB] = [randomUUID(), randomUUID()];
  const [courseA, courseB, courseC] = [randomUUID(), randomUUID(), randomUUID()];
  try {
   await db.begin(async tx => {
    await tx.unsafe("INSERT INTO platform_instructors(id,user_id,display_name_snapshot) VALUES($1,$2,'Teacher A'),($3,$4,'Teacher B')", [idA, teacherA, idB, teacherB]);
    for (const id of [courseA, courseB, courseC]) {
     await tx.unsafe("INSERT INTO platform_courses(id,slug,status,current_revision,published_at) VALUES($1,$2,'published',1,NOW())", [id, `learners-${id}`]);
     await tx.unsafe("INSERT INTO platform_course_revisions(course_id,revision,title_en,status,content_hash,published_at) VALUES($1,1,'Learner stats fixture','published',decode(repeat('ab',32),'hex'),NOW())", [id]);
    }
    await tx.unsafe("INSERT INTO platform_course_owners(course_id,instructor_id,role) VALUES($1,$4,'owner'),($1,$5,'co_instructor'),($2,$4,'owner'),($3,$5,'owner')", [courseA, courseB, courseC, idA, idB]);
    for (const [user, id] of [[teacherA, courseA], [teacherA, courseB], [teacherA, courseC], [teacherB, courseA], [teacherB, courseB], [learner, courseA], [learner, courseB]]) {
     await tx.unsafe("INSERT INTO platform_course_entitlements(user_id,course_id,valid_from) VALUES($1,$2,NOW())", [user, id]);
    }
    await tx.unsafe("INSERT INTO platform_course_entitlements(user_id,course_id,status,valid_from,valid_until) VALUES($1,$2,'active',NOW()-INTERVAL '2 days',NOW()-INTERVAL '1 day'),($1,$3,'revoked',NOW()-INTERVAL '1 day',NULL),($1,$4,'active',NOW()+INTERVAL '1 day',NULL)", [invalid, courseA, courseB, courseC]);
   });
   state.userId = teacherA;
   const dashboardA = await json(await app.request('/instructor/dashboard'));
   expect(dashboardA.studentCount).toBe(2);
   expect(dashboardA.availableMinor).toBe(0);
   expect(dashboardA.recentCourses).toHaveLength(2);
   expect(dashboardA.recentCourses).toEqual(expect.arrayContaining([expect.objectContaining({id:courseA,learnerCount:1}),expect.objectContaining({id:courseB,learnerCount:2})]));
   const studentsA = await json(await app.request('/instructor/students?page=1&pageSize=20'));
   expect(studentsA.total).toBe(3);
   expect(studentsA.items.map((item: { userId: string; courseId: string }) => [Number(item.userId), item.courseId])).toEqual(expect.arrayContaining([
    [learner, courseA], [learner, courseB], [teacherB, courseB],
   ]));
   await json(await write('/instructor/certificates',{courseId:courseA,userId:invalid,recipientName:'Invalid'}),400);
   await json(await write('/instructor/certificates',{courseId:courseA,userId:teacherA,recipientName:'Teacher A'}),400);
   const granted=await json(await write('/instructor/certificates',{courseId:courseA,userId:learner,recipientName:'Learner'}),201);
   const repeated=await json(await write('/instructor/certificates',{courseId:courseA,userId:learner,recipientName:'Learner'}),200);
   expect(repeated.id).toBe(granted.id);expect(repeated.verificationCode).toBe(granted.verificationCode);
   const updatedStudents=await json(await app.request('/instructor/students?page=1&pageSize=20'));
   expect(updatedStudents.items.find((item:{userId:string;courseId:string})=>Number(item.userId)===learner&&item.courseId===courseA).hasCertificate).toBe(true);
   state.userId = teacherB;
   const dashboardB = await json(await app.request('/instructor/dashboard'));
   expect(dashboardB.studentCount).toBe(2);
   const studentsB = await json(await app.request('/instructor/students?page=1&pageSize=20'));
   expect(studentsB.total).toBe(2);
   expect(studentsB.items.map((item: { userId: string; courseId: string }) => [Number(item.userId), item.courseId])).toEqual(expect.arrayContaining([[learner, courseA], [teacherA, courseC]]));
   await db.unsafe("INSERT INTO platform_instructor_revenue_ledger(instructor_id,entry_type,delta_amount_minor,currency,reason,actor_user_id) VALUES($1,'adjustment',1200,'CNY','fixture',$3),($1,'adjustment',-200,'CNY','fixture',$3),($2,'adjustment',900,'CNY','fixture',$4)",[idA,idB,teacherA,teacherB]);
   state.userId=teacherA;
   const earnings=await json(await app.request('/instructor/earnings?page=1&pageSize=1&v=2'));
   expect(earnings.total).toBe(2);
   expect(earnings.items).toHaveLength(1);
   expect(earnings.items[0].entryType).toBe('adjustment');
   const secondPage=await json(await app.request('/instructor/earnings?page=2&pageSize=1&v=2'));
   expect(secondPage.total).toBe(2);
   expect(secondPage.items[0].id).not.toBe(earnings.items[0].id);
   expect([Number(earnings.items[0].amountMinor),Number(secondPage.items[0].amountMinor)].sort((a,b)=>a-b)).toEqual([-200,1200]);
   expect(await json(await app.request('/instructor/earnings?page=3&pageSize=1&v=2'))).toMatchObject({items:[],total:2});
   expect(await json(await app.request('/instructor/dashboard?view=earnings&v=2'))).toMatchObject({availableMinor:1000,availableCurrency:'CNY',recentCourses:[]});
  } finally {
   state.userId = first;
  }
 });
 it('migrates existing instructors without deleting profiles, guessing ambiguous ownership or granting new roles', async () => {
  const [existing,missing,ambiguous,unverified,suspended] = (await db.unsafe(
   "INSERT INTO app_users(display_name) VALUES('Existing'),('Missing'),('Ambiguous'),('Unverified'),('Suspended') RETURNING id"
  )).map(row=>Number(row.id));
  const [existingInstructor,missingInstructor,ambiguousInstructor,suspendedInstructor]=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
  const profile=async(userId:number,name:string,visible:boolean,kind='teacher')=>Number((await db.unsafe(
   "INSERT INTO teacher_directory_entries(kind,name_zh,description_zh,website,is_visible,owner_key,owner_name) VALUES($1,$2,'Introduction','https://example.test',$3,$4,$2) RETURNING id",
   [kind,name,visible,'u'+userId]
  ))[0].id);
  const hidden=await profile(existing,'Existing profile',false);
  await profile(ambiguous,'Choice A',true);await profile(ambiguous,'Choice B',true);
  const legacy=await profile(unverified,'Unverified profile',true);
  const school=await profile(unverified,'School',true,'organization');
  const suspendedProfile=await profile(suspended,'Suspended profile',true);
  await db.unsafe("INSERT INTO platform_instructors(id,user_id,display_name_snapshot,status) VALUES($1,$2,'Existing','active'),($3,$4,'Missing','active'),($5,$6,'Ambiguous','active'),($7,$8,'Suspended','suspended')",[existingInstructor,existing,missingInstructor,missing,ambiguousInstructor,ambiguous,suspendedInstructor,suspended]);
  await db.unsafe(readFileSync(new URL('../migrations/0348_platform_unified_instructor_profiles.sql',import.meta.url),'utf8'));
  const migrated=await db.unsafe("SELECT i.id::text,i.teacher_entry_id,t.is_visible FROM platform_instructors i LEFT JOIN teacher_directory_entries t ON t.id=i.teacher_entry_id WHERE i.id=ANY($1::uuid[])",[[existingInstructor,missingInstructor,ambiguousInstructor,suspendedInstructor]]);
  const byId=(id:string)=>migrated.find(row=>row.id===id);
  expect(Number(byId(existingInstructor)?.teacher_entry_id)).toBe(hidden);
  expect(byId(existingInstructor)?.is_visible).toBe(false);
  expect(byId(missingInstructor)?.teacher_entry_id).not.toBeNull();
  expect(byId(missingInstructor)?.is_visible).toBe(false);
  expect(byId(ambiguousInstructor)?.teacher_entry_id).toBeNull();
  expect(Number(byId(suspendedInstructor)?.teacher_entry_id)).toBe(suspendedProfile);
  expect(await db.unsafe('SELECT id FROM platform_instructors WHERE user_id=$1',[unverified])).toHaveLength(0);
  const created=Number(byId(missingInstructor)?.teacher_entry_id);
  await db.unsafe("UPDATE teacher_directory_entries SET description_zh='Publishable profile',is_visible=TRUE WHERE id=$1",[created]);
  const publicEntries=await db.unsafe('SELECT t.id FROM teacher_directory_entries t WHERE '+PUBLIC_DIRECTORY_ENTRY_PREDICATE);
  const visibleIds=publicEntries.map(row=>Number(row.id));
  expect(visibleIds).toContain(school);
  expect(visibleIds).toContain(created);
  expect(visibleIds).not.toContain(legacy);
  expect(visibleIds).not.toContain(hidden);
  expect(visibleIds).not.toContain(suspendedProfile);
  expect((await db.unsafe("SELECT is_visible FROM teacher_directory_entries WHERE id=$1",[legacy]))[0].is_visible).toBe(true);
 });
});
