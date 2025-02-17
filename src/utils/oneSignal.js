import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { arrayUnion } from "firebase/firestore";

const db = getFirestore();
const auth = getAuth();

export const storePlayerId = async (playerId) => {
    if (!playerId) {
        console.error("Player ID is undefined, skipping storage.");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        console.error("No authenticated user found.");
        return;
    }

    const userRef = doc(db, "users", user.uid);

    try {
        await setDoc(userRef, { playerIds: arrayUnion(playerId) }, { merge: true });
        console.log("Player ID stored:", playerId);
    } catch (error) {
        console.error("Error storing Player ID:", error);
    }
};
