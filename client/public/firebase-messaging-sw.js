/* eslint-disable no-undef */
// Nexa Firebase Cloud Messaging (FCM) & Web Push Service Worker

// Optional Firebase compat libraries if configured with full web SDK
try {
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
} catch {
  // Service worker runs in native standards mode if external scripts are unreachable
}

if (typeof firebase !== 'undefined' && firebase.apps && !firebase.apps.length) {
  try {
    const config = self.__FIREBASE_CONFIG__;
    if (config) {
      firebase.initializeApp(config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        handleCallNotification(payload.data || payload);
      });
    }
  } catch (err) {
    console.warn('[FCM SW] Optional Firebase compat init skipped:', err);
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function handleCallNotification(data) {
  const callId = data.callId || data.roomId;
  const callerId = data.callerId || data.userId || '0';
  const callerName = data.callerName || data.callerUsername || 'Someone';
  const callType = data.callType === 'video' ? 'video' : 'audio';

  const callTitle = `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`;
  const callBody = `${callerName} is calling you on Nexa...`;

  const notificationOptions = {
    body: callBody,
    icon: '/dr_doom_orb_logo.svg',
    badge: '/favicon.svg',
    tag: `nexa-call-${callId}`,
    renotify: true,
    requireInteraction: true, // Keeps notification visible until acted upon
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
        action: 'answer',
        title: 'Answer Call 📞'
      },
      {
        action: 'decline',
        title: 'Decline ✕'
      }
    ]
  };

  return self.registration.showNotification(callTitle, notificationOptions);
}

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
    data.type === 'INCOMING_CALL' ||
    data.destination === 'CALL' ||
    data.destination === 'CALL_INVITE' ||
    Boolean(data.callId || data.roomId);

  if (isCallInvite && (data.callId || data.roomId)) {
    event.waitUntil(handleCallNotification(data));
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
  const action = event.action; // 'answer', 'accept', 'decline', or empty (clicked body)
  const isDecline = action === 'decline';
  const targetUrl = data.url || (data.roomId ? `/messages?callId=${data.roomId}&action=accept` : '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Broadcast call action event to existing active client window
      const isCallAction = data.type === 'CALL_INVITE' || Boolean(data.callId || data.roomId);

      for (const client of clientList) {
        if ('focus' in client) {
          if (isCallAction) {
            client.postMessage({
              type: 'NEXA_CALL_PUSH_ACTION',
              action: isDecline ? 'decline' : 'accept',
              callId: data.callId || data.roomId,
              callerId: data.callerId,
              callerName: data.callerName,
              callType: data.callType
            });
          }

          if (!isDecline) {
            if ('navigate' in client && targetUrl) {
              client.navigate(targetUrl);
            }
            return client.focus();
          } else {
            return;
          }
        }
      }

      // If no open client exists and user didn't decline, open a new window
      if (!isDecline && self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  if (data.type === 'CALL_INVITE' && (data.callId || data.roomId)) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'NEXA_CALL_PUSH_ACTION',
          action: 'dismissed',
          callId: data.callId || data.roomId
        });
      }
    });
  }
});
