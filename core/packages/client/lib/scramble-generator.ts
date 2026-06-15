// Ported from packages/client-vite/src/utils/scrambleGenerator.ts

export const crossColorToCubeRotation = (c: string): string => {
  switch (c) {
    case 'y': return 'x2';
    case 'b': return "x'";
    case 'r': return 'z';
    case 'g': return 'x';
    case 'o': return "z'";
    case 'w': return '';
    default:
      console.error('crossColorToCubeRotation: invalid color', c);
      return '';
  }
};

export const inverseScramble = (s: string): string => {
  const arr = s.split(' ');
  return arr
    .map((it) => {
      if (it.length === 0) return '';
      if (it[it.length - 1] === '2') return it;
      if (it[it.length - 1] === "'") return it.slice(0, -1);
      return `${it}'`;
    })
    .reverse()
    .join(' ');
};

export interface PllCaseInstance {
  name: string;
  rotation: string;
  dTurn: string;
  colorShift: number;
  crossColor: string;
}

export const scrambleForCase = (
  pllCase: PllCaseInstance | null,
  pllMap: Record<string, Record<string, string>>,
  crossColorOverride?: string
): string => {
  if (!pllCase) return '';
  const cc = crossColorOverride ? crossColorOverride[0].toLowerCase() : pllCase.crossColor;
  const solution = pllMap[pllCase.name]?.['noAuf'] || '';
  const crossColorChange = crossColorToCubeRotation(cc);
  const colorShift = 'y '.repeat(pllCase.colorShift).trim();
  const inversedRotation = inverseScramble(pllCase.rotation);
  return `${crossColorChange} ${colorShift} ${pllCase.dTurn} ${solution} ${inversedRotation}`
    .replace(/\s+/g, ' ')
    .trim();
};
