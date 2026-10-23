import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { isNative } from '@/utils/platform';
import { getStorage } from "firebase/storage"; // Import Firebase Storage

const firebaseConfig = {
    apiKey: "AIzaSyD0aH-KpmPalq4U-WCpt6OXeVuEkgdRo0Y",
    authDomain: "clingnote-463b4.firebaseapp.com",
    projectId: "clingnote-463b4",
    storageBucket: "clingnote-463b4.appspot.com",
    messagingSenderId: "168239327702",
    appId: "1:168239327702:web:ac517dc83e800e19e91c77",
    measurementId: "G-D7G4FQXXT7"
};

const app = initializeApp(firebaseConfig);
if (!isNative()) { try { getAnalytics(app); } catch (e) { /* analytics is optional */ } } // not in the iOS shell: keeps the App Privacy label minimal
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Initialize Storage

export { app, auth, db, storage };
