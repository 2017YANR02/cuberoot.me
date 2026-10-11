import Image from 'next/image';
import './cubing-brand-label.css';

/** Shared brand assets; unknown/custom teams keep their original text. */
const brands = [
  { aliases: ['gan', 'gancube'], src: '/images/brands/gan-color.png', circle: false },
  { aliases: ['魔域', '魔域文化', 'moyu'], src: '/images/brands/moyu-color.png', circle: false },
  { aliases: ['奇艺', '奇艺魔方', '奇艺魔方格', 'qiyi'], src: '/images/brands/qiyi-color.png', circle: true },
];

export function CubingBrandLabel({ name, logoOnly = false, fallbackToName = false }: { name: string; logoOnly?: boolean; fallbackToName?: boolean }) {
  const brand = brands.find(item => item.aliases.includes(name.trim().toLowerCase()));
  return <span className="cubing-brand-label">
    {brand && <Image className={`cubing-brand-logo${brand.circle ? ' cubing-brand-logo--circle' : ''}`} src={brand.src} alt={logoOnly ? name : ''} width={32} height={32} unoptimized />}
    {(!logoOnly || (!brand && fallbackToName)) && <span>{name}</span>}
  </span>;
}
