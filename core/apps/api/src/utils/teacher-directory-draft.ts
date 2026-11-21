export type EntryKind = 'teacher' | 'organization';
export type TeachingMode = 'online' | 'in_person' | 'both';
type ImageKind = 'portrait' | 'organization' | 'teaching' | 'other';
export interface DirectoryImage { id:number; kind:ImageKind; captionZh:string; captionEn:string }
const CONTACT_KEYS=['wechat','qq','email','phone','youtube','bilibili','douyin','kuaishou','xiaohongshu','wechatChannels','facebook','other'] as const;
type ContactKey=typeof CONTACT_KEYS[number];
export type DirectoryContacts=Partial<Record<ContactKey,string>>;
const URL_CONTACT_KEYS=new Set<ContactKey>(['youtube','bilibili','douyin','kuaishou','xiaohongshu','facebook']);
const KINDS:readonly EntryKind[]=['teacher','organization'];
const MODES:readonly TeachingMode[]=['online','in_person','both'];
const IMAGE_KINDS:readonly ImageKind[]=['portrait','organization','teaching','other'];

export interface DirectoryDraft {
  kind:EntryKind; nameZh:string; nameEn:string; locationZh:string; locationEn:string;
  descriptionZh:string; descriptionEn:string; specialtiesZh:string[]; specialtiesEn:string[];
  teachingMode:TeachingMode; contacts:DirectoryContacts; images:DirectoryImage[];
  contact:string; website:string; wcaId:string; isCurated:boolean; isVisible:boolean;
}

export function cleanText(value:unknown,max:number):string { return String(value??'').trim().slice(0,max); }

function cleanTags(value:unknown):string[] {
  if(!Array.isArray(value))return [];
  const seen=new Set<string>(), result:string[]=[];
  for(const item of value){const tag=cleanText(item,50),key=tag.toLocaleLowerCase();if(!tag||seen.has(key))continue;seen.add(key);result.push(tag);if(result.length===8)break;}
  return result;
}

export function cleanContacts(value:unknown,legacyContact=''):DirectoryContacts {
  const contacts:DirectoryContacts={};
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    const source=value as Record<string,unknown>;
    for(const key of CONTACT_KEYS){const contactValue=cleanText(source[key],500);if(contactValue)contacts[key]=contactValue;}
  }
  if(Object.keys(contacts).length===0&&legacyContact)contacts.other=cleanText(legacyContact,500);
  return contacts;
}

export function cleanImages(value:unknown):DirectoryImage[] {
  if(!Array.isArray(value))return [];
  const seen=new Set<number>(),result:DirectoryImage[]=[];
  for(const item of value){
    if(!item||typeof item!=='object')continue;
    const source=item as Record<string,unknown>,id=Number(source.id);
    if(!Number.isSafeInteger(id)||id<=0||seen.has(id))continue;
    seen.add(id);result.push({id,kind:IMAGE_KINDS.includes(source.kind as ImageKind)?source.kind as ImageKind:'other',captionZh:cleanText(source.captionZh,160),captionEn:cleanText(source.captionEn,160)});
    if(result.length===8)break;
  }
  return result;
}

export function isHttpUrl(value:string):boolean {
  try{const url=new URL(value);return url.protocol==='http:'||url.protocol==='https:';}catch{return false;}
}

export function readDraft(body:Partial<DirectoryDraft>,defaults?:{isVisible:boolean;contacts:DirectoryContacts;images:DirectoryImage[];contact:string}):DirectoryDraft {
  const wcaId=cleanText(body.wcaId,20).toUpperCase(),rawContact=cleanText(body.contact,300);
  const contacts=body.contacts===undefined&&defaults?cleanContacts(defaults.contacts,defaults.contact):cleanContacts(body.contacts,rawContact);
  return {kind:KINDS.includes(body.kind as EntryKind)?body.kind as EntryKind:'teacher',nameZh:cleanText(body.nameZh,160),nameEn:cleanText(body.nameEn,160),locationZh:cleanText(body.locationZh,160),locationEn:cleanText(body.locationEn,160),descriptionZh:cleanText(body.descriptionZh,2000),descriptionEn:cleanText(body.descriptionEn,2000),specialtiesZh:cleanTags(body.specialtiesZh),specialtiesEn:cleanTags(body.specialtiesEn),teachingMode:MODES.includes(body.teachingMode as TeachingMode)?body.teachingMode as TeachingMode:'both',contacts,images:body.images===undefined&&defaults?cleanImages(defaults.images):cleanImages(body.images),contact:rawContact||cleanText(Object.values(contacts)[0],300),website:cleanText(body.website,2000),wcaId,isCurated:body.isCurated===true,isVisible:typeof body.isVisible==='boolean'?body.isVisible:defaults?.isVisible??true};
}

export function validateDraft(draft:DirectoryDraft):string|null {
  if(!draft.nameZh&&!draft.nameEn)return 'name_required';
  if((draft.kind!=='teacher'||draft.isVisible)&&!draft.descriptionZh&&!draft.descriptionEn)return 'description_required';
  if(draft.kind==='organization'&&Object.keys(draft.contacts).length===0&&!draft.website)return 'contact_required';
  if(draft.website&&!isHttpUrl(draft.website))return 'website_invalid';
  for(const key of URL_CONTACT_KEYS)if(draft.contacts[key]&&!isHttpUrl(draft.contacts[key]))return `${key}_invalid`;
  if(draft.contacts.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contacts.email))return 'email_invalid';
  if(draft.wcaId&&!/^\d{4}[A-Z]{4}\d{2}$/.test(draft.wcaId))return 'wca_id_invalid';
  return null;
}
