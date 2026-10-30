import Image from 'next/image';
import { wcaTeamBrand } from '@/lib/wca-team-brands';
import './cubing-brand-label.css';

/** Shared brand assets; unknown/custom teams keep their original text. */
const brands = [
  { aliases: ['魔域战队'], src: '/images/brands/moyu-team.svg', circle: false, monochrome: true, width: '4.1em' },
  { aliases: ['魔域梦之队'], src: '/images/brands/moyu-dream-team.svg', circle: false, monochrome: true, width: '2.3em' },
  { aliases: ['gan', 'gancube'], src: '/images/brands/gan-color.svg', circle: false },
  { aliases: ['魔域', '魔域文化', 'moyu'], src: '/images/brands/moyu-color.png', circle: false },
  { aliases: ['奇艺', '奇艺魔方', '奇艺魔方格', 'qiyi'], src: '/images/brands/qiyi-color.png', circle: true },
];

export function CubingBrandLabel({ name, logoOnly = false, fallbackToName = false }: { name: string; logoOnly?: boolean; fallbackToName?: boolean }) {
  const brand = brands.find(item => item.aliases.includes(name.trim().toLowerCase()))
    ?? brands.find(item => item.aliases.includes(wcaTeamBrand(name).trim().toLowerCase()));
  return <span className="cubing-brand-label" title={logoOnly && brand ? name : undefined}>
    {brand && (brand.monochrome
      ? <span className="cubing-brand-logo cubing-brand-logo--monochrome" role={logoOnly ? 'img' : undefined} aria-label={logoOnly ? name : undefined} aria-hidden={logoOnly ? undefined : true}
        style={{ maskImage: `url("${brand.src}")`, WebkitMaskImage: `url("${brand.src}")`, width: brand.width }} />
      : <Image className={`cubing-brand-logo${brand.circle ? ' cubing-brand-logo--circle' : ''}`} src={brand.src} alt={logoOnly ? name : ''} width={32} height={32} unoptimized />)}
    {(!logoOnly || (!brand && fallbackToName)) && <span>{name}</span>}
  </span>;
}
