require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    try {
        const { userId } = JSON.parse(event.body);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription', // Monthly subscription
            line_items: [
                {
                    price: 'price_1RYKpGF1Lys3ABJJGNeprBeX', // ✅ Your recurring price
                    quantity: 1,
                },
            ],
            metadata: {
                userId,
            },
            success_url: 'http://localhost:8080/payment-success?userId=' + userId,
            cancel_url: 'http://localhost:8080/payment-cancelled',
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ url: session.url }),
        };
    } catch (err) {
        console.error("Stripe error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
