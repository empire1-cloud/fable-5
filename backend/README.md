# Fable-5 Backend Service

This is the backend service for Fable-5 that handles payment processing and other server-side operations.

## Architecture

The backend follows a backend-for-frontend (BFF) pattern where:
- Frontend handles UI/UX and makes API calls to this backend
- Backend handles sensitive operations like payment processing with Stripe
- No sensitive keys are exposed to the frontend

## Endpoints

### Health Check
```
GET /api/health
```
Returns server status and timestamp.

### Payment Processing
```
POST /api/payments/checkout-session
```
Creates a Stripe Checkout Session for subscription plans.

**Request Body:**
```json
{
  "planType": "free" | "pro" | "enterprise"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```
PORT=3001
NODE_ENV=development
STRIPE_SECRET_KEY=your_stripe_secret_key_here
API_BASE_URL=http://localhost:3001
```

For production, also set:
```
STRIPE_PRICE_PRO=price_actual_pro_id_from_stripe
STRIPE_PRICE_ENTERPRISE=price_actual_enterprise_id_from_stripe
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development mode (with auto-rebuild and restart)
npm run dev

# Start production server
npm start
```

## Security Notes

- Stripe secret key is only accessible to the backend
- All payment processing happens server-side
- Frontend only receives a checkout session URL for redirection
- No sensitive data is exposed in frontend bundles

## Integration with Fable-5 Frontend

The frontend (`app/src/lib/api.ts`) is already configured to call:
```typescript
export const api = {
  payments: {
    // ... other methods
    createCheckoutSession: (planType: string) => 
      request<{ url: string }>("POST", "/api/payments/checkout-session", { planType }),
  },
  // ... 
};
```

Make sure to set `VITE_API_BASE` in the frontend `.env` to point to this backend.