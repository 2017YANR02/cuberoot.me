/** Website view-angle adapter; the drawing plan is shared with native clients. */
import { caseThumbPlan as basePlan, cubeThumbParams, supportsCaseViewAngle, type CaseThumbPlanInput as BaseInput } from '@cuberoot/puzzle-render-core/alg-thumb-plan';
import { caseViewAlg, caseViewSetup, type CaseViewAngle } from '@/lib/alg_display';
export * from '@cuberoot/puzzle-render-core/alg-thumb-plan';
/** Shared size for case-detail animation, static preview and admin preview (px). */
export const ALG_CASE_PREVIEW_SIZE = 150;

export interface CaseThumbPlanInput extends BaseInput { viewAngle?: CaseViewAngle }
export function caseThumbPlan(input: CaseThumbPlanInput) {
  const angle = /^([2-7])x\1$/.test(input.puzzle) && supportsCaseViewAngle(cubeThumbParams(input.puzzle, input.set, input.sticker, input.mask)) ? input.viewAngle ?? 'default' : 'default';
  return basePlan({...input, alg:caseViewAlg(input.alg, angle), setup:input.setup === undefined ? undefined : caseViewSetup(input.setup, angle)});
}
