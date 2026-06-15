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
  apiKey: "AIzaSyAMZBTPUtLg_-FSdbgkBfVkZ73kG2PkC7M",
  authDomain: "weekly-9dfdc.firebaseapp.com",
  projectId: "weekly-9dfdc",
  storageBucket: "weekly-9dfdc.firebasestorage.app",
  messagingSenderId: "892443429193",
  appId: "1:892443429193:web:e189a565655622f050f298",
};

// Reuse the existing app on hot-reload / repeated imports.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
