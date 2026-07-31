export interface Engine {
  id: string; // "00".."08"
  name: string;
  role: string;
  inputs: string[];
  outputs: string[];
  kpis: string[];
  acceptedReceipts: string[];
  escalationConditions: string[];
  connectedEngineIds: string[];
  /** The pipeline gate caption, e.g. "NEXT MAY PROCEED WHEN → ..." */
  gate: string;
  /** Sheet 1 pipeline number, if this engine has one ("01".."06"), else null. */
  pipeNum: string | null;
}
