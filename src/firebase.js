import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Read Vite env vars (in dev from .env, in CI from GitHub Actions secrets)
const {
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_MEASUREMENT_ID
} = import.meta.env;

const isFirebaseConfigured = !!VITE_FIREBASE_API_KEY && !!VITE_FIREBASE_PROJECT_ID;

let db = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db, isFirebaseConfigured };