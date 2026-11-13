// Explicit native-build boundary for jsPDF's unused HTML exporters.
export default function unsupported():never {throw new Error('Browser HTML PDF export is unavailable in Mini Programs');}
export const Canvg={fromString:unsupported};
export const decode=unsupported;
