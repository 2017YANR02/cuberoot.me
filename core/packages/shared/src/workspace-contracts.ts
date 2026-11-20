export function isContractTemplateTitle(title: string): boolean {
  return /合同|协议|\b(?:contracts?|agreements?)\b/i.test(title)
    && /模板|\btemplate\b/i.test(title);
}

export function contractTitleFromTemplate(title: string): string {
  return title.trim().replace(/\s*[-–—:：]?\s*(?:模板|\btemplate)$/i, '').trim().slice(0, 120);
}
