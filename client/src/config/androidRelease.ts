const configuredVersion = import.meta.env.VITE_ANDROID_VERSION?.trim();

export const ANDROID_RELEASE = Object.freeze({
  versionName: configuredVersion || '1.0.0',
  versionLabel: configuredVersion ? `v${configuredVersion}` : 'v1.0.0',
  fileName: 'nexa-social-app.apk',
  fileSize: '54.5 MB',
  releaseDate: 'August 2026',
  // Direct Download directly from this Web App (No GitHub redirection)
  downloadUrl: '/nexa-social-app.apk',
  directAppReleaseUrl: '/app-release.apk',
  // Absolute Direct Download URL
  absoluteDownloadUrl: 'https://nexa-social-app.surge.sh/nexa-social-app.apk',
  // Web Client Navigation Route
  downloadPageRoute: '/download',
  // Secondary Mirror
  githubReleaseUrl: 'https://github.com/yaseenyash55-droid/Nexa/releases/tag/v1.0.0'
});
