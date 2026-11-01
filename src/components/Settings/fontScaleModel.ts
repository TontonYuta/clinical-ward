import type { AppFontScale } from '../../utils/storage/appStatePersistence';

export function fontScaleToPixels(scale: AppFontScale): number {
  return scale === 'compact' ? 18.2 : scale === 'large' ? 23.4 : 20.8;
}
