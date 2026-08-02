import { useEffect, useState } from "react";
import { PanelCard, Chip } from "../../components";
import { StateStrip } from "../../components/StateChip";
import { EVIDENCE_STATES, RECEIPT_TYPES, MEASUREMENT_VERDICTS } from "../../types/enums";
import type { ApiEvidenceRecord } from "../../lib/api";
import type { WriteResult } from "../../hooks/useEvidenceRecords";

interface Props {
  record: ApiEvidenceRecord;
  advance: (id: string, to: string, reason: string) => Promise<WriteResult>;
  addReceipt: (id: string, kind: string, content: string) => Promise<WriteResult>;
  addVerification: (id: string, receiptId: string, reproduced: boolean, method: string) => Promise<WriteResult>;
  addMeasurement: (id: string, gateType: string, verdict: string, reading?: unknown) => Promise<WriteResult>;
}

const ALL_TARGETS: string[] = [...EVIDENCE_STATES, "BLOCKED", "KILLED"];
const INPUT: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--panel-raised)",
  color: "var(--ink)", border: "1px solid var(--border)", padding: "8px 10px",
};

export function EvidenceRecordCard(props: Props) {
  const { record, advance, addReceipt, addVerification, addMeasurement } = props;
  const [attemptTarget, setAttemptTarget] = useState<string>(ALL_TARGETS[0]);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptKind, setReceiptKind] = useState<string>(RECEIPT_TYPES[0]);
  const [receiptContent, setReceiptContent] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState("");
  const [verifyMethod, setVerifyMethod] = useState("");
  const [verifyReproduced, setVerifyReproduced] = useState(true);
  const [measureGate, setMeasureGate] = useState("default");
  const [measureVerdict, setMeasureVerdict] = useState<string>(MEASUREMENT_VERDICTS[0]);

  useEffect(() => {
    if (!selectedReceipt && record.receipts[0]) setSelectedReceipt(record.receipts[0].id);
    if (selectedReceipt && !record.receipts.some((r) => r.id === selectedReceipt)) {
      setSelectedReceipt(record.receipts[0]?.id ?? "");
    }
  }, [record.receipts, selectedReceipt]);

  const unresolved = record.contradictions.filter((c) => !c.resolved);
  const reproduced = record.verifications.filter((v) => v.reproducible).length;
  const canAttachReceipt = record.state === "EXECUTED";
  const evidenceStates = EVIDENCE_STATES as readonly string[];
  const canVerify = record.state === "RECEIPTED" || evidenceStates.indexOf(record.state) >= evidenceStates.indexOf("VERIFIED");
  const canMeasure = record.state === "VERIFIED" || evidenceStates.indexOf(record.state) >= evidenceStates.indexOf("MEASURED");

  const run = async (fn: () => Promise<WriteResult>, after?: () => void) => {
    setBusy(true);
    const r = await fn();
    setResult(r);
    if (r.ok) after?.();
    setBusy(false);
  };

  return (
    <PanelCard label={`${record.id.slice(0, 8)} · ${record.claim.slice(0, 40)}`} accent={record.state === "VERIFIED" || record.state === "CANONIZED"}>
      <StateStrip current={record.state} />
      <div className="chips" style={{ marginBottom: 10 }}>
        <Chip>{`grade ${record.grade}`}</Chip>
        <Chip>{`confidence ${(record.confidence * 100).toFixed(0)}%`}</Chip>
        <Chip accent={record.receipts.length > 0}>{record.receipts.length ? `${record.receipts.length} receipt(s)` : "no receipt"}</Chip>
        <Chip accent={reproduced > 0}>{record.verifications.length ? `${record.verifications.length} verification(s), ${reproduced} reproduced` : "no verification record"}</Chip>
        <Chip accent={record.measurements.length > 0}>{record.measurements.length ? `${record.measurements.length} measurement(s)` : "no measurement"}</Chip>
        {unresolved.length > 0 && <Chip warn>{`${unresolved.length} unresolved contradiction(s)`}</Chip>}
      </div>

      <div className="two-col">
        <div>
          <div className="card-label">ATTACHED RECEIPTS</div>
          {record.receipts.length === 0 ? <p className="card-footnote">none attached</p> : record.receipts.map((r) => (
            <p key={r.id} className="card-footnote" style={{ borderTop: "none", paddingTop: 0 }}>
              <strong>{r.receipt_type}</strong>{r.digest ? <> · sha256 {r.digest.slice(0, 12)}…</> : null}
              <br /><span style={{ color: "var(--ink-dim)" }}>{r.description.slice(0, 140)}</span>
            </p>
          ))}
          {record.contradictions.length > 0 && <>
            <div className="card-label" style={{ marginTop: 10 }}>CONTRADICTIONS</div>
            {record.contradictions.map((c) => <div key={c.id}>
              <p className="card-footnote" style={{ color: c.resolved ? "var(--ink-dim)" : "var(--warn)", borderTop: "none" }}>
                {c.resolved ? "RESOLVED — " : "UNRESOLVED — "}{c.description}{c.resolution && <> · {c.resolution}</>}
              </p>
            </div>)}
          </>}
        </div>
        <div>
          <div className="card-label">AUDIT HISTORY (append-only)</div>
          <div style={{ display: "grid", gap: 4, maxHeight: 180, overflowY: "auto" }}>
            {record.audit_entries.map((a, i) => <p key={i} className="card-footnote" style={{ borderTop: "none", paddingTop: 0 }}>
              {new Date(a.created_at).toLocaleString()} · <strong>{a.state_from ?? "—"} → {a.state_to}</strong> · {a.actor_id.slice(0, 8)} — {a.reason}
            </p>)}
          </div>
        </div>
      </div>

      <div className="card-label" style={{ marginTop: 14 }}>EXECUTION RECEIPT — ONLY WHILE EXECUTED</div>
      <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <select value={receiptKind} onChange={(e) => setReceiptKind(e.target.value)} style={INPUT} disabled={!canAttachReceipt}>
          {RECEIPT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input value={receiptContent} placeholder={canAttachReceipt ? "execution proof" : `locked while ${record.state}`}
          onChange={(e) => setReceiptContent(e.target.value)} style={{ ...INPUT, minWidth: 260, flex: 1 }} disabled={!canAttachReceipt} />
        <button type="button" className="btn" disabled={busy || !canAttachReceipt || !receiptContent.trim()}
          onClick={() => void run(() => addReceipt(record.id, receiptKind, receiptContent.trim()), () => setReceiptContent(""))}>ATTACH RECEIPT</button>
      </div>

      <div className="card-label" style={{ marginTop: 14 }}>INDEPENDENT VERIFICATION — RECEIPT-SPECIFIC</div>
      <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <select value={selectedReceipt} onChange={(e) => setSelectedReceipt(e.target.value)} style={INPUT} disabled={!canVerify || !record.receipts.length}>
          <option value="">choose receipt</option>
          {record.receipts.map((r) => <option key={r.id} value={r.id}>{r.receipt_type}{r.digest ? ` · ${r.digest.slice(0, 10)}` : ""}</option>)}
        </select>
        <input value={verifyMethod} placeholder="independent reproduction method (8+ characters)" onChange={(e) => setVerifyMethod(e.target.value)}
          style={{ ...INPUT, minWidth: 260, flex: 1 }} disabled={!canVerify} />
        <label className="card-footnote" style={{ borderTop: "none", paddingTop: 0, display: "flex", gap: 6 }}>
          <input type="checkbox" checked={verifyReproduced} onChange={(e) => setVerifyReproduced(e.target.checked)} disabled={!canVerify} />reproduced
        </label>
        <button type="button" className="btn" disabled={busy || !canVerify || !selectedReceipt || verifyMethod.trim().length < 8}
          onClick={() => void run(() => addVerification(record.id, selectedReceipt, verifyReproduced, verifyMethod.trim()), () => setVerifyMethod(""))}>RECORD VERIFICATION</button>
      </div>
      <p className="card-footnote">The server refuses a verifier who created the selected receipt.</p>

      <div className="card-label" style={{ marginTop: 14 }}>MEASUREMENT vs GATE</div>
      <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <input value={measureGate} placeholder="gate type" onChange={(e) => setMeasureGate(e.target.value)} style={{ ...INPUT, minWidth: 180, flex: 1 }} disabled={!canMeasure} />
        <select value={measureVerdict} onChange={(e) => setMeasureVerdict(e.target.value)} style={INPUT} disabled={!canMeasure}>
          {MEASUREMENT_VERDICTS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button type="button" className="btn" disabled={busy || !canMeasure}
          onClick={() => void run(() => addMeasurement(record.id, measureGate.trim() || "default", measureVerdict))}>RECORD MEASUREMENT</button>
      </div>

      <div className="card-label" style={{ marginTop: 14 }}>ATTEMPT ANY TRANSITION — SERVER DECIDES</div>
      <div className="btn-row" style={{ alignItems: "center" }}>
        <select value={attemptTarget} onChange={(e) => { setAttemptTarget(e.target.value); setResult(null); }} style={INPUT}>
          {ALL_TARGETS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button type="button" className="btn" disabled={busy}
          onClick={() => void run(() => advance(record.id, attemptTarget, "attempted from Evidence workspace"))}>ATTEMPT TRANSITION</button>
      </div>
      {result && <p className="card-footnote" style={{ color: result.ok ? "var(--ok)" : "var(--warn)", borderTop: "none" }} role="status">
        {result.ok ? "ACCEPTED — server applied it." : `REFUSED BY SERVER — ${result.detail}`}
      </p>}
    </PanelCard>
  );
}
