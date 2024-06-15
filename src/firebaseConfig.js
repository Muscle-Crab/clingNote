import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app); // Initialize Storage

export { auth, db, storage };
