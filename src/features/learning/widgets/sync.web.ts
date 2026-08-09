/**
 * Web has no home screen widget, so syncing is a no-op.
 *
 * Named `sync.web.ts` rather than a plain `sync.ts` deliberately. In this
 * project's Metro setup an extension-less `sync.ts` *outranks* its
 * `sync.ios.tsx` / `sync.android.tsx` siblings, so a plain fallback silently
 * wins on every platform and disables the widget everywhere — with no error,
 * because a no-op is a perfectly valid module. Keeping the fallback
 * platform-scoped means nothing can shadow the real implementations.
 */
import type { Digest } from '../types';

export function syncDigestWidget(_digests: Digest[]): void {
  // No widget surface here.
}
