function definePaper(slug: string, title: string, topic: string) {
  const files = '/papers/cubing-lean/' + slug;
  return { title, topic, author: 'Ruimin Yan', date: '2026-11-26',
    href: '/math/cubing-lean/papers/' + slug, pdf: files + '.pdf', source: files + '-source.zip' };
}

export const paper = definePaper('full-cycle-commutators', 'Full-cycle commutators in the Rubik’s Cube group', 'commutators');
export const kernelPaper = definePaper('short-solution-kernel', 'A kernel for short solutions of the generalized Rubik’s Cube', 'short-solutions');
export type CubingPaper = ReturnType<typeof definePaper>;
