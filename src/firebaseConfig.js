import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { getAuth, connectAuthEmulator } from 'firebase/auth';
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

// Local end-to-end tests only (scripts/e2e): VUE_APP_FIREBASE_EMULATORS=1 at dev-server time points the app at the
// auth + firestore emulators under a demo-* project id, which can never reach production. Never set for real builds.
const EMU = process.env.VUE_APP_FIREBASE_EMULATORS === '1';
if (EMU) firebaseConfig.projectId = 'demo-clingnote';
const app = initializeApp(firebaseConfig);
if (!EMU) { try { getAnalytics(app); } catch (e) { /* analytics is optional */ } }
const db = getFirestore(app);
const auth = getAuth(app);
if (EMU) { connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8085); }
const storage = getStorage(app); // Initialize Storage

export { app, auth, db, storage };
