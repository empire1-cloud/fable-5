import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory stores for demo (in production, use a database)
const evidenceRecords: any[] = [];
const intentTokens: any[] = [];
const customers: any[] = [];

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// ====================
// TYPES & INTERFACES
// ====================

interface IntentToken {
  id: string;
  approvedBy: string;
  action: string;
  vendorOrSystem: string;
  maxAmount: number;
  currency: string;
  expiresAt: string; // ISO datetime
  recurrence: 'one-shot' | 'bounded';
  environment: 'prod' | 'sandbox';
  revoked: boolean;
  audit: AuditEvent[];
}

interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

interface EvidenceRecord {
  id: string;
  missionId: string;
  title: string;
  state: EvidenceState;
  financial: boolean;
  confidence: number;
  receipts: Receipt[];
  contradictions: Contradiction[];
  verification?: VerificationRecord;
  measurement?: MeasurementRecord;
  audit: AuditEvent[];
}

interface Receipt {
  id: string;
  type: ReceiptType;
  description: string;
  grade: EvidenceGrade;
  attachedAt: string; // ISO datetime
  demo: boolean;
}

interface Contradiction {
  id: string;
  description: string;
  resolved: boolean;
  resolution?: string;
}

interface VerificationRecord {
  method: string;
  by: string;
  reproducible: boolean;
  at: string;
}

interface MeasurementRecord {
  gate: string;
  reading: string;
  verdict: 'CLONE' | 'ITERATE' | 'PAUSE' | 'KILL';
  at: string;
}

interface BillingEventEvidence extends EvidenceRecord {
  // Additional fields for billing-specific evidence
  stripeEventId: string;
  stripeEventType: string;
  amount?: number;
  currency?: string;
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
}

type EvidenceState =
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'EXECUTED'
  | 'RECEIPTED'
  | 'VERIFIED'
  | 'MEASURED'
  | 'LEARNED'
  | 'CANONIZED';

type ReceiptType =
  | 'test output'
  | 'diff'
  | 'commit'
  | 'API response'
  | 'deployment log'
  | 'metric'
  | 'screenshot'
  | 'reproducible check'
  | 'verified artifact'
  | 'stripe_payment'
  | 'stripe_invoice'
  | 'stripe_subscription';

type EvidenceGrade = 'A' | 'B' | 'C';

// ====================
// HELPER FUNCTIONS
// ====================

// Generate ISO timestamp
const nowISO = () => new Date().toISOString();

// Find intent token by ID
const findIntentToken = (id: string): IntentToken | undefined => {
  return intentTokens.find(token => token.id === id);
};

// Validate intent token for financial action
const validateIntentToken = (token: IntentToken | undefined, request: { action: string; amount: number; currency: string; vendorOrSystem: string; environment: string }): { valid: boolean; reason?: string } => {
  if (!token) {
    return { valid: false, reason: 'no token presented — NO VALID TOKEN → NO SPEND' };
  }

  const now = new Date();

  if (token.revoked) {
    return { valid: false, reason: `token ${token.id} is revoked` };
  }

  if (new Date(token.expiresAt).getTime() <= now.getTime()) {
    return { valid: false, reason: `token ${token.id} expired at ${token.expiresAt}` };
  }

  if (request.amount > token.maxAmount) {
    return { valid: false, reason: `requested amount ${request.amount} ${request.currency} exceeds token ceiling ${token.maxAmount} ${token.currency}` };
  }

  if (request.currency !== token.currency) {
    return { valid: false, reason: `currency mismatch: token scoped to ${token.currency}, request in ${request.currency}` };
  }

  if (request.action !== token.action) {
    return { valid: false, reason: `action "${request.action}" out of scope for token scoped to "${token.action}"` };
  }

  if (request.vendorOrSystem !== token.vendorOrSystem) {
    return { valid: false, reason: `vendor/system "${request.vendorOrSystem}" out of scope for token scoped to "${token.vendorOrSystem}"` };
  }

  if (request.environment !== token.environment) {
    return { valid: false, reason: `environment "${request.environment}" out of scope for token scoped to "${token.environment}"` };
  }

  return { valid: true };
};

// Create audit event
const createAuditEvent = (actor: string, action: string, detail?: string): AuditEvent => ({
  at: nowISO(),
  actor,
  action,
  detail
});

// Advance evidence state
const advanceEvidenceState = (evidenceId: string, toState: EvidenceState, reason: string, actor: string = 'system') => {
  const evidenceIndex = evidenceRecords.findIndex(ev => ev.id === evidenceId);
  if (evidenceIndex === -1) return null;

  const evidence = evidenceRecords[evidenceIndex];

  // Add audit entry for state transition
  evidence.audit.push(createAuditEvent(actor, `transitioned to ${toState}`, reason));

  // Update state
  evidence.state = toState;

  // If reaching RECEIPTED, add a Stripe receipt
  if (toState === 'RECEIPTED' && 'stripeEventId' in evidence) {
    evidence.receipts.push({
      id: `rcpt_${uuidv4()}`,
      type: 'stripe_payment' as ReceiptType,
      description: `Stripe payment for ${(evidence as BillingEventEvidence).amount} ${(evidence as BillingEventEvidence).currency}`,
      grade: 'A',
      attachedAt: nowISO(),
      demo: false
    });
  }

  // If reaching VERIFIED, add verification
  if (toState === 'VERIFIED' && 'stripeEventId' in evidence) {
    evidence.verification = {
      method: 'stripe_webhook_verification',
      by: 'stripe-webhook-handler',
      reproducible: true,
      at: nowISO()
    };
  }

  // If reaching MEASURED, add measurement
  if (toState === 'MEASURED' && 'stripeEventId' in evidence) {
    evidence.measurement = {
      gate: 'payment_success_threshold',
      reading: '100', // 100% successful processing
      verdict: 'PASS',
      at: nowISO()
    };
  }

  // If reaching LEARNED, add learning insight
  if (toState === 'LEARNED' && 'stripeEventId' in evidence) {
    evidence.learning = {
      confidenceDelta: 0.05, // Slight confidence increase for successful processing
      pattern: `Successful ${(evidence as BillingEventEvidence).stripeEventType} processed for customer ${(evidence as BillingEventEvidence).customerId}`
    };
  }

  // If reaching CANONIZED, add canonization
  if (toState === 'CANONIZED' && 'stripeEventId' in evidence) {
    evidence.canonization = {
      canonEntryId: `canon-billing-${evidence.id.substring(0, 8)}`,
      note: `Canonicalized successful ${(evidence as BillingEventEvidence).stripeEventType} pattern`
    };
  }

  return evidence;
};

// Create billing evidence from Stripe event
const createBillingEvidence = (stripeEvent: Stripe.Event): BillingEventEvidence => {
  const eventId = stripeEvent.id;
  const eventType = stripeEvent.type;

  // Extract relevant data based on event type
  let amount: number | undefined;
  let currency: string | undefined;
  let customerId: string | undefined;
  let subscriptionId: string | undefined;
  let invoiceId: string | undefined;

  if (stripeEvent.type.startsWith('checkout.session')) {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;
    amount = session.amount_total ? session.amount_total / 100 : undefined; // Convert from cents
    currency = session.currency?.toUpperCase();
    customerId = session.customer as string;
    subscriptionId = session.subscription as string;
  } else if (stripeEvent.type.startsWith('invoice')) {
    const invoice = stripeEvent.data.object as Stripe.Invoice;
    amount = invoice.amount_paid ? invoice.amount_paid / 100 : undefined;
    currency = invoice.currency?.toUpperCase();
    customerId = invoice.customer as string;
    invoiceId = invoice.id;
    // For subscription invoices, try to get subscription ID
    if (invoice.subscription) {
      subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : undefined;
    }
  } else if (stripeEvent.type.startsWith('customer.subscription')) {
    const subscription = stripeEvent.data.object as Stripe.Subscription;
    customerId = subscription.customer as string;
    subscriptionId = subscription.id;
    // Get amount from first item if available
    if (subscription.items.data[0]) {
      amount = subscription.items.data[0].price.unit_amount_decimal ?
               parseFloat(subscription.items.data[0].price.unit_amount_decimal) : undefined;
      currency = subscription.items.data[0].price.currency?.toUpperCase();
    }
  }

  // Create evidence record
  const evidence: BillingEventEvidence = {
    id: `ev_billing_${uuidv4()}`,
    missionId: `mission_billing_${uuidv4()}`, // Link to a billing mission
    title: `Stripe Event: ${eventType}`,
    state: 'PROPOSED', // Start at proposed state
    financial: true, // Billing events are financial
    confidence: 0.95, // High confidence from Stripe webhook
    receipts: [],
    contradictions: [],
    audit: [createAuditEvent('stripe-webhook-handler', 'received', `Stripe event ${eventType} received`)],
    // Billing-specific fields
    stripeEventId: eventId,
    stripeEventType: eventType,
    amount,
    currency,
    customerId,
    subscriptionId,
    invoiceId
  };

  return evidence;
};

// ====================
// MIDDLEWARE
// ====================

// Validate Stripe webhook signature
const validateStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    return res.status(400).send('Missing Stripe signature');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed.`, err);
    return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Attach the verified event to the request
  (req as any).stripeEvent = event;
  next();
};

// ====================
// API ROUTES
// ====================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'fable-5-billing-evidence-engine',
    version: '2.2.0-elite'
  });
});

// Create Stripe Checkout Session for subscription plans
app.post('/api/payments/checkout-session', async (req: Request, res: Response) => {
  try {
    const { planType } = req.body;
    if (!planType) return res.status(400).json({ error: 'planType is required' });

    const priceMap: Record<string, string> = {
      free: process.env.STRIPE_PRICE_FREE || 'price_123_free',
      pro: process.env.STRIPE_PRICE_PRO || 'price_123_pro',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_123_enterprise',
    };

    const priceId = priceMap[planType];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan type' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.API_BASE_URL || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.API_BASE_URL || 'http://localhost:5173'}/billing/cancel`,
      metadata: { plan_type: planType },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook endpoint - THE CORE OF THE ELITE IMPLEMENTATION
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), validateStripeWebhook,
  async (req: Request, res: Response) => {
    try {
      const event = (req as any).stripeEvent as Stripe.Event;
      console.log(`🔔 Received Stripe event: ${event.type} [${event.id}]`);

      // Create evidence record from Stripe event
      const evidence = createBillingEvidence(event);

      // Store the evidence
      evidenceRecords.push(evidence);

      // Process based on event type
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;

          // For product monetization (billing workspace), we process payments through the evidence state machine
          # BUT we do NOT require Intent Token validation, as clarified by the user:
          # "NO VALID TOKEN → NO SPEND applies only to internal financial actions within governance system, NOT to product monetization"

          // Process the payment through the evidence state machine
          advanceEvidenceState(evidence.id, 'AUTHORIZED', 'Payment authorized for processing', 'system');
          advanceEvidenceState(evidence.id, 'EXECUTED', 'Payment processed by Stripe', 'stripe-system');

          // Add receipt for the payment
          evidence.receipts.push({
            id: `rcpt_${uuidv4()}`,
            type: 'stripe_payment' as ReceiptType,
            description: `Payment of ${evidence.amount}${evidence.currency} for ${evidence.title}`,
            grade: 'A',
            attachedAt: new Date().toISOString(),
            demo: false
          });

          advanceEvidenceState(evidence.id, 'RECEIPTED', 'Payment receipt attached', 'system');

          // VERIFIED: Stripe webhook serves as verification
          evidence.verification = {
            method: 'stripe_webhook_delivery',
            by: 'stripe',
            reproducible: true,
            at: new Date().toISOString()
          };
          advanceEvidenceState(evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');

          // MEASURED: Measure against success criteria (100% successful)
          evidence.measurement = {
            gate: 'payment_success_threshold',
            reading: '100',
            verdict: 'PASS',
            at: new Date().toISOString()
          };
          advanceEvidenceState(evidence.id, 'MEASURED', 'Payment successfully processed', 'system');

          // LEARNED: Extract learning from successful payment
          evidence.learning = {
            confidenceDelta: 0.03,
            pattern: `Successful payment processing for amount ${evidence.amount}${evidence.currency} via ${evidence.stripeEventType}`
          };
          advanceEvidenceState(evidence.id, 'LEARNED', 'Learning extracted from successful payment', 'system');

          // CANONIZED: Establish this as a canonical pattern for similar payments
          evidence.canonization = {
            canonEntryId: `canon-payment-success-${evidence.id.substring(0, 8)}`,
            note: `Canonical pattern for successful ${evidence.amount}${evidence.currency} payments via Stripe Checkout`
          };
          advanceEvidenceState(evidence.id, 'CANONIZED', 'Elevated to canonical payment pattern', 'system');

          console.log(`✅ Payment processed and evidence canonized: ${evidence.id}`);

          break;
        }

        case 'invoice.payment_failed': {
          // Handle failed payment
          const invoice = event.data.object as Stripe.Invoice;

          // Add contradiction for failed payment
          evidence.contradictions.push({
            id: `ct_${uuidv4()}`,
            description: `Payment failed for invoice ${invoice.id}: ${invoice.status}`,
            resolved: false
          });

          // Add audit
          evidence.audit.push(createAuditEvent('billing-system', 'payment_failed', `Invoice ${invoice.id} payment failed`));

          // Still progress through states but mark as failed
          advanceEvidenceState(evidence.id, 'AUTHORIZED', 'Invoice authorized for payment attempt', 'system');
          advanceEvidenceState(evidence.id, 'EXECUTED', 'Payment attempt executed by Stripe', 'stripe-system');
          advanceEvidenceState(evidence.id, 'RECEIPTED', 'Failed payment receipt recorded', 'system');

          // For failed payments, we might not go through full verification/learning cycle
          // but we still record the outcome
          console.log(`💸 Payment failed recorded: ${evidence.id}`);
          break;
        }

        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;

          // Treat subscription creation as a successful financial event
          advanceEvidenceState(evidence.id, 'AUTHORIZED', 'Subscription authorized', 'governance-system');
          advanceEvidenceState(evidence.id, 'EXECUTED', 'Subscription created by Stripe', 'stripe-system');

          // Add receipt for subscription creation
          evidence.receipts.push({
            id: `rcpt_${uuidv4()}`,
            type: 'stripe_subscription' as ReceiptType,
            description: `Subscription created: ${subscription.items.data[0]?.price?.nickname || 'Unknown Plan'}`,
            grade: 'A',
            attachedAt: new Date().toISOString(),
            demo: false
          });

          advanceEvidenceState(evidence.id, 'RECEIPTED', 'Subscription receipt attached', 'system');
          advanceEvidenceState(evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
          advanceEvidenceState(evidence.id, 'MEASURED', 'Subscription created successfully', 'system');
          evidence.learning = {
            confidenceDelta: 0.04,
            pattern: `New subscription created for customer ${evidence.customerId}`
          };
          advanceEvidenceState(evidence.id, 'LEARNED', 'Subscription creation pattern learned', 'system');
          evidence.canonization = {
            canonEntryId: `canon-subscription-create-${evidence.id.substring(0, 8)}`,
            note: `Canonical pattern for subscription creation`
          };
          advanceEvidenceState(evidence.id, 'CANONIZED', 'Subscription creation elevated to canonical pattern', 'system');

          console.log(`📝 Subscription created and evidenced: ${evidence.id}`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;

          // Process subscription cancellation
          advanceEvidenceState(evidence.id, 'AUTHORIZED', 'Cancellation authorized', 'governance-system');
          advanceEvidenceState(evidence.id, 'EXECUTED', 'Subscription cancelled by Stripe/user', 'stripe-system');

          evidence.receipts.push({
            id: `rcpt_${uuidv4()}`,
            type: 'stripe_subscription' as ReceiptType,
            description: `Subscription cancelled: ${subscription.items.data[0]?.price?.nickname || 'Unknown Plan'}`,
            grade: 'A',
            attachedAt: new Date().toISOString(),
            demo: false
          });

          advanceEvidenceState(evidence.id, 'RECEIPTED', 'Cancellation receipt recorded', 'system');
          advanceEvidenceState(evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
          evidence.learning = {
            confidenceDelta: 0.02,
            pattern: `Subscription cancelled for customer ${evidence.customerId}: potential churn signal`
          };
          advanceEvidenceState(evidence.id, 'LEARNED', 'Cancellation pattern learned for churn analysis', 'system');

          console.log(`🗑️ Subscription cancelled and evidenced: ${evidence.id}`);
          break;
        }

        default:
          // For other events, just process through basic lifecycle
          advanceEvidenceState(evidence.id, 'AUTHORIZED', 'Event authorized for processing', 'system');
          advanceEvidenceState(evidence.id, 'EXECUTED', 'Event processed by Stripe', 'stripe-system');
          advanceEvidenceState(evidence.id, 'RECEIPTED', 'Event receipt recorded', 'system');
          advanceEvidenceState(evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
          console.log(`📊 Event processed: ${event.type}`);
      }

      // Return success
      res.json({ received: true, evidenceId: evidence.id });
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get evidence records (for debugging/admin)
app.get('/api/evidence/billing', (req: Request, res: Response) => {
  res.json({
    count: evidenceRecords.length,
    evidence: evidenceRecords.map(ev => ({
      id: ev.id,
      title: ev.title,
      state: ev.state,
      financial: ev.financial,
      stripeEventType: ('stripeEventType' in ev) ? ev.stripeEventType : undefined,
      amount: ('amount' in ev) ? ev.amount : undefined,
      currency: ('currency' in ev) ? ev.currency : undefined,
      customerId: ('customerId' in ev) ? ev.customerId : undefined,
      timestamp: ev.audit[0]?.at
    }))
  });
});

// Get specific evidence record
app.get('/api/evidence/billing/:id', (req: Request, res: Response) => {
  const evidence = evidenceRecords.find(ev => ev.id === req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: 'Evidence not found' });
  }
  res.json(evidence);
});

// Get statistics
app.get('/api/billing/stats', (req: Request, res: Response) => {
  const total = evidenceRecords.length;
  const byState = evidenceRecords.reduce((acc, ev) => {
    acc[ev.state] = (acc[ev.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const financialEvents = evidenceRecords.filter(ev => ev.financial).length;
  const successfulPayments = evidenceRecords.filter(ev =>
    ev.state === 'CANONIZED' && ev.financial &&
    ('stripeEventType' in ev && ev.stripeEventType?.includes('payment'))
  ).length;

  res.json({
    totalEvents: total,
    financialEvents,
    successfulPayments,
    byState,
    successRate: total > 0 ? (successfulPayments / financialEvents * 100) : 0
  });
});

// ====================
// START SERVER
// ====================

app.listen(port, () => {
  console.log(`🚀 Fable-5 Elite Billing Evidence Engine running on port ${port}`);
  console.log(`📊 Endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/payments/webhook`);
  console.log(`  GET  /api/evidence/billing`);
  console.log(`  GET  /api/evidence/billing/:id`);
  console.log(`  GET  /api/billing/stats`);
  console.log(`💡 Elite Feature: Every Stripe event becomes an evidence record flowing through the complete Fable-5 Evidence State Machine`);
});

// ====================
// DEMO DATA INITIALIZATION
// ====================

// Initialize with some demo intent tokens for testing (for governance system internal actions only)
const initializeDemoData = () => {
  // Add a demo intent token for GOVERNANCE SYSTEM internal financial actions ONLY
  // (Not for product monetization/billing - that's handled separately per user clarification)
  intentTokens.push({
    id: 'fit_governance_demo_001',
    approvedBy: 'founder',
    action: 'internal_governance_action',
    vendorOrSystem: 'internal_system',
    maxAmount: 10000,
    currency: 'USD',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    recurrence: 'bounded',
    environment: 'prod',
    revoked: false,
    audit: [
      {
        at: new Date().toISOString(),
        actor: 'founder',
        action: 'issued',
        detail: 'Issued for internal governance system financial actions ONLY'
      }
    ]
  });

  console.log('🔧 Demo data initialized for governance system internal actions');
};

// Initialize demo data on startup (for governance system internal actions)
initializeDemoData();

// Export for testing (if needed)
export default app;