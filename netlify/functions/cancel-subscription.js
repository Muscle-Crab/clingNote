require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Firebase setup
const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

exports.handler = async (event) => {
    try {
        const { userId } = JSON.parse(event.body);
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return { statusCode: 404, body: "User not found" };
        }

        const { subscriptionId } = userDoc.data();
        if (!subscriptionId) {
            return { statusCode: 400, body: "No subscription ID found" };
        }

        // Cancel the Stripe subscription
        await stripe.subscriptions.del(subscriptionId);

        // Update Firestore
        await db.collection('users').doc(userId).set({ hasPaid: false }, { merge: true });

        return { statusCode: 200, body: "Subscription canceled successfully" };
    } catch (err) {
        console.error("Cancel error:", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
