const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")("YOUR_STRIPE_SECRET_KEY");

admin.initializeApp();

exports.createStripeCheckout = functions.https.onCall(async (data, context) => {
    const { priceId, userId } = data;

    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `https://your-app.netlify.app/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `https://your-app.netlify.app/cancel`,
        metadata: { firebaseUID: userId }
    });

    return { url: session.url };
});
