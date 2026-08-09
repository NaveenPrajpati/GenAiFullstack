/**
 * Fallback for platforms with no home screen widget — web, and anything else
 * Metro resolves here rather than to `sync.ios.tsx` / `sync.android.tsx`.
 *
 * Its only job is to let callers import `syncDigestWidget` unconditionally, so
 * the store never has to branch on platform.
 */
import type { Digest } from '../types';

export function syncDigestWidget(_digests: Digest[]): void {
  // No widget surface here.
}
