import type { FeatureFlagResponse } from '../types/admin';

export function rebaseFeatureFlagDraft(
  base: FeatureFlagResponse,
  draft: FeatureFlagResponse,
  latest: FeatureFlagResponse,
): FeatureFlagResponse {
  const desiredByKey = new Map(
    draft.flags
      .filter((flag) => base.flags.find((original) => original.key === flag.key)?.enabled !== flag.enabled)
      .map((flag) => [flag.key, flag.enabled]),
  );
  return {
    ...latest,
    flags: latest.flags.map((flag) => ({
      ...flag,
      enabled: flag.key === 'overview' ? true : (desiredByKey.get(flag.key) ?? flag.enabled),
    })),
  };
}
