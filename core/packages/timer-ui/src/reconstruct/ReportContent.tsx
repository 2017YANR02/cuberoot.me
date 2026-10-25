'use client';
import { createElement, type ReactNode } from 'react';
import { Check, Copy, Forward, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight, SkipBack, SkipForward, ChevronLeft, Play, Pause, ArrowRightLeft } from 'lucide-react';
import '../recon/recon-cross-toggle.css';
import BoolToggle from '../BoolToggle';
import { TimerDifficultyHelp } from '../TimerDifficultyHelp';
import CubeColorChip from '../CubeColorChip';
import { useReconstructHost } from './ReconstructHost';
import { getTextOffsetInElement, snapCaretToLine } from '../recon/text-cursor';
import NotationLine from '../recon/NotationLine';
import { notationHit } from './report-notation';
import type { ReportNode, ReportAction } from './report-content';

const icons={swap:ArrowRightLeft,check:Check,copy:Copy,share:Forward,'thumb-up':ThumbsUp,'thumb-down':ThumbsDown,start:SkipBack,end:SkipForward,back:ChevronLeft,next:ChevronRight,play:Play,pause:Pause};
/** DOM-only adapter. Content and decisions belong to report-content. */
export default function ReportContent({node,dispatch,slots={}}:{node:ReportNode|null;dispatch:(action:ReportAction)=>void;slots?:Record<string,ReactNode>}) {
  const host=useReconstructHost();
  if(!node)return null;
  if(node.href){
    const content=<ReportContent node={{...node,href:undefined}} dispatch={dispatch} slots={slots}/>;
    return host.renderCaseLink?host.renderCaseLink(node.href,content,'sml-case-link'):<a className="sml-case-link" href={host.localize({en:node.href,zh:'/zh'+node.href})}>{content}</a>;
  }
  if(node.notation){
    const data=node.notation;
    const body=node.children?.find(child=>child.id==='body');
    const moves=body?.children?.find(child=>child.id==='moves');
    return <NotationLine line={data.line} crossColor={data.crossColor} links={data.links}
      colorHref={colors=>data.colorHrefs[colors]} inspectionColors={data.inspectionColors}
      diagram={data.diagramId?slots[data.diagramId]:undefined}
      trailing={slots['annotation:'+node.id]}
      moves={moves?<ReportContent node={moves} dispatch={dispatch} slots={slots}/>:undefined}
      className={node.className} state={node.state} bodyClassName="sml-body" diagramClassName="sml-diagram"
      chipClassName="sml-label-chip" commentClassName="sml-label" localize={host.localize}
      renderLink={(href,label)=>host.renderCaseLink?host.renderCaseLink(href,label,'sml-case-link'):<a className="sml-case-link" href={host.localize({en:href,zh:'/zh'+href})}>{label}</a>}/>;
  }
  const render=(child:ReportNode)=><ReportContent key={child.id} node={child} dispatch={dispatch} slots={slots}/>;
  const children=node.children?.map(render);
  const Toggle=host.BoolToggle??BoolToggle;
  switch(node.kind){
    case 'color':return <CubeColorChip localize={host.localize} colors={node.colors??''} className={node.className}/>;
    case 'moves':return node.action?<span role="button" tabIndex={0} className={node.className} title={node.title} onKeyDown={event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();dispatch(node.action!);}
    }} onClick={event=>{
      const raw=event.detail?getTextOffsetInElement(event.currentTarget,{x:event.clientX,y:event.clientY}):-1;
      if(raw<0){dispatch(node.action!);return;}
      let start=0;const positions=(node.tokens??[]).map(t=>{const p={start,end:start+t.token.length,text:t.token};start=p.end+1;return p;});
      const offset=snapCaretToLine(raw,node.text??'',positions),index=positions.findIndex(p=>p.end>=offset);
      const action=notationHit(node,index,index>=0&&offset>positions[index].start);if(action)dispatch(action);
    }}>{node.text}</span>:<span className={node.className}>{node.text}</span>;
    case 'bar':return <div className="sa-bar" role="img" aria-label={node.text}>{node.segments?.map(s=><span key={s.id} className="sa-bar-seg" data-tone={s.tone} style={{width:s.fraction*100+'%'}} title={s.label}/>)}</div>;
    case 'slot':return slots[node.id]??null;
    case 'text':return node.icon==='info'&&node.title
      ? <TimerDifficultyHelp content={node.title} label={node.text??''}/>
      : node.tag==='fragment'?<>{node.text}</>:createElement(node.tag??'span',{className:node.className,title:node.title},node.text);
    case 'button':{
      const Icon=node.icon?icons[node.icon as keyof typeof icons]:undefined;
      return <button type="button" className={node.className} disabled={node.disabled} aria-pressed={node.selected} title={node.title??node.text} aria-label={node.text} onClick={()=>node.action&&dispatch(node.action)}>{Icon?<Icon size={15}/>:node.text}{children}</button>;
    }
    case 'toggle':return <Toggle value={Boolean(node.value)} label={node.text} onChange={value=>node.action&&dispatch({...node.action,value})}/>;
    case 'select':return <label className={node.className}>{node.text}<select value={String(node.value)} onChange={e=>node.action&&dispatch({...node.action,value:Number(e.target.value)})}>{node.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
    case 'disclosure':return <div className={node.className}><button type="button" className="reconstruct-section-header" aria-expanded={node.selected} onClick={()=>node.action&&dispatch(node.action)}>{node.selected?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<span className="reconstruct-section-title reconstruct-section-title-inline">{node.text}</span></button>{node.selected&&children}</div>;
    case 'table':return <div className="sa-scroll"><table className={node.className}><thead><tr><th scope="col" className="sa-rowhead"/>{node.columns?.map(column=><th key={column.id} scope="col" data-tone={column.tone} data-open={column.selected?'':undefined} className={column.className==='sa-total-col'?'sa-total-col':undefined}>{render(column)}</th>)}</tr></thead><tbody>{node.rows?.map(row=><tr key={row.id} className={row.className}><th scope="row" className="sa-rowhead">{row.label}</th>{row.cells.map((cell,i)=><td key={cell.id} title={cell.title} data-open={node.columns?.[i]?.selected?'':undefined} className={i===row.cells.length-1?'sa-total-col':undefined}>{render(cell)}</td>)}</tr>)}</tbody></table></div>;
    case 'group':return node.tag==='fragment'?<>{children}</>:createElement(node.tag??'div',{className:node.className,title:node.title,'data-state':node.state,'data-stage':node.stage},children);
  }
}
