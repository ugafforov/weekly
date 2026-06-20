import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase project: Weekly (weekly-9dfdc · 892443429193).
 *
 * These values identify the Firebase web app; for web apps the API key is a
 * public/publishable identifier (not a secret) — access is protected by Firebase
 * Security Rules and the project's Authorized Domains, not by hiding this config.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAMZBTPUtLg_-FSdbgkBfVkZ73kG2PkC7M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "weekly-9dfdc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "weekly-9dfdc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "weekly-9dfdc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "892443429193",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:892443429193:web:e189a565655622f050f298",
};

// Reuse the existing app on hot-reload / repeated imports.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
