/** Remove only the bilingual Bark news heading, preserving results, ranks and flags. */
export function stripRecordNewsPrefix(text: string): string {
  return text.replace(/^(?:纪录快讯|PR快讯|Breaking News|PR News)[!！]\s*/i, '');
}
