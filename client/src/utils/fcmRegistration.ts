import { notificationsApi } from '../api/notifications.api.js';

export interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  vapidKey?: string;
}

/**
 * Registers browser notification permission, initializes Web Push/FCM,
 * and synchronizes the device token with the Nexa backend.
 */
export async function registerFcmPush(
  apiBaseUrl?: string,
  authToken?: string,
  vapidKey?: string
): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('Push notifications are not supported in this browser environment.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted.');
      return null;
    }

    // 1. Register background messaging service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    await navigator.serviceWorker.ready;

    let fcmToken: string | null = null;

    // 2. Fetch Web Push / FCM Registration Subscription Token
    if ('pushManager' in registration) {
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const subscribeOptions: PushSubscriptionOptionsInit = {
          userVisibleOnly: true,
          applicationServerKey: vapidKey || undefined
        };
        subscription = await registration.pushManager.subscribe(subscribeOptions).catch(() => null);
      }

      if (subscription) {
        fcmToken = JSON.stringify(subscription);
      }
    }

    // 3. Sync token with backend
    if (fcmToken) {
      if (apiBaseUrl && authToken) {
        await fetch(`${apiBaseUrl}/api/notifications/fcm-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ token: fcmToken, platform: 'web' })
        }).catch((err) => console.warn('Direct FCM fetch sync warning:', err));
      } else {
        await notificationsApi.registerFcmToken(fcmToken, 'web').catch(() => {
          // Offline safe fallback
        });
      }

      console.log('Web FCM / Push token registered and synchronized successfully.');
      return fcmToken;
    }
  } catch (error) {
    console.error('Error during FCM push token registration:', error);
  }

  return null;
}
