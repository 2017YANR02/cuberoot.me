'use client';

/**
 * StepMoveList — 这把是怎么拧的,按步分组写出来。
 *
 *     打乱                                              ⧉
 *       R D B' D2 U2 B R2 F2 D2 B' U2 B'
 *
 *       U R' F R' B2 L                    // Y cross
 *
 *       U F2 R' F2 U2 R             // BR  F1
 *       ...
 *       U2 F U R U' R' F'           // OLL-P+
 *
 *       U' F2 U' F2 D R2 B2 U B2 D' R2 U  // PLL-T
 *
 * 阶段名和阶段用时(「十字 [4.02]」)**不在这里**(2026-08-04 用户提的):同一屏左边
 * 那根带游标的轴已经把四段的名字和用时画出来了,这里再写一遍是同一件事说两次。分组
 * 本身留着 —— 组与组之间的空白就是它,而每一行右边的标注(`// Y cross`、`F1`、
 * `// OLL-P+`)本来就说得出自己是谁。
 *
 * 这里只展示动作和标注；参考步数评价保留在分步分析中。
 *
 * 标注和动作都不是这里算的:动作来自 `recon_text.ts` 的行(切点和分步分析表同一把
 * 刀),标注来自 /recon 的识别器。这个文件只负责摆。
 *
 * 回放接上之后,这里同时是**进度显示**:正在播的那一步高亮,还没播到的压暗,
 * 点某一步的标题跳到那一步开头。
 */

import ReportContent from './ReportContent';
import { reportNotation, prepareReportNotation } from './report-notation';
import { initialReportUI, reduceReportUI } from './report-content';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReportAction } from './report-content';
import { useNotationCases } from '../recon/NotationLine';

import { useReconstructHost, type ReconstructHost } from './ReconstructHost';

import type { ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { ReferenceResult, SlotReference } from '@cuberoot/shared/timer/reconstruct/reference';
import type { ReconstructionType } from '@cuberoot/shared/timer/reconstruct/recon-text';

export interface StepMoveListProps {
  method?: ReconstructionType;
  recon: ReconTextResult | null;
  /** 保留调用契约；公式列表不显示参考步数评价。 */
  reference: ReferenceResult | null;
  /** 保留调用契约；公式列表不显示槽位评价。 */
  slotReference: SlotReference[] | null;
  /** 回放游标 = 已经播了几手。省略则不做高亮。 */
  currentIdx?: number | null;
  /** 点某一步跳到它开头。省略则标题不是按钮。 */
  onSeek?: (idx: number, atMs?: number) => void;
  /** 还原步骤底下的一句提醒(如「这把没录姿态」)。省略则不显示。 */
  notice?: React.ReactNode;
  /** 「复盘对不对」那一行。省略则不显示。 */
  feedback?: React.ReactNode;
  /** Untimed generated solutions can supply notation without recorded-solve metrics. */
  clipboardText?: string;
  /** Optional host toolbar for the shared notation actions. */
  toolbar?: HTMLElement | null;
}



const NoLineDiagrams: NonNullable<ReconstructHost['LineDiagramProvider']> = ({ children }) => children(() => null, () => undefined);

export default function StepMoveList({method='cfop',recon,currentIdx,onSeek,notice,feedback,clipboardText,toolbar}:StepMoveListProps) {
  const host=useReconstructHost(), {LineDiagramProvider=NoLineDiagrams}=host;
  const [ui,setUI]=useState(initialReportUI);
  const commentCases=useNotationCases((recon?.lines??[]).map(line=>'// '+(line.label??'')).join('\n'),method==='cfop');
  const prepared=useMemo(()=>prepareReportNotation(recon,method,ui.simplified,host.wasteBrackets),[recon,method,ui.simplified,host.wasteBrackets]);
  const projection=prepared.projection;
  if(!recon)return null;
  return <LineDiagramProvider scramble={recon.scramble} text={projection.displayText} enabled={method==='cfop'}>{(diagramAt,caseHrefAt)=>{
    const content=reportNotation(recon,method,ui,host.localize,{prepared,currentIdx,canSeek:Boolean(onSeek),cases:commentCases,caseHref:caseHrefAt,inspectionColors:host.inspectionColors,wasteBrackets:host.wasteBrackets,
      notice:notice?{id:'notice',kind:'slot'}:null,feedback:feedback?{id:'feedback',kind:'slot'}:null});
    const slots:Record<string,React.ReactNode>={notice,feedback};
    projection.lines.forEach(({ line },i)=>{
      slots['diagram:'+(i+projection.inspectionOffset)]=diagramAt(i+projection.inspectionOffset);
      slots['annotation:'+line.key]=host.renderAnnotationAction?.(line,()=>onSeek?.(line.fromIdx));
    });
    const dispatch = (action: ReportAction) => {
      if(action.copyText)void host.writeClipboardText(action.copyText).catch(err=>console.warn('[step-move-list] copy failed:',err));
      if(action.type==='play-from')onSeek?.(Number(action.value),action.timeMs);
      if(action.type==='copy-notation')void host.writeClipboardText(clipboardText ?? content.clipboard).then(()=>{
        setUI(state=>reduceReportUI(state,{type:'copied',key:'notation'}));
        setTimeout(()=>setUI(state=>reduceReportUI(state,{type:'copied'})),1500);
      }).catch(err=>console.warn('[step-move-list] copy failed:',err));
      setUI(state=>reduceReportUI(state,action));
    };
    const head = toolbar ? content.node?.children?.find(node => node.id === 'head') : null;
    const node = head && content.node ? {...content.node, children: content.node.children?.filter(child => child !== head)} : content.node;
    return <>
      {head && toolbar && createPortal(<ReportContent node={head} slots={slots} dispatch={dispatch}/>, toolbar)}
      <ReportContent node={node} slots={slots} dispatch={dispatch}/>
    </>;
  }}</LineDiagramProvider>;
}
