import { cubeColorGroups, f2lDisplayColors, crossColorFromLabels } from '../cube-color-model';
import type { ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { reconTextForClipboard } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { ReconstructionType } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { reconCommentLinks, type ReconCommentCases } from '@cuberoot/shared/recon/comment-links';
import type { ReconstructLocalize } from './ReconstructHost';
import { projectReconNotation, projectReconComment, reconCommentFills, reconNotationState } from './report-presentation';
import { groupNode, textNode, buttonNode, type ReportNode, type ReportUIState, type ReportAction } from './report-content';

export function reportNotation(recon:ReconTextResult|null,method:ReconstructionType,state:ReportUIState,tr:ReconstructLocalize,options:{
  copyMode?:'copy'|'system';prepared?:ReturnType<typeof prepareReportNotation>;currentIdx?:number|null; canSeek?:boolean; cases?:ReconCommentCases;
  caseHref?:(line:number,colors:string)=>string|undefined;
  inspectionColors?:(moves:string)=>string|undefined;
  wasteBrackets?:(text:string,scramble:string)=>Map<number,string>;
  notice?:ReportNode|null;feedback?:ReportNode|null;
}={}) {
  const {projection,decorated,clipboard}=options.prepared??prepareReportNotation(recon,method,state.simplified,options.wasteBrackets);
  if(!recon||!projection.shownRecon||!recon.lines.length)return {node:null,clipboard,projection};
  const groups:ReportNode[]=[];let groupKey='';
  const labels=recon.lines.map(line=>line.label);
  const color=(id:string,colors:string):ReportNode=>({id,kind:'color',colors:f2lDisplayColors(colors,crossColorFromLabels(labels)),fills:reconCommentFills(colors,labels),className:'sml-label-chip'});
  for(const [i,item] of projection.lines.entries()){
    const {line,normalizedLine}=item,sourceLine=i+projection.inspectionOffset;
    const tokens=options.wasteBrackets&&method==='cfop'?(decorated.split(/\r?\n/)[sourceLine]??'').split('//')[0].trim().split(/\s+/).filter(Boolean):item.moves;
    const copyText=(decorated.split(/\r?\n/)[sourceLine]??'').trim();
    const rowAction:ReportAction=options.canSeek?{type:'play-from',value:line.fromIdx,timeMs:line.fromMs,copyText}:{type:'copy-line',copyText};
    const ranges=tokens.map((token,j)=>{
      const range=normalizedLine?undefined:line.moveRanges?.[j];
      const before:ReportAction={type:'play-from',value:range?.startIdx??line.fromIdx,timeMs:range?.ts,copyText};
      const after:ReportAction=range?{type:'play-from',value:(range.seekEndIdx??range.endIdx)+1,timeMs:range.endTs,copyText}:before;
      return {token,before,after};
    });
    const comments=projectReconComment(line.label??'',method,options.cases??new Map(),colors=>options.caseHref?.(sourceLine,colors)).map((part,j)=>({...part.colors?color(String(j),part.colors):textNode(String(j),part.text),href:part.href}));
    const body=groupNode('body',[
      {id:'moves',kind:'moves',text:tokens.join(' '),tokens:ranges,action:rowAction,className:`sml-moves${options.canSeek?' is-seek':''}`,title:options.canSeek?tr({zh:'复制本行并定位回放',en:'Copy this line and seek playback'}):tr({zh:'复制本行',en:'Copy this line'})},
      comments.length?groupNode('comment',comments,'sml-label','flow'):null,
    ],'sml-body','flow');
    const row:ReportNode={...groupNode(line.key,[line.kind!=='cross'&&line.kind!=='inspection'?{id:`diagram:${sourceLine}`,kind:'slot' as const}:null,body],'sml-line sml-line-with-diagram','flow'),state:reconNotationState(line,options.currentIdx)??undefined};
    const lineText=tokens.join(' ')+(line.label?' // '+line.label:'');
    row.notation=method==='training'?undefined:{line:lineText,crossColor:crossColorFromLabels(labels),
      links:method==='cfop'?reconCommentLinks(lineText,options.cases,set=>options.caseHref?.(sourceLine,set)).flatMap(link=>{
        const href=link.href==='/alg/3x3/f2l'?options.caseHref?.(sourceLine,'F2L'):link.href;
        return href&&/\/alg\/3x3\/[^/]+\//.test(href)?[{...link,href}]:[];
      }):[],
      colorHrefs:Object.fromEntries(cubeColorGroups(line.label??'').flatMap(group=>{
        const href=options.caseHref?.(sourceLine,group.colors);return href?[[group.colors,href]]:[];
      })),diagramId:line.kind!=='cross'&&line.kind!=='inspection'?`diagram:${sourceLine}`:undefined};
    if(groupKey!==item.groupKey){groupKey=item.groupKey;groups.push({...groupNode('group:'+groupKey,[],'sml-group'),stage:line.kind});}
    groups.at(-1)!.children!.push(row);
  }
  const inspection=projection.inspection;
  const colors=options.inspectionColors?.(inspection);
  return {clipboard,projection,node:groupNode('notation',[
    groupNode('head',[
      projection.canToggle&&buttonNode('simplified',state.simplified?tr({zh:'显示原始记录',en:'Show original record'}):tr({zh:'显示化简记录',en:'Show simplified record'}),{type:'simplified'},`recon-cross-toggle${state.simplified?' active':''}`,{selected:state.simplified,icon:'swap'}),
      buttonNode('copy',options.copyMode==='system'?tr({zh:'分享还原步骤',en:'Share solution steps'}):tr({zh:'复制成 /recon 的格式',en:'Copy in /recon format'}),{type:'copy-notation'},'sml-copy',{icon:state.copied==='notation'?'check':'copy'}),
    ],'sml-head','row'),
    Boolean(recon.scramble.trim())&&groupNode('scramble',[{...groupNode('line',[groupNode('body',[{id:'moves',kind:'moves',text:recon.scramble,className:'sml-moves is-seek',action:{type:'copy-line',copyText:recon.scramble},title:tr({zh:'复制本行',en:'Copy this line'})}],'sml-body','flow')],'sml-line'),notation:{line:recon.scramble,crossColor:null,links:[],colorHrefs:{}}}],'sml-group sml-scramble'),
    method!=='training'&&Boolean(inspection.trim())&&groupNode('inspection',[{...groupNode('line',[groupNode('body',[
      {id:'moves',kind:'moves',text:options.wasteBrackets&&method==='cfop'?decorated.split('\n')[0].split('//')[0].trim():inspection,className:'sml-moves is-seek',action:{type:'copy-line',copyText:decorated.split('\n')[0].trim()},title:tr({zh:'复制本行',en:'Copy this line'})},
      groupNode('label',[textNode('text','// '+tr({zh:'观察',en:'inspection'})),colors?{id:'colors',kind:'color',colors,fills:reconCommentFills(colors,[]),className:'sml-label-chip cube-orientation-chip'}:null],'sml-label','flow')
    ],'sml-body','flow')],'sml-line sml-line-with-diagram'),notation:{line:inspection+' // '+tr({zh:'观察',en:'inspection'}),crossColor:null,links:[],colorHrefs:{},inspectionColors:colors}}],'sml-group'),
    ...groups,options.notice,options.feedback,
  ],'sml recon-notation-list')};
}
/** Both adapters resolve token boundaries here; only hit testing is host-specific. */
export function notationHit(node:ReportNode,tokenIndex:number,after:boolean):ReportAction|undefined {
  if(!node.action)return undefined;
  if(node.action.type==='copy-line')return node.action;
  return (after?node.tokens?.[tokenIndex]?.after:node.tokens?.[tokenIndex]?.before)??node.action;
}

export function prepareReportNotation(recon:ReconTextResult|null,method:ReconstructionType,simplified:boolean,wasteBrackets?:(text:string,scramble:string)=>Map<number,string>){
  const projection=projectReconNotation(recon,method,simplified);
  let decorated=projection.displayText;
  if(wasteBrackets&&method==='cfop'){
    const source=decorated.split('\n').map(line=>{const comment=line.indexOf('//');return comment<0?line.replace(/[()]/g,''):line.slice(0,comment).replace(/[()]/g,'')+line.slice(comment);}).join('\n');
    const markers=wasteBrackets(source,recon?.scramble??'');decorated='';
    for(let i=0;i<=source.length;i++)decorated+=(markers.get(i)??'')+(source[i]??'');
  }
  const clipboard=projection.shownRecon?reconTextForClipboard({...projection.shownRecon,text:decorated}):'';
  return {projection,decorated,clipboard};
}
