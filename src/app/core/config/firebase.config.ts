import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBgq57IKhHsOG_4kAL3zhufM4_jC4b4lYY",
  authDomain: "expense-tracker-4d264.firebaseapp.com",
  projectId: "expense-tracker-4d264",
  storageBucket: "expense-tracker-4d264.firebasestorage.app",
  messagingSenderId: "136666664235",
  appId: "1:136666664235:web:9cbddb8eab9782b491096e",
  measurementId: "G-8W1P9M670J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app; 