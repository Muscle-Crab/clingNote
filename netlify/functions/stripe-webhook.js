require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const crypto = require('crypto');

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ✅ Decode Firebase key from base64
const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

// ✅ Initialize Firebase safely
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

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

    // ✅ Handle successful one-time payment
    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const userId = session.metadata.userId;
        const creditsToAdd = parseInt(session.metadata.credits || 25); // default to 10 credits if not passed

        try {
            const db = admin.firestore();
            const userRef = db.collection('users').doc(userId);

            await db.runTransaction(async (t) => {
                const userDoc = await t.get(userRef);
                const currentCredits = userDoc.exists ? (userDoc.data().credits || 0) : 0;

                t.set(userRef, {
                    credits: currentCredits + creditsToAdd,
                    hasPaid: true, // ✅ Mark user as paid
                }, { merge: true });
            });


            console.log(`✅ Added ${creditsToAdd} credits for user ${userId}`);
        } catch (error) {
            console.error("❌ Firestore update failed:", error);
            return { statusCode: 500, body: "Firestore error" };
        }
    }

    return { statusCode: 200, body: "✅ Webhook received" };
};
