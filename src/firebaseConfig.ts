import appletConfig from '../firebase-applet-config.json';

export interface FirebaseConfigType {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export const firebaseConfig: FirebaseConfigType = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'zekcek-1531460808376',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    appletConfig.firestoreDatabaseId ||
    'ai-studio-warpknittprozglr-dfe7572d-4164-4e70-9914-c348e244254b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  measurementId: appletConfig.measurementId || '',
  oAuthClientId: appletConfig.oAuthClientId || '',
  recaptchaSiteKey: appletConfig.recaptchaSiteKey || '',
};

export default firebaseConfig;
