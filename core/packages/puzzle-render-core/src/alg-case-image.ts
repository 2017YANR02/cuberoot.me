/** Native image adapter for the same plan consumed by CaseThumb and PDF. */
import { renderFromSimpleQuery } from '@cuberoot/visualcube/svg';
import { caseThumbPlan, type CaseThumbPlanInput } from './alg-thumb-plan';

export async function algorithmCaseImage(input: CaseThumbPlanInput, size = 160): Promise<{svg?: string; src?: string}> {
  const plan = caseThumbPlan(input);
  if (plan.renderer === 'asset') return {src:plan.src};
  if (plan.renderer === 'inline-svg') return {svg:plan.svg};
  if (plan.renderer === 'engine' || plan.renderer === 'sr') {
    // Reuse the existing HTTP adapter for DOM/3D engines instead of shipping
    // those engines in the Mini Program package. Views match CaseThumb exactly.
    const params = new URLSearchParams({pzl:plan.renderer === 'engine' ? plan.puzzle : 'megaminx',view:plan.renderer === 'engine' ? 'iso' : 'top',size:String(size)});
    params.set(plan.driver.alg !== undefined ? 'alg' : 'case',plan.driver.alg ?? plan.driver.case ?? '');
    return {src:`/v1/visualcube.svg?${params}`};
  }
  const p = plan.params;
  return {svg:renderFromSimpleQuery({
    ...(p.faceletColors ? {fc:p.faceletColors,...(p.faceletAlg ? {alg:p.faceletAlg} : {})} : plan.setup ? {setup:plan.setup} : {case:plan.algorithm}),
    view:p.view, size, pzl:p.puzzleSize,
    ...(p.mask ? {mask:p.mask} : {}), ...(p.scheme ? {sch:p.scheme} : {}), ...(p.hideGreySides ? {ngs:'1'} : {}),
    ...(p.planSimplify?.side ? {psr:p.planSimplify.side} : {}), ...(p.planSimplify?.up ? {pur:p.planSimplify.up} : {}),
    ...(p.planSimplify?.showYellow !== undefined ? {psy:p.planSimplify.showYellow ? '1' : '0'} : {}),
    ...(p.planSimplify?.forceShow ? {pfs:p.planSimplify.forceShow} : {}), ...(p.planSimplify?.forceHide ? {pfh:p.planSimplify.forceHide} : {}),
  })};
}
