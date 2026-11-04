import type { AppFontScale } from '../../utils/storage/appStatePersistence';

export function fontScaleToPixels(scale: AppFontScale): number {
  return scale === 'compact' ? 14.5 : scale === 'large' ? 17.5 : 16.0;
}
