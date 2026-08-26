import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { logger } from './logger.js';

let firebaseApp: App | null = null;

/**
 * Initializes the Firebase Admin SDK from the minified FIREBASE_SERVICE_ACCOUNT environment variable.
 * Suitable for cloud hosting platforms like Render, Railway, Heroku, or GCP.
 */
export function initializeFirebase(): App | null {
  if (firebaseApp || getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_CREDENTIALS || '';

  if (!rawCredentials) {
    logger.debug('FIREBASE_SERVICE_ACCOUNT is not configured; running in simulated FCM mode.');
    return null;
  }

  try {
    let serviceAccount: ServiceAccount;

    // Handle base64 encoded or raw JSON strings
    if (rawCredentials.trim().startsWith('{')) {
      serviceAccount = JSON.parse(rawCredentials);
    } else {
      const decoded = Buffer.from(rawCredentials, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    }

    firebaseApp = initializeApp({
      credential: cert(serviceAccount)
    });

    logger.info('Firebase Admin SDK initialized successfully.');
    return firebaseApp;
  } catch (error) {
    logger.error({ error }, 'Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable');
    return null;
  }
}

/**
 * Retrieves the initialized Firebase Admin Messaging instance.
 */
export function getFirebaseMessaging(): Messaging | null {
  const app = firebaseApp || initializeFirebase();
  if (app) {
    try {
      return getMessaging(app);
    } catch {
      return null;
    }
  }
  return null;
}
