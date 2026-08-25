import { notificationsApi } from '../api/notifications.api.js';

export interface CallPushActionEvent {
  type: 'NEXA_CALL_PUSH_ACTION';
  action: 'accept' | 'decline' | 'dismissed';
  callId: string;
  callerId?: string | number;
  callerName?: string;
  callType?: 'video' | 'audio';
}

type CallActionListener = (event: CallPushActionEvent) => void;

class WebFcmService {
  private isRegistered = false;
  private callActionListeners: Set<CallActionListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (data?.type === 'NEXA_CALL_PUSH_ACTION') {
          this.callActionListeners.forEach((listener) => {
            try {
              listener(data);
            } catch (err) {
              console.error('Error in call action listener', err);
            }
          });
        }
      });
    }
  }

  /**
   * Registers the background service worker for Web Push & FCM
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      this.isRegistered = true;
      return registration;
    } catch (error) {
      console.warn('Failed to register Firebase messaging service worker:', error);
      return null;
    }
  }

  /**
   * Requests browser notification permission and syncs the web push token with Nexa backend
   */
  public async requestPermissionAndSyncToken(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const registration = await this.registerServiceWorker();
      if (!registration) return false;

      // Subscribe to PushManager if supported
      if ('pushManager' in registration) {
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // If a public VAPID key is configured, applicationServerKey can be used; otherwise subscribe
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: undefined
          }).catch(() => null);
        }

        if (subscription) {
          const rawToken = JSON.stringify(subscription);
          // Register subscription token with backend
          await notificationsApi.registerFcmToken(rawToken, 'web').catch(() => {
            // Ignore if offline
          });
        }
      }

      return true;
    } catch (err) {
      console.warn('Failed to initialize web push notification token:', err);
      return false;
    }
  }

  /**
   * Subscribes to incoming call push notification actions (Accept / Decline)
   */
  public onCallAction(listener: CallActionListener): () => void {
    this.callActionListeners.add(listener);
    return () => {
      this.callActionListeners.delete(listener);
    };
  }
}

export const webFcmService = new WebFcmService();
