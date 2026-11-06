import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom Database ID (MANDATORY in AI Studio) and auto long-polling for iframe stability
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

// Firestore Error Handling Standard as per Firebase Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
}

// Test Connection at initial boot with fallback to prevent backend reachability timeout errors
export async function testConnection() {
  try {
    // Race with a 3-second timeout so app boot is never blocked or throws network warnings
    const connectionCheck = getDocFromServer(doc(db, 'test', 'connection'));
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout')), 3000)
    );
    await Promise.race([connectionCheck, timeout]);
  } catch (error) {
    // Quietly handle connection delay / offline state
    if (error instanceof Error && (error.message.includes('client is offline') || error.message.includes('timeout') || error.message.includes('reach Cloud Firestore'))) {
      console.info('Firestore çevrimdışı/beklemede çalışıyor.');
    }
  }
}

testConnection();
