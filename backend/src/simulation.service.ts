import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';

// Import types from our evidence system
import type { EvidenceRecord, Receipt, AuditEvent, EvidenceState, ReceiptType, EvidenceGrade, IntentToken } from '../types';
import type { Opportunity, Decision, Mission, EvidenceItem, EpistemicType, AllocationScores, GenomeSection, CompanyGenome, MarketNode, ResourceAllocation } from '../types';

// In-memory stores (would typically come from database)
let evidenceRecords: EvidenceRecord[] = [];
let intentTokens: IntentToken[] = [];
let opportunities: Opportunity[] = [];
let decisions: Decision[] = [];
let missions: Mission[] = [];
let genomes: CompanyGenome[] = [];
let marketNodes: MarketNode[] = [];
let allocations: ResourceAllocation[] = [];

// ====================
// SIMULATION SERVICE
// ====================

/**
 * Simulation service for generating realistic test data for Fable-5
 * Can generate:
 * - Stripe events that flow through evidence system
 * - Demo data for all workspaces
 * - Business scenario simulations
 */
class SimulationService {
  private stripe: Stripe;

  constructor(stripeSecretKey: string) {
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  }

  /**
   * Generate a random timestamp within the last N days
   */
  private randomDate(daysAgo: number) {
    return new Date(Date.now() - Math.floor(Math.random() * d * 24 * 60 * 60 * 1000)).toISOString();
  }

  /**
   * Generate a random ID with prefix
   */
  private id(prefix: string) {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate realistic Stripe event data
   */
  private generateStripeEvent(type: string): Stripe.Event {
    const id = `evt_${Math.random().toString(36).substr(2, 9)}`;
    const created = Math.floor(Date.now() / 1000);

    switch (type) {
      case 'checkout.session.completed':
        return {
          id,
          object: 'event',
          api_version: '2023-10-16',
          created,
          data: {
            object: {
              id: `cs_${this.id('test')}`,
              object: 'checkout.session',
              amount_total: Math.floor(Math.random() * 10000) + 500, // $5-$105
              currency: ['usd', 'eur', 'gbp'][Math.floor(Math.random() * 3)],
              customer: `cus_${this.id('test')}`,
              subscription: Math.random() > 0.5 ? `sub_${this.id('test')}` : null,
              payment_status: 'paid',
              status: 'complete'
            }
          },
          livemode: false,
          pending_webhooks: 1,
          request: { id: null, idempotency_key: null },
          type: 'checkout.session.completed'
        } as Stripe.Event;

      case 'invoice.payment_failed':
        return {
          id,
          object: 'event',
          api_version: '2023-10-16',
          created,
          data: {
            object: {
              id: `in_${this.id('test')}`,
              object: 'invoice',
              amount_due: Math.floor(Math.random() * 5000) + 500, // $5-$55
              amount_paid: 0,
              currency: ['usd', 'eur', 'gbp'][Math.floor(Math.random() * 3)],
              customer: `cus_${this.id('test')}`,
              date: Math.floor(Date.now() / 1000),
              status: 'open',
              subscription: `sub_${this.id('test')}`
            }
          },
          livemode: false,
          pending_webhooks: 1,
          request: { id: null, idempotency_key: null },
          type: 'invoice.payment_failed'
        } as Stripe.Event;

      case 'customer.subscription.created':
        return {
          id,
          object: 'event',
          api_version: '2023-10-16',
          created,
          data: {
            object: {
              id: `sub_${this.id('test')}`,
              object: 'subscription',
              customer: `cus_${this.id('test')}`,
              current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
              current_period_start: Math.floor(Date.now() / 1000),
              status: 'active',
              items: {
                data: [{
                  id: `si_${this.id('test')}`,
                  object: 'subscription_item',
                  price: {
                    id: `price_${this.id('test')}`,
                    object: 'price',
                    unit_amount: Math.floor(Math.random() * 5000) + 500, // $5-$55
                    currency: ['usd', 'eur', 'gbp'][Math.floor(Math.random() * 3)],
                    recurring: { interval: 'month' }
                  },
                  quantity: 1
                }]
              }
            }
          },
          livemode: false,
          pending_webhooks: 1,
          request: { id: null, idempotency_key: null },
          type: 'customer.subscription.created'
        } as Stripe.Event;

      default:
        // Generic event
        return {
          id,
          object: 'event',
          api_version: '2023-10-16',
          created,
          data: { object: { id: `obj_${this.id('test')}`, object: 'object' } },
          livemode: false,
          pending_webhooks: 1,
          request: { id: null, idempotency_key: null },
          type
        } as Stripe.Event;
    }
  }

  /**
   * Generate a realistic Intent Token
   */
  private generateIntentToken(): IntentToken {
    const actions = ['process_payment', 'api_access', 'data_export', 'user_management'];
    const vendors = ['stripe', 'aws', 'google-cloud', 'sendgrid', 'twilio'];
    const environments = ['prod', 'sandbox'];
    const recurrences: ('one-shot' | 'bounded')[] = ['one-shot', 'bounded'];

    return {
      id: `fit_${this.id('token')}`,
      approvedBy: ['founder', 'cto', 'cio'][Math.floor(Math.random() * 3)],
      action: actions[Math.floor(Math.random() * actions.length)],
      vendorOrSystem: vendors[Math.floor(Math.random() * vendors.length)],
      maxAmount: Math.floor(Math.random() * 10000) + 1000, // $10-$110
      currency: ['USD', 'EUR', 'GBP'][Math.floor(Math.random() * 3)],
      expiresAt: new Date(Date.now() + Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000).toISOString(),
      recurrence: recurrences[Math.floor(Math.random() * recurrences.length)],
      environment: environments[Math.floor(Math.random() * environments.length)],
      revoked: Math.random() > 0.95, // 5% chance of being revoked
      audit: [{
        at: this.randomDate(30),
        actor: ['founder', 'system', 'admin'][Math.floor(Math.random() * 3)],
        action: 'issued',
        detail: 'Issued for service access'
      }]
    };
  }

  /**
   * Generate a realistic Opportunity
   */
  private generateOpportunity(): Opportunity {
    const stages = ['ideation', 'validation', 'scaling', 'maturity'];
    return {
      id: `opp_${this.id('opp')}`,
      title: [
        'AI-powered customer segmentation',
        'Real-time analytics dashboard',
        'Automated compliance reporting',
        'Customer churn prediction engine',
        'Dynamic pricing optimization',
        'Fraud detection system',
        'Personalized recommendation engine',
        'Supply chain optimization',
        'Employee performance analytics',
        'Market trend forecasting'
      ][Math.floor(Math.random() * 10)],
      score: Math.floor(Math.random() * 100),
      evidence: [{
        text: [
          'Market research indicates strong demand',
          'Customer interviews validate pain point',
          'Competitive analysis shows gap in market',
          'Technical feasibility study completed',
          'Pilot program with beta users successful'
        ][Math.floor(Math.random() * 5)] as string,
        type: ['fact', 'inference', 'forecast', 'hypothèse', 'assumption'][Math.floor(Math.random() * 5)] as EpistemicType
      }],
      assumptions: [
        'Market will grow at 15% YoY',
        'Customer acquisition cost < $50',
        'Churn rate < 5% monthly',
        'Regulatory environment stable',
        'Technology stack remains viable'
      ],
      expectedValue: `$${Math.floor(Math.random() * 1000000)}`,
      confidence: Math.random() * 0.9 + 0.1, // 0.1-1.0
      risk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      dependencies: [
        'API gateway completion',
        'Data pipeline setup',
        'Security audit passed',
        'User acceptance testing',
        'Regulatory approval'
      ],
      nextExperiment: [
        'Run A/B test on pricing tiers',
        'Conduct user interviews with enterprise clients',
        'Build MVP core features',
        'Performance benchmarking',
        'Security penetration test'
      ][Math.floor(Math.random() * 5)],
      alloc: {
        expectedReturn: `${Math.floor(Math.random() * 100)}%`,
        confidence: Math.random(),
        strategicValue: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        learningValue: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        cost: `$${Math.floor(Math.random() * 100000)}`,
        reversibility: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        timeToProof: `${Math.floor(Math.random() * 6) + 1} months`,
        risk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
      }
    };
  }

  /**
   * Generate a realistic Decision
   */
  private generateDecision(): Decision {
    return {
      id: `dec_${this.id('dec')}`,
      question: [
        'Should we invest in the new AI feature?',
        'Approve budget for marketing campaign?',
        'Hire additional engineering staff?',
        'Partner with third-party vendor?',
        'Launch beta program to select customers?',
        'Allocate resources to refactor legacy system?',
        'Invest in employee training program?',
        'Adopt new cloud architecture?',
        'Implement automated decision: 'Should we proceed with the feature rollout?'
      ][Math.floor(Math.random() * 9)],
      evidence: [
        {
          text: [
            'Customer satisfaction scores increased 20%',
            'Usage metrics show 35% adoption rate',
            'Competitor analysis reveals market gap',
            'Financial projections indicate positive ROI',
            'Risk assessment shows manageable exposure'
          ][Math.floor(Math.random() * 5)] as string,
          type: ['fact', 'inference', 'forecast', 'hypothèse', 'assumption'][Math.floor(Math.random() * 5)] as EpistemicType
        }
      ],
      assumptions: [
        'Market conditions remain stable',
        'Technical dependencies are available',
        'Regulatory approval timeline',
        'Customer adoption follows projected curve',
        'Resource constraints are manageable'
      ],
      confidence: Math.random() * 0.8 + 0.2, // 0.2-1.0
      upside: [
        'Capture additional market share',
        'Improve customer retention',
        'Reduce operational costs by 25%',
        'Accelerate time-to-market for future features',
        'Strengthen competitive position'
      ][Math.floor(Math.random() * 5)],
      downside: [
        'Potential delays in other initiatives',
        'Increased technical debt if rushed',
        'Customer confusion during transition',
        'Resource diversion from core products',
        'Regulatory compliance risks'
      ][Math.floor(Math.random() * 5)],
      reversibility: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
      cost: `$${Math.floor(Math.random() * 500000)}`,
      dependencies: [
        'Infrastructure readiness',
        'Stakeholder alignment',
        'Resource availability',
        'External dependencies met',
        'Quality assurance complete'
      ],
      recommendedAction: [
        'Proceed with implementation',
        'Delay for further analysis',
        'Pilot with limited user group',
        'Seek alternative solutions',
        'Maintain current approach'
      ][Math.floor(Math.random() * 5)],
      requiredAuthority: ['L1', 'L2', 'L3', 'L4', 'L5'][Math.floor(Math.random() * 5)],
      nextVerificationEvent: [
        'User acceptance testing completion',
        'Performance benchmark results',
        'Security audit approval',
        'Customer feedback session',
        'Financial review cycle'
      ][Math.floor(Math.random() * 5)]
    };
  }

  /**
   * Generate a realistic Company Genome
   */
  private generateGenome(): CompanyGenome {
    const maturities: ('Draft' | 'Tested' | 'Verified' | 'Replication-Ready')[] =
      ['Draft', 'Tested', 'Verified', 'Replication-Ready'];
    return {
      id: `gen_${this.id('gen')}`,
      name: [
        'Nexus Dynamics',
        'Vertex Solutions',
        'Apex Innovations',
        'Summit Technologies',
        'Catalyst Systems',
        'Momentum Labs',
        'Forge Industries',
        'Pioneer Group',
        'Vanguard Corp',
        'Helix Enterprises'
      ][Math.floor(Math.random() * 10)],
      thesis: [
        'AI-driven automation will transform enterprise workflows',
        'Data privacy concerns create opportunity for secure solutions',
        'Remote work trends demand better collaboration tools',
        'Sustainability requirements drive green technology adoption',
        'Experience economy values personalization over features'
      ][Math.floor(Math.random() * 5)],
      maturity: maturities[Math.floor(Math.random() * maturities.length)],
      sections: [
        {
          key: 'problem',
          group: 'foundation',
          label: 'Core Problem Statement',
          value: 'Enterprises struggle with fragmented data systems causing inefficiencies',
          proven: Math.random() > 0.3
        },
        {
          key: 'customer',
          group: 'market',
          label: 'Target Customer Profile',
          value: 'Mid-market companies with 100-1000 employees undergoing digital transformation',
          proven: Math.random() > 0.4
        },
        {
          key: 'wedge',
          group: 'differentiation',
          label: 'Unique Value Proposition',
          value: 'AI-powered context-aware automation that reduces manual work by 40%',
          proven: Math.random() > 0.2
        },
        {
          key: 'offer',
          group: 'product',
          label: 'Core Offering',
          value: 'Platform-as-a-service with modular AI components',
          proven: Math.random() > 0.3
        },
        {
          key: 'pricing',
          group: 'monetization',
          label: 'Pricing Strategy',
          value: 'Tiered subscription with usage-based overages',
          proven: Math.random() > 0.5
        }
      ],
      verifiedPlaybooks: [
        'Customer onboarding process',
        'Feature release procedure',
        'Incident response protocol',
        'Quarterly business review template'
      ].slice(0, Math.floor(Math.random() * 4)),
      missingForNextStage: [
        'Customer success metrics',
        'Partner ecosystem development',
        'Advanced analytics capabilities',
        'International expansion framework'
      ].slice(0, Math.floor(Math.random() * 4)),
      economicGateType: [
        'NRR > 110%',
        'Gross margin > 70%',
        'Payback period < 12 months',
        'LTV:COD > 3:1',
        'Months to recover CAC < 5'
      ][Math.floor(Math.random() * 5)]
    };
  }

  /**
   * Generate a realistic Market Node
   */
  private generateMarketNode(): MarketNode {
    return {
      id: `node_${this.id('node')}`,
      genomeId: `gen_${Math.floor(Math.random() * 1000)}`, // Would reference actual genome
      geography: [
        'North America',
        'Europe',
        'Asia-Pacific',
        'Latin America',
        'Middle East & Africa'
      ][Math.floor(Math.random() * 5)],
      vertical: [
        'Financial Services',
        'Healthcare',
        'Retail',
        'Manufacturing',
        'Technology',
        'Education'
      ][Math.floor(Math.random() * 6)],
      segment: [
        'Enterprise (>1000 employees)',
        'Mid-market (100-1000 employees)',
        'SMB (<100 employees)'
      ][Math.floor(Math.random() * 3)],
      offer: [
        'Platform license',
        'Professional services',
        'Managed services',
        'Training & certification',
        'Premium support'
      ][Math.floor(Math.random() * 5)],
      localModules: [
        'Localization pack',
        'Regulatory compliance module',
        'Industry-specific templates',
        'Payment gateway integration',
        'Reporting dashboard'
      ].slice(0, Math.floor(Math.random() * 5)),
      gateType: [
        'NRR threshold',
        'Customer acquisition cost payback',
        'Product-market fit validation',
        'Scale readiness assessment',
        'Profitability milestone'
      ][Math.floor(Math.random() * 5)],
      evidenceState: [
        'PROPOSED',
        'AUTHORIZED',
        'EXECUTED',
        'RECEIPTED',
        'VERIFIED',
        'MEASURED',
        'LEARNED',
        'CANONIZED'
      ][Math.floor(Math.random() * 8)],
      autonomy: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'][Math.floor(Math.random() * 6)],
      status: [
        'Exploring',
        'Validating',
        'Active',
        'Scaling',
        'Paused',
        'Killed',
        'Archived'
      ][Math.floor(Math.random() * 7)],
      alloc: {
        expectedReturn: `${Math.floor(Math.random() * 100)}%`,
        confidence: Math.random(),
        strategicValue: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        learningValue: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        cost: `$${Math.floor(Math.random() * 100000)}`,
        reversibility: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        timeToProof: `${Math.floor(Math.random() * 6) + 1} months`,
        risk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
      }
    };
  }

  /**
   * Generate a realistic Resource Allocation
   */
  private generateResourceAllocation(): ResourceAllocation {
    const resources = [
      'founder time',
      'agent time',
      'cash',
      'compute',
      'engineering capacity',
      'distribution capacity',
      'partnership bandwidth',
      'legal effort',
      'operational attention'
    ];

    return {
      resource: resources[Math.floor(Math.random() * resources.length)],
      targetId: `target_${this.id('tgt')}`,
      targetType: Math.random() > 0.5 ? 'opportunity' : 'node',
      amount: Math.floor(Math.random() * 100) + 1 // 1-100 units
    };
  }

  /**
   * Generate a complete set of demo data for all workspaces
   */
  async generateFullDemoData() {
    console.log('🎲 Generating comprehensive demo data for Fable-5...');

    // Clear existing data (in dev environment)
    evidenceRecords = [];
    intentTokens = [];
    opportunities = [];
    decisions = [];
    missions = [];
    genomes = [];
    marketNodes = [];
    allocations = [];

    // Generate Intent Tokens (for governance)
    for (let i = 0; i < 5; i++) {
      intentTokens.push(this.generateIntentToken());
    }

    // Generate Opportunities (for allocation)
    for (let i = 0; i < 8; i++) {
      opportunities.push(this.generateOpportunity());
    }

    // Generate Decisions (for governance)
    for (let i = 0; i < 6; i++) {
      decisions.push(this.generateDecision());
    }

    // Generate Missions (for control plane)
    for (let i = 0; i < 10; i++) {
      missions.push({
        id: `mission_${this.id('mis')}`,
        objective: [
          'Launch MVP for new customer segment',
          'Improve system performance by 40%',
          'Reduce customer churn rate',
          'Expand to new geographic market',
          'Develop strategic partnership program',
          'Enhance data security and compliance',
          'Build developer ecosystem',
          'Implement AI-powered recommendations',
          'Create self-service customer portal',
          'Establish thought leadership program'
        ][Math.floor(Math.random() * 10)],
        opportunityId: Math.random() > 0.5 ? `opp_${Math.floor(Math.random() * 1000)}` : undefined,
        nodeId: Math.random() > 0.5 ? `node_${Math.floor(Math.random() * 1000)}` : undefined,
        engineId: ['00', '01', '02', '03', '04', '05', '06', '07', '08'][Math.floor(Math.random() * 9)] as any,
        owner: [
          'alice@company.com',
          'bob@company.com',
          'carol@company.com',
          'david@company.com',
          'eve@company.com'
        ][Math.floor(Math.random() * 5)],
        autonomy: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'][Math.floor(Math.random() * 6)],
        status: [
          'QUEUED',
          'ACTIVE',
          'BLOCKED'
        ][Math.floor(Math.random() * 3)],
        budget: `$${Math.floor(Math.random() * 200000)}`,
        successCriteria: [
          'Achieve 95% uptime SLA',
          'Reduce average response time < 200ms',
          'Increase user adoption by 30%',
          'Achieve zero critical security findings',
          'Generate $100k in new revenue'
        ][Math.floor(Math.random() * 5)],
        evidenceRequirement: [
          'Performance benchmark results',
          'User acceptance testing completion',
          'Security audit certification',
          'Customer feedback analysis',
          'Financial ROI calculation'
        ][Math.floor(Math.random() * 5)],
        evidenceRecordId: `ev_${this.id('ev')}`,
        financial: Math.random() > 0.7, // 30% chance of being financial
        blocker: Math.random() > 0.8 ? [
          'Dependency on external API not ready',
          'Key personnel unavailable',
          'Regulatory approval pending',
          'Infrastructure provisioning delayed',
          'Budget approval outstanding'
        ][Math.floor(Math.random() * 5)] : undefined,
        escalationCondition: [
          'Budget exceeds approved limit by 20%',
          'Timeline slips by more than 2 weeks',
          'Critical security vulnerability discovered',
          'Key stakeholder withdraws support',
          'Legal compliance issue identified'
        ][Math.floor(Math.random() * 5)]
      });
    }

    // Generate Genomes (for genomes workspace)
    for (let i = 0; i < 4; i++) {
      genomes.push(this.generateGenome());
    }

    // Generate Market Nodes (for genomes workspace)
    for (let i = 0; i < 6; i++) {
      marketNodes.push(this.generateMarketNode());
    }

    // Generate Resource Allocations (for allocation workspace)
    for (let i = 0; i < 12; i++) {
      allocations.push(this.generateResourceAllocation());
    }

    console.log(`✅ Generated demo data:`);
    console.log(`   • ${intentTokens.length} Intent Tokens`);
    console.log(`   • ${opportunities.length} Opportunities`);
    console.log(`   • ${decisions.length} Decisions`);
    console.log(`   • ${missions.length} Missions`);
    console.log(`   • ${genomes.length} Genomes`);
    console.log(`   • ${marketNodes.length} Market Nodes`);
    console.log(`   • ${allocations.length} Resource Allocations`);

    return {
      intentTokens,
      opportunities,
      decisions,
      missions,
      genomes,
      marketNodes,
      allocations
    };
  }

  /**
   * Generate a batch of Stripe events to flow through evidence system
   */
  async generateStripeEvents(count: number = 10) {
    const eventTypes = [
      'checkout.session.completed',
      'invoice.payment_failed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'charge.refunded',
      'payment_intent.succeeded',
      'payment_intent.payment_failed'
    ];

    console.log(`⚡ Generating ${count} Stripe events for evidence processing...`);

    const events = [];
    for (let i = 0; i < count; i++) {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const event = this.generateStripeEvent(type);
      events.push(event);

      // In a real system, this would be sent to the webhook endpoint
      // For simulation, we'll just log it
      console.log(`📡 Generated event: ${event.type} [${event.id}]`);
    }

    return events;
  }

  /**
   * Simulate a business scenario (e.g., successful product launch)
   */
  async simulateBusinessScenario(scenarioType: 'launch' | 'chrisis' | 'expansion') {
    console.log(`🎭 Simulating business scenario: ${scenarioType}`);

    switch (scenarioType) {
      case 'launch':
        // Simulate a successful product launch
        console.log('   → Generating successful launch events...');
        // Multiple successful payments, new subscriptions, positive metrics
        await this.generateStripeEvents(15); // Mix of successful events
        break;

      case 'chrisis':
        // Simulate a billing/churn crisis
        console.log('   → Generating crisis scenario events...');
        // More failed payments, cancellations, disputes
        const events = [];
        for (let i = 0; i < 10; i++) {
          const type = Math.random() > 0.5 ?
            'invoice.payment_failed' :
            'customer.subscription.deleted';
          events.push(this.generateStripeEvent(type));
        }
        return events;

      case 'expansion':
        // Simulate market expansion
        console.log('   → Generating expansion scenario events...');
        // Mix of new subscriptions, upgrades, international payments
        await this.generateStripeEvents(12);
        break;
    }
  }
}

// ====================
// SIMULATION ENDPOINTS
// ====================

// Initialize simulation service
const simulationService = new SimulationService(process.env.STRIPE_SECRET_KEY!);

/**
 * Endpoint to generate and store demo data for all workspaces
 */
async function generateDemoData(req: Request, res: Response) {
  try {
    const data = await simulationService.generateFullDemoData();

    // Store in global variables (in real app, this would go to database)
    // For now, just return the generated data
    res.json({
      success: true,
      message: 'Demo data generated successfully',
      data: {
        counts: {
          intentTokens: data.intentTokens.length,
          opportunities: data.opportunities.length,
          decisions: data.decisions.length,
          missions: data.missions.length,
          genomes: data.genomes.length,
          marketNodes: data.marketNodes.length,
          allocations: data.allocations.length
        },
        sample: {
          intentToken: data.intentTokens[0],
          opportunity: data.opportunities[0],
          decision: data.decisions[0],
          mission: data.missions[0],
          genome: data.genomes[0],
          marketNode: data.marketNodes[0],
          allocation: data.allocations[0]
        }
      }
    });
  } catch (error) {
    console.error('❌ Error generating demo data:', error);
    res.status(500).json({ error: 'Failed to generate demo data' });
  }
}

/**
 * Endpoint to generate Stripe events for testing evidence flow
 */
async function generateStripeEvents(req: Request, res: Response) {
  try {
    const count = parseInt(req.query.count as string) || 5;
    const events = await simulationService.generateStripeEvents(Math.min(count, 50)); // Cap at 50

    res.json({
      success: true,
      message: `Generated ${events.length} Stripe events`,
      events: events.map(e => ({
        id: e.id,
        type: e.type,
        created: e.created
      }))
    });
  } catch (error) {
    console.error('❌ Error generating Stripe events:', error);
    res.status(500).json({ error: 'Failed to generate Stripe events' });
  }
}

/**
 * Endpoint to simulate a business scenario
 */
async function simulateScenario(req: Request, res: Response) {
  try {
    const scenario = req.params.scenario as 'launch' | 'crisis' | 'expansion';
    if (!['launch', 'crisis', 'expansion'].includes(scenario)) {
      return res.status(400).json({
        error: 'Invalid scenario. Must be one of: launch, crisis, expansion'
      });
    }

    await simulationService.simulateBusinessScenario(scenario);

    res.json({
      success: true,
      message: `Simulated ${scenario} scenario`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error simulating scenario:', error);
    res.status(500).json({ error: 'Failed to simulate scenario' });
  }
}

/**
 * Endpoint to reset all data (useful for testing)
 */
function resetData(req: Request, res: Response) {
  evidenceRecords = [];
  intentTokens = [];
  opportunities = [];
  decisions = [];
  missions = [];
  genomes = [];
  marketNodes = [];
  allocations = [];

  res.json({
    success: true,
    message: 'All simulation data reset',
    timestamp: new Date().toISOString()
  });
}

/**
 * Endpoint to get current stats
 */
function getStats(req: Request, res: Response) {
  res.json({
    evidenceRecords: evidenceRecords.length,
    intentTokens: intentTokens.length,
    opportunities: opportunities.length,
    decisions: decisions.length,
    missions: missions.length,
    genomes: genomes.length,
    marketNodes: marketNodes.length,
    allocations: allocations.length,
    timestamp: new Date().toISOString()
  });
}

// ====================
// EXPORT ROUTES AND SERVICE
// ====================

export {
  simulationService,
  generateDemoData,
  generateStripeEvents,
  simulateScenario,
  resetData,
  getStats
};