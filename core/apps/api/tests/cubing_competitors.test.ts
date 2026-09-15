import { describe, expect, it } from 'vitest';
import { parseCubingCompetitors } from '../src/utils/cubing_competitors';

describe('cubing.com competitor registration tables', () => {
  it('reads the new table layout without mixing WCA IDs into names or unregistered events', () => {
    // Beijing Autumn Rivalry / Guangzhou Grand Open 2026: new tbody attributes,
    // separate name/ID paragraphs, no gender column, Iconify event classes.
    const users = parseCubingCompetitors(`<table><thead><tr>
      <th>#</th><th>Name</th><th>Region</th>
      <th><span class="iconify i-event:333 text-xl"></span></th>
      <th><span class="iconify i-event:222 text-xl"></span></th>
      </tr></thead><tbody class="divide-y"><tr class="bg-white">
      <td><span>133</span></td><td><div><p>连允之</p>
      <p><a href="/results/person/2025LIAN01">2025LIAN01</a></p></div></td><td>中国</td>
      <td><span class="iconify i-event:333 shrink-0"></span></td>
      <td><span class="iconify i-mdi:minus"></span></td>
      </tr></tbody></table>`);
    expect(users).toEqual({
      '133': { number: 133, name: '连允之', wcaid: '2025LIAN01', region: '中国', eventIds: ['333'] },
    });
  });

  it('retains the legacy layout, decoded names, newcomer rows, and empty registrations', () => {
    const users = parseCubingCompetitors(`<table><thead><tr>
      <th>#</th><th>Name</th><th>Gender</th><th>Region</th>
      <th class="header-event"><i class="event-icon event-icon-333"></i></th>
      <th class="header-event"><i class="event-icon event-icon-333oh"></i></th>
      </tr></thead><tbody>
      <tr><td>40</td><td>5/35</td><td>35/5</td><td></td><td>40</td><td>20</td></tr>
      <tr><td>44</td><td><a href="/results/person/2025LIAN01">Yunzhi Lian</a></td><td>F</td><td>China</td>
      <td><i class="event-icon event-icon-333"></i></td><td></td></tr>
      <tr><td>45</td><td>A &amp; B</td><td>M</td><td>Hong Kong</td><td></td>
      <td><i class="event-icon event-icon-333oh"></i></td></tr>
      <tr><td>46</td><td>Empty Events</td><td>F</td><td>China</td><td></td><td></td></tr>
      </tbody></table>`);
    expect(users).toEqual({
      '44': { number: 44, name: 'Yunzhi Lian', wcaid: '2025LIAN01', region: 'China', eventIds: ['333'] },
      '45': { number: 45, name: 'A & B', wcaid: '', region: 'Hong Kong', eventIds: ['333oh'] },
      '46': { number: 46, name: 'Empty Events', wcaid: '', region: 'China', eventIds: [] },
    });
  });

  it('ignores empty, unrelated, and malformed rows', () => {
    expect(parseCubingCompetitors('')).toEqual({});
    expect(parseCubingCompetitors('<table><tbody><tr><td>1</td><td>Not a roster</td></tr></tbody></table>')).toEqual({});
    expect(parseCubingCompetitors(`<table><thead><tr><th>#</th><th>Name</th><th>Region</th>
      <th><span class="i-event:333"></span></th></tr></thead><tbody>
      <tr><td>-1</td><td>Invalid</td><td>China</td><td><span class="i-event:333"></span></td></tr>
      <tr><td>1</td><td>Short row</td></tr></tbody></table>`)).toEqual({});
  });
});
