require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY) // Replace with your Stripe test key

exports.handler = async (event) => {
    try {
        const { userId } = JSON.parse(event.body);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'AI Routine Access',
                        },
                        unit_amount: 200, // $5.00
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                userId, // <--- Store for webhook access
            },
            success_url: 'https://clingnote.netlify.app/payment-success?userId=' + userId,
            cancel_url: 'https://clingnote.netlify.app/payment-cancelled',
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

