import type { AppFontScale } from '../../utils/storage/appStatePersistence';

export function fontScaleToPixels(scale: AppFontScale): number {
  return scale === 'compact' ? 14 : scale === 'large' ? 18 : 16;
}
