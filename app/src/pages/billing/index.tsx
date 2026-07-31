import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, PanelCard, ChipRow } from "../../components";
import { useAuth } from "../../auth/AuthProvider";
import { api } from "../../lib/api";

export function Billing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<"free" | "pro" | "enterprise">("free");
  const [isLoading, setIsLoading] = useState(false);

  // Handle subscription logic
  const handleSubscribe = async (planType: string) => {
    setIsLoading(true);
    try {
      // Call backend to create checkout session
      const { url } = await api.payments.createCheckoutSession(planType);

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err) {
      console.error("Error creating checkout session:", err);
      alert("Failed to initiate payment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Sheet
        eyebrow="SHEET 7 / 7 · BILLING & SUBSCRIPTIONS"
        title="Fable-5 Subscription Plans"
        note="Choose the plan that fits your organization's governance needs"
      >
        <div className="space-y-6">
          {/* Free Plan */}
          <PanelCard 
            label="FREE" 
            className={plan === "free" ? "border-b-4 border-cyan-500" : ""}
          >
            <div className="space-y-4" onClick={() => setPlan("free")}>
              <div className="text-3xl font-bold">$0</div>
              <p className="text-sm text-muted-foreground">Forever free</p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M8 12h.01M12 12h.01M16 12h.01"/>
                  </svg>
                  <span>Unlimited evidence records</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M12 8 4"/>
                  </svg>
                  <span>Basic governance features</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Community support</span>
                </div>
              </div>
              
              {plan === "free" && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => navigate('/billing/upgrade')}
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </PanelCard>

          {/* Pro Plan */}
          <PanelCard 
            label="PRO" 
            className={plan === "pro" ? "border-b-4 border-amber-500" : ""}
          >
            <div className="space-y-4" onClick={() => setPlan("pro")}>
              <div className="text-3xl font-bold">$29</div>
              <p className="text-sm text-muted-foreground">/ month per user</p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M8 12h.01M12 12h.01M16 12h.01"/>
                  </svg>
                  <span>Unlimited evidence records</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M12 8v4l4 2"/>
                  </svg>
                  <span>All governance features</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Priority email support</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                  </svg>
                  <span>API access (1000 calls/month)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Custom branding</span>
                </div>
              </div>
              
              {plan === "pro" && (
                <button 
                  className="btn" 
                  onClick={() => handleSubscribe("pro")}
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Subscribe Now"}
                </button>
              )}
              
              {plan !== "pro" && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => handleSubscribe("pro")}
                >
                  Choose Pro
                </button>
              )}
            </div>
          </PanelCard>

          {/* Enterprise Plan */}
          <PanelCard 
            label="ENTERPRISE" 
            className={plan === "enterprise" ? "border-b-4 border-violet-500" : ""}
          >
            <div className="space-y-4" onClick={() => setPlan("enterprise")}>
              <div className="text-3xl font-bold">Custom</div>
              <p className="text-sm text-muted-foreground">Contact sales</p>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M8 12h.01M12 12h.01M16 12h.01"/>
                  </svg>
                  <span>Unlimited everything</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M12 8v4l4 2"/>
                  </svg>
                  <span>Advanced governance suite</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Dedicated account manager</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                  </svg>
                  <span>Unlimited API calls</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                  </svg>
                  <span>On-premise deployment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Custom SLAs & support</span>
                </div>
              </div>
              
              {plan === "enterprise" && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => navigate('/billing/contact-sales')}
                >
                  Contact Sales
                </button>
              )}
              
              {plan !== "enterprise" && (
                <button 
                  className="btn btn-outline" 
                  onClick={() => navigate('/billing/contact-sales')}
                >
                  Learn More
                </button>
              )}
            </div>
          </PanelCard>
        </div>
      </Sheet>

      <Sheet 
        eyebrow="BILLING ADD-ONS" 
        title="Add-On Services" 
        note="Enhance your Fable-5 experience with additional capabilities"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PanelCard label="Usage Add-ons">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div>
                  <div className="font-medium">Additional API Calls</div>
                  <p className="text-sm text-muted-foreground">$0.001 per call over limit</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                  <path d="M12 8v4l4 2"/>
                </svg>
                <div>
                  <div className="font-medium">Advanced Analytics</div>
                  <p className="text-sm text-muted-foreground">$49/month</p>
                </div>
              </div>
            </div>
          </PanelCard>

          <PanelCard label="Professional Services">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div>
                  <div className="font-medium">Implementation</div>
                  <p className="text-sm text-muted-foreground">Starting at $2,500</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                  <path d="M12 8v4l4 2"/>
                </svg>
                <div>
                  <div className="font-medium">Custom Workflows</div>
                  <p className="text-sm text-muted-foreground">Starting at $1,500</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <div>
                  <div className="font-medium">Training & Certification</div>
                  <p className="text-sm text-muted-foreground">$200 per seat</p>
                </div>
              </div>
            </div>
          </PanelCard>

          <PanelCard label="Compliance & Security">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div>
                  <div className="font-medium">SOC 2 Type II</div>
                  <p className="text-sm text-muted-foreground">Included in Enterprise</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                  <path d="M12 8v4l4 2"/>
                </svg>
                <div>
                  <div className="font-medium">HIPAA Compliant</div>
                  <p className="text-sm text-muted-foreground">Available on request</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
                <div>
                  <div className="font-medium">Data Residency Options</div>
                  <p className="text-sm text-muted-foreground">Enterprise only</p>
                </div>
              </div>
            </div>
          </PanelCard>
        </div>
      </Sheet>
    </>
  );
}

// Success and Cancel pages
export function BillingSuccess() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("session_id");
    if (id) {
      setSessionId(id);
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div className="flex h-[20vh] items-center justify-center">Processing...</div>;
  }

  return (
    <div className="min-h-[20vh] flex flex-col items-center justify-center p-6 text-center">
      <Sheet eyebrow="SHEET 7 / 7 · BILLING & SUBSCRIPTIONS" title="Subscription Successful!" note="">
        <h2 className="text-2xl font-bold mb-4">Subscription Successful!</h2>
        {sessionId && (
          <p className="mb-6">
            Your subscription is now active. Session ID: <code className="bg-muted px-2 py-1 rounded">{sessionId}</code>
          </p>
        )}
        <p className="mb-8">
          Thank you for choosing Fable-5. Your governance system is now upgraded with enhanced features.
        </p>
        <button 
          onClick={() => window.location.href = "/"} 
          className="btn"
        >
          Go to Dashboard
        </button>
      </Sheet>
    </div>
  );
}

export function BillingCancel() {
  return (
    <div className="min-h-[20vh] flex flex-col items-center justify-center p-6 text-center">
      <Sheet eyebrow="SHEET 7 / 7 · BILLING & SUBSCRIPTIONS" title="Subscription Cancelled" note="">
        <h2 className="text-2xl font-bold mb-4">Subscription Cancelled</h2>
        <p className="mb-6">
          Your subscription was not completed. You can continue using the free tier or try again later.
        </p>
        <div className="space-x-4">
          <button 
            onClick={() => window.location.href = "/billing"} 
            className="btn btn-outline"
          >
            Try Again
          </button>
          <button 
            onClick={() => window.location.href = "/"} 
            className="btn"
          >
            Go to Dashboard
          </button>
        </div>
      </Sheet>
    </div>
  );
}
