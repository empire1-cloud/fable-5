import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useOpportunities } from "../hooks/useOpportunities";
import { useMissions } from "../hooks/useMissions";
import { useEvidenceRecords } from "../hooks/useEvidenceRecords";
import { useIntentTokens } from "../hooks/useIntentTokens";

type ControlPlaneData = {
  opportunities: ReturnType<typeof useOpportunities>;
  missions: ReturnType<typeof useMissions>;
  evidence: ReturnType<typeof useEvidenceRecords>;
  tokens: ReturnType<typeof useIntentTokens>;
};

const Ctx = createContext<ControlPlaneData | null>(null);

/**
 * Mounted once, inside the authenticated shell. Four collections are fetched
 * here and shared, so the status bar and the workspace that renders the same
 * records do not each open their own request for them.
 */
export function ControlPlaneDataProvider({ children }: { children: ReactNode }) {
  const opportunities = useOpportunities();
  const missions = useMissions();
  const evidence = useEvidenceRecords();
  const tokens = useIntentTokens();

  const value = useMemo(
    () => ({ opportunities, missions, evidence, tokens }),
    [opportunities, missions, evidence, tokens],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useControlPlane(): ControlPlaneData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useControlPlane must be used inside <ControlPlaneDataProvider>");
  return ctx;
}
