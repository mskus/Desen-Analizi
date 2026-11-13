import { GuideBarConfig, GuideBarId } from '../types';

export interface SoftYarnSwatch {
  name: string;
  hex: string;
}

export interface SoftYarnPalette {
  id: string;
  name: string;
  description: string;
  colors: Record<GuideBarId, string>;
}

/**
 * Göze yumuşak gelen, koyu ve açık zeminde net okunabilen pastel tekstil iplik renkleri
 */
export const SOFT_YARN_SWATCHES: SoftYarnSwatch[] = [
  { name: 'Pastel Gökyüzü', hex: '#6E9AC8' },
  { name: 'Buz Turkuaz', hex: '#63A6B0' },
  { name: 'Adaçayı Yeşili', hex: '#68A889' },
  { name: 'Zeytin Pastel', hex: '#8FA87E' },
  { name: 'Sıcak Kum', hex: '#CCA06B' },
  { name: 'Şeftali Kil', hex: '#CC8E78' },
  { name: 'Gül Kurusu', hex: '#CC8299' },
  { name: 'Pudra Erik', hex: '#AD86A8' },
  { name: 'Soft Lavanta', hex: '#9888C4' },
  { name: 'Keten Ekru', hex: '#B4BFC9' },
];

export const SOFT_YARN_PALETTES: SoftYarnPalette[] = [
  {
    id: 'natural-pastel',
    name: 'Doğal Pastel',
    description: 'Dengeli ve göz yormayan varsayılan soft tonlar',
    colors: {
      GB1: '#6E9AC8',
      GB2: '#CC8299',
      GB3: '#68A889',
      GB4: '#CCA06B',
      GB5: '#9888C4',
      GB6: '#63A6B0',
    },
  },
  {
    id: 'earth-linen',
    name: 'Toprak & Keten',
    description: 'Doğal halı ve dokuma tonları',
    colors: {
      GB1: '#86A396',
      GB2: '#C49A7E',
      GB3: '#879BB3',
      GB4: '#CBB18A',
      GB5: '#AC92A1',
      GB6: '#789EA3',
    },
  },
  {
    id: 'nordic-soft',
    name: 'İskandinav Soft',
    description: 'Serin, sade ve modern pastel uyum',
    colors: {
      GB1: '#7E9FC2',
      GB2: '#BF919B',
      GB3: '#89AF96',
      GB4: '#C9AF82',
      GB5: '#9397BF',
      GB6: '#80B2B5',
    },
  },
  {
    id: 'warm-silk',
    name: 'Sıcak Tekstil',
    description: 'Yumuşak sıcak bej, pudra ve adaçayı',
    colors: {
      GB1: '#C7968B',
      GB2: '#BFA57E',
      GB3: '#89A897',
      GB4: '#7F99B5',
      GB5: '#AD92AC',
      GB6: '#CCB58F',
    },
  },
];

export const DEFAULT_SOFT_BAR_COLORS: Record<GuideBarId, string> =
  SOFT_YARN_PALETTES[0].colors;

const LEGACY_HARSH_COLORS = new Set([
  '#3b82f6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
]);

export function hasHarshYarnColors(
  guideBars: Record<GuideBarId, GuideBarConfig>
): boolean {
  return (Object.keys(guideBars) as GuideBarId[]).some((id) => {
    const c = guideBars[id]?.color?.toLowerCase();
    return Boolean(c && LEGACY_HARSH_COLORS.has(c));
  });
}
