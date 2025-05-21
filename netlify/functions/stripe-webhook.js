// /.netlify/functions/stripe-webhook.js
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const admin = require('firebase-admin');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json'); // ✅ Explicit path

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event) => {
    const sig = event.headers['stripe-signature'];

    let stripeEvent;
    try {
        const rawBody = Buffer.from(event.body, 'utf8');
        stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err) {
        console.error("❌ Webhook signature verification failed:", err.message);
        return {
            statusCode: 400,
            body: `Webhook Error: ${err.message}`,
        };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const userId = session.metadata.userId;

        try {
            const db = admin.firestore();
            await db.collection('users').doc(userId).set({ hasPaid: true }, { merge: true });
            console.log(`✅ Payment recorded for user ${userId}`);
        } catch (error) {
            console.error("❌ Firestore update failed:", error);
            return { statusCode: 500, body: "Firestore error" };
        }
    }

    return { statusCode: 200, body: "✅ Webhook received" };
};
