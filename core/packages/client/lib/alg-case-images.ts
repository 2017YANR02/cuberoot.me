import type { CaseSvgInput } from './alg_pdf/case_svg';
import { algSheetFromCases, type FromCasesOptions } from './alg_pdf/from_cases';

export interface CaseImage {
  name: string;
  input: CaseSvgInput;
}
export interface CaseImageGroup {
  id: string;
  label: string;
  current: CaseImage[];
  all: CaseImage[];
}
export interface CaseImageBatch {
  filename: string;
  groups: CaseImageGroup[];
}

/** Reuse the PDF's lossless case/holding conversion; never use display notation. */
export function caseImageBatch(options: FromCasesOptions): CaseImageBatch {
  return {
    filename: options.filename,
    groups: options.cases.map((c, index) => {
      const rows = (allOris: boolean) => algSheetFromCases({
        ...options, cases: [c], allOris, thumbs: true, maxAlgs: 0,
      }).cases.map((row, oi) => ({
        name: `${options.puzzle}-${options.set}-${c.name}${allOris ? `-ori-${oi + 1}` : ''}`,
        input: row.thumb!,
      }));
      return { id: String(index), label: options.caseLabel?.(c) ?? c.name, current: rows(false), all: rows(true) };
    }),
  };
}

export function imageFilename(name: string): string {
  return name.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').slice(0, 160) || 'case';
}
