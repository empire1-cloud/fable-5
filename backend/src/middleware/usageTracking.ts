import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Import types from our evidence system
import type { EvidenceRecord, Receipt, AuditEvent, EvidenceState, ReceiptType, EvidenceGrade } from '../types';

// In-memory storage for usage metrics (in production, use Redis or database)
interface UsageMetric {
  id: string;
  customerId: string;
  apiEndpoint: string;
  method: string;
  timestamp: string; // ISO
  responseTimeMs: number;
  statusCode: number;
  metadata?: Record<string, any>;
}

const usageMetrics: UsageMetric[] = [];
const hourlyUsageAggregates = new Map<string, Map<string, number>>(); // customerId -> { endpoint -> count }

// ====================
// USAGE TRACKING MIDDLEWARE
// ====================

/**
 * Middleware to track API usage for billing purposes
 * Should be mounted early in the middleware chain
 */
export function usageTrackingMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip tracking for internal/health endpoints
    if (req.path.startsWith('/api/health') || req.path.startsWith('/api/evidence')) {
      return next();
    }

    const startTime = Date.now();

    // Capture response finish event
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      const responseTimeMs = Date.now() - startTime;

      // Extract customer ID from auth token or API key (simplified for demo)
      const customerId = extractCustomerId(req);

      if (customerId) {
        // Record individual usage metric
        const metric: UsageMetric = {
          id: `usage_${uuidv4()}`,
          customerId,
          apiEndpoint: req.path,
          method: req.method,
          timestamp: new Date().toISOString(),
          responseTimeMs,
          statusCode: res.statusCode,
          metadata: {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            queryParams: req.query,
            // Don't log sensitive data like body/content-length in production
          }
        };

        usageMetrics.push(metric);

        // Update hourly aggregates
        const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
        if (!hourlyUsageAggregates.has(customerId)) {
          hourlyUsageAggregates.set(customerId, new Map());
        }
        const customerMap = hourlyUsageAggregates.get(customerId)!;
        const endpointKey = `${req.method}:${req.path}`;
        const currentCount = customerMap.get(endpointKey) || 0;
        customerMap.set(endpointKey, currentCount + 1);

        // Every 100 requests, create a usage billing event
        if (usageMetrics.length % 100 === 0) {
          createUsageBillingEvent(customerId, 100); // 100 units of usage
        }
      }

      // Restore original end method
      res.end = originalEnd;
      return originalEnd.call(this, chunk, encoding, callback);
    };

    next();
  };
}

/**
 * Extract customer ID from request (simplified implementation)
 * In production, this would validate JWT, API key, session, etc.
 */
function extractCustomerId(req: Request): string | null {
  // Try to get from Authorization header (Bearer token)
  const authHeader = req.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In real app, decode JWT and extract customer ID
    // For demo, use hash of token or mock mapping
    return `cust_${Buffer.from(token).toString('base64').substring(0, 8)}`;
  }

  // Try to get from API key header
  const apiKey = req.get('X-API-Key');
  if (apiKey) {
    return `cust_${Buffer.from(apiKey).toString('base64').substring(0, 8)}`;
  }

  // Try to get from custom header
  const customerIdHeader = req.get('X-Customer-ID');
  if (customerIdHeader) {
    return customerIdHeader;
  }

  // For demo purposes, if no auth, use a default customer
  // In production, you'd return null and skip tracking unauthenticated requests
  return 'demo_customer';
}

/**
 * Create a usage-based billing event that flows through the evidence system
 * This would typically be integrated with your evidence service
 */
function createUsageBillingEvent(customerId: string, usageUnits: number) {
  // This would normally call your evidence service API
  // For demo, we'll simulate creating an evidence record

  const usageEvent: EvidenceRecord = {
    id: `ev_usage_${uuidv4()}`,
    missionId: `mission_usage_${uuidv4()}`,
    title: `API Usage Billing: ${usageUnits} units for customer ${customerId}`,
    state: 'PROPOSED',
    financial: true, // Usage billing is financial
    confidence: 0.9, // High confidence from metered usage
    receipts: [],
    contradictions: [],
    audit: [{
      at: new Date().toISOString(),
      actor: 'usage-metering-system',
      action: 'recorded',
      detail: `${usageUnits} API usage units recorded for ${customerId}`
    }],
    // Add usage-specific fields (would extend EvidenceRecord in real implementation)
    // These would be stored in a separate usage_events table or as metadata
    usageMetadata: {
      customerId,
      usageUnits,
      unitType: 'api_call',
      timestamp: new Date().toISOString(),
      billingPeriod: getCurrentBillingPeriod()
    }
  };

  // In a real system, you would:
  // 1. Save this to your events/database
  // 2. Trigger the evidence state machine progression
  // 3. Eventually create a line item on the customer's invoice

  console.log(`📊 Usage billing event created: ${usageEvent.id} for ${usageUnits} units`);

  // For demo, return the event
  return usageEvent;
}

/**
 * Get current billing period identifier (YYYY-MM)
 */
function getCurrentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ====================
// USAGE REPORTING ENDPOINTS
// ====================

/**
 * Get usage statistics for a customer
 */
function getUsageStats(req: Request, res: Response) {
  const { customerId } = req.params;
  const { startDate, endDate } = req.query;

  // Filter metrics for customer and date range
  let filteredMetrics = usageMetrics.filter(m => m.customerId === customerId);

  if (startDate) {
    filteredMetrics = filteredMetrics.filter(m => new Date(m.timestamp) >= new Date(startDate as string));
  }
  if (endDate) {
    filteredMetrics = filteredMetrics.filter(m => new Date(m.timestamp) <= new Date(endDate as string));
  }

  // Aggregate by endpoint
  const byEndpoint = filteredMetrics.reduce((acc, metric) => {
    const key = `${metric.method}:${metric.apiEndpoint}`;
    if (!acc[key]) {
      acc[key] = { count: 0, totalResponseTime: 0, avgResponseTime: 0 };
    }
    acc[key].count++;
    acc[key].totalResponseTime += metric.responseTimeMs;
    acc[key].avgResponseTime = acc[key].totalResponseTime / acc[key].count;
    return acc;
  }, {} as Record<string, { count: number; totalResponseTime: number; avgResponseTime: number }>);

  res.json({
    customerId,
    period: {
      start: startDate || undefined,
      end: endDate || undefined
    },
    totalRequests: filteredMetrics.length,
    byEndpoint,
    hourlyAggregates: hourlyUsageAggregates.get(customerId) || new Map()
  });
}

/**
 * Reset usage counters (typically called at billing period boundary)
 */
function resetUsageCounters(req: Request, res: Response) {
  // In production, this would archive current period data and reset counters
  const customerId = req.params.customerId;

  // Archive current hour data (simplified)
  if (customerId && hourlyUsageAggregates.has(customerId)) {
    const archivedData = {
      customerId,
      timestamp: new Date().toISOString(),
      data: Object.fromEntries(hourlyUsageAggregates.get(customerId)!)
    };

    // In production, save to analytics database
    console.log(`📦 Archiving usage data:`, JSON.stringify(archivedData, null, 2));

    // Reset counters
    hourlyUsageAggregates.delete(customerId);
  }

  res.json({
    message: `Usage counters reset for customer ${customerId || 'all'}`,
    timestamp: new Date().toISOString()
  });
}

// ====================
// EXPORT MIDDLEWARE AND CONTROLLERS
// ====================

export {
  usageTrackingMiddleware,
  getUsageStats,
  resetUsageCounters
};

// For demonstration - simulate some usage
if (require.main === module) {
  // Demo mode - simulate API usage
  console.log('🚀 Usage Tracking Middleware Demo');

  // Simulate some API calls
  setInterval(() => {
    const fakeReq = {
      path: '/api/opportunities',
      method: 'GET',
      headers: {
        'authorization': 'Bearer demo_token_123',
        'user-agent': 'demo-client/1.0'
      },
      ip: '127.0.0.1',
      query: {}
    };

    const fakeRes = {
      statusCode: 200,
      end: function() {}
    };

    const middleware = usageTrackingMiddleware();
    middleware(fakeReq as any, fakeRes as any, () => {});

    console.log(`📈 Simulated API call. Total usage records: ${usageMetrics.length}`);

    // Every 10 calls, show stats
    if (usageMetrics.length % 10 === 0) {
      console.log('📊 Current usage stats:');
      console.log(`   Total events: ${usageMetrics.length}`);
      const uniqueCustomers = new Set(usageMetrics.map(m => m.customerId));
      console.log(`   Unique customers: ${uniqueCustomers.size}`);
    }
  }, 1000); // 1 request per second for demo
}