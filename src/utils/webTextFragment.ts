/**
 * Build a W3C Scroll-To-Text Fragment URL (#:~:text=...) from a web citation snippet/excerpt
 * so modern browsers scroll directly to and highlight the extracted passage.
 */
export function buildTextFragmentUrl(rawUrl?: string | null, excerpt?: string): string {
  if (!rawUrl) return '';
  const baseUrl = rawUrl.split('#')[0];
  if (!excerpt) return rawUrl;

  const segments = excerpt
    .split(/\.{2,}|…|\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 18);
  const candidate = (segments[0] || excerpt.replace(/\s+/g, ' ').trim()).replace(/[.,;:!?]+$/, '');
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 3) return rawUrl;

  if (words.length <= 8) {
    return `${baseUrl}#:~:text=${encodeURIComponent(words.join(' '))}`;
  }
  const textStart = words.slice(0, 4).join(' ');
  const textEnd = words.slice(-3).join(' ');
  return `${baseUrl}#:~:text=${encodeURIComponent(textStart)},${encodeURIComponent(textEnd)}`;
}
