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
  try {
    const raw = sessionStorage.getItem(createRegistryPageCacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRegistryPage;
    return parsed?.response?.items && typeof parsed.cachedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedRegistryPage(key: RegistryPageKey, response: RegistryPageResponse): void {
  try {
    const cacheKey = createRegistryPageCacheKey(key);
    sessionStorage.setItem(cacheKey, JSON.stringify({ response, cachedAt: Date.now() } satisfies CachedRegistryPage));
  } catch {}
}
