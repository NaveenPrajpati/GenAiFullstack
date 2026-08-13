const fs = require('fs');
const path = require('path');

/**
 * Dynamic layer over `app.json`. Expo reads the static config first and passes
 * it in as `config`, so everything not named below stays exactly as written
 * there — this file only overrides the identity of the app.
 *
 * Why: a phone carrying the dev client, an internal preview, and the store build
 * otherwise shows three identical icons labelled "ai-app". The name is what you
 * read; the id is what actually lets the three coexist, since same-id builds
 * replace each other on install rather than sitting side by side.
 *
 * `APP_VARIANT` is set per profile in eas.json; `EAS_BUILD_PROFILE` (which EAS
 * sets on its own) backs it up so a build is still labelled if that env block
 * goes missing. Neither is set for a local `expo start`, which is why the
 * fallback is production's identity rather than a variant's.
 *
 * `scheme` varies too, and has to: it is claimed per-install, not per-id, so
 * three apps declaring `aiapps://` leave Android free to hand a widget tap to
 * whichever of them it decides owns the scheme. The deep link is read back off
 * this config at runtime (features/learning/widgets/deepLink.ts) rather than
 * hardcoded, so the two can't drift.
 */
const VARIANTS = {
  development: { name: 'ai-app(d)', id: 'com.aiapps.dev', scheme: 'aiapps.dev' },
  preview: { name: 'ai-app(p)', id: 'com.aiapps.preview', scheme: 'aiapps.preview' },
  // production: { name: 'ai-app', id: 'com.aiapps', scheme: 'aiapps' },
};

/**
 * The Google Services Gradle plugin aborts with "No matching client found for
 * package name" when google-services.json holds no client for the variant's
 * package — roughly ten minutes into a remote build. Saying it here costs a
 * second instead.
 *
 * A warning rather than a throw: iOS never reads this file, and an iOS build of
 * the same variant is perfectly valid while Firebase is still missing the entry.
 */
function warnIfUnregistered(config, id, projectRoot) {
  const file = config.android?.googleServicesFile;
  if (!file) return;

  let packages;
  try {
    const json = JSON.parse(fs.readFileSync(path.resolve(projectRoot, file), 'utf8'));
    packages = (json.client ?? []).map((c) => c.client_info?.android_client_info?.package_name);
  } catch {
    return; // Missing or unreadable is its own problem, and not this file's to report.
  }

  if (!packages.includes(id)) {
    console.warn(
      `\n⚠️  ${path.basename(file)} has no client for "${id}" — it registers ${packages.join(', ')}.\n` +
        `   Add the package in the Firebase console, re-download the file, and the Android build will\n` +
        `   fail until you do. One file can hold all three clients.\n`
    );
  }
}

module.exports = ({ config, projectRoot }) => {
  const variant = VARIANTS[process.env.APP_VARIANT ?? process.env.EAS_BUILD_PROFILE];
  if (!variant) return config;

  warnIfUnregistered(config, variant.id, projectRoot);

  return {
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    ios: { ...config.ios, bundleIdentifier: variant.id },
    android: { ...config.android, package: variant.id },
  };
};
