import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let database: Database | undefined;

/** .env.local 에 실제 Firebase 값이 들어갔는지 확인 */
export function isFirebaseConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const url = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!key || !url || !projectId) return false;
  if (key.includes('your_api_key') || key === 'undefined') return false;
  if (url.includes('your_project_id') || url === 'undefined') return false;
  return true;
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase 환경변수가 설정되지 않았습니다. .env.local 을 확인해 주세요.',
    );
  }
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseDatabase(): Database {
  if (database) return database;
  database = getDatabase(getFirebaseApp());
  return database;
}
