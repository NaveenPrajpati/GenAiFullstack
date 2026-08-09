/**
 * The type surface for the platform-specific widget sync.
 *
 * Metro selects `sync.ios.tsx`, `sync.android.tsx` or `sync.web.ts` by platform
 * extension, but TypeScript does not follow that convention and cannot resolve
 * `./widgets/sync` on its own.
 *
 * This is a `.d.ts` rather than a plain `sync.ts` on purpose: Metro resolves a
 * request for `sync` against `sync.ts`, never `sync.d.ts`, so this file cannot
 * shadow the real implementations. An earlier plain `sync.ts` did exactly that
 * — it outranked every platform sibling and silently turned the widget into a
 * no-op on all platforms, with no error, because a no-op still type-checks.
 */
import type { Digest } from '../types';

export declare function syncDigestWidget(digests: Digest[]): void;
