import { Capacitor } from '@capacitor/core';

export async function initializeLiveUpdates() {
  // Only execute on native Capacitor platforms (iOS / Android)
  if (!Capacitor.isNativePlatform()) return;

  try {
    const LiveUpdates = await import('@capacitor/live-updates');
    const { App } = await import('@capacitor/app');

    // Register event to fire each time user resumes the app  
    App.addListener('resume', async () => {
      if (localStorage.getItem('shouldReloadApp') === 'true') {
        await LiveUpdates.reload();
      } else {
        const result = await LiveUpdates.sync();
        localStorage.setItem('shouldReloadApp', String(result.activeApplicationPathChanged));
      }
    });

    // First sync on app load
    const result = await LiveUpdates.sync();
    localStorage.setItem('shouldReloadApp', String(result.activeApplicationPathChanged));
  } catch (err) {
    console.warn('Capacitor LiveUpdates sync skipped or not installed in current environment:', err);
  }
}
