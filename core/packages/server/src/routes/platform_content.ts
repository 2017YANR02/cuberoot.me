import type { Context } from 'hono';
import { requirePlatformAdmin } from '../platform/auth.js';
import {
  isPostgresConflict,
  platformDb,
  platformQuery,
  sendMutation,
  withIdempotency,
} from '../platform/db.js';
import { badRequest, conflict, notFound } from '../platform/errors.js';
import { platformRouter, privateNoStore, publicCache } from '../platform/http.js';
import {
  arrayField,
  enumField,
  integerField,
  isObject,
  isoTimestampField,
  nullableStringField,
  pagination,
  readJsonObject,
  resourceId,
  stringField,
  type JsonObject,
} from '../platform/validation.js';

export const platformContentRoutes = platformRouter();

const SLUG = /^[a-z0-9][a-z0-9_-]{0,159}$/;
const CURRENCY = /^[A-Z]{3}$/;

function requiredParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (!value) badRequest(`${name} is required`);
  return resourceId(value, name);
}

function requireTitle(titleZh: string | undefined, titleEn: string | undefined): void {
  if (!titleZh && !titleEn) badRequest('At least one of titleZh and titleEn is required');
}

platformContentRoutes.get('/platform/search', async (c) => {
  const query = c.req.query('q')?.trim().slice(0, 200) ?? '';
  if (query.length < 2) {
    publicCache(c, false);
    return c.json({ results: [], total: 0 });
  }
  const rows = await platformQuery(platformDb(), `
    SELECT * FROM (
      SELECT 'course' AS type, c.id::text AS id, c.slug, r.title_zh AS "titleZh", r.title_en AS "titleEn",
        r.summary_zh AS "summaryZh", r.summary_en AS "summaryEn", '/platform/courses/' || c.slug AS href,
        c.published_at AS "publishedAt"
      FROM platform_courses c JOIN platform_course_revisions r ON r.course_id=c.id AND r.revision=c.current_revision
      WHERE c.status='published' AND (r.title_zh ILIKE '%'||$1||'%' OR r.title_en ILIKE '%'||$1||'%'
        OR r.summary_zh ILIKE '%'||$1||'%' OR r.summary_en ILIKE '%'||$1||'%')
      UNION ALL
      SELECT 'path', p.id::text, p.slug, p.title_zh, p.title_en, p.description_zh, p.description_en,
        '/platform/paths/' || p.slug, p.published_at
      FROM platform_learning_paths p WHERE p.status='published'
        AND (p.title_zh ILIKE '%'||$1||'%' OR p.title_en ILIKE '%'||$1||'%'
          OR p.description_zh ILIKE '%'||$1||'%' OR p.description_en ILIKE '%'||$1||'%')
      UNION ALL
      SELECT 'event', e.id::text, e.slug, e.title_zh, e.title_en, e.description_zh, e.description_en,
        '/platform/events/' || e.slug, e.published_at
      FROM platform_events e WHERE e.status='published'
        AND (e.title_zh ILIKE '%'||$1||'%' OR e.title_en ILIKE '%'||$1||'%'
          OR e.description_zh ILIKE '%'||$1||'%' OR e.description_en ILIKE '%'||$1||'%')
      UNION ALL
      SELECT 'news', n.id::text, n.slug, n.title_zh, n.title_en, '', '',
        '/platform/news/' || n.slug, n.published_at
      FROM platform_news_articles n WHERE n.status='published'
        AND (n.title_zh ILIKE '%'||$1||'%' OR n.title_en ILIKE '%'||$1||'%')
      UNION ALL
      SELECT 'product', p.id::text, p.slug, p.title_zh, p.title_en, p.description_zh, p.description_en,
        '/platform/shop/' || p.slug, p.created_at
      FROM platform_products p WHERE p.status='active'
        AND (p.title_zh ILIKE '%'||$1||'%' OR p.title_en ILIKE '%'||$1||'%'
          OR p.description_zh ILIKE '%'||$1||'%' OR p.description_en ILIKE '%'||$1||'%')
    ) result ORDER BY "publishedAt" DESC NULLS LAST, type, id LIMIT 80
  `, [query]);
  publicCache(c, rows.length > 0);
  return c.json({ results: rows, total: rows.length });
});

platformContentRoutes.get('/platform/events', async (c) => {
  const { page, pageSize, offset } = pagination(c, 60);
  const rows = await platformQuery(platformDb(), `
    SELECT e.id::text AS id, e.slug, e.title_zh AS "titleZh", e.title_en AS "titleEn",
      e.description_zh AS "descriptionZh", e.description_en AS "descriptionEn", e.status,
      e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.timezone,
      e.venue_snapshot AS venue, e.published_at AS "publishedAt",
      COALESCE((SELECT MIN(t.amount_minor) FROM platform_event_ticket_types t
        WHERE t.event_id=e.id AND t.status='active'), 0) AS "fromAmountMinor"
    FROM platform_events e WHERE e.status='published'
    ORDER BY CASE WHEN e.ends_at >= NOW() THEN 0 ELSE 1 END, e.starts_at, e.id LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  publicCache(c, rows.length > 0);
  return c.json({ events: rows, page, pageSize });
});

platformContentRoutes.get('/platform/events/:id', async (c) => {
  const key = requiredParam(c, 'id');
  const rows = await platformQuery(platformDb(), `
    SELECT e.id::text AS id, e.slug, e.title_zh AS "titleZh", e.title_en AS "titleEn",
      e.description_zh AS "descriptionZh", e.description_en AS "descriptionEn", e.status,
      e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.timezone, e.venue_snapshot AS venue,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',t.id::text,'code',t.code,'titleZh',t.title_zh,'titleEn',t.title_en,
        'status',t.status,'amountMinor',t.amount_minor,'currency',t.currency,
        'capacity',t.capacity,'available',GREATEST(t.capacity-t.reserved_quantity-t.sold_quantity,0),
        'salesStartAt',t.sales_start_at,'salesEndAt',t.sales_end_at
      ) ORDER BY t.amount_minor,t.id) FROM platform_event_ticket_types t WHERE t.event_id=e.id), '[]'::jsonb) AS tickets
    FROM platform_events e WHERE (e.id::text=$1 OR e.slug=$1) AND e.status='published'
  `, [key]);
  if (!rows[0]) notFound('Event');
  publicCache(c);
  return c.json({ event: rows[0] });
});

platformContentRoutes.get('/platform/news', async (c) => {
  const { page, pageSize, offset } = pagination(c, 60);
  const rows = await platformQuery(platformDb(), `
    SELECT id::text AS id, slug, title_zh AS "titleZh", title_en AS "titleEn",
      body_zh AS "bodyZh", body_en AS "bodyEn", published_at AS "publishedAt"
    FROM platform_news_articles WHERE status='published'
    ORDER BY published_at DESC,id LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  publicCache(c, rows.length > 0);
  return c.json({ articles: rows, page, pageSize });
});

platformContentRoutes.get('/platform/news/:id', async (c) => {
  const key = requiredParam(c, 'id');
  const rows = await platformQuery(platformDb(), `
    SELECT id::text AS id, slug, title_zh AS "titleZh", title_en AS "titleEn",
      body_zh AS "bodyZh", body_en AS "bodyEn", published_at AS "publishedAt"
    FROM platform_news_articles WHERE (id::text=$1 OR slug=$1) AND status='published'
  `, [key]);
  if (!rows[0]) notFound('News article');
  publicCache(c);
  return c.json({ article: rows[0] });
});

platformContentRoutes.get('/platform/products', async (c) => {
  const { page, pageSize, offset } = pagination(c, 60);
  const rows = await platformQuery(platformDb(), `
    SELECT p.id::text AS id,p.slug,p.product_type AS "productType",p.title_zh AS "titleZh",p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh",p.description_en AS "descriptionEn",p.status,
      COALESCE((SELECT MIN(v.amount_minor) FROM platform_product_variants v
        WHERE v.product_id=p.id AND v.status='active'),0) AS "fromAmountMinor",
      COALESCE((SELECT MIN(v.member_amount_minor) FROM platform_product_variants v
        WHERE v.product_id=p.id AND v.status='active' AND v.member_amount_minor IS NOT NULL),NULL) AS "fromMemberAmountMinor"
    FROM platform_products p WHERE p.status='active' ORDER BY p.updated_at DESC,p.id LIMIT $1 OFFSET $2
  `, [pageSize, offset]);
  publicCache(c, rows.length > 0);
  return c.json({ products: rows, page, pageSize });
});

platformContentRoutes.get('/platform/products/:id', async (c) => {
  const key = requiredParam(c, 'id');
  const rows = await platformQuery(platformDb(), `
    SELECT p.id::text AS id,p.slug,p.product_type AS "productType",p.title_zh AS "titleZh",p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh",p.description_en AS "descriptionEn",p.status,
      COALESCE(jsonb_agg(jsonb_build_object(
        'id',v.id::text,'sku',v.sku,'titleZh',v.title_zh,'titleEn',v.title_en,'status',v.status,
        'amountMinor',v.amount_minor,'memberAmountMinor',v.member_amount_minor,'currency',v.currency,
        'availableQuantity',GREATEST(v.inventory_on_hand-v.inventory_reserved,0),'weightGrams',v.weight_grams,'metadata',v.metadata
      ) ORDER BY v.created_at,v.id) FILTER (WHERE v.id IS NOT NULL), '[]'::jsonb) AS variants
    FROM platform_products p LEFT JOIN platform_product_variants v ON v.product_id=p.id AND v.status IN ('active','sold_out')
    WHERE (p.id::text=$1 OR p.slug=$1) AND p.status='active' GROUP BY p.id
  `, [key]);
  if (!rows[0]) notFound('Product');
  publicCache(c);
  return c.json({ product: rows[0] });
});

function eventFields(body: JsonObject, required: boolean) {
  const venue = body.venue;
  if (venue !== undefined && !isObject(venue)) badRequest('venue must be an object');
  const tickets = arrayField(body, 'tickets', { maxItems: 100 });
  return {
    slug: stringField(body,'slug',{required,max:120,pattern:SLUG}),
    titleZh:stringField(body,'titleZh',{max:240}), titleEn:stringField(body,'titleEn',{max:240}),
    descriptionZh:stringField(body,'descriptionZh',{max:100_000,trim:false}),
    descriptionEn:stringField(body,'descriptionEn',{max:100_000,trim:false}),
    status:enumField(body,'status',['draft','published','cancelled','completed','archived'] as const),
    startsAt:isoTimestampField(body,'startsAt'), endsAt:isoTimestampField(body,'endsAt'),
    timezone:stringField(body,'timezone',{required,max:80}), venue,
    tickets:tickets?.map((value,index)=>{
      if(!isObject(value)) badRequest(`tickets[${index}] must be an object`);
      const amount=integerField(value,'amountMinor',{required:true,min:0,max:Number.MAX_SAFE_INTEGER});
      const capacity=integerField(value,'capacity',{required:true,min:1,max:1_000_000});
      const code=stringField(value,'code',{required:true,max:64,pattern:/^[a-z0-9][a-z0-9_-]{0,63}$/});
      const titleZh=stringField(value,'titleZh',{max:160}); const titleEn=stringField(value,'titleEn',{max:160});
      requireTitle(titleZh,titleEn);
      const salesStartAt=isoTimestampField(value,'salesStartAt');
      const salesEndAt=isoTimestampField(value,'salesEndAt');
      if(salesStartAt&&salesEndAt&&Date.parse(salesEndAt)<=Date.parse(salesStartAt)){
        badRequest(`tickets[${index}].salesEndAt must be after salesStartAt`);
      }
      return {code,titleZh:titleZh??'',titleEn:titleEn??'',status:enumField(value,'status',['active','sold_out','archived'] as const)??'active',
        amountMinor:amount,currency:stringField(value,'currency',{required:true,max:3,pattern:CURRENCY}),capacity,
        salesStartAt,salesEndAt};
    }),
  };
}

async function listAdminEvents(c: Context): Promise<Response> {
  await requirePlatformAdmin(c); const {page,pageSize,offset}=pagination(c,100);
  const id=c.req.param('id')?requiredParam(c,'id'):null;
  const rows=await platformQuery(platformDb(),`
    SELECT e.id::text AS id,e.slug,e.title_zh AS "titleZh",e.title_en AS "titleEn",
      e.description_zh AS "descriptionZh",e.description_en AS "descriptionEn",e.status,
      e.starts_at AS "startsAt",e.ends_at AS "endsAt",e.timezone,e.venue_snapshot AS venue,
      COALESCE(jsonb_agg(jsonb_build_object('id',t.id::text,'code',t.code,'titleZh',t.title_zh,'titleEn',t.title_en,
        'status',t.status,'amountMinor',t.amount_minor,'currency',t.currency,'capacity',t.capacity,
        'reservedQuantity',t.reserved_quantity,'soldQuantity',t.sold_quantity,'salesStartAt',t.sales_start_at,'salesEndAt',t.sales_end_at)
        ORDER BY t.created_at,t.id) FILTER(WHERE t.id IS NOT NULL),'[]'::jsonb) AS tickets
    FROM platform_events e LEFT JOIN platform_event_ticket_types t ON t.event_id=e.id
    WHERE ($1::text IS NULL OR e.id::text=$1 OR e.slug=$1) GROUP BY e.id ORDER BY e.updated_at DESC LIMIT $2 OFFSET $3
  `,[id,pageSize,offset]);
  if(id&&!rows[0])notFound('Event'); privateNoStore(c);
  return c.json(id?{event:rows[0]}:{events:rows,page,pageSize});
}
platformContentRoutes.get('/platform/admin/events',listAdminEvents);
platformContentRoutes.get('/platform/admin/events/:id',listAdminEvents);

async function saveEvent(c: Context,creating:boolean):Promise<Response>{
  const actor=await requirePlatformAdmin(c); const id=creating?null:requiredParam(c,'id');
  const body=await readJsonObject(c); const input=eventFields(body,creating);
  if(creating){requireTitle(input.titleZh,input.titleEn);if(!input.startsAt||!input.endsAt)badRequest('startsAt and endsAt are required');}
  if(input.startsAt&&input.endsAt&&Date.parse(input.endsAt)<=Date.parse(input.startsAt))badRequest('endsAt must be after startsAt');
  const result=await withIdempotency(c,actor,`platform.admin.event.${creating?'create':'update'}:${id??'new'}`,body,async(db)=>{
    let eventId:string;
    try{
      if(creating){const status=input.status??'draft';const rows=await platformQuery<{id:string}>(db,`
        INSERT INTO platform_events(slug,title_zh,title_en,description_zh,description_en,status,starts_at,ends_at,timezone,venue_snapshot,created_by_user_id,published_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,CASE WHEN $6='published' THEN NOW() ELSE NULL END) RETURNING id::text AS id
      `,[input.slug,input.titleZh??'',input.titleEn??'',input.descriptionZh??'',input.descriptionEn??'',status,input.startsAt,input.endsAt,input.timezone,JSON.stringify(input.venue??{}),actor.userId]);eventId=rows[0].id;}
      else{const rows=await platformQuery<{id:string}>(db,`
        UPDATE platform_events SET slug=COALESCE($2,slug),title_zh=COALESCE($3,title_zh),title_en=COALESCE($4,title_en),
          description_zh=COALESCE($5,description_zh),description_en=COALESCE($6,description_en),status=COALESCE($7,status),
          starts_at=COALESCE($8,starts_at),ends_at=COALESCE($9,ends_at),timezone=COALESCE($10,timezone),
          venue_snapshot=COALESCE($11::jsonb,venue_snapshot),published_at=CASE WHEN COALESCE($7,status)='published' THEN COALESCE(published_at,NOW()) ELSE published_at END
        WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id
      `,[id,input.slug??null,input.titleZh??null,input.titleEn??null,input.descriptionZh??null,input.descriptionEn??null,input.status??null,
        input.startsAt??null,input.endsAt??null,input.timezone??null,input.venue?JSON.stringify(input.venue):null]);if(!rows[0])notFound('Event');eventId=rows[0].id;}
      if(input.tickets){
        const existingTickets=await platformQuery<{code:string;reservedQuantity:number;soldQuantity:number}>(db,`
          SELECT code,reserved_quantity AS "reservedQuantity",sold_quantity AS "soldQuantity"
          FROM platform_event_ticket_types WHERE event_id=$1::uuid FOR UPDATE
        `,[eventId]);
        const existingByCode=new Map(existingTickets.map((ticket)=>[ticket.code,ticket]));
        for(const ticket of input.tickets){
          const existing=existingByCode.get(ticket.code!);
          if(existing&&ticket.capacity!<existing.reservedQuantity+existing.soldQuantity){
            conflict(`Ticket ${ticket.code} capacity cannot be lower than its reserved and sold quantity`);
          }
        }
        await platformQuery(db,"UPDATE platform_event_ticket_types SET status='archived' WHERE event_id=$1::uuid",[eventId]);
        for(const ticket of input.tickets)await platformQuery(db,`
          INSERT INTO platform_event_ticket_types(event_id,code,title_zh,title_en,status,amount_minor,currency,capacity,sales_start_at,sales_end_at)
          VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT(event_id,code) DO UPDATE SET title_zh=EXCLUDED.title_zh,title_en=EXCLUDED.title_en,status=EXCLUDED.status,
            amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,capacity=EXCLUDED.capacity,
            sales_start_at=EXCLUDED.sales_start_at,sales_end_at=EXCLUDED.sales_end_at,
            capacity_revision=platform_event_ticket_types.capacity_revision
              + CASE WHEN platform_event_ticket_types.capacity<>EXCLUDED.capacity THEN 1 ELSE 0 END
        `,[eventId,ticket.code,ticket.titleZh,ticket.titleEn,ticket.status,ticket.amountMinor,ticket.currency,ticket.capacity,ticket.salesStartAt??null,ticket.salesEndAt??null]);}
      return{status:creating?201:200,body:{event:{id:eventId}},resourceType:'event',resourceId:eventId};
    }catch(error){if(isPostgresConflict(error))conflict('Event data conflicts with an existing record');throw error;}
  });return sendMutation(c,result);
}
platformContentRoutes.post('/platform/admin/events',(c)=>saveEvent(c,true));
platformContentRoutes.patch('/platform/admin/events/:id',(c)=>saveEvent(c,false));

function newsFields(body:JsonObject,required:boolean){
  const bodyZh=body.bodyZh;const bodyEn=body.bodyEn;
  if(bodyZh!==undefined&&!isObject(bodyZh))badRequest('bodyZh must be an object');
  if(bodyEn!==undefined&&!isObject(bodyEn))badRequest('bodyEn must be an object');
  return{slug:stringField(body,'slug',{required,max:160,pattern:SLUG}),titleZh:stringField(body,'titleZh',{max:240}),
    titleEn:stringField(body,'titleEn',{max:240}),bodyZh,bodyEn,
    status:enumField(body,'status',['draft','published','archived'] as const)};
}
async function listAdminNews(c:Context):Promise<Response>{await requirePlatformAdmin(c);const{page,pageSize,offset}=pagination(c,100);
  const id=c.req.param('id')?requiredParam(c,'id'):null;const rows=await platformQuery(platformDb(),`
    SELECT id::text AS id,slug,title_zh AS "titleZh",title_en AS "titleEn",body_zh AS "bodyZh",body_en AS "bodyEn",status,
      published_at AS "publishedAt",updated_at AS "updatedAt" FROM platform_news_articles
    WHERE($1::text IS NULL OR id::text=$1 OR slug=$1) ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,[id,pageSize,offset]);
  if(id&&!rows[0])notFound('News article');privateNoStore(c);return c.json(id?{article:rows[0]}:{articles:rows,page,pageSize});}
platformContentRoutes.get('/platform/admin/news',listAdminNews);platformContentRoutes.get('/platform/admin/news/:id',listAdminNews);
async function saveNews(c:Context,creating:boolean):Promise<Response>{const actor=await requirePlatformAdmin(c);const id=creating?null:requiredParam(c,'id');
  const body=await readJsonObject(c);const input=newsFields(body,creating);if(creating)requireTitle(input.titleZh,input.titleEn);
  const result=await withIdempotency(c,actor,`platform.admin.news.${creating?'create':'update'}:${id??'new'}`,body,async(db)=>{
    let rows:{id:string}[];if(creating){const status=input.status??'draft';rows=await platformQuery<{id:string}>(db,`
      INSERT INTO platform_news_articles(slug,title_zh,title_en,body_zh,body_en,status,author_user_id,published_at)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,CASE WHEN $6='published' THEN NOW() ELSE NULL END)RETURNING id::text AS id`,
      [input.slug,input.titleZh??'',input.titleEn??'',JSON.stringify(input.bodyZh??{}),JSON.stringify(input.bodyEn??{}),status,actor.userId]);}
    else rows=await platformQuery<{id:string}>(db,`UPDATE platform_news_articles SET slug=COALESCE($2,slug),title_zh=COALESCE($3,title_zh),
      title_en=COALESCE($4,title_en),body_zh=COALESCE($5::jsonb,body_zh),body_en=COALESCE($6::jsonb,body_en),status=COALESCE($7,status),
      published_at=CASE WHEN COALESCE($7,status)='published' THEN COALESCE(published_at,NOW()) ELSE published_at END
      WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id`,[id,input.slug??null,input.titleZh??null,input.titleEn??null,
        input.bodyZh?JSON.stringify(input.bodyZh):null,input.bodyEn?JSON.stringify(input.bodyEn):null,input.status??null]);
    if(!rows[0])notFound('News article');return{status:creating?201:200,body:{article:rows[0]},resourceType:'news_article',resourceId:rows[0].id};});
  return sendMutation(c,result);}
platformContentRoutes.post('/platform/admin/news',(c)=>saveNews(c,true));platformContentRoutes.patch('/platform/admin/news/:id',(c)=>saveNews(c,false));

function productFields(body:JsonObject,required:boolean){const variants=arrayField(body,'variants',{maxItems:200});return{
  slug:stringField(body,'slug',{required,max:120,pattern:SLUG}),productType:enumField(body,'productType',['physical','digital'] as const),
  titleZh:stringField(body,'titleZh',{max:240}),titleEn:stringField(body,'titleEn',{max:240}),
  descriptionZh:stringField(body,'descriptionZh',{max:100_000,trim:false}),descriptionEn:stringField(body,'descriptionEn',{max:100_000,trim:false}),
  status:enumField(body,'status',['draft','active','archived'] as const),variants:variants?.map((value,index)=>{if(!isObject(value))badRequest(`variants[${index}] must be an object`);
    const titleZh=stringField(value,'titleZh',{max:240});const titleEn=stringField(value,'titleEn',{max:240});requireTitle(titleZh,titleEn);
    const amount=integerField(value,'amountMinor',{required:true,min:0,max:Number.MAX_SAFE_INTEGER});
    const member=value.memberAmountMinor===null?null:integerField(value,'memberAmountMinor',{min:0,max:Number.MAX_SAFE_INTEGER});if(member!=null&&amount!=null&&member>amount)badRequest(`variants[${index}].memberAmountMinor cannot exceed amountMinor`);
    const metadata=value.metadata;if(metadata!==undefined&&!isObject(metadata))badRequest(`variants[${index}].metadata must be an object`);
    return{sku:stringField(value,'sku',{required:true,max:120,pattern:/^[A-Z0-9][A-Z0-9_-]{0,119}$/}),titleZh:titleZh??'',titleEn:titleEn??'',
      status:enumField(value,'status',['active','sold_out','archived']as const)??'active',amountMinor:amount,memberAmountMinor:member??null,
      currency:stringField(value,'currency',{required:true,max:3,pattern:CURRENCY}),inventoryOnHand:integerField(value,'inventoryOnHand',{required:true,min:0,max:2_147_483_647}),
      weightGrams:value.weightGrams===null?null:integerField(value,'weightGrams',{min:0,max:100_000_000}),metadata:metadata??{}};})};}
async function listAdminProducts(c:Context):Promise<Response>{await requirePlatformAdmin(c);const{page,pageSize,offset}=pagination(c,100);
  const id=c.req.param('id')?requiredParam(c,'id'):null;const rows=await platformQuery(platformDb(),`
    SELECT p.id::text AS id,p.slug,p.product_type AS "productType",p.title_zh AS "titleZh",p.title_en AS "titleEn",
      p.description_zh AS "descriptionZh",p.description_en AS "descriptionEn",p.status,
      COALESCE(jsonb_agg(jsonb_build_object('id',v.id::text,'sku',v.sku,'titleZh',v.title_zh,'titleEn',v.title_en,'status',v.status,
        'amountMinor',v.amount_minor,'memberAmountMinor',v.member_amount_minor,'currency',v.currency,'inventoryOnHand',v.inventory_on_hand,
        'inventoryReserved',v.inventory_reserved,'weightGrams',v.weight_grams,'metadata',v.metadata)ORDER BY v.created_at,v.id)FILTER(WHERE v.id IS NOT NULL),'[]'::jsonb)AS variants
    FROM platform_products p LEFT JOIN platform_product_variants v ON v.product_id=p.id WHERE($1::text IS NULL OR p.id::text=$1 OR p.slug=$1)
    GROUP BY p.id ORDER BY p.updated_at DESC LIMIT $2 OFFSET $3`,[id,pageSize,offset]);if(id&&!rows[0])notFound('Product');privateNoStore(c);
  return c.json(id?{product:rows[0]}:{products:rows,page,pageSize});}
platformContentRoutes.get('/platform/admin/products',listAdminProducts);platformContentRoutes.get('/platform/admin/products/:id',listAdminProducts);
async function saveProduct(c:Context,creating:boolean):Promise<Response>{const actor=await requirePlatformAdmin(c);const id=creating?null:requiredParam(c,'id');
  const body=await readJsonObject(c);const input=productFields(body,creating);if(creating){requireTitle(input.titleZh,input.titleEn);if(!input.productType)badRequest('productType is required');}
  const result=await withIdempotency(c,actor,`platform.admin.product.${creating?'create':'update'}:${id??'new'}`,body,async(db)=>{let productId:string;
    try{if(creating){const rows=await platformQuery<{id:string}>(db,`INSERT INTO platform_products(slug,product_type,status,title_zh,title_en,description_zh,description_en,created_by_user_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING id::text AS id`,[input.slug,input.productType,input.status??'draft',input.titleZh??'',input.titleEn??'',input.descriptionZh??'',input.descriptionEn??'',actor.userId]);productId=rows[0].id;}
    else{const rows=await platformQuery<{id:string}>(db,`UPDATE platform_products SET slug=COALESCE($2,slug),product_type=COALESCE($3,product_type),status=COALESCE($4,status),
      title_zh=COALESCE($5,title_zh),title_en=COALESCE($6,title_en),description_zh=COALESCE($7,description_zh),description_en=COALESCE($8,description_en)
      WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id`,[id,input.slug??null,input.productType??null,input.status??null,input.titleZh??null,input.titleEn??null,input.descriptionZh??null,input.descriptionEn??null]);if(!rows[0])notFound('Product');productId=rows[0].id;}
    if(input.variants){
      await platformQuery(db,"UPDATE platform_product_variants SET status='archived' WHERE product_id=$1::uuid",[productId]);
      for(const variant of input.variants){
        const rows=await platformQuery<{id:string;inventoryOnHand:number;inventoryReserved:number}>(db,`
          INSERT INTO platform_product_variants(product_id,sku,title_zh,title_en,status,amount_minor,member_amount_minor,currency,inventory_on_hand,weight_grams,metadata)
          VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,0,$9,$10::jsonb)
          ON CONFLICT(product_id,sku)DO UPDATE SET title_zh=EXCLUDED.title_zh,title_en=EXCLUDED.title_en,
            status=EXCLUDED.status,amount_minor=EXCLUDED.amount_minor,member_amount_minor=EXCLUDED.member_amount_minor,currency=EXCLUDED.currency,
            weight_grams=EXCLUDED.weight_grams,metadata=EXCLUDED.metadata
          RETURNING id::text AS id,inventory_on_hand AS "inventoryOnHand",inventory_reserved AS "inventoryReserved"`,
          [productId,variant.sku,variant.titleZh,variant.titleEn,variant.status,variant.amountMinor,variant.memberAmountMinor,variant.currency,variant.weightGrams??null,JSON.stringify(variant.metadata)]);
        const saved=rows[0];
        const desiredInventory=variant.inventoryOnHand!;
        if(desiredInventory<saved.inventoryReserved)conflict(`Inventory for ${variant.sku} cannot be lower than its reserved quantity`);
        const inventoryDelta=desiredInventory-saved.inventoryOnHand;
        if(inventoryDelta!==0)await platformQuery(db,`
          INSERT INTO platform_inventory_ledger(product_variant_id,entry_type,delta_on_hand,reason,actor_user_id,actor_key)
          VALUES($1::uuid,'adjustment',$2,'Admin catalog inventory set',$3,$4)
        `,[saved.id,inventoryDelta,actor.userId,actor.ownerKey]);
      }
    }
    return{status:creating?201:200,body:{product:{id:productId}},resourceType:'product',resourceId:productId};
    }catch(error){if(isPostgresConflict(error))conflict('Product data conflicts with an existing record');throw error;}});return sendMutation(c,result);}
platformContentRoutes.post('/platform/admin/products',(c)=>saveProduct(c,true));platformContentRoutes.patch('/platform/admin/products/:id',(c)=>saveProduct(c,false));

async function archive(c:Context,table:'platform_events'|'platform_news_articles'|'platform_products',status:string,resourceType:string):Promise<Response>{
  const actor=await requirePlatformAdmin(c);const id=requiredParam(c,'id');const result=await withIdempotency(c,actor,`platform.admin.${resourceType}.archive:${id}`,{},async(db)=>{
    const rows=await platformQuery<{id:string}>(db,`UPDATE ${table} SET status=$2 WHERE id::text=$1 OR slug=$1 RETURNING id::text AS id`,[id,status]);
    if(!rows[0])notFound(resourceType);return{status:200,body:{[resourceType]:rows[0]},resourceType,resourceId:rows[0].id};});return sendMutation(c,result);}
platformContentRoutes.delete('/platform/admin/events/:id',(c)=>archive(c,'platform_events','archived','event'));
platformContentRoutes.delete('/platform/admin/news/:id',(c)=>archive(c,'platform_news_articles','archived','news_article'));
platformContentRoutes.delete('/platform/admin/products/:id',(c)=>archive(c,'platform_products','archived','product'));

platformContentRoutes.get('/platform/admin/analytics',async(c)=>{await requirePlatformAdmin(c);const{pageSize}=pagination(c,366);
  const rows=await platformQuery(platformDb(),`SELECT local_date AS date,event_name AS "eventName",surface,dimensions,event_count AS "eventCount",
    unique_subject_count AS "uniqueSubjectCount" FROM platform_analytics_daily_aggregates ORDER BY local_date DESC,event_name,surface LIMIT $1`,[pageSize]);
  const summary=await platformQuery(platformDb(),`SELECT
    (SELECT COUNT(*)::int FROM platform_courses WHERE status='published')AS "publishedCourses",
    (SELECT COUNT(*)::int FROM platform_course_entitlements WHERE status='active')AS "activeEntitlements",
    (SELECT COUNT(*)::int FROM platform_orders WHERE status NOT IN('draft','cancelled','expired'))AS orders,
    (SELECT COALESCE(SUM(total_amount_minor),0)::text FROM platform_orders WHERE status IN('paid','fulfilled','partially_refunded'))AS "grossAmountMinor"`);
  privateNoStore(c);return c.json({summary:summary[0]??{},daily:rows});});

platformContentRoutes.get('/platform/admin/logs',async(c)=>{await requirePlatformAdmin(c);const{page,pageSize,offset}=pagination(c,200);
  const action=c.req.query('action')?.trim().slice(0,120)??'';const rows=await platformQuery(platformDb(),`
    SELECT id::text AS id,actor_key AS "actorKey",action,resource_type AS "resourceType",resource_id AS "resourceId",outcome,reason_code AS "reasonCode",
      request_id AS "requestId",metadata,occurred_at AS "occurredAt" FROM platform_audit_events
    WHERE($1='' OR action=$1)ORDER BY occurred_at DESC,id LIMIT $2 OFFSET $3`,[action,pageSize,offset]);privateNoStore(c);return c.json({logs:rows,page,pageSize});});
