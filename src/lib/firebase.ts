import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase project: Weekly (weekly-9dfdc · 892443429193).
 *
 * Qiymatlar faqat muhit o'zgaruvchilaridan (VITE_FIREBASE_*) o'qiladi.
 * Production uchun Vercel → Project Settings → Environment Variables
 * bo'limiga barcha VITE_FIREBASE_* qiymatlarini qo'shing.
 *
 * Bu qiymatlar web uchun public/publishable — Firebase Security Rules
 * va Authorized Domains orqali himoyalanadi, yashirish orqali emas.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Reuse the existing app on hot-reload / repeated imports.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
