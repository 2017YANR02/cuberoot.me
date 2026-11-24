import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { Solve } from '@cuberoot/shared/timer';
import type { ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import BoolToggle, { type BoolToggleProps } from '../BoolToggle';

import type { ReconstructLocalize } from './report-content';
import type { CfopFormulaTarget, CfopFormulaFocus } from './cfop-diagnosis';
export type { ReconstructLocalize } from './report-content';

export interface ReconstructAssistantSummary {
  timeMs: number;
  penalty: Solve['penalty'];
  method: string | null;
  stm: number | null;
  tps: number | null;
  stages: Array<{
    label: string;
    stepMs: number | null;
    recognitionMs: number | null;
    executionMs: number | null;
    turns: number | null;
    cumulativeMs: number | null;
  }>;
}

/** Only host capabilities; analysis, report structure and playback stay shared. */
export interface ReconstructHost {
  localize: ReconstructLocalize;
  writeClipboardText: (text: string) => Promise<void>;
  replayUrl?: (solve: Solve) => string | null | Promise<string | null>;
  renderIntakeAction?: (solve: Solve, snapshot: ReconSnapshot | null) => ReactNode;
  renderAssistantAction?: (summary: ReconstructAssistantSummary, followUp?: boolean) => ReactNode;
  renderAssistantTrainingLink?: (href: string, label: string) => ReactNode;
  prepareAssistantFormula?: (set: CfopFormulaTarget['set']) => void;
  renderAssistantFormula?: (target: CfopFormulaTarget, focus: CfopFormulaFocus, fallback: ReactNode) => ReactNode;
  renderAnnotationAction?: (line: ReconTextLine, seek: () => void) => ReactNode;
  renderCaseLink?: (href: string, label: ReactNode, className: string) => ReactNode;
  renderScrambleDiagram?: (scramble: string) => ReactNode;
  LineDiagramProvider?: ComponentType<{
    scramble: string; text: string; enabled: boolean;
    children: (diagramAt: (line: number) => ReactNode, caseHrefAt: (line: number, colors: string) => string | undefined) => ReactNode;
  }>;
  inspectionColors?: (moves: string) => string | undefined;
  wasteBrackets?: (text: string, scramble: string) => Map<number, string>;
  recordGyro: boolean;
  onEnableGyro?: () => void;
  BoolToggle?: ComponentType<BoolToggleProps>;
}

export const ReconstructHostContext = createContext<ReconstructHost>({
  localize: (text) => text.en,
  writeClipboardText: async () => { throw new Error('Reconstruction clipboard host is not configured'); },
  recordGyro: false,
  BoolToggle,
});

export function useReconstructHost(): ReconstructHost {
  return useContext(ReconstructHostContext);
}
