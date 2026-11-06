import { RegistryPageResponse } from '../../types/registry';

export interface RegistryPageKey {
  search: string;
  group: string;
  pharmGroup: string;
  page: number;
  pageSize: number;
  onlyInWarehouse: boolean;
}

export interface CachedRegistryPage {
  response: RegistryPageResponse;
  cachedAt: number;
}

const PREFIX = 'clinical_registry_page_v1:';
const inMemoryRegistryCache = new Map<string, CachedRegistryPage>();
const MAX_IN_MEMORY_ENTRIES = 120;

export function createRegistryPageCacheKey(key: RegistryPageKey): string {
  return PREFIX + JSON.stringify({
    search: key.search.trim().toLocaleLowerCase(),
    group: key.group,
    pharmGroup: key.pharmGroup,
    page: key.page,
    pageSize: key.pageSize,
    onlyInWarehouse: key.onlyInWarehouse,
  });
}

export function getCachedRegistryPage(key: RegistryPageKey): CachedRegistryPage | null {
  const cacheKey = createRegistryPageCacheKey(key);

  // 1. Tầng 1: In-Memory Cache siêu tốc (0ms, Zero-Latency)
  const memCached = inMemoryRegistryCache.get(cacheKey);
  if (memCached && memCached.response?.items && typeof memCached.cachedAt === 'number') {
    // TTL 10 phút
    if (Date.now() - memCached.cachedAt < 600_000) {
      return memCached;
    }
    inMemoryRegistryCache.delete(cacheKey);
  }

  // 2. Tầng 2: SessionStorage bền vững khi reload
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRegistryPage;
    if (parsed?.response?.items && typeof parsed.cachedAt === 'number') {
      inMemoryRegistryCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveCachedRegistryPage(key: RegistryPageKey, response: RegistryPageResponse): void {
  const cacheKey = createRegistryPageCacheKey(key);
  const entry: CachedRegistryPage = { response, cachedAt: Date.now() };

  // 1. Lưu vào In-Memory Map
  if (inMemoryRegistryCache.size >= MAX_IN_MEMORY_ENTRIES) {
    const oldestKey = inMemoryRegistryCache.keys().next().value;
    if (oldestKey) inMemoryRegistryCache.delete(oldestKey);
  }
  inMemoryRegistryCache.set(cacheKey, entry);

  // 2. Lưu vào SessionStorage với cơ chế chống tràn Quota
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    try {
      // Dọn dẹp các trang cũ trong sessionStorage khi chạm quota
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.slice(0, Math.max(1, keysToRemove.length / 2)).forEach((k) => sessionStorage.removeItem(k));
      sessionStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch {}
  }
}
