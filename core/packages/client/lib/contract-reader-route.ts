export const CONTRACT_READER_PATH = '/admin/team/contract';
export const CONTRACT_LIST_HREF = '/admin/team?section=contracts';

export function contractDraftHref(id: string): string {
  return `${CONTRACT_READER_PATH}?draft=${encodeURIComponent(id)}`;
}

export function isContractReaderPath(pathname: string | null): boolean {
  return pathname?.replace(/^\/(?:en|zh)(?=\/|$)/, '').replace(/\/$/, '') === CONTRACT_READER_PATH;
}
