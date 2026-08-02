# Fable-5 Backend Service

This is the backend service for Fable-5 that handles payment processing and other server-side operations.

## Architecture

The backend follows a backend-for-frontend (BFF) pattern where:
- Frontend handles UI/UX and makes API calls to this backend
- Backend handles sensitive operations like payment processing with Stripe
- No sensitive keys are exposed to the frontend

## Features

- **Tenant Isolation**: Each tenant's data is isolated via Row Level Security (RLS)
- **Idempotent Payments**: Checkout requests require an idempotency key to prevent duplicate charges
- **Secure Webhook Processing**: 
  - Raw events are stored immutably before processing
  - Tenant context is resolved from webhook metadata or customer lookup
  - Processing occurs in a transaction with tenant-level RLS
  - Out-of-event-order protection for subscription lifecycle events
  - Idempotent webhook handling (duplicate events are ignored)
- **Evidence-Driven**: Every Stripe event becomes an evidence record flowing through the Fable-5 Evidence State Machine
- **Explicit Entitlements**: Access rights are stored in an entitlements table rather than inferred from state

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
  "planType": "free" | "pro" | "enterprise",
  "idempotencyKey": "string (unique per request)",
  "tenantId": "string (optional, will be overridden by auth header)"
}
```
**Important:** The `tenantId` in the request body is ignored if it conflicts with the authenticated tenant from the `X-Tenant-Id` header. The header takes precedence.

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

### Stripe Webhook
```
POST /api/payments/webhook
```
Endpoint for receiving Stripe webhooks. Must be configured in your Stripe Dashboard.

**Requirements:**
- Set the `STRIPE_WEBHOOK_SECRET` environment variable to the secret from your webhook endpoint
- The endpoint must be set to receive `application/json` and use the raw body for signature verification

### Evidence Retrieval
```
GET /api/evidence/billing
```
Get all Stripe-related evidence records (for debugging/admin).

```
GET /api/evidence/billing/:id
```
Get a specific evidence record by ID.

### Statistics
```
GET /api/billing/stats
```
Get billing statistics including event counts, state breakdown, and success rates.

## Environment Variables

Create a `.env` file based on `.env.example`:

```
PORT=3001
NODE_ENV=development
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=fable5
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
STRIPE_PRICE_FREE=price_123_free
STRIPE_PRICE_PRO=price_123_pro
STRIPE_PRICE_ENTERPRISE=price_123_enterprise
API_BASE_URL=http://localhost:3001
```

## Security Notes

- Stripe secret key is only accessible to the backend
- All payment processing happens server-side
- Frontend only receives a checkout session URL for redirection
- No sensitive data is exposed in frontend bundles
- Tenant enforcement:
  - Requests must include `X-Tenant-Id` header with a valid UUID
  - The header value is validated and used to set PostgreSQL row-level security
  - Optional `tenantId` in request body is ignored if it conflicts with the header
- Webhook security:
  - Signature verification using Stripe webhook secret
  - Raw event storage before processing to ensure auditability
  - Tenant resolution from metadata or customer lookup
  - Quarantining of events that cannot be tied to a tenant

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

## Testing the Idempotency

To test idempotency, make two requests to `/api/payments/checkout-session` with:
- Same `planType`
- Same `idempotencyKey`
- Same `X-Tenant-Id` header

The second request will return the same checkout session URL as the first, and only one Stripe session will be created.

## Testing Tenant Isolation

1. Create two tenants in the `tenants` table (or use the default tenant)
2. Make requests with different `X-Tenant-Id` headers
3. Verify that each tenant can only see their own evidence records via `/api/evidence/billing`
4. Verify that webhook events are routed to the correct tenant based on metadata or customer lookup

## Production Deployment

Ensure you have:
1. A PostgreSQL database with the `pgcrypto` extension enabled (for UUID generation)
2. Properly configured Stripe environment (secret key, webhook secret, price IDs)
3. Set `NODE_ENV=production` for optimal performance
4. Use a reverse proxy (like Nginx) for SSL termination and load balancing
5. Set up monitoring and logging for the webhook endpoint

## Database Schema

The backend uses the following tables:
- `tenants`: Stores tenant information
- `customer_tenant_map`: Maps Stripe customer IDs to tenants
- `purchase_intents`: Idempotency keys for checkout requests
- `subscriptions`: Tracks active subscriptions per tenant
- `entitlements`: Explicit access rights per tenant
- `subscription_event_cursor`: Tracks latest processed event per subscription (for out-of-order protection)
- `webhook_processing`: Tracks webhook processing state (idempotency, retries, dead-letter)
- `stripe_events_raw`: Immutable storage of raw Stripe events
- `evidence_*`: Fable-5 evidence tables extended with tenant_id and billing-specific fields

## Implementation Notes

### Tenant Context
The tenant ID is derived from the `X-Tenant-Id` header, which should be set by an authentication middleware (not implemented in this MVP). In a production system, this would come from a verified JWT or session that includes the user's active organization membership.

### Idempotency
Checkout requests require an `idempotencyKey` parameter. This key is stored in the `purchase_intents` table with a unique constraint on `(tenant_id, idempotency_key)`. The same key is passed to Stripe in the `metadata` of both the Checkout Session and the subscription data.

### Webhook Processing
1. **Raw Storage**: The webhook handler first stores the raw event in `stripe_events_raw` (no tenant context)
2. **Tenant Resolution**: 
   - First attempts to get `tenant_id` from `event.data.object.metadata` (set during checkout)
   - Falls back to looking up the Stripe customer in `customer_tenant_map`
   - If still unresolved, the event is quarantined in `webhook_processing` with status 'failed'
3. **Processing**: 
   - Sets tenant-level RLS via `SELECT set_config('app.tenant_id', $1, true)`
   - Processes the event in a transaction
   - Uses `subscription_event_cursor` to detect and ignore outdated events (while still storing them)
   - Marks the event as processed in `webhook_processing`

### Evidence State Machine
Every Stripe event creates an evidence record that progresses through the standard Fable-5 states:
- PROPOSED → AUTHORIZED → EXECUTED → RECEIPTED → VERIFIED → MEASURED → LEARNED → CANONIZED

Note: Not all events progress through the full sequence (e.g., failed invoice payments stop at RECEIPTED).

### Error Handling
- Database transactions are rolled back on any error
- Webhook retries are handled by Stripe based on HTTP response codes (2xx = success, anything else = retry)
- Failed webhook processing attempts are recorded in `webhook_processing.attempts` and `last_error`
- After too many failed attempts, events should be manually inspected from the `quarantined` state

## License

ISC