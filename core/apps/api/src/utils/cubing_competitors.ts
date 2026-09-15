import { parseHTML } from 'linkedom';

interface Competitor {
  number: number;
  name: string;
  wcaid: string;
  region: string;
  eventIds: string[];
}

/** cubing.com 旧版及新版报名表；只读取选手行中实际存在的项目图标。 */
export function parseCubingCompetitors(html: string): Record<string, Competitor> {
  const { document } = parseHTML(html);
  const users: Record<string, Competitor> = {};
  for (const table of document.querySelectorAll('table')) {
    const headers = [...table.querySelectorAll('thead th')];
    const firstEventColumn = headers.findIndex((header) => (
      /(?:event-icon-|i-event:)[a-z0-9]+/.test(header.innerHTML)
    ));
    if (firstEventColumn < 3) continue;
    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = [...row.querySelectorAll('td')];
      if (cells.length <= firstEventColumn) continue;
      const number = Number(cells[0].textContent?.trim());
      if (!Number.isInteger(number) || number <= 0) continue;
      // 新版另一个段落显示 WCA ID；不能把它拼进选手名字。
      const name = (cells[1].querySelector('p') ?? cells[1]).textContent?.trim();
      if (!name || /^[\d/&;\s]+$/.test(name)) continue;
      const personLink = cells[1].querySelector('a[href*="/results/person/"]');
      const wcaid = personLink?.getAttribute('href')?.match(/\/results\/person\/([A-Za-z0-9]+)/)?.[1] ?? '';
      const eventIds = new Set<string>();
      for (const cell of cells.slice(firstEventColumn)) {
        for (const icon of cell.querySelectorAll('[class]')) {
          const event = icon.className.match(/(?:^|\s)(?:event-icon-|i-event:)([a-z0-9]+)(?=\s|$)/);
          if (event) eventIds.add(event[1]);
        }
      }
      users[String(number)] = {
        number,
        name,
        wcaid,
        region: cells[firstEventColumn - 1].textContent?.trim() ?? '',
        eventIds: [...eventIds],
      };
    }
  }
  return users;
}
