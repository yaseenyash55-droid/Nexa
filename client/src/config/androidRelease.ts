const configuredVersion = import.meta.env.VITE_ANDROID_VERSION?.trim();

export const ANDROID_RELEASE = Object.freeze({
  versionName: configuredVersion || '1.0.0',
  versionLabel: configuredVersion ? `v${configuredVersion}` : 'v1.0.0',
  fileName: 'app-release.apk',
  fileSize: '54.3 MB',
  releaseDate: 'August 2026',
  // Primary Direct Download from GitHub Releases
  downloadUrl: 'https://github.com/yaseenyash55-droid/Nexa/releases/download/v1.0.0/app-release.apk',
  // Direct Raw Master Repository Download Link
  githubRawUrl: 'https://github.com/yaseenyash55-droid/Nexa/raw/main/android/app/build/outputs/apk/release/app-release.apk',
  // Latest Release Landing Page
  githubReleaseUrl: 'https://github.com/yaseenyash55-droid/Nexa/releases/tag/v1.0.0',
  // Web Client Navigation Route
  downloadPageRoute: '/download',
  absoluteDownloadUrl: 'https://github.com/yaseenyash55-droid/Nexa/releases/download/v1.0.0/app-release.apk'
});
