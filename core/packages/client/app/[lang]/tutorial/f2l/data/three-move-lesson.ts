/** Copy for the combined chapter preview; the original chapters remain unchanged. */
export const THREE_MOVE_PARTS = [
  {
    title: { zh: '认识图案', en: 'Recognize' },
    copy: { zh: '三步基态有四种：A+、A−、B+、B−\nA 类棱角已配对，B 类棱角尚未配对', en: 'The simplest F2L cases take just three moves: A+, A−, B+ and B−. The A cases are already paired; the B cases are not.' },
  },
  {
    title: { zh: '看懂三步', en: 'Learn the moves' },
    copy: { zh: '观察每一步怎样改变棱角的位置\nA+ 与 A− 互为镜像，B+ 与 B− 也是如此', en: 'Watch how each move changes the edge and corner positions. A+ mirrors A−, and B+ mirrors B−.' },
  },
  {
    title: { zh: '顶层调整', en: 'Align the top' },
    copy: { zh: '只转顶层，棱角之间的相对关系不变，仍然是同一种 case\n先转 U、U′ 或 U2，让它与教材图形对齐，再做三步还原', en: 'Turning only the top preserves the relationship between the edge and corner: it is still the same case. Use U, U′ or U2 to match the reference, then solve it in three moves.' },
  },
] as const;
