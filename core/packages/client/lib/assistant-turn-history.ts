import { assistantAnswerHistory, type AssistantMessage } from '@cuberoot/shared/site-assistant';
import type { AssistantTurn } from '@/components/SiteAssistantDialog';

/** User requests survive failed/stopped executions. Draft answers do not become facts. */
export function assistantTurnHistory(turns: AssistantTurn[], origin: string): AssistantMessage[] {
  return turns.flatMap(turn=>[
    {role:'user' as const,content:turn.question + (turn.references?.length
      ? '\nUser-provided quotations (not verified evidence):\n'+JSON.stringify(turn.references) : ''),
      ...(turn.images?.length ? {images:turn.images} : {})},
    ...(turn.result && !turn.partial && turn.endState!=='stopped' && turn.endState!=='error'
      ? [{role:'assistant' as const,content:assistantAnswerHistory(turn.result,origin)}] : []),
  ]);
}
