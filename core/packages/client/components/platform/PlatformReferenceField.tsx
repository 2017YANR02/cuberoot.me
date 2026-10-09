'use client';

import { sessionFetch } from '@/lib/session-fetch';
import { useEffect, useMemo, useState } from 'react';
import BoolToggle from '@/components/BoolToggle';
import SearchInput from '@/components/SearchInput';
import { useT } from '@/hooks/useT';
import { apiUrl } from '@/lib/api-base';
import { authHeaders, handleApi } from '@/lib/admin-api';
import { commerceRecord, commerceText } from './PlatformCommerceContent';

type Entry=Record<string,unknown>;
const SOURCES:Record<string,string>={courseIds:'admin/courses',productIds:'admin/products',productVariantIds:'admin/products',eventIds:'admin/events',eventTicketTypeIds:'admin/events',membershipPlanIds:'membership-plans',instructorId:'admin/instructors'};
export function PlatformReferenceField({source,label,selected,onChange,multiple=true}:{source:string;label:string;selected:string[];onChange:(values:string[])=>void;multiple?:boolean}) {
 const t=useT();const [entries,setEntries]=useState<Entry[]|null>(null);const [error,setError]=useState('');const [query,setQuery]=useState('');
 useEffect(()=>{const controller=new AbortController();setEntries(null);void(async()=>{try{const all:Entry[]=[];for(let page=1;page<=100;page++){const response=await sessionFetch(apiUrl(`/v1/platform/${SOURCES[source]}?page=${page}&pageSize=100`),{headers:authHeaders(false),signal:controller.signal});const envelope=await handleApi<Record<string,unknown>>(response);const raw=Object.values(envelope).find(Array.isArray) as unknown[]|undefined;const rows=(raw??[]).map(commerceRecord);all.push(...rows);if(rows.length<100||(typeof envelope.total==='number'&&all.length>=envelope.total))break;}setEntries(all);setError('');}catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:String(reason));}})();return()=>controller.abort();},[source]);
 const options=useMemo(()=>{const nested=source==='productVariantIds'?'variants':source==='eventTicketTypeIds'?'tickets':null;return (entries??[]).flatMap(entry=>nested?(Array.isArray(entry[nested])?entry[nested] as unknown[]:[]).map(raw=>{const item=commerceRecord(raw);return {...item,parentTitle:commerceText(entry,'title',t)};}):[entry]);},[entries,source,t]);
 const name=(entry:Entry)=>String(entry.parentTitle?`${entry.parentTitle} · `:'')+(commerceText(entry,'title',t)||commerceText(entry,'name',t)||String(entry.displayName??entry.id));
 const filtered=options.filter(entry=>name(entry).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return <fieldset className="platform-structured-editor"><legend>{label}</legend>{error?<p role="alert">{error}</p>:entries===null?<p>{t('加载中…','Loading…')}</p>:multiple?<><SearchInput value={query} onChange={setQuery} placeholder={t('搜索可选内容','Search available items')}/>{filtered.map(entry=><BoolToggle key={String(entry.id)} label={name(entry)} value={selected.includes(String(entry.id))} onChange={active=>onChange(active?[...selected,String(entry.id)]:selected.filter(id=>id!==String(entry.id)))}/>)}{selected.filter(id=>!options.some(entry=>String(entry.id)===id)).map(id=><BoolToggle key={id} label={t('已选择的归档内容','Selected archived content')} value onChange={()=>onChange(selected.filter(value=>value!==id))}/>)}</>:<select className="platform-field-control" required value={selected[0]??''} onChange={event=>onChange([event.target.value])}><option value="">{t('请选择','Choose an item')}</option>{options.map(entry=><option key={String(entry.id)} value={String(entry.id)}>{name(entry)}</option>)}</select>}</fieldset>;
}
