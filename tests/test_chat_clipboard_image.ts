import { getClipboardImageFile } from '../src/utils/clipboardImage';

const image = new File([new Uint8Array([1, 2, 3])], 'clipboard-image.png', { type: 'image/png' });
const item = { kind: 'file', type: 'image/png', getAsFile: () => image } as DataTransferItem;
const items = [item] as unknown as DataTransferItemList;
const pasted = getClipboardImageFile(items);
if (!pasted) throw new Error('Clipboard image should be converted to a file attachment');
if (pasted.type !== 'image/png') throw new Error('Clipboard image MIME type must be preserved');
if (getClipboardImageFile([] as unknown as DataTransferItemList)) throw new Error('Text-only clipboard should not produce an image');
console.log('Chat clipboard image checks passed');
