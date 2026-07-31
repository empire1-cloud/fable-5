import express, { Request, Response } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create checkout session endpoint
app.post('/api/payments/checkout-session', async (req: Request, res: Response) => {
  try {
    const { planType } = req.body;

    // Validate input
    if (!planType) {
      return res.status(400).json({ error: 'planType is required' });
    }

    // Map internal plan types to Stripe Price IDs
    // In production, these would come from your Stripe dashboard
    const priceMap: Record<string, string> = {
      free: 'price_123_free', // This would be a free tier price ID
      pro: process.env.STRIPE_PRICE_PRO || 'price_123_pro',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_123_enterprise',
    };

    const priceId = priceMap[planType];

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.API_BASE_URL || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.API_BASE_URL || 'http://localhost:5173'}/billing/cancel`,
      // Optional: Add customer email or other metadata
      metadata: {
        plan_type: planType,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;