const configuredVersion = import.meta.env.VITE_ANDROID_VERSION?.trim();

export const ANDROID_RELEASE = Object.freeze({
  versionName: configuredVersion || 'latest',
  versionLabel: configuredVersion ? `v${configuredVersion}` : 'Latest',
  fileName: 'nexa-social-app.apk',
  downloadUrl: `/nexa-social-app.apk?v=${encodeURIComponent(configuredVersion || 'latest')}`,
  absoluteDownloadUrl: `https://nexa-social-app.surge.sh/nexa-social-app.apk?v=${encodeURIComponent(configuredVersion || 'latest')}`
});
