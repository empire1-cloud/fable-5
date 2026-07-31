import type { CanonKind } from "./enums";

export interface CanonEntry {
  id: string;
  kind: CanonKind;
  body: string;
  sourceOutcomeRef: string;
  createdAt: string; // ISO
}

export interface OperatingPrimitive {
  id: string;
  name: string;
  provenBy: string[]; // outcome refs
  reusableAcross: string[]; // genome ids / verticals
}
