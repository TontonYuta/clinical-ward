import type { AppFontScale, LegacyFontScale } from '../../utils/storage/appStatePersistence';

export function fontScaleToPixels(scale: AppFontScale): number {
  if (typeof scale === 'number') return Math.min(24, Math.max(12, scale));
  const legacy: Record<LegacyFontScale, number> = { compact: 14.5, standard: 16, large: 17.5 };
  return legacy[scale];
}
