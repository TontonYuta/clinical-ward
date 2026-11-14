/** Return the first image file available in a clipboard DataTransferItemList. */
export function getClipboardImageFile(items: DataTransferItemList): File | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item?.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}
