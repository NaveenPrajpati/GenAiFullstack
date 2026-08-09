const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// androidx.work version alignment (withWorkManagerFix)';

/**
 * Pins every `androidx.work` artifact to a single version.
 *
 * `react-native-android-widget` requires `work-runtime:2.8.1`, while something
 * in the transitive graph still resolves `work-runtime-ktx:2.7.1`. Those two
 * overlap: androidx folded the `-ktx` artifact into `work-runtime` in 2.8.0, so
 * both AARs ship `androidx.work.OneTimeWorkRequestKt` and
 * `androidx.work.PeriodicWorkRequestKt`, and `checkDebugDuplicateClasses` fails
 * the build.
 *
 * Forcing both coordinates to 2.8.1 fixes it without dropping anything — at
 * 2.8.1 `work-runtime-ktx` is an empty artifact that just depends on
 * `work-runtime`, so any Kotlin extension usage still resolves. Excluding the
 * `-ktx` module outright would also work, but would silently break the build
 * again if a dependency ever pins it below 2.8.
 *
 * This exists as a config plugin rather than an `android/` edit because the
 * project is CNG — `android/` is generated and gitignored, so a hand edit there
 * would be erased by the next prebuild.
 */
const withWorkManagerFix = (config) =>
  withAppBuildGradle(config, (config) => {
    // Prebuild can run against an existing android/ directory, so appending
    // unconditionally would stack duplicate blocks.
    if (config.modResults.contents.includes(MARKER)) {
      return config;
    }

    config.modResults.contents += `
${MARKER}
configurations.all {
    resolutionStrategy {
        force 'androidx.work:work-runtime:2.8.1'
        force 'androidx.work:work-runtime-ktx:2.8.1'
    }
}
`;

    return config;
  });

module.exports = withWorkManagerFix;
