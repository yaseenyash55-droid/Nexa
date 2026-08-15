import { Capacitor } from '@capacitor/core';

export interface LiveUpdatesConfigOptions {
  channel?: string;
  appId?: string;
  autoUpdateMethod?: 'background' | 'none';
  maxVersions?: number;
}

export async function setLiveUpdatesConfig(options: LiveUpdatesConfigOptions) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const LiveUpdates = await import('@capacitor/live-updates');
    if (typeof (LiveUpdates as any).setConfig === 'function') {
      await (LiveUpdates as any).setConfig(options);
    }
  } catch (err) {
    console.warn('LiveUpdates.setConfig skipped or not supported:', err);
  }
}

export async function syncUserLiveUpdates(user: any) {
  if (!Capacitor.isNativePlatform() || !user) return null;
  try {
    const LiveUpdates = await import('@capacitor/live-updates');
    
    const channel = user.channel || (user.role === 'admin' ? 'Beta' : 'Production');
    const maxVersions = user.maxVersions || 2;

    if (typeof (LiveUpdates as any).setConfig === 'function') {
      await (LiveUpdates as any).setConfig({ channel, maxVersions });
    }

    const result = await LiveUpdates.sync();
    localStorage.setItem('shouldReloadApp', String(result.activeApplicationPathChanged));
    return result;
  } catch (err) {
    console.warn('syncUserLiveUpdates skipped or unavailable:', err);
    return null;
  }
}

export async function initializeLiveUpdates(configOptions?: LiveUpdatesConfigOptions) {
  // Only execute on native Capacitor platforms (iOS / Android)
  if (!Capacitor.isNativePlatform()) return;

  try {
    const LiveUpdates = await import('@capacitor/live-updates');
    const { App } = await import('@capacitor/app');

    if (configOptions && typeof (LiveUpdates as any).setConfig === 'function') {
      await (LiveUpdates as any).setConfig(configOptions);
    }
    
    let SplashScreen: any = null;
    try {
      SplashScreen = (await import('@capacitor/splash-screen')).SplashScreen;
    } catch {
      // Fallback if plugin is unlinked
    }

    // Register event to fire each time user resumes the app  
    App.addListener('resume', async () => {
      if (
        localStorage.getItem('shouldReloadApp') === 'true' &&
        localStorage.getItem('shouldBlockReload') !== 'true'
      ) {
        await LiveUpdates.reload();
      } else {
        const result = await LiveUpdates.sync();
        localStorage.setItem('shouldReloadApp', String(result.activeApplicationPathChanged));
        if (!result.activeApplicationPathChanged && SplashScreen) {
          await SplashScreen.hide();
        }
      }
    });

    // First sync on app load
    if (
      localStorage.getItem('shouldReloadApp') === 'true' &&
      localStorage.getItem('shouldBlockReload') !== 'true'
    ) {
      await LiveUpdates.reload();
    } else {
      const result = await LiveUpdates.sync();
      localStorage.setItem('shouldReloadApp', String(result.activeApplicationPathChanged));
      if (result.activeApplicationPathChanged) {
        await LiveUpdates.reload();
      } else if (SplashScreen) {
        await SplashScreen.hide();
      }
    }
  } catch (err) {
    console.warn('Capacitor LiveUpdates sync skipped or not installed in current environment:', err);
  }
}
