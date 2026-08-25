/* eslint-disable no-undef */
// Nexa Firebase Cloud Messaging (FCM) & Web Push Service Worker

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Handle incoming high-priority FCM / Web Push messages in the background
 */
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    payload = {
      data: {
        body: event.data ? event.data.text() : 'You have a new update on Nexa.'
      }
    };
  }

  // Extract FCM data payload fields
  const data = payload.data || payload;
  const isCallInvite = data.type === 'CALL_INVITE' ||
    data.destination === 'CALL' ||
    data.destination === 'CALL_INVITE' ||
    Boolean(data.callId || data.roomId);

  if (isCallInvite && (data.callId || data.roomId)) {
    const callId = data.callId || data.roomId;
    const callerId = data.callerId || data.userId || '0';
    const callerName = data.callerName || data.callerUsername || 'A Nexa user';
    const callType = data.callType === 'video' ? 'video' : 'audio';

    const callTitle = `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`;
    const callBody = `${callerName} is calling you on Nexa...`;

    const notificationOptions = {
      body: callBody,
      icon: '/dr_doom_orb_logo.svg',
      badge: '/favicon.svg',
      tag: `nexa-call-${callId}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [300, 200, 300, 200, 500, 200, 500],
      data: {
        type: 'CALL_INVITE',
        callId,
        roomId: callId,
        callerId,
        callerName,
        callType,
        url: `/messages?callId=${encodeURIComponent(callId)}&targetId=${encodeURIComponent(callerId)}&callType=${encodeURIComponent(callType)}&action=accept`
      },
      actions: [
        {
          action: 'accept',
          title: 'Accept 📞'
        },
        {
          action: 'decline',
          title: 'Decline ✕'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(callTitle, notificationOptions)
    );
    return;
  }

  // Handle standard push notifications
  const title = payload.notification?.title || data.title || 'Nexa Social';
  const body = payload.notification?.body || data.body || data.message || 'You have a new notification.';
  const destination = data.destination || data.type || 'HOME';
  const resourceId = data.resourceId || data.postId || data.userId || '';

  const standardOptions = {
    body,
    icon: '/dr_doom_orb_logo.svg',
    badge: '/favicon.svg',
    tag: `nexa-notif-${data.id || Date.now()}`,
    data: {
      destination,
      resourceId,
      url: destination === 'CHAT' || destination === 'MESSAGES' ? '/messages' : '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, standardOptions)
  );
});

/**
 * Handle interactive Web Push notification action buttons and clicks
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action; // 'accept', 'decline', or empty (clicked body)
  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Broadcast call action event to existing active client window
      const isCallAction = data.type === 'CALL_INVITE' || Boolean(data.callId);

      for (const client of clientList) {
        if ('focus' in client) {
          if (isCallAction) {
            client.postMessage({
              type: 'NEXA_CALL_PUSH_ACTION',
              action: action === 'decline' ? 'decline' : 'accept',
              callId: data.callId,
              callerId: data.callerId,
              callerName: data.callerName,
              callType: data.callType
            });
          }

          if (action !== 'decline') {
            return client.focus();
          } else {
            return;
          }
        }
      }

      // If no open client exists and user didn't decline, open a new window
      if (action !== 'decline' && self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  if (data.type === 'CALL_INVITE' && data.callId) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'NEXA_CALL_PUSH_ACTION',
          action: 'dismissed',
          callId: data.callId
        });
      }
    });
  }
});
