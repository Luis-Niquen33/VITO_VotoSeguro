import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAu94pYTRY-5LVCDzMVYaH5vMLkY7EA4Vc",
  authDomain: "votoseguro-1ce0f.firebaseapp.com",
  projectId: "votoseguro-1ce0f",
  storageBucket: "votoseguro-1ce0f.firebasestorage.app",
  messagingSenderId: "1000398352820",
  appId: "1:1000398352820:web:e380fedd20ffe4c7fcc2e1",
  measurementId: "G-72GD2860QT"
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let app = null;
if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}
const db = app ? getFirestore(app) : null;

export { db };
