/**
 * ShopLedger - Firebase Web SDK v10+ Modular Setup via CDN
 * Connected to project: shopledger-969a4
 * Providers: Email/Password, Google Sign-In, Phone Authentication
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  writeBatch, 
  increment,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

/**
 * Live Firebase Web App Configuration for project: shopledger-969a4
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDlbvAFn0HA5ndhV2uzPr1zDM-8BtD6yHo",
  authDomain: "shopledger-969a4.firebaseapp.com",
  projectId: "shopledger-969a4",
  storageBucket: "shopledger-969a4.firebasestorage.app",
  messagingSenderId: "601892737110",
  appId: "1:601892737110:web:55369a3a354afad0b9ebf7",
  measurementId: "G-SN7WL9LCG7"
};

export const isConfigured = true;

// Primary App & Services
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase Analytics if supported in current browser environment
let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics initialized with measurementId:', firebaseConfig.measurementId);
    }
  }).catch(() => {});
}

export { 
  app, 
  auth, 
  db,
  analytics,
  // Auth primitives
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  // Firestore primitives
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  writeBatch, 
  increment,
  serverTimestamp
};

/**
 * Creates an isolated secondary Firebase app instance
 * Allows Super Admin or Owner to provision new accounts with createUserWithEmailAndPassword
 * without automatically signing out the currently logged-in Super Admin/Owner.
 */
export function getSecondaryAuth() {
  const secondaryAppName = `SecondaryApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  return {
    secondaryApp,
    secondaryAuth: getAuth(secondaryApp)
  };
}
