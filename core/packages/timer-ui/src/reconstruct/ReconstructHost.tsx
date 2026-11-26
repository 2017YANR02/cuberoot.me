import { createContext, useContext } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { Solve } from '@cuberoot/shared/timer';
import type { ReconSnapshot } from '@cuberoot/shared/recon-ground-truth';
import type { ReconTextLine } from '@cuberoot/shared/timer/reconstruct/recon-text';
import BoolToggle, { type BoolToggleProps } from '../BoolToggle';

import type { ReconstructLocalize } from './report-content';
import type { CfopFormulaTarget, CfopFormulaFocus } from './cfop-diagnosis';
export type { ReconstructLocalize } from './report-content';

export interface ReplayPracticeTarget {
  key: string;
  legacyKey?: string;
  practiceScope?: string;
  label: string;
  set: 'cross' | 'f2l' | 'oll' | 'pll' | 'zbll';
  metric: 'recognition' | 'execution' | 'total';
  formula?: CfopFormulaTarget;
}

/** Local recognition input. Only resolved public case IDs enter the chat draft. */
export interface ReplayPairTrainingInput {
  origin?: { solve: Solve; scope: string };
  fingerprint?: string;
  formula?: CfopFormulaTarget;
  retestCaseKey?: string;
  history?: readonly Solve[];
}

export interface ReplayTrainingEvidence {
  drills: { name: string; clock: string; valid: number; total: number; medianMs: number | null; times: string[] }[];
  retest?: { name: string; metric: string; before: string[]; after: string[]; beforeMs: number | null;
    afterMs: number | null; beforeValid: number; afterValid: number; extra: number; manual: boolean };
}
export interface ReplayReportEvidence {
  wholeSolve?: boolean;
  freePairs?: number;
  skipped?: string[];
  selected?: number;
  observation?: { metric: string; current: number; baseline: number; slower: boolean; note: string };
  priority?: { name: string; metric: string; earlier: number; recent: number; earlierCount: number; recentCount: number; slowerCount: number; instruction: string };
  observationNote?: string;
  stageFindings?: Record<string, string>;
  excluded?: string[];
  historyFinding?: string;
  training?: ReplayTrainingEvidence;
}
export interface ReconstructAssistantSummary {
  reviewRotation?: string;
  evidence?: ReplayReportEvidence;
  timeMs: number;
  penalty: Solve['penalty'];
  method: string | null;
  stm: number | null;
  tps: number | null;
  notes?: string[];
  focus?: { label: string; selectedKey?: string; goal: 'stepMs' | 'recognitionMs' | 'executionMs' | 'turns' };
  stages: Array<{
    range?: { startMs: number; first: number; last: number };
    key?: string;
    zbll?: import('./replay-zbll').ReplayZbll;
    alternatives?: {slot:string; turns:number; alg:string}[];
    clips?: {kind:'transition'|'pause'; startMs?:number; endMs?:number; setup:string; alg:string; first:number; last:number; ms:number; beforeExecution:boolean}[];
    gapCount?: number;
    transfer?: {previousRounds?:{start:number; comparison:import('./cfop-personal-baseline').F2lTransferComparison}[]; caseId?:number; set?:'f2l'|'adv-f2l'|'oll'|'pll'|'zbll';
      goals?:{goal:'recognition'|'execution'|'transition'|'routes'; variant:'recorded'|'reference'|'case'; attempts:number; correct:number; medianMs:number|null; entryMs:number|null; deviceCount?:number; deviceExecutionMs?:number|null; longestGapMs?:number|null}[];
      name:string; role:'recorded'|'retest'; signal:'recognitionMs'|'executionMs'; count:number;
      medianMs:number|null; originalMs:number|null; opportunities?:number; comparison?:import('./cfop-personal-baseline').F2lTransferComparison}[];
    fullRoute?: {originalTurns:number; turns:number; setup:string; alg:string};
    fingerprint?: string;
    formula?: CfopFormulaTarget;
    instruction?: string;
    longestGap?: {durationMs: number; first: number; last: number};
    playbackReference?: string;
    rawSetup?: boolean;
    slot?: string;
    original?: string;
    setup?: string;
    refTurns?: number | null;
    refUserTurns?: number | null;
    refSolution?: string | null;
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
  renderAssistantAction?: (summary: ReconstructAssistantSummary, followUp?: boolean, pairPending?: boolean, pairTraining?: ReplayPairTrainingInput) => ReactNode;
  renderPairTraining?: (fingerprint: string | undefined, label: string, fallback: ReactNode, origin?: ReplayPairTrainingInput['origin']) => ReactNode;
  renderAssistantTrainingLink?: (href: string, label: string) => ReactNode;
  prepareAssistantFormula?: (set: CfopFormulaTarget['set']) => void;
  renderAssistantFormula?: (target: CfopFormulaTarget, focus: CfopFormulaFocus, fallback: ReactNode) => ReactNode;
  renderPracticeRetest?: (target: ReplayPracticeTarget, action: (result?: string, retestCaseKey?: string, training?: ReplayTrainingEvidence) => ReactNode) => ReactNode;
  renderPairPlayer?: (setup: string, alg: string, slot: string, rotation?: string) => ReactNode;
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
