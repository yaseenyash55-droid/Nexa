import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerFcmPush } from '../fcmRegistration.js';
import { notificationsApi } from '../../api/notifications.api.js';

describe('Web FCM Push Token Registration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null if notification permission is denied', async () => {
    (global as any).Notification = {
      requestPermission: vi.fn().mockResolvedValue('denied')
    };

    const token = await registerFcmPush('http://localhost:4000', 'test-token');
    expect(token).toBeNull();
  });

  it('registers service worker and syncs token when permission is granted', async () => {
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/fake-sub-token',
      keys: { p256dh: 'key1', auth: 'auth1' }
    };

    (global as any).Notification = {
      requestPermission: vi.fn().mockResolvedValue('granted')
    };

    const mockRegister = vi.fn().mockResolvedValue({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(mockSubscription),
        subscribe: vi.fn()
      }
    });

    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: mockRegister,
        ready: Promise.resolve()
      },
      writable: true,
      configurable: true
    });

    const apiSpy = vi.spyOn(notificationsApi, 'registerFcmToken').mockResolvedValue(undefined as any);

    const token = await registerFcmPush();
    expect(token).toBe(JSON.stringify(mockSubscription));
    expect(apiSpy).toHaveBeenCalledWith(JSON.stringify(mockSubscription), 'web');
  });
});
