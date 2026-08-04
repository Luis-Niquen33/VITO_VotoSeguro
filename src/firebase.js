import { initializeApp, getApps } from "firebase/app";
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

const firebaseConfig = {
  apiKey: VITE_FIREBASE_API_KEY || "AIzaSyAu94pYTRY-5LVCDzMVYaH5vMLkY7EA4Vc",
  authDomain: VITE_FIREBASE_AUTH_DOMAIN || "votoseguro-1ce0f.firebaseapp.com",
  projectId: VITE_FIREBASE_PROJECT_ID || "votoseguro-1ce0f",
  storageBucket: VITE_FIREBASE_STORAGE_BUCKET || "votoseguro-1ce0f.firebasestorage.app",
  messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID || "1000398352820",
  appId: VITE_FIREBASE_APP_ID || "1:1000398352820:web:e380fedd20ffe4c7fcc2e1",
  ...(VITE_FIREBASE_MEASUREMENT_ID ? { measurementId: VITE_FIREBASE_MEASUREMENT_ID } : { measurementId: "G-72GD2860QT" }),
};

const isFirebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let db = null;

if (isFirebaseConfigured) {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db, isFirebaseConfigured };