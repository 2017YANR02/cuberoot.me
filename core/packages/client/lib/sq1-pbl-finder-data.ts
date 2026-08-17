import type {
  Sq1PblAuxiliary,
  Sq1PblFinderDefaults,
  Sq1PblPll,
} from '@/lib/sq1-pbl';

type JsonRecord = Record<string, unknown>;

function record(value: unknown, message: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as JsonRecord;
}

function array(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function string(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value) throw new Error(message);
  return value;
}

function pll(value: unknown, parity: boolean): Sq1PblPll {
  const item = record(value, 'Invalid SQ1 PBL Finder PLL');
  if (item.parity !== parity) throw new Error('Invalid SQ1 PBL Finder PLL parity');
  return {
    name: string(item.name, 'Invalid SQ1 PBL Finder PLL name'),
    parity,
    topSetup: string(item.topSetup, 'Invalid SQ1 PBL Finder top setup'),
    bottomSetup: string(item.bottomSetup, 'Invalid SQ1 PBL Finder bottom setup'),
  };
}

function auxiliary(value: unknown): Sq1PblAuxiliary {
  const item = record(value, 'Invalid SQ1 PBL Finder auxiliary algorithm');
  return {
    name: string(item.name, 'Invalid SQ1 PBL Finder auxiliary name'),
    sequence: string(item.sequence, 'Invalid SQ1 PBL Finder auxiliary sequence'),
  };
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export async function loadSq1PblFinderDefaults(signal?: AbortSignal): Promise<Sq1PblFinderDefaults> {
  const response = await fetch('/data/sq1-pbl/finder-defaults.json', {
    signal,
    cache: 'force-cache',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const raw = record(await response.json(), 'Invalid SQ1 PBL Finder defaults');
  if (raw.schemaVersion !== 1) throw new Error('Unsupported SQ1 PBL Finder schema');

  const rawProvenance = record(raw.provenance, 'Invalid SQ1 PBL Finder provenance');
  const rawLicense = record(raw.licenseStatus, 'Invalid SQ1 PBL Finder license status');
  const rawPlls = record(raw.plls, 'Invalid SQ1 PBL Finder PLL groups');
  const standard = array(rawPlls.standard, 'Invalid SQ1 PBL Finder standard PLLs')
    .map(value => pll(value, false));
  const parity = array(rawPlls.parity, 'Invalid SQ1 PBL Finder parity PLLs')
    .map(value => pll(value, true));
  const auxiliaryAlgorithms = array(raw.auxiliaryAlgorithms, 'Invalid SQ1 PBL Finder auxiliary algorithms')
    .map(auxiliary);

  if (standard.length !== 21
    || parity.length !== 22
    || auxiliaryAlgorithms.length !== 814
    || !unique([...standard, ...parity].map(item => item.name))
    || !unique(auxiliaryAlgorithms.map(item => item.name))
    || !unique(auxiliaryAlgorithms.map(item => item.sequence))) {
    throw new Error('Incomplete SQ1 PBL Finder defaults');
  }

  const rawAuthors = array(rawProvenance.authors, 'Invalid SQ1 PBL Finder authors');
  const authors = rawAuthors.map(author => string(author, 'Invalid SQ1 PBL Finder author'));
  const rawAuxiliaryCredit = rawProvenance.auxiliaryDataCredit === undefined
    ? null
    : record(rawProvenance.auxiliaryDataCredit, 'Invalid SQ1 PBL Finder auxiliary credit');

  return {
    schemaVersion: 1,
    provenance: {
      application: string(rawProvenance.application, 'Invalid SQ1 PBL Finder application'),
      authors,
      sourceUrl: string(rawProvenance.sourceUrl, 'Invalid SQ1 PBL Finder source URL'),
      sourceSha256: string(rawProvenance.sourceSha256, 'Invalid SQ1 PBL Finder source digest'),
      ...(rawAuxiliaryCredit ? {
        auxiliaryDataCredit: {
          name: string(rawAuxiliaryCredit.name, 'Invalid SQ1 PBL Finder auxiliary credit name'),
          description: string(rawAuxiliaryCredit.description, 'Invalid SQ1 PBL Finder auxiliary credit description'),
          sourceUrl: string(rawAuxiliaryCredit.sourceUrl, 'Invalid SQ1 PBL Finder auxiliary credit URL'),
        },
      } : {}),
    },
    licenseStatus: {
      status: string(rawLicense.status, 'Invalid SQ1 PBL Finder license status'),
      redistributionPermission: string(rawLicense.redistributionPermission, 'Invalid SQ1 PBL Finder redistribution status'),
      notice: string(rawLicense.notice, 'Invalid SQ1 PBL Finder license notice'),
    },
    plls: { standard, parity },
    auxiliaryAlgorithms,
  };
}
