import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { Hono } from 'hono';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({db:null as unknown,userId:1,create:vi.fn(),notify:vi.fn(),query:vi.fn()}));
vi.mock('../src/db/connection.js',()=>({get sql(){return state.db;}}));
vi.mock('../src/platform/auth.js',()=>({requirePlatformActor:async()=>({userId:state.userId,ownerKey:`user:${state.userId}`,displayName:'Fixture',isAdmin:false,viaApiKey:false,wcaId:null}),requirePlatformAdmin:async()=>({userId:1,ownerKey:'user:1',displayName:'Fixture',isAdmin:true,viaApiKey:false,wcaId:null})}));
vi.mock('../src/platform/payment.js',async(importOriginal)=>({
 ...await importOriginal<typeof import('../src/platform/payment.js')>(),
 createProviderPayment:state.create,verifyProviderNotification:state.notify,queryProviderPayment:state.query,
 orderPaymentChannels:()=>({alipay:true,wechatNative:true,wechatH5:true,wechatMiniProgram:false}),
}));
import {platformCommerceRoutes} from '../src/routes/platform_commerce.js';
import {platformContentRoutes} from '../src/routes/platform_content.js';
import {platformLearningRoutes} from '../src/routes/platform_learning.js';
const app=new Hono().route('/v1/platform',platformCommerceRoutes).route('/v1/platform',platformLearningRoutes).route('/v1',platformContentRoutes);
const url=process.env.PLATFORM_COMMERCE_TEST_DATABASE_URL;
describe.skipIf(!url)('commerce completion against PostgreSQL',()=>{
 const schema=`commerce_${randomUUID().replaceAll('-','')}`;let admin:ReturnType<typeof postgres>,db:ReturnType<typeof postgres>,productId:string,variantId:string;
 const migration=(name:string)=>readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8');
 beforeAll(async()=>{if(!['localhost','127.0.0.1'].includes(new URL(url!).hostname))throw new Error('Loopback required');admin=postgres(url!,{max:1,onnotice:()=>{}});await admin.unsafe(`CREATE SCHEMA "${schema}"`);db=postgres(url!,{max:4,connection:{search_path:schema},onnotice:()=>{}});state.db=db;
 await db.unsafe(`CREATE FUNCTION trg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=NOW(); RETURN NEW; END $$;CREATE TABLE app_users(id BIGINT PRIMARY KEY);CREATE TABLE teacher_directory_entries(id BIGINT PRIMARY KEY);`);
 await db.unsafe(migration('0142_teaching_foundation.sql').split('CREATE TABLE student_profiles')[0]);for(const file of ['0167_platform_core.sql','0183_platform_physical_bundle_codes.sql','0219_platform_lesson_grants.sql','0224_online_competitions.sql','0228_platform_provider_refunds.sql','0260_platform_commerce_completion.sql','0296_wechat_instructor_payouts.sql'])await db.unsafe(migration(file));await db.unsafe('INSERT INTO app_users VALUES(1)');},60000);
 afterAll(async()=>{vi.unstubAllEnvs();await db?.end();if(admin){await admin.unsafe(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}});
 const write=(path:string,body:unknown)=>app.request(path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
 async function pendingOrderPayment(items: unknown[]) {
  const response = await write('/v1/platform/orders', { items });
  const order = await response.json(); expect(response.status, JSON.stringify(order)).toBe(201);
  const payment = await write(`/v1/platform/orders/${order.id}/payment-attempts`, { provider: 'wechat', clientType: 'pc' });
  expect(payment.status, await payment.clone().text()).toBe(201);
  const input = state.create.mock.calls.at(-1)![0];
  return { order, event: { provider: 'wechat', eventId: randomUUID(), providerTransactionId: randomUUID(), orderNo: input.orderNo,
   paid: true, amountCents: order.totalAmountMinor, currency: 'CNY', merchantId: 'fixture-merchant', raw: { fixture: true } } };
 }
 async function advisoryGate(key: string) {
  let release!: () => void, ready!: (pid: number) => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const locked = new Promise<number>(resolve => { ready = resolve; });
  const closed = db.begin(async tx => {
   await tx.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
   ready(Number((await tx.unsafe('SELECT pg_backend_pid() pid'))[0].pid));
   await gate;
  });
  return { pid: await locked, release, closed };
 }
 async function waitForAdvisoryWaiters(pid: number, count: number): Promise<number[]> {
  let waiters: number[] = [];
  await vi.waitFor(async () => {
   const rows = await admin.unsafe(`SELECT waiting.pid FROM pg_locks waiting JOIN pg_locks held
     ON held.locktype=waiting.locktype AND held.database=waiting.database AND held.classid=waiting.classid
     AND held.objid=waiting.objid AND held.objsubid=waiting.objsubid
     WHERE held.pid=$1 AND held.granted AND NOT waiting.granted AND waiting.locktype='advisory'`, [pid]);
   waiters = rows.map(row => Number(row.pid)); expect(waiters).toHaveLength(count);
  }, { timeout: 3000, interval: 10 });
  return waiters;
 }
 async function shiftMembershipTimeline(membershipId: string, interval: string) {
  // Fixture clock control: move existing immutable intervals, preserving their status.
  await db.begin(async tx => {
   await tx.unsafe('ALTER TABLE platform_membership_ledger DISABLE TRIGGER USER');
   await tx.unsafe('UPDATE platform_membership_ledger SET valid_from=valid_from+$2::interval,valid_until=valid_until+$2::interval WHERE membership_id=$1', [membershipId, interval]);
   await tx.unsafe('ALTER TABLE platform_membership_ledger ENABLE TRIGGER USER');
   await tx.unsafe('UPDATE platform_memberships SET valid_from=valid_from+$2::interval,valid_until=valid_until+$2::interval WHERE id=$1', [membershipId, interval]);
  });
 }
 async function membershipIsActive(membershipId: string) {
  const response = await app.request('/v1/platform/me/memberships');
  const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(200);
  return body.items.find((item: { id: string }) => item.id === membershipId)?.isActive;
 }
 it('filters before pagination and preserves presentation',async()=>{for(const [slug,title,category] of [['alpha-cube','Alpha cube','cubes'],['beta-cube','Beta cube','cubes'],['alpha-book','Alpha book','books']]){const response=await write('/v1/platform/admin/products',{slug,productType:'digital',status:'active',titleZh:title,titleEn:title,category,memberOnly:slug==='alpha-cube',presentation:{brand:'Fixture'},variants:[{sku:slug.toUpperCase(),titleZh:'Standard',titleEn:'Standard',amountMinor:1200,memberAmountMinor:900,currency:'CNY',inventoryOnHand:3,status:'active'}]});const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(201);if(slug==='alpha-cube')productId=body.product.id;}
 const list=await(await app.request('/v1/platform/products?q=Alpha&category=cubes&pageSize=1')).json();expect(list.total).toBe(1);expect(list.products).toHaveLength(1);expect(list.products[0]).toMatchObject({id:productId,memberOnly:true});const page=await(await app.request('/v1/platform/products?category=cubes&pageSize=1&page=2')).json();expect(page.total).toBe(2);expect(page.products).toHaveLength(1);const detail=await(await app.request(`/v1/platform/products/${productId}`)).json();variantId=detail.product.variants[0].id;expect(detail.product.presentation.brand).toBe('Fixture');expect(detail.product.related).toHaveLength(1);});
 it('shares member/coupon pricing without quote side effects',async()=>{const payload={items:[{productVariantId:variantId,quantity:2}],couponCode:'FIXTURE'};expect((await write('/v1/platform/orders/quote',payload)).status).toBe(400);
 const plans=await db.unsafe(`INSERT INTO platform_membership_plans(slug,name_zh,name_en,status,period_unit,period_count,amount_minor,currency) VALUES('fixture','会员','Member','active','month',1,100,'CNY') RETURNING id`);await db.unsafe(`INSERT INTO platform_memberships(user_id,plan_id,status,valid_from,valid_until) VALUES(1,$1,'active',NOW()-INTERVAL '1 day',NOW()+INTERVAL '1 month')`,[plans[0].id]);const coupon=await write('/v1/platform/admin/coupons',{code:'FIXTURE',status:'active',discountType:'percent',discountBps:1250,perUserLimit:1,eligibility:{memberOnly:true,productIds:[productId]}});expect(coupon.status,JSON.stringify(await coupon.json())).toBe(201);
 const quote=await write('/v1/platform/orders/quote',payload);expect(quote.status,JSON.stringify(await quote.clone().json())).toBe(200);expect(await quote.json()).toMatchObject({member:true,subtotalAmountMinor:1800,discountAmountMinor:225,totalAmountMinor:1575});expect((await db.unsafe('SELECT COUNT(*)::int n FROM platform_orders'))[0].n).toBe(0);expect((await db.unsafe('SELECT inventory_reserved FROM platform_product_variants WHERE id=$1',[variantId]))[0].inventory_reserved).toBe(0);
 const response=await write('/v1/platform/orders',payload);const order=await response.json();expect(response.status,JSON.stringify(order)).toBe(201);expect((await db.unsafe('SELECT total_amount_minor::int amount FROM platform_orders WHERE id=$1',[order.id]))[0].amount).toBe(1575);expect((await db.unsafe('SELECT inventory_reserved FROM platform_product_variants WHERE id=$1',[variantId]))[0].inventory_reserved).toBe(2);expect((await write('/v1/platform/orders/quote',payload)).status).toBe(409);});
 it('reads business aggregates and exact collection totals',async()=>{for(const path of ['/v1/platform/orders','/v1/platform/admin/orders','/v1/platform/admin/coupons','/v1/platform/admin/instructor-payouts','/v1/platform/admin/reconciliation','/v1/platform/admin/logs']){const response=await app.request(`${path}?q=FIXTURE`);expect(response.status,path).toBe(200);expect(typeof(await response.json()).total).toBe('number');}const response=await app.request('/v1/platform/admin/analytics');const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);expect(body.item.summary.orders).toBe(1);expect(body.item.summary.paidOrders).toBe(0);});
 it('enforces ticket sales dates and preserves venue/program',async()=>{const response=await write('/v1/platform/admin/events',{slug:'fixture-event',titleZh:'活动',titleEn:'Fixture event',status:'published',startsAt:'2099-01-02T01:00:00Z',endsAt:'2099-01-02T03:00:00Z',timezone:'Asia/Shanghai',category:'training',program:['三阶'],venue:{city:'杭州',name:'Training room'},tickets:[{code:'ticket',titleZh:'入场票',titleEn:'Admission',amountMinor:2000,currency:'CNY',capacity:10,salesStartAt:'2099-01-01T00:00:00Z',salesEndAt:'2099-01-02T00:00:00Z',status:'active'}]});const result=await response.json();expect(response.status,JSON.stringify(result)).toBe(201);const detail=await(await app.request(`/v1/platform/events/${result.event.id}`)).json();expect(detail.event.venue.city).toBe('杭州');expect(detail.event.program).toEqual(['三阶']);expect(detail.event.tickets[0].available).toBe(10);expect((await write('/v1/platform/orders/quote',{items:[{eventTicketTypeId:detail.event.tickets[0].id,quantity:1}]})).status).toBe(404);const search=await(await app.request('/v1/platform/search?q=Alpha&pageSize=1&page=2')).json();expect(search.total).toBe(2);expect(search.results).toHaveLength(1);});
 it('round-trips Markdown and related news',async()=>{for(const slug of ['news-one','news-two']){const response=await write('/v1/platform/admin/news',{slug,titleZh:slug,titleEn:slug,status:'published',category:'teaching',excerptZh:'摘要',excerptEn:'Summary',bodyZh:{markdown:'# 标题'},bodyEn:{markdown:'# Heading'}});expect(response.status,JSON.stringify(await response.json())).toBe(201);}const response=await app.request('/v1/platform/news/news-one');const body=await response.json();expect(response.status).toBe(200);expect(body.article.excerptZh).toBe('摘要');expect(body.article.related).toHaveLength(1);expect(body.article.bodyEn.markdown).toBe('# Heading');const edited=await app.request(`/v1/platform/admin/news/${body.article.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({excerptZh:'',bodyEn:{markdown:'Updated **body**'}})});expect(edited.status,JSON.stringify(await edited.json())).toBe(200);const saved=await(await app.request('/v1/platform/news/news-one')).json();expect(saved.article.excerptZh).toBe('');expect(saved.article.bodyEn.markdown).toBe('Updated **body**');});
 // Exercise real order/reservation/settlement SQL; only payment-network I/O is simulated.
 async function paymentFixture(provider: 'wechat' | 'alipay' = 'wechat', clientType: 'pc' | 'wap' = 'pc') {
  vi.stubEnv('WECHAT_MCHID', 'fixture-merchant');
  vi.stubEnv('ALIPAY_APP_ID', 'fixture-alipay');
  vi.stubEnv('PLATFORM_DATA_ENCRYPTION_KEY_V1', Buffer.alloc(32, 7).toString('base64'));
  state.userId = 1;
  state.query.mockReset().mockResolvedValue(null);
  state.create.mockReset().mockResolvedValue({ qrCodeDataUrl: 'data:image/png;base64,fixture' });
  const slug = `merch-${randomUUID()}`;
  const productResponse = await write('/v1/platform/admin/products', {
   slug, productType: 'physical', status: 'active', titleZh: '测试周边', titleEn: 'Fixture merchandise', category: 'lifestyle',
   variants: [{ sku: slug.toUpperCase(), titleZh: '标准', titleEn: 'Standard', amountMinor: 2900, currency: 'CNY', inventoryOnHand: 3, status: 'active' }],
  });
  const product = await productResponse.json(); expect(productResponse.status, JSON.stringify(product)).toBe(201);
  const detail = await (await app.request(`/v1/platform/products/${product.product.id}`)).json();
  const variant = detail.product.variants[0].id;
  const address = await (await write('/v1/platform/me/shipping-addresses', {
   recipientName: 'Fixture', phone: '13800000000', countryCode: 'CN', city: 'Fixture city', addressLine1: 'Fixture address',
  })).json();
  const created = await write('/v1/platform/orders', { shippingAddressId: address.id, items: [{ productVariantId: variant, quantity: 2 }], totalAmountMinor: 1 });
  const order = await created.json(); expect(created.status, JSON.stringify(order)).toBe(201);
  expect(order.totalAmountMinor).toBe(5800);
  const response = await write(`/v1/platform/orders/${order.id}/payment-attempts`, { provider, clientType, lang: 'zh' });
  const attempt = await response.json(); expect(response.status, JSON.stringify(attempt)).toBe(201);
  const input = state.create.mock.calls[0][0];
  expect(input).toMatchObject({ provider, clientType, amountCents: 5800, currency: 'CNY', lang: 'zh' });
  const event = { provider, eventId: randomUUID(), providerTransactionId: randomUUID(), orderNo: input.orderNo,
   paid: true, amountCents: 5800, currency: 'CNY', merchantId: provider === 'wechat' ? 'fixture-merchant' : 'fixture-alipay', raw: { fixture: true } };
  state.notify.mockReset().mockResolvedValue(event);
  const inventory = async () => (await db.unsafe('SELECT inventory_on_hand,inventory_reserved FROM platform_product_variants WHERE id=$1', [variant]))[0];
  const notify = () => write(`/v1/platform/payments/${provider}/notify`, {});
  return { order, attempt, variant, event, inventory, notify };
 }
 async function makeQueryDue(attemptId: string) {
  // Fixture clock control only: production updates use the normal timestamp trigger.
  await db.unsafe('ALTER TABLE platform_payment_attempts DISABLE TRIGGER USER');
  try { await db.unsafe("UPDATE platform_payment_attempts SET updated_at=NOW()-INTERVAL '20 seconds' WHERE id=$1", [attemptId]); }
  finally { await db.unsafe('ALTER TABLE platform_payment_attempts ENABLE TRIGGER USER'); }
 }
 it.each(['wechat', 'alipay'] as const)('resumes %s and settles concurrent callback replays exactly once', async provider => {
  const f = await paymentFixture(provider);
  expect(await f.inventory()).toMatchObject({ inventory_on_hand: 3, inventory_reserved: 2 });
  const read = await app.request(`/v1/platform/orders/${f.order.id}`);
  expect(await read.json()).toMatchObject({ activePayment: { id: f.attempt.id, provider, clientType: 'pc', qrCodeDataUrl: 'data:image/png;base64,fixture' } });
  const resumed = await write(`/v1/platform/orders/${f.order.id}/payment-attempts`, { provider, clientType: 'pc', lang: 'zh' });
  expect(resumed.status).toBe(200); expect(await resumed.json()).toMatchObject({ id: f.attempt.id });
  expect(state.create.mock.calls[1][0].orderNo).toBe(f.event.orderNo);
  expect((await write(`/v1/platform/orders/${f.order.id}/payment-attempts`, { provider: provider === 'wechat' ? 'alipay' : 'wechat', clientType: 'pc' })).status).toBe(409);
  const notices = await Promise.all([f.notify(), f.notify()]);
  expect(notices.map(r => r.status)).toEqual([200, 200]);
  expect(await f.inventory()).toMatchObject({ inventory_on_hand: 1, inventory_reserved: 0 });
  const paid = await (await app.request(`/v1/platform/orders/${f.order.id}`)).json();
  expect(paid.status).toBe('paid'); expect(paid.activePayment).toBeNull();
  expect((await db.unsafe("SELECT COUNT(*)::int n FROM platform_inventory_ledger WHERE product_variant_id=$1 AND entry_type='sell'", [f.variant]))[0].n).toBe(1);
 });
 it('rejects amount, currency, merchant and order mismatches without changing stock', async () => {
  const f = await paymentFixture();
  for (const mismatch of [{ amountCents: 1 }, { currency: 'USD' }, { merchantId: 'another-merchant' }, { orderNo: 'another-order' }]) {
   state.notify.mockResolvedValue({ ...f.event, ...mismatch });
   expect((await f.notify()).status).toBe(403);
  }
  expect(await f.inventory()).toMatchObject({ inventory_on_hand: 3, inventory_reserved: 2 });
  expect((await (await app.request(`/v1/platform/orders/${f.order.id}`)).json()).status).toBe('pending_payment');
 });
 it('recovers a missed notification only through an authenticated provider query', async () => {
  const f = await paymentFixture();
  await makeQueryDue(f.attempt.id);
  state.userId = 2;
  expect((await app.request(`/v1/platform/orders/${f.order.id}`)).status).toBe(404);
  expect(state.query).not.toHaveBeenCalled(); state.userId = 1;
  state.query.mockRejectedValueOnce(new Error('Fixture provider unavailable'));
  expect((await (await app.request(`/v1/platform/orders/${f.order.id}`)).json()).status).toBe('pending_payment');
  await makeQueryDue(f.attempt.id);
  state.query.mockResolvedValue({ ...f.event, eventId: `query:${f.event.providerTransactionId}` });
  const recovered = await (await app.request(`/v1/platform/orders/${f.order.id}`)).json();
  expect(recovered.status).toBe('paid');
  expect(state.query).toHaveBeenLastCalledWith('wechat', f.event.orderNo);
  expect((await f.notify()).status).toBe(200);
  expect(await f.inventory()).toMatchObject({ inventory_on_hand: 1, inventory_reserved: 0 });
 });
 it('refreshes H5 URLs on the same payment and rejects WeChat embedded H5', async () => {
  const f = await paymentFixture('wechat', 'wap');
  state.create.mockResolvedValue({ checkoutUrl: 'https://example.invalid/refreshed-h5' });
  const resumed = await write(`/v1/platform/orders/${f.order.id}/payment-attempts`, { provider: 'wechat', clientType: 'wap' });
  expect(await resumed.json()).toMatchObject({ id: f.attempt.id, checkoutUrl: 'https://example.invalid/refreshed-h5' });
  expect(state.create.mock.calls[1][0].orderNo).toBe(f.event.orderNo);
  const blocked = await app.request(`/v1/platform/orders/${f.order.id}/payment-attempts`, { method: 'POST',
   headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), 'User-Agent': 'iPhone MicroMessenger/8.0' },
   body: JSON.stringify({ provider: 'wechat', clientType: 'wap' }) });
  expect(blocked.status).toBe(400); expect(state.create).toHaveBeenCalledTimes(2);
 });
 it('records a late payment for reconciliation without selling released stock', async () => {
  const f = await paymentFixture();
  expect((await write(`/v1/platform/orders/${f.order.id}/cancel`, {})).status).toBe(200);
  expect((await f.notify()).status).toBe(200);
  expect(await f.inventory()).toMatchObject({ inventory_on_hand: 3, inventory_reserved: 0 });
  expect((await (await app.request(`/v1/platform/orders/${f.order.id}`)).json()).status).toBe('cancelled');
  expect((await db.unsafe('SELECT rejection_code FROM platform_provider_events WHERE payment_attempt_id=$1', [f.attempt.id]))[0].rejection_code).toBe('late_payment_after_order_closed');
 });
 it('keeps an unpaid provider notification pending until the transaction is settled', async () => {
  const f = await paymentFixture('alipay');
  state.notify.mockResolvedValue({ ...f.event, paid: false, closed: false });
  expect((await f.notify()).status).toBe(200);
  expect((await db.unsafe('SELECT status FROM platform_payment_attempts WHERE id=$1', [f.attempt.id]))[0].status).toBe('pending');
  state.notify.mockResolvedValue(f.event); expect((await f.notify()).status).toBe(200);
  expect(await f.inventory()).toMatchObject({ inventory_on_hand: 1, inventory_reserved: 0 });
 });

 it.each(['published', 'unlisted'])('enforces %s course enrollment mode before quoting or granting access', async status => {
  state.userId = 1;
  for (const mode of ['invite', 'admin_grant', 'free', 'purchase']) {
   const courseId = randomUUID();
   await db.begin(async tx => {
    await tx.unsafe(`INSERT INTO platform_courses(id,slug,status,current_revision,enrollment_mode,base_amount_minor,currency,published_at)
      VALUES($1,$2,$3,1,$4,0,'CNY',NOW())`, [courseId, `mode-${mode}-${courseId}`, status, mode]);
    await tx.unsafe(`INSERT INTO platform_course_revisions(course_id,revision,title_zh,title_en,status,content_hash,published_at)
      VALUES($1,1,'课程','Course','published',decode(repeat('ab',32),'hex'),NOW())`, [courseId]);
   });
   const payload = { items: [{ courseId }] };
   const quote = await write('/v1/platform/orders/quote', payload);
   const order = await write('/v1/platform/orders', payload);
   if (mode === 'purchase') {
    expect(quote.status, JSON.stringify(await quote.json())).toBe(200);
    expect(order.status, JSON.stringify(await order.json())).toBe(201);
    expect((await db.unsafe('SELECT status FROM platform_course_entitlements WHERE user_id=1 AND course_id=$1', [courseId]))[0].status).toBe('active');
   } else {
    expect(quote.status, `${mode}: ${JSON.stringify(await quote.json())}`).toBe(404);
    expect(order.status, `${mode}: ${JSON.stringify(await order.json())}`).toBe(404);
    expect(await db.unsafe('SELECT id FROM platform_order_items WHERE course_id=$1', [courseId])).toHaveLength(0);
    expect(await db.unsafe('SELECT id FROM platform_course_entitlements WHERE course_id=$1', [courseId])).toHaveLength(0);
   }
  }
 });

 it('serializes concurrent default address changes without losing either address', async () => {
  vi.stubEnv('PLATFORM_DATA_ENCRYPTION_KEY_V1', Buffer.alloc(32, 7).toString('base64'));
  await db.unsafe('INSERT INTO app_users VALUES(3)');
  state.userId = 3;
  const payload = { recipientName: 'Fixture', phone: '13800000000', countryCode: 'CN', city: 'Fixture city', addressLine1: 'Fixture address', isDefault: true };
  try {
   const responses = await Promise.all([
    write('/v1/platform/me/shipping-addresses', { ...payload, label: 'First' }),
    write('/v1/platform/me/shipping-addresses', { ...payload, label: 'Second' }),
   ]);
   const bodies = await Promise.all(responses.map(response => response.json()));
   expect(responses.map(response => response.status), JSON.stringify(bodies)).toEqual([201, 201]);
   const addresses = await db.unsafe('SELECT id,is_default FROM platform_shipping_addresses WHERE user_id=3 AND archived_at IS NULL');
   expect(addresses).toHaveLength(2);
   expect(addresses.filter(address => address.is_default)).toHaveLength(1);
   const updates = await Promise.all(addresses.map(address => app.request(`/v1/platform/me/shipping-addresses/${address.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ isDefault: true }),
   })));
   expect(updates.map(response => response.status)).toEqual([200, 200]);
   expect(await db.unsafe('SELECT id FROM platform_shipping_addresses WHERE user_id=3 AND is_default AND archived_at IS NULL')).toHaveLength(1);
  } finally { state.userId = 1; }
 });

 it.each(['purchase', 'invite', 'mixed'])('preserves both membership periods when first %s grants race', async source => {
  const userId = ['purchase', 'invite', 'mixed'].indexOf(source) + 4;
  await db.unsafe('INSERT INTO app_users VALUES($1)', [userId]);
  state.userId = userId;
  const plan = (await db.unsafe(`INSERT INTO platform_membership_plans(slug,name_en,status,period_unit,period_count,amount_minor,currency)
    VALUES($1,'Concurrent membership','active','day',1,0,'CNY') RETURNING id`, [`membership-${randomUUID()}`]))[0].id;
  const codes: string[] = [];
  for (let i = 0; i < (source === 'invite' ? 2 : source === 'mixed' ? 1 : 0); i++) {
   const response = await write('/v1/platform/admin/invites', { benefit: { membershipPlanId: plan } });
   const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(201);
   codes.push(body.code);
  }
  // Hold both first inserts long enough to exercise the missing-row race deterministically.
  await db.unsafe(`CREATE FUNCTION delay_membership_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$;
    CREATE TRIGGER delay_membership_insert BEFORE INSERT ON platform_memberships FOR EACH ROW EXECUTE FUNCTION delay_membership_insert()`);
  try {
   const responses = await Promise.all([
    source === 'invite' ? write('/v1/platform/invites/redeem', { code: codes[0] }) : write('/v1/platform/orders', { items: [{ membershipPlanId: plan }] }),
    source === 'purchase' ? write('/v1/platform/orders', { items: [{ membershipPlanId: plan }] }) : write('/v1/platform/invites/redeem', { code: codes.at(-1) }),
   ]);
   const bodies = await Promise.all(responses.map(response => response.json()));
   expect(responses.map(response => response.status), JSON.stringify(bodies)).toEqual([201, 201]);
   const rows = await db.unsafe(`SELECT ROUND(EXTRACT(EPOCH FROM (valid_until-valid_from))/86400)::int days
     FROM platform_memberships WHERE user_id=$2 AND plan_id=$1`, [plan, userId]);
   expect(rows[0].days).toBe(2);
   const ledger = await db.unsafe(`SELECT entry_type, l.valid_from, l.valid_until FROM platform_membership_ledger l JOIN platform_memberships m ON m.id=l.membership_id WHERE m.user_id=$1 ORDER BY l.valid_from`, [userId]);
   expect(ledger).toHaveLength(2);
   expect(ledger[0].valid_until).toEqual(ledger[1].valid_from);
   if (source === 'purchase') expect(ledger.map(row => row.entry_type)).toEqual(['purchase', 'renewal']);
   else expect(ledger.filter(row => row.entry_type === 'grant')).toHaveLength(source === 'invite' ? 2 : 1);
  } finally {
   state.userId = 1;
   await db.unsafe('DROP TRIGGER delay_membership_insert ON platform_memberships; DROP FUNCTION delay_membership_insert()');
  }
 });

 it.each([
  ['purchase', 'refund'], ['purchase', 'grant'], ['invite', 'refund'], ['invite', 'grant'],
 ])('keeps membership ledger consistent when refund races %s with %s first', async (source, firstOperation) => {
  const userId = Number((await db.unsafe('SELECT COALESCE(MAX(id),0)::int + 1 id FROM app_users'))[0].id);
  await db.unsafe('INSERT INTO app_users VALUES($1)', [userId]); state.userId = userId;
  vi.stubEnv('WECHAT_MCHID', 'fixture-merchant');
  state.create.mockResolvedValue({ qrCodeDataUrl: 'data:image/png;base64,fixture' });
  const plan = (await db.unsafe(`INSERT INTO platform_membership_plans(slug,name_en,status,period_unit,period_count,amount_minor,currency)
    VALUES($1,'Refund race','active','day',1,1000,'CNY') RETURNING id`, [`refund-race-${randomUUID()}`]))[0].id;
  const original = await pendingOrderPayment([{ membershipPlanId: plan }]); state.notify.mockResolvedValue(original.event);
  expect((await write('/v1/platform/payments/wechat/notify', {})).status).toBe(200);
  let grant: () => Promise<Response>;
  if (source === 'purchase') {
   const renewal = await pendingOrderPayment([{ membershipPlanId: plan }]); state.notify.mockResolvedValue(renewal.event);
   grant = () => write('/v1/platform/payments/wechat/notify', {});
  } else {
   const response = await write('/v1/platform/admin/invites', { benefit: { membershipPlanId: plan } });
   const invite = await response.json(); expect(response.status, JSON.stringify(invite)).toBe(201);
   grant = () => write('/v1/platform/invites/redeem', { code: invite.code });
  }
  const refund = () => write(`/v1/platform/admin/orders/${original.order.id}/refund`, {
   reasonCode: 'fixture_refund', providerRefundId: randomUUID(), evidenceReference: 'fixture-refund-evidence',
  });
  const gate = await advisoryGate(`platform-membership:${userId}`);
  try {
   const first = firstOperation === 'refund' ? refund() : grant();
   await waitForAdvisoryWaiters(gate.pid, 1);
   const second = firstOperation === 'refund' ? grant() : refund();
   await waitForAdvisoryWaiters(gate.pid, 2); gate.release(); await gate.closed;
   const responses = await Promise.all([first, second]);
   const refundResponse = responses[firstOperation === 'refund' ? 0 : 1];
   const grantResponse = responses[firstOperation === 'refund' ? 1 : 0];
   expect(grantResponse.status, await grantResponse.clone().text()).toBe(source === 'purchase' ? 200 : 201);
   const refundStatus = source === 'purchase' && firstOperation === 'grant' ? 409 : 201;
   expect(refundResponse.status, await refundResponse.clone().text()).toBe(refundStatus);
   const [membership] = await db.unsafe('SELECT id,status,valid_from,valid_until FROM platform_memberships WHERE user_id=$1 AND plan_id=$2', [userId, plan]);
   const remaining = await db.unsafe(`SELECT l.valid_from,l.valid_until FROM platform_membership_ledger l
     WHERE l.membership_id=$1 AND l.delta_access=1 AND NOT EXISTS (SELECT 1 FROM platform_membership_ledger r WHERE r.reversal_of_ledger_id=l.id)
     ORDER BY l.valid_from`, [membership.id]);
   expect(remaining).toHaveLength(refundStatus === 409 ? 2 : 1);
   // SQL NOW() is the transaction start; the ledger period uses the service clock.
   expect(Math.abs(new Date(membership.valid_from).getTime() - new Date(remaining[0].valid_from).getTime())).toBeLessThan(1000);
   expect(membership.valid_until).toEqual(remaining.at(-1)!.valid_until);
   const future = new Date(remaining[0].valid_from).getTime() > Date.now();
   expect(await membershipIsActive(membership.id)).toBe(!future);
   if (future) {
    const before = await write('/v1/platform/orders/quote', { items: [{ membershipPlanId: plan }] });
    expect((await before.json()).member).toBe(false);
    await shiftMembershipTimeline(membership.id, '-1 day');
    expect(await membershipIsActive(membership.id)).toBe(true);
    const after = await write('/v1/platform/orders/quote', { items: [{ membershipPlanId: plan }] });
    expect((await after.json()).member).toBe(true);
   }
   expect((await db.unsafe('SELECT status FROM platform_orders WHERE id=$1', [original.order.id]))[0].status).toBe(refundStatus === 409 ? 'fulfilled' : 'refunded');
   expect(await db.unsafe('SELECT id FROM platform_refunds WHERE order_id=$1', [original.order.id])).toHaveLength(refundStatus === 409 ? 0 : 1);
  } finally { gate.release(); await gate.closed; state.userId = 1; }
 });

 it.each(['callback', 'zero-total order'])('settles opposing mixed carts without deadlock against a %s', async secondSource => {
  const userId = Number((await db.unsafe('SELECT COALESCE(MAX(id),0)::int + 1 id FROM app_users'))[0].id);
  await db.unsafe('INSERT INTO app_users VALUES($1)', [userId]); state.userId = userId;
  vi.stubEnv('WECHAT_MCHID', 'fixture-merchant');
  state.create.mockResolvedValue({ qrCodeDataUrl: 'data:image/png;base64,fixture' });
  const plan = (await db.unsafe(`INSERT INTO platform_membership_plans(slug,name_en,status,period_unit,period_count,amount_minor,currency)
    VALUES($1,'Mixed cart','active','day',1,1000,'CNY') RETURNING id`, [`mixed-${randomUUID()}`]))[0].id;
  const slug = `mixed-${randomUUID()}`;
  const response = await write('/v1/platform/admin/products', { slug, productType: 'digital', status: 'active', titleEn: 'Mixed cart',
   variants: [{ sku: slug.toUpperCase(), titleEn: 'Standard', amountMinor: 1000, currency: 'CNY', inventoryOnHand: 5, status: 'active' }] });
  const product = await response.json(); expect(response.status, JSON.stringify(product)).toBe(201);
  const variant = (await db.unsafe('SELECT id FROM platform_product_variants WHERE product_id=$1', [product.product.id]))[0].id;
  const forward = [{ membershipPlanId: plan }, { productVariantId: variant }], reverse = [...forward].reverse();
  const firstPayment = await pendingOrderPayment(forward);
  let second: () => Promise<Response>;
  if (secondSource === 'callback') {
   const secondPayment = await pendingOrderPayment(reverse);
   state.notify.mockResolvedValueOnce(firstPayment.event).mockResolvedValueOnce(secondPayment.event);
   second = () => write('/v1/platform/payments/wechat/notify', {});
  } else {
   const couponCode = `MIXED-${randomUUID()}`;
   expect((await write('/v1/platform/admin/coupons', { code: couponCode, status: 'active', discountType: 'percent', discountBps: 10000 })).status).toBe(201);
   state.notify.mockResolvedValueOnce(firstPayment.event);
   second = () => write('/v1/platform/orders', { items: reverse, couponCode });
  }
  const gateKey = `fixture-mixed:${randomUUID()}`;
  await db.unsafe(`CREATE FUNCTION gate_mixed_membership() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_advisory_xact_lock(hashtextextended(TG_ARGV[0],0)); RETURN NEW; END $$;
    CREATE TRIGGER gate_mixed_membership BEFORE INSERT ON platform_memberships FOR EACH ROW EXECUTE FUNCTION gate_mixed_membership('${gateKey}')`);
  const gate = await advisoryGate(gateKey);
  try {
   const first = write('/v1/platform/payments/wechat/notify', {});
   const [firstPid] = await waitForAdvisoryWaiters(gate.pid, 1);
   const other = second();
   await waitForAdvisoryWaiters(firstPid, 1);
   gate.release(); await gate.closed;
   const results = await Promise.all([first, other]);
   expect(results.map(result => result.status), JSON.stringify(await Promise.all(results.map(result => result.text())))).toEqual([200, secondSource === 'callback' ? 200 : 201]);
   expect((await db.unsafe('SELECT inventory_on_hand,inventory_reserved FROM platform_product_variants WHERE id=$1', [variant]))[0]).toMatchObject({ inventory_on_hand: 3, inventory_reserved: 0 });
   expect((await db.unsafe('SELECT ROUND(EXTRACT(EPOCH FROM (valid_until-valid_from))/86400)::int days FROM platform_memberships WHERE user_id=$1 AND plan_id=$2', [userId, plan]))[0].days).toBe(2);
   expect(await db.unsafe("SELECT id FROM platform_orders WHERE buyer_user_id=$1 AND status='fulfilled'", [userId])).toHaveLength(2);
  } finally {
   gate.release(); await gate.closed;
   await db.unsafe('DROP TRIGGER gate_mixed_membership ON platform_memberships; DROP FUNCTION gate_mixed_membership()');
   state.userId = 1;
  }
 });

 it('denies refunded membership gaps and activates the remaining invitation at its own start', async () => {
  const userId = Number((await db.unsafe('SELECT COALESCE(MAX(id),0)::int + 1 id FROM app_users'))[0].id);
  await db.unsafe('INSERT INTO app_users VALUES($1)', [userId]); state.userId = userId;
  vi.stubEnv('WECHAT_MCHID', 'fixture-merchant');
  state.create.mockResolvedValue({ qrCodeDataUrl: 'data:image/png;base64,fixture' });
  const plan = (await db.unsafe(`INSERT INTO platform_membership_plans(slug,name_en,status,period_unit,period_count,amount_minor,currency)
    VALUES($1,'Refund gap','active','day',1,1000,'CNY') RETURNING id`, [`gap-${randomUUID()}`]))[0].id;
  async function redeem() {
   const created = await write('/v1/platform/admin/invites', { benefit: { membershipPlanId: plan } });
   const invite = await created.json(); expect(created.status, JSON.stringify(invite)).toBe(201);
   const response = await write('/v1/platform/invites/redeem', { code: invite.code });
   const body = await response.json(); expect(response.status, JSON.stringify(body)).toBe(201);
   return body.membershipId as string;
  }
  try {
   const membershipId = await redeem();
   await shiftMembershipTimeline(membershipId, '-2 days');
   const paid = await pendingOrderPayment([{ membershipPlanId: plan }]); state.notify.mockResolvedValue(paid.event);
   expect((await write('/v1/platform/payments/wechat/notify', {})).status).toBe(200);
   await redeem();
   const refunded = await write(`/v1/platform/admin/orders/${paid.order.id}/refund`, {
    reasonCode: 'fixture_gap', providerRefundId: randomUUID(), evidenceReference: 'fixture-refund-evidence',
   });
   expect(refunded.status, await refunded.clone().text()).toBe(201);
   const slug = `gap-product-${randomUUID()}`;
   const created = await write('/v1/platform/admin/products', { slug, productType: 'digital', status: 'active', memberOnly: true, titleEn: 'Members only',
    variants: [{ sku: slug.toUpperCase(), titleEn: 'Standard', amountMinor: 1000, memberAmountMinor: 500, currency: 'CNY', inventoryOnHand: 5, status: 'active' }] });
   const product = await created.json(); expect(created.status, JSON.stringify(product)).toBe(201);
   const variant = (await db.unsafe('SELECT id FROM platform_product_variants WHERE product_id=$1', [product.product.id]))[0].id;
   const quote = () => write('/v1/platform/orders/quote', { items: [{ productVariantId: variant }] });
   expect(await membershipIsActive(membershipId)).toBe(false);
   expect((await quote()).status).toBe(400);
   await shiftMembershipTimeline(membershipId, '-1 day');
   expect(await membershipIsActive(membershipId)).toBe(true);
   const eligible = await quote(); expect(eligible.status).toBe(200);
   expect(await eligible.json()).toMatchObject({ member: true, totalAmountMinor: 500 });
  } finally { state.userId = 1; }
 });
});
