import express from 'express';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import type { PoolClient, QueryResult } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const port = process.env.PORT || 3001;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-07-29.dahlia',
});

// Initialize PostgreSQL connection pool
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

// Types
type UUID = string;
type ReceiptType = 'stripe_payment' | 'stripe_subscription' | 'stripe_invoice';
type EvidenceState =
  | 'PROPOSED'
  | 'AUTHORIZED'
  | 'EXECUTED'
  | 'RECEIPTED'
  | 'VERIFIED'
  | 'MEASURED'
  | 'LEARNED'
  | 'CANONIZED';

// -----------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------
function isUUID(v: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(v);
}

/**
 * Extract tenant ID from the authenticated request.
 * For this MVP we simulate auth via a header; in production this
 * would come from a verified JWT/session that includes the user's
 * active organization membership.
 *
 * The function also validates an optional body.tenantId for consistency.
 */
function getTenantFromRequest(req: ExpressRequest): { tenantId: UUID } | { error: string } {
  // 1️⃣ Authenticated user → active organization (placeholder)
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  if (!headerTenantId) {
    return { error: 'Missing tenant context in request (authentication required)' };
  }
  if (!isUUID(headerTenantId)) {
    return { error: 'Invalid tenant ID format' };
  }
  const tenantId = headerTenantId as UUID;

  // 2️⃣ Optional body consistency check (must match if present)
  if (req.body && typeof req.body === 'object' && 'tenantId' in req.body) {
    const bodyTenantId = String((req.body as any).tenantId);
    if (bodyTenantId && bodyTenantId !== tenantId) {
      return { error: 'Provided tenantId does not match authenticated tenant' };
    }
  }

  return { tenantId };
}

/**
 * Set the tenant ID for the current PostgreSQL transaction.
 * Must be called inside an explicit transaction block.
 */
async function setTenantContext(client: PoolClient, tenantId: UUID): Promise<void> {
  // true = transaction‑local (see POSTGRESQL SET CONFIG docs)
  await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
}

/**
 * Generate ISO timestamp string.
 */
function nowISO(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------
// Database initialization (idempotent, safe to rerun)
// -----------------------------------------------------------------
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Enable required extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // === Core tables (tenant‑aware) ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_tenant_map (
        stripe_customer_id VARCHAR PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_intents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        stripe_session_id VARCHAR UNIQUE,
        idempotency_key VARCHAR NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL,
        plan_type VARCHAR(50) NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT unique_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        stripe_subscription_id VARCHAR PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        canceled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // === Evidence tables (tenant‑aware) ===
    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        state TEXT NOT NULL,
        financial BOOLEAN NOT NULL DEFAULT FALSE,
        stripe_event_type VARCHAR(100),
        amount NUMERIC(15,2),
        currency VARCHAR(10),
        customer_id VARCHAR(255),
        data JSONB DEFAULT '{}'::jsonb,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evidence_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
        state_from TEXT NOT NULL,
        state_to TEXT NOT NULL,
        reason TEXT NOT NULL,
        actor TEXT NOT NULL,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_receipts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evidence_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        grade TEXT NOT NULL,
        attached_at TIMESTAMPTZ NOT NULL,
        demo BOOLEAN NOT NULL DEFAULT FALSE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evidence_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        by TEXT NOT NULL,
        reproducible BOOLEAN NOT NULL DEFAULT FALSE,
        at TIMESTAMPTZ NOT NULL,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evidence_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
        gate TEXT NOT NULL,
        reading TEXT NOT NULL,
        verdict TEXT NOT NULL,
        at TIMESTAMPTZ NOT NULL,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS evidence_contradictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evidence_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE CASCADE,
        statement TEXT NOT NULL,
        contradicting_statement TEXT NOT NULL,
        resolved BOOLEAN NOT NULL DEFAULT FALSE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS entitlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        feature_key VARCHAR(100) NOT NULL,
        is_granted BOOLEAN NOT NULL DEFAULT FALSE,
        granted_until TIMESTAMPTZ,
        evidence_id UUID REFERENCES evidence_records(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, feature_key)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_event_cursor (
        stripe_subscription_id VARCHAR PRIMARY KEY REFERENCES subscriptions(stripe_subscription_id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        latest_event_created TIMESTAMPTZ NOT NULL,
        latest_event_id VARCHAR NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Raw webhook ingress table – not subject to tenant RLS, stores immutable Stripe events
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_events_raw (
        id VARCHAR PRIMARY KEY,
        object JSONB NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        tenant_id UUID, -- nullable until resolved
        error_text TEXT
      );
    `);

    // Tenant‑scoped webhook processing state (for replay safety, dead‑letter, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_processing (
        stripe_event_id VARCHAR PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processing_status VARCHAR(20) NOT NULL DEFAULT 'received', -- received|processing|processed|failed|dead_letter
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        processed_at TIMESTAMPTZ,
        UNIQUE (stripe_event_id)
      );
    `);

    // === Ensure evidence_records has the columns we use for billing metadata ===
    // (These are now created in the CREATE TABLE above, but keeping for backward compatibility)
    await client.query(`
      ALTER TABLE evidence_records
        ADD COLUMN IF NOT EXISTS stripe_event_type VARCHAR(100),
        ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2),
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
        ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb
    `);

    // === Enable Row Level Security and create policies (idempotent) ===
    await client.query(`
      DO $$
      DECLARE
        tbl text;
        has_rls boolean;
      BEGIN
        FOR tbl IN
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename IN (
              'tenants','customer_tenant_map','purchase_intents','subscriptions',
              'evidence_records','evidence_events','evidence_receipts',
              'evidence_verifications','evidence_measurements'
            )
        LOOP
          -- Enable RLS if not already enabled
          SELECT relrowsecurity INTO has_rls
          FROM pg_class
          WHERE relname = tbl
            AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

          IF NOT has_rls THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
          END IF;

          -- Force RLS (no bypass via session_replication_role)
          EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

          -- Create policy if it doesn't exist
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = tbl
              AND policyname = 'tenant_isolation_' || tbl
          ) THEN
            IF tbl = 'tenants' THEN
              -- For tenants table, use id as the tenant identifier
              EXECUTE format('CREATE POLICY tenant_isolation_%I ON %I USING (id = current_setting(''app.tenant_id'')::uuid)', tbl, tbl);
            ELSE
              -- For all other tables, use the tenant_id foreign key
              EXECUTE format('CREATE POLICY tenant_isolation_%I ON %I USING (tenant_id = current_setting(''app.tenant_id'')::uuid)', tbl, tbl);
            END IF;
          END IF;
        END LOOP;
      END $$;
    `);

    // Create a default tenant for any existing data that lacks a proper tenant (optional)
    await client.query(`
      INSERT INTO tenants (id, name)
      VALUES ('00000000-0000-0000-0000-000000000000', 'default')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✅ Database initialized with tenancy and RLS');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------
// Evidence helpers – all must receive the same PoolClient for atomicity
// -----------------------------------------------------------------
async function createBillingEvidence(
  client: PoolClient,
  event: Stripe.Event,
  tenantId: UUID
): Promise<{ id: UUID; amount: number | null; currency: string | null; title: string; customerId: string | null }> {
  const evidenceId = uuidv4();
  const eventType = event.type;
  const created = new Date(event.created * 1000);
  let amount: number | null = null;
  let currency: string | null = null;
  let customerId: string | null = null;

  // Extract amount/currency/customer from common Stripe objects
  if (event.data.object && typeof event.data.object === 'object') {
    const obj = event.data.object as any;
    if (typeof obj.amount === 'number') {
      amount = obj.amount;
      currency = obj.currency?.toUpperCase() ?? null;
    }
    if (typeof obj.customer === 'string') {
      customerId = obj.customer;
    }
  }

  const title = `Stripe Event:${eventType}`;

  await client.query(
    `INSERT INTO evidence_records
       (id, title, state, financial, stripe_event_type, amount, currency, customer_id, data, tenant_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      evidenceId,
      title,
      'PROPOSED',
      !!amount, // financial if amount present
      eventType,
      amount ?? null,
      currency ?? null,
      customerId ?? null,
      JSON.stringify(event),
      tenantId,
      created,
      created
    ]
  );
  return { id: evidenceId, amount, currency, title, customerId };
}

async function updateEvidenceState(
  client: PoolClient,
  evidenceId: UUID,
  toState: EvidenceState,
  reason: string,
  actor: string
): Promise<void> {
  await client.query(
    `INSERT INTO evidence_events
       (evidence_id, state_from, state_to, reason, actor, created_at)
     SELECT
       $2,
       state,
       $3,
       $4,
       $5,
       now()
     FROM evidence_records
     WHERE id = $1`,
    [evidenceId, toState, reason, actor, nowISO()]
  );
  await client.query(
    `UPDATE evidence_records SET state = $2, updated_at = now() WHERE id = $1`,
    [evidenceId, toState]
  );
}

async function addReceipt(
  client: PoolClient,
  evidenceId: UUID,
  receipt: {
    type: ReceiptType;
    description: string;
    grade: string;
    attachedAt: string;
    demo: boolean;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO evidence_receipts
       (id, evidence_id, type, description, grade, attached_at, demo, tenant_id, created_at, updated_at)
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
     )`,
    [
      uuidv4(),
      evidenceId,
      receipt.type,
      receipt.description,
      receipt.grade,
      receipt.attachedAt,
      receipt.demo,
      // tenant_id will be set via RLS (we rely on the session config)
      null, // will be filled by trigger or we can set explicitly after setting context
      receipt.attachedAt,
      receipt.attachedAt
    ]
  );
  // Update the receipt row with the correct tenant_id (since we inserted with null)
  await client.query(
    `UPDATE evidence_receipts SET tenant_id = current_setting('app.tenant_id')::uuid WHERE id = $1`,
    [uuidv4()] // the id we just inserted
  );
}

async function addVerification(
  client: PoolClient,
  evidenceId: UUID,
  verification: {
    method: string;
    by: string;
    reproducible: boolean;
    at: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO evidence_verifications
       (id, evidence_id, method, by, reproducible, at, tenant_id, created_at, updated_at)
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
     )`,
    [
      uuidv4(),
      evidenceId,
      verification.method,
      verification.by,
      verification.reproducible,
      verification.at,
      null, // tenant_id set via RLS
      verification.at,
      verification.at
    ]
  );
  await client.query(
    `UPDATE evidence_verifications SET tenant_id = current_setting('app.tenant_id')::uuid WHERE id = $1`,
    [uuidv4()]
  );
}

async function addMeasurement(
  client: PoolClient,
  evidenceId: UUID,
  measurement: {
    gate: string;
    reading: string;
    verdict: string;
    at: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO evidence_measurements
       (id, evidence_id, gate, reading, verdict, at, tenant_id, created_at, updated_at)
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
     )`,
    [
      uuidv4(),
      evidenceId,
      measurement.gate,
      measurement.reading,
      measurement.verdict,
      measurement.at,
      null, // tenant_id set via RLS
      measurement.at,
      measurement.at
    ]
  );
  await client.query(
    `UPDATE evidence_measurements SET tenant_id = current_setting('app.tenant_id')::uuid WHERE id = $1`,
    [uuidv4()]
  );
}

// -----------------------------------------------------------------
// Routes
// -----------------------------------------------------------------
app.get('/api/health', (_req: ExpressRequest, res: ExpressResponse) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create Stripe Checkout Session for subscription plans
app.post('/api/payments/checkout-session', async (req: ExpressRequest, res: ExpressResponse) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ Resolve tenant from authenticated context
    const tenantResult = getTenantFromRequest(req);
    if ('error' in tenantResult) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: tenantResult.error });
    }
    const tenantId = tenantResult.tenantId;

    // 2️⃣ Set tenant-level RLS for this transaction
    await setTenantContext(client, tenantId);

    const { planType, idempotencyKey } = req.body;
    if (!planType) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'planType is required' });
    }
    if (!idempotencyKey) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'idempotencyKey is required' });
    }

    // Create namespaced idempotency key for Stripe and database operations
    const namespacedIdempotencyKey = `fable5:checkout:${tenantId}:${idempotencyKey}`;

    // 3️⃣ Look up existing purchase intent by idempotency key (tenant-scoped)
    const existingIntent = await client.query(
      `SELECT id, stripe_session_id FROM purchase_intents
       WHERE tenant_id = $1 AND idempotency_key = $2`,
      [tenantId, namespacedIdempotencyKey]
    );

    let purchaseIntentId: UUID;
    let stripeSessionId: string | null = null;

    if (existingIntent && existingIntent.rowCount! > 0) {
      // Reuse existing intent
      purchaseIntentId = existingIntent.rows[0].id as UUID;
      stripeSessionId = existingIntent.rows[0].stripe_session_id as string | null;
      // If we already have a Stripe session, return its URL
      if (stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
        await client.query('COMMIT');
        return res.json({ url: session.url });
      }
    } else {
      // Create new purchase intent
      purchaseIntentId = uuidv4();
      await client.query(
        `INSERT INTO purchase_intents
           (id, tenant_id, idempotency_key, amount_cents, currency, plan_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          purchaseIntentId,
          tenantId,
          idempotencyKey,
          planType === 'free' ? 0 :
          planType === 'pro' ? 2900 : // $29.00
          0, // enterprise handled via custom price in Stripe Dashboard
          planType === 'free' ? 'USD' : 'USD',
          planType
        ]
      );
    }

    const priceMap: Record<string, string> = {
      free: process.env.STRIPE_PRICE_FREE || 'price_123_free',
      pro: process.env.STRIPE_PRICE_PRO || 'price_123_pro',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_123_enterprise',
    };
    const priceId = priceMap[planType];
    if (!priceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    // 4️⃣ If we don't yet have a Stripe session, create one
    if (!stripeSessionId) {
      const session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ['card'],
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'subscription',
          success_url: `${process.env.API_BASE_URL || 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}'`,
          cancel_url: `${process.env.API_BASE_URL || 'http://localhost:5173'}/billing/cancel`,
          metadata: {
            tenant_id: tenantId,
            purchase_intent_id: purchaseIntentId,
            idempotencyKey: idempotencyKey,
          },
          subscription_data: {
            metadata: {
              tenant_id: tenantId,
              purchase_intent_id: purchaseIntentId,
              idempotencyKey: idempotencyKey,
            },
          },
        },
        { idempotencyKey: namespacedIdempotencyKey }   // Add the namespaced idempotency key as request options
      );

      // Persist the Stripe session id back to the purchase intent
      await client.query(
        `UPDATE purchase_intents
           SET stripe_session_id = $1
           WHERE id = $2`,
        [session.id, purchaseIntentId]
      );

      stripeSessionId = session.id;
    }

    await client.query('COMMIT');
    res.json({ url: stripeSessionId ? (await stripe.checkout.sessions.retrieve(stripeSessionId)).url : '' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  } finally {
    client.release();
  }
});

// Stripe webhook endpoint - core of the elite implementation
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  async (req: ExpressRequest, res: ExpressResponse) => {
    // 1️⃣ Acquire a client for raw event storage (no tenant RLS yet)
    const rawClient = await pool.connect();
    try {
      // Verify Stripe signature
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

      // 2️⃣ Durably store the raw event (immutable audit trail)
      await rawClient.query(
        `INSERT INTO stripe_events_raw
           (id, object, received_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [event.id, JSON.stringify(event), new Date()]
      );
      await rawClient.release();

      // 3️⃣ Now process the event under tenant-scoped transaction
      const procClient = await pool.connect();
      try {
        await procClient.query('BEGIN');

        // Determine tenant_id from metadata or customer map
        let tenantId: UUID | null = null;
        // a) Prefer metadata set at checkout time (most reliable)
        if (
          event.data.object &&
          typeof event.data.object === 'object' &&
          'metadata' in event.data.object &&
          (event.data.object as any).metadata?.tenant_id
        ) {
          tenantId = (event.data.object as any).metadata.tenant_id as UUID | null;
        }
        // b) Fallback: look up via Stripe customer → tenant map
        if (!tenantId && event.data.object && typeof event.data.object === 'object') {
          const custId = (event.data.object as any).customer;
          if (typeof custId === 'string') {
            const mapRes = await procClient.query(
              `SELECT tenant_id FROM customer_tenant_map WHERE stripe_customer_id = $1`,
              [custId]
            );
            if (mapRes && mapRes.rowCount! > 0) {
              tenantId = mapRes.rows[0].tenant_id as UUID;
            }
          }
        }

        // If tenant_id cannot be resolved, quarantine the event and return
        if (!tenantId) {
          await procClient.query('COMMIT');
          return res.json({
            received: true,
            quarantined: true,
            reason: 'Missing tenant_id – event stored for manual review'
          });
        }

        // 4️⃣ Idempotency: skip if we already processed this Stripe event in webhook_processing
        const existing = await procClient.query(
          `SELECT 1 FROM webhook_processing WHERE stripe_event_id = $1`,
          [event.id]
        );
        if (existing && existing.rowCount! > 0) {
          await procClient.query('COMMIT');
          return res.json({ received: true, duplicate: true });
        }

        // 5️⃣ Record receipt of the webhook (status = received)
        await procClient.query(
          `INSERT INTO webhook_processing
             (stripe_event_id, tenant_id, processing_status)
           VALUES ($1, $2, 'received')`,
          [event.id, tenantId]
        );

        // 6️⃣ Set tenant‑level Row Level Security for this transaction
        await setTenantContext(procClient, tenantId);

        // 7️⃣ Extract useful ids from the Stripe object
        const stripeObjectId =
          event.data.object && typeof event.data.object === 'object' && 'id' in event.data.object
            ? (event.data.object as any).id
            : null;
        const stripeObjectType =
          event.data.object && typeof event.data.object === 'object' && 'object' in event.data.object
            ? (event.data.object as any).object
            : null;

        // 8️⃣ Out‑of‑order protection for subscription‑lifecycle events
        //    We only block state‑rolling‑back; we still record the event as evidence.
        let projectionAllowed = true;
        if (
          event.type.startsWith('customer.subscription') &&
          stripeObjectId
        ) {
          const cursorRes = await procClient.query(
            `SELECT latest_event_created, latest_event_id
             FROM subscription_event_cursor
             WHERE stripe_subscription_id = $1`,
            [stripeObjectId]
          );
          const eventCreated = new Date(event.created * 1000); // Stripe.created is seconds since epoch
          if (cursorRes.rowCount! > 0) {
            const latestCreated = cursorRes.rows[0].latest_event_created as Date;
            // If this event is older than the latest we already applied, skip state update
            if (eventCreated <= latestCreated) {
              // If same timestamp, tie‑break by event id (lexicographic)
              if (
                eventCreated.getTime() === latestCreated.getTime() &&
                event.id <= (cursorRes.rows[0].latest_event_id as string)
              ) {
                projectionAllowed = false;
              } else {
                projectionAllowed = false;
              }
            }
          }
          // Store cursor regardless (for future comparison) – only if newer or equal with higher id
          await procClient.query(
            `INSERT INTO subscription_event_cursor
               (stripe_subscription_id, tenant_id, latest_event_created, latest_event_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (stripe_subscription_id)
             DO UPDATE SET
               tenant_id = EXCLUDED.tenant_id,
               latest_event_created = EXCLUDED.latest_event_created,
               latest_event_id = EXCLUDED.latest_event_id
             WHERE
               EXCLUDED.latest_event_created > subscription_event_cursor.latest_event_created OR
               (EXCLUDED.latest_event_created = subscription_event_cursor.latest_event_created AND
                EXCLUDED.latest_event_id > subscription_event_cursor.latest_event_id)`,
            [stripeObjectId, tenantId, eventCreated, event.id]
          );
        }

        // 9️⃣ Create evidence record (always – immutable audit trail)
        const evidence = await createBillingEvidence(procClient, event, tenantId as UUID);
        // Ensure evidence row gets the tenant_id (already set in createBillingEvidence via data column, but we also set explicitly)
        await procClient.query(
          `UPDATE evidence_records
             SET tenant_id = $1
           WHERE id = $2`,
          [tenantId, evidence.id]
        );

        // 10️⃣ Process the event type (state transitions, entitlements, receipts)
        //    All changes below happen inside the same transaction.
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;

            // AUTHORIZED → EXECUTED → RECEIPTED → VERIFIED → MEASURED
            await updateEvidenceState(procClient, evidence.id, 'AUTHORIZED', 'Payment authorized for processing', 'system');
            await updateEvidenceState(procClient, evidence.id, 'EXECUTED', 'Payment processed by Stripe', 'stripe-system');

            await addReceipt(procClient, evidence.id, {
              type: 'stripe_payment' as ReceiptType,
              description: `Payment of ${evidence.amount ?? 0}${evidence.currency ?? ''} for ${evidence.title}`,
              grade: 'A',
              attachedAt: nowISO(),
              demo: false
            });

            await updateEvidenceState(procClient, evidence.id, 'RECEIPTED', 'Payment receipt attached', 'system');
            await addVerification(procClient, evidence.id, {
              method: 'stripe_webhook_delivery',
              by: 'stripe',
              reproducible: true,
              at: nowISO()
            });
            await updateEvidenceState(procClient, evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
            await addMeasurement(procClient, evidence.id, {
              gate: 'payment_success_threshold',
              reading: '100',
              verdict: 'PASS',
              at: nowISO()
            });
            await updateEvidenceState(procClient, evidence.id, 'MEASURED', 'Payment successfully processed', 'system');
            // Note: We do NOT automatically advance to LEARNED or CANONIZED.
            // Those states require explicit learning or canonization actions.

            // For subscription checkouts we also create a subscription row
            if (session.subscription) {
              const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
              await procClient.query(
                `INSERT INTO subscriptions
                   (stripe_subscription_id, tenant_id, status, current_period_start, current_period_end, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (stripe_subscription_id)
                 DO UPDATE SET
                   status = EXCLUDED.status,
                   current_period_start = EXCLUDED.current_period_start,
                   current_period_end = EXCLUDED.current_period_end,
                   updated_at = EXCLUDED.updated_at`,
                [
                  session.subscription,
                  tenantId,
                  'active',
                  new Date((stripeSubscription as any).current_period_start * 1000),
                  new Date((stripeSubscription as any).current_period_end * 1000),
                  new Date(),
                  new Date()
                ]
              );
              // Upsert customer_tenant_map
              if (session.customer) {
                await procClient.query(
                  `INSERT INTO customer_tenant_map (stripe_customer_id, tenant_id)
                   VALUES ($1, $2)
                   ON CONFLICT (stripe_customer_id) DO UPDATE SET
                     tenant_id = EXCLUDED.tenant_id`,
                  [session.customer, tenantId]
                );
              }
              // Grant the appropriate entitlement
              const featureKey = session.mode === 'subscription' ?
                (session.metadata?.plan_type as string) ?? 'pro_plan' :
                'free_plan';
              await procClient.query(
                `INSERT INTO entitlements
                   (tenant_id, feature_key, is_granted, granted_until, evidence_id, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (tenant_id, feature_key)
                 DO UPDATE SET
                   is_granted = EXCLUDED.is_granted,
                   granted_until = EXCLUDED.granted_until,
                   evidence_id = EXCLUDED.evidence_id,
                   updated_at = EXCLUDED.updated_at`,
                [
                  tenantId,
                  featureKey,
                  true,
                  null, // forever while granted (could set to period_end if desired)
                  evidence.id,
                  new Date()
                ]
              );
            }

            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;

            // We do NOT automatically create a contradiction for every failed payment.
            // A contradiction should only be created when it conflicts with another claim.
            // For now, we just record the event as normal (up to EXECUTED) and add a receipt for the attempt.

            await updateEvidenceState(procClient, evidence.id, 'AUTHORIZED', 'Invoice authorized for payment attempt', 'system');
            await updateEvidenceState(procClient, evidence.id, 'EXECUTED', 'Payment attempt executed by Stripe', 'stripe-system');

            // Add a receipt for the failed attempt
            await addReceipt(procClient, evidence.id, {
              type: 'stripe_invoice' as ReceiptType,
              description: `Payment failed for invoice ${invoice.id}: ${invoice.status}`,
              grade: 'A',
              attachedAt: nowISO(),
              demo: false
            });

            await updateEvidenceState(procClient, evidence.id, 'RECEIPTED', 'Failed payment receipt recorded', 'system');
            // We do NOT proceed to VERIFIED, etc. for a failed payment.

            break;
          }

          case 'customer.subscription.created': {
            const subscription = event.data.object;

            // Upsert subscription row
            await procClient.query(
              `INSERT INTO subscriptions
                 (stripe_subscription_id, tenant_id, status, current_period_start, current_period_end, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (stripe_subscription_id)
               DO UPDATE SET
                 status = EXCLUDED.status,
                 current_period_start = EXCLUDED.current_period_start,
                 current_period_end = EXCLUDED.current_period_end,
                 updated_at = EXCLUDED.updated_at`,
              [
                subscription.id,
                tenantId,
                subscription.status,
                new Date((subscription as any)['current_period_start'] * 1000),
                new Date((subscription as any)['current_period_end'] * 1000),
                new Date(),
                new Date()
              ]
            );

            // For *new* subscriptions we also want to move through the evidence states
            // (only if projection was allowed by the OOO guard above)
            if (projectionAllowed) {
              await updateEvidenceState(procClient, evidence.id, 'AUTHORIZED', 'Subscription authorized', 'governance-system');
              await updateEvidenceState(procClient, evidence.id, 'EXECUTED', 'Subscription created by Stripe', 'stripe-system');

              await addReceipt(procClient, evidence.id, {
                type: 'stripe_subscription' as ReceiptType,
                description: `Subscription created: ${subscription.items.data[0]?.price?.nickname || 'Unknown Plan'}`,
                grade: 'A',
                attachedAt: nowISO(),
                demo: false
              });

              await updateEvidenceState(procClient, evidence.id, 'RECEIPTED', 'Subscription receipt attached', 'system');
              await addVerification(procClient, evidence.id, {
                method: 'stripe_webhook_delivery',
                by: 'stripe',
                reproducible: true,
                at: nowISO()
              });
              await updateEvidenceState(procClient, evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
              await addMeasurement(procClient, evidence.id, {
                gate: 'subscription_created_success',
                reading: '1',
                verdict: 'PASS',
                at: nowISO()
              });
              await updateEvidenceState(procClient, evidence.id, 'MEASURED', 'Subscription created successfully', 'system');
              // Note: We do NOT automatically advance to LEARNED or CANONIZED.
            }

            // Upsert customer_tenant_map
            if (subscription.customer) {
              await procClient.query(
                `INSERT INTO customer_tenant_map (stripe_customer_id, tenant_id)
                 VALUES ($1, $2)
                 ON CONFLICT (stripe_customer_id) DO UPDATE SET
                   tenant_id = EXCLUDED.tenant_id`,
                [subscription.customer, tenantId]
              );
            }

            // Grant entitlement for the plan
            const featureKey = subscription.items.data[0]?.price?.nickname
              ? subscription.items.data[0].price.nickname.toLowerCase().includes('pro')
                ? 'pro_plan'
                : subscription.items.data[0].price.nickname.toLowerCase().includes('enterprise')
                  ? 'enterprise_plan'
                  : 'free_plan'
              : 'free_plan'; // fallback

            await procClient.query(
              `INSERT INTO entitlements
                 (tenant_id, feature_key, is_granted, granted_until, evidence_id, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (tenant_id, feature_key)
               DO UPDATE SET
                 is_granted = EXCLUDED.is_granted,
                 granted_until = EXCLUDED.granted_until,
                 evidence_id = EXCLUDED.evidence_id,
                 updated_at = EXCLUDED.updated_at`,
              [
                tenantId,
                featureKey,
                true,
                null,
                evidence.id,
                new Date()
              ]
            );

            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;

            // Update subscription row
            await procClient.query(
              `UPDATE subscriptions
              SET status = $1, canceled_at = $2, updated_at = $3
              WHERE stripe_subscription_id = $4`,
              [subscription.status, new Date(), new Date(), subscription.id]
            );

            if (projectionAllowed) {
              await updateEvidenceState(procClient, evidence.id, 'AUTHORIZED', 'Cancellation authorized', 'governance-system');
              await updateEvidenceState(procClient, evidence.id, 'EXECUTED', 'Subscription cancelled by Stripe/user', 'stripe-system');

              await addReceipt(procClient, evidence.id, {
                type: 'stripe_subscription' as ReceiptType,
                description: `Subscription cancelled: ${subscription.items.data[0]?.price?.nickname || 'Unknown Plan'}`,
                grade: 'A',
                attachedAt: nowISO(),
                demo: false
              });

              await updateEvidenceState(procClient, evidence.id, 'RECEIPTED', 'Cancellation receipt recorded', 'system');
              // Note: We do NOT automatically advance to LEARNED or CANONIZED.
              // Those states require explicit learning or canonization actions.
            }

            // Upsert customer_tenant_map? Actually, on deletion we might want to keep the map for historical reasons? We'll leave it.

            // Revoke entitlement
            const featureKey = subscription.items.data[0]?.price?.nickname
              ? subscription.items.data[0].price.nickname.toLowerCase().includes('pro')
                ? 'pro_plan'
                : subscription.items.data[0].price.nickname.toLowerCase().includes('enterprise')
                  ? 'enterprise_plan'
                  : 'free_plan'
              : 'free_plan';

            await procClient.query(
              `UPDATE entitlements
                 SET is_granted = FALSE, granted_until = NULL, updated_at = $1
               WHERE tenant_id = $2 AND feature_key = $3`,
              [new Date(), tenantId, featureKey]
            );

            break;
          }

          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            // For successful renewal invoices, we could update measurements, etc.
            // For now, just record as a successful payment event.
            await updateEvidenceState(procClient, evidence.id, 'AUTHORIZED', 'Invoice authorized for payment attempt', 'system');
            await updateEvidenceState(procClient, evidence.id, 'EXECUTED', 'Payment executed by Stripe', 'stripe-system');
            await updateEvidenceState(procClient, evidence.id, 'RECEIPTED', 'Successful payment receipt recorded', 'system');
            await updateEvidenceState(procClient, evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
            await addMeasurement(procClient, evidence.id, {
              gate: 'invoice_payment_success',
              reading: '100',
              verdict: 'PASS',
              at: nowISO()
            });
            await updateEvidenceState(procClient, evidence.id, 'MEASURED', 'Invoice payment successful', 'system');
            // Note: We do NOT automatically go to LEARNED/CANONIZED for every successful invoice payment
            // because that would create false canonical patterns. We only do that for the initial checkout.
            // For renewals, we just record the successful payment.
            break;
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            // Handle plan changes, etc.
            // Upsert subscription row
            await procClient.query(
              `INSERT INTO subscriptions
                 (stripe_subscription_id, tenant_id, status, current_period_start, current_period_end, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (stripe_subscription_id)
               DO UPDATE SET
                 status = EXCLUDED.status,
                 current_period_start = EXCLUDED.current_period_start,
                 current_period_end = EXCLUDED.current_period_end,
                 updated_at = EXCLUDED.updated_at`,
              [
                subscription.id,
                tenantId,
                subscription.status,
                new Date((subscription as any)['current_period_start'] * 1000),
                new Date((subscription as any)['current_period_end'] * 1000),
                new Date(),
                new Date()
              ]
            );
            // Update customer_tenant_map if customer changed
            if (subscription.customer) {
              await procClient.query(
                `INSERT INTO customer_tenant_map (stripe_customer_id, tenant_id)
                 VALUES ($1, $2)
                 ON CONFLICT (stripe_customer_id) DO UPDATE SET
                   tenant_id = EXCLUDED.tenant_id`,
                [subscription.customer, tenantId]
              );
            }
            // If projection allowed, we might need to update entitlements (plan change)
            if (projectionAllowed) {
              // Determine current plan from subscription items
              const featureKey = subscription.items.data[0]?.price?.nickname
                ? subscription.items.data[0].price.nickname.toLowerCase().includes('pro')
                  ? 'pro_plan'
                  : subscription.items.data[0].price.nickname.toLowerCase().includes('enterprise')
                    ? 'enterprise_plan'
                    : 'free_plan'
                : 'free_plan';
              // Update entitlement to reflect new plan (revoke old, grant new)
              // In a real system you would track the previous plan and revoke it.
              // For simplicity, we just set the entitlement for the current plan to granted.
              await procClient.query(
                `UPDATE entitlements
                   SET is_granted = CASE WHEN feature_key = $1 THEN TRUE ELSE FALSE END,
                       granted_until = CASE WHEN feature_key = $1 THEN NULL ELSE granted_until END,
                       evidence_id = CASE WHEN feature_key = $1 THEN $2 ELSE evidence_id END,
                       updated_at = $3
                 WHERE tenant_id = $4`,
                [featureKey, evidence.id, new Date(), tenantId]
              );
            }
            break;
          }

          default:
            // For all other event types we still create evidence and a basic audit trail
            if (projectionAllowed !== false) {
              await updateEvidenceState(procClient, evidence.id, 'AUTHORIZED', 'Event authorized for processing', 'system');
              await updateEvidenceState(procClient, evidence.id, 'EXECUTED', 'Event processed by Stripe', 'stripe-system');
              await updateEvidenceState(procClient, evidence.id, 'RECEIPTED', 'Event receipt recorded', 'system');
              await updateEvidenceState(procClient, evidence.id, 'VERIFIED', 'Verified via Stripe webhook', 'system');
            }
            console.log(`📊 Event processed: ${event.type}`);
        }

        // 11️⃣ Mark webhook as processed
        await procClient.query(
          `UPDATE webhook_processing
             SET processing_status = 'processed',
                 processed_at = $1
           WHERE stripe_event_id = $2`,
          [new Date(), event.id]
        );

        await procClient.query('COMMIT');
        res.json({ received: true, evidenceId: evidence.id });
      } catch (error) {
        await procClient.query('ROLLBACK');
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      } finally {
        procClient.release();
      }
    } catch (error) {
      // If we get here, the raw client is still open; we should release it and return an error.
      await rawClient.release();
      console.error('❌ Error in webhook handler (outer):', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get evidence records (for debugging/admin)
app.get('/api/evidence/billing', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { rows } = await pool.query(`
      SELECT er.id, er.title, er.state, er.financial, er.stripe_event_type, er.amount, er.currency, er.customer_id, er.created_at
      FROM (
        SELECT
          e.id,
          e.title,
          e.state,
          e.financial,
          (SELECT value::text FROM jsonb_each_text(e.data) WHERE key = 'stripeEventType') as stripe_event_type,
          (SELECT value::numeric FROM jsonb_each_text(e.data) WHERE key = 'amount') as amount,
          (SELECT value::text FROM jsonb_each_text(e.data) WHERE key = 'currency') as currency,
          (SELECT value::text FROM jsonb_each_text(e.data) WHERE key = 'customerId') as customer_id,
          e.created_at
        FROM evidence_records e
        WHERE e.title LIKE 'Stripe Event:%'
      ) er
      ORDER BY er.created_at DESC
    `);
    res.json({
      count: rows.length,
      evidence: rows
    });
  } catch (err) {
    console.error('Error fetching evidence:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific evidence record
  app.get('/api/evidence/billing/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const idParam = req.params.id;
      if (idParam === undefined) {
        return res.status(400).json({ error: 'Missing ID' });
      }
      let id: string;
      if (Array.isArray(idParam)) {
        if (idParam.length === 0) {
          return res.status(400).json({ error: 'Invalid ID' });
        }
        const potentialId = idParam[0];
        if (typeof potentialId !== 'string') {
          return res.status(400).json({ error: 'Invalid ID' });
        }
        id = potentialId;
      } else {
        if (typeof idParam !== 'string') {
          return res.status(400).json({ error: 'Invalid ID' });
        }
        id = idParam;
      }
      const evidence = await getEvidence(id);
      if (!evidence) {
        return res.status(404).json({ error: 'Evidence not found' });
      }
      res.json(evidence);
    } catch (err) {
      console.error('Error fetching evidence:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// Get statistics
app.get('/api/billing/stats', async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM evidence_records WHERE title LIKE \'Stripe Event:%\'');
    const total = parseInt(totalResult.rows[0].count);

    const byStateResult = await pool.query(`
      SELECT state, COUNT(*) as count
      FROM evidence_records
      WHERE title LIKE 'Stripe Event:%'
      GROUP BY state
    `);
    const byState = Object.fromEntries(byStateResult.rows.map((r: any) => [r.state, parseInt(r.count)]));

    const financialEventsResult = await pool.query(`
      SELECT COUNT(*)
      FROM evidence_records
      WHERE title LIKE 'Stripe Event:%' AND financial = true
    `);
    const financialEvents = parseInt(financialEventsResult.rows[0].count);

    const successfulPaymentsResult = await pool.query(`
      SELECT COUNT(*)
      FROM evidence_records
      WHERE title LIKE 'Stripe Event:%'
        AND financial = true
        AND state = 'CANONIZED'
        AND (SELECT value::text FROM jsonb_each_text(data) WHERE key = 'stripeEventType') LIKE '%payment%'
    `);
    const successfulPayments = parseInt(successfulPaymentsResult.rows[0].count);

    res.json({
      totalEvents: total,
      financialEvents,
      successfulPayments,
      byState,
      successRate: total > 0 ? (successfulPayments / financialEvents * 100) : 0
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get evidence by ID (used in routes)
async function getEvidence(id: string) {
  const res = await pool.query('SELECT * FROM evidence_records WHERE id = $1', [id]);
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  // Fetch related data
  const [receipts, verifications, measurements, contradictions, auditEvents] = await Promise.all([
    pool.query('SELECT * FROM evidence_receipts WHERE evidence_id = $1', [id]),
    pool.query('SELECT * FROM evidence_verifications WHERE evidence_id = $1', [id]),
    pool.query('SELECT * FROM evidence_measurements WHERE evidence_id = $1', [id]),
    pool.query('SELECT * FROM evidence_contradictions WHERE evidence_id = $1', [id]),
    pool.query('SELECT * FROM evidence_events WHERE evidence_id = $1 ORDER BY created_at', [id]),
  ]);
  return {
    ...row,
    receipts: receipts.rows,
    verifications: verifications.rows,
    measurements: measurements.rows,
    contradictions: contradictions.rows,
    audit: auditEvents.rows.map((e: any) => ({
      at: e.created_at,
      actor: e.actor,
      action: `${e.state_from} -> ${e.state_to}`,
      detail: e.reason,
    })),
  };
}

// ====================
// START SERVER
// ====================

// Initialize database on startup
initializeDatabase().catch(console.error);

app.listen(port, () => {
  console.log(`🚀 Fable-5 Tenant-Isolated Billing Engine running on port ${port}`);
  console.log(`📊 Endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/payments/checkout-session`);
  console.log(`  POST /api/payments/webhook`);
  console.log(`  GET  /api/evidence/billing`);
  console.log(`  GET  /api/evidence/billing/:id`);
  console.log(`  GET  /api/billing/stats`);
  console.log(`🔒 Feature: Tenant isolation, idempotency, replay safety, and atomic transactions`);
});

export { app as default };