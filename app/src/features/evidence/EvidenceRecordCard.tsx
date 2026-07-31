import { useEffect, useState } from "react";
import { PanelCard, Chip } from "../../components";
import { StateStrip } from "../../components/StateChip";
import { EVIDENCE_STATES, RECEIPT_TYPES } from "../../types/enums";
import type { ApiEvidenceRecord } from "../../lib/api";
import type { WriteResult } from "../../hooks/useEvidenceRecords";

interface Props {
  record: ApiEvidenceRecord;
  advance: (id: string, to: string, reason: string, expectedVersion?: number) => Promise<WriteResult>;
  setFields: (id: string, fields: Record<string, string | null>) => Promise<WriteResult>;
  addReceipt: (id: string, kind: string, content: string) => Promise<WriteResult>;
  addVerification: (id: string, receiptId: string, reproduced: boolean, method: string) => Promise<WriteResult>;
  addContradiction: (id: string, detail: string) => Promise<WriteResult>;
  resolveContradiction: (id: string, contradictionId: string, detail: string) => Promise<WriteResult>;
}

const ALL_TARGETS: string[] = [...EVIDENCE_STATES, "BLOCKED", "KILLED"];
const INPUT: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--panel-raised)",
  color: "var(--ink)", border: "1px solid var(--border)", padding: "8px 10px",
};

const FIELDS = [
  { key: "authorization", label: "AUTHORIZATION RECORD", unlocks: "AUTHORIZED", editableAt: "PROPOSED" },
  { key: "execution_log", label: "EXECUTION LOG", unlocks: "EXECUTED", editableAt: "AUTHORIZED" },
  { key: "measurement", label: "MEASUREMENT vs GATE", unlocks: "MEASURED", editableAt: "VERIFIED" },
  { key: "learning", label: "LEARNING (confidence delta / pattern)", unlocks: "LEARNED", editableAt: "MEASURED" },
  { key: "canonization", label: "CANON ENTRY", unlocks: "CANONIZED", editableAt: "LEARNED" },
] as const;

export function EvidenceRecordCard(props: Props) {
  const { record, advance, setFields, addReceipt, addVerification, addContradiction, resolveContradiction } = props;
  const [attemptTarget, setAttemptTarget] = useState<string>(ALL_TARGETS[0]);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptKind, setReceiptKind] = useState<string>(RECEIPT_TYPES[0]);
  const [receiptContent, setReceiptContent] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState("");
  const [verifyMethod, setVerifyMethod] = useState("");
  const [verifyReproduced, setVerifyReproduced] = useState(true);
  const [contradiction, setContradiction] = useState("");
  const [fieldDraft, setFieldDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedReceipt && record.receipts[0]) setSelectedReceipt(record.receipts[0].id);
    if (selectedReceipt && !record.receipts.some((r) => r.id === selectedReceipt)) {
      setSelectedReceipt(record.receipts[0]?.id ?? "");
    }
  }, [record.receipts, selectedReceipt]);

  const unresolved = record.contradictions.filter((c) => !c.resolved);
  const reproduced = record.verifications.filter((v) => v.reproduced).length;
  const canAttachReceipt = record.state === "EXECUTED";
  const evidenceStates = EVIDENCE_STATES as readonly string[];
  const canVerify = record.state === "RECEIPTED" || evidenceStates.indexOf(record.state) >= evidenceStates.indexOf("VERIFIED");

  const run = async (fn: () => Promise<WriteResult>, after?: () => void) => {
    setBusy(true);
    const r = await fn();
    setResult(r);
    if (r.ok) after?.();
    setBusy(false);
  };

  return (
    <PanelCard label={`${record.id.slice(0, 8)} · ${record.subject}`} accent={record.state === "VERIFIED" || record.state === "CANONIZED"}>
      <StateStrip current={record.state} />
      <div className="chips" style={{ marginBottom: 10 }}>
        <Chip>{`v${record.version}`}</Chip>
        <Chip>{`confidence ${(record.confidence * 100).toFixed(0)}%`}</Chip>
        <Chip accent={record.receipts.length > 0}>{record.receipts.length ? `${record.receipts.length} receipt(s)` : "no receipt"}</Chip>
        <Chip accent={reproduced > 0}>{record.verifications.length ? `${record.verifications.length} verification(s), ${reproduced} reproduced` : "no verification record"}</Chip>
        {unresolved.length > 0 && <Chip warn>{`${unresolved.length} unresolved contradiction(s)`}</Chip>}
        {record.is_financial && <Chip warn>financial · exact verdict required</Chip>}
      </div>

      {record.is_financial && (
        <div className="token-rows" style={{ marginBottom: 12 }}>
          <Row k="vendor / system" v={record.vendor_or_system ?? "missing"} />
          <Row k="amount" v={`${record.financial_amount ?? "missing"} ${record.financial_currency ?? ""}`} />
          <Row k="environment" v={record.financial_environment ?? "missing"} />
          <Row k="intent token" v={record.intent_token_id ?? "not bound"} />
          <Row k="spend verdict" v={record.spend_verdict_id ?? "not bound"} />
          <Row k="authorized by" v={record.authorized_by ?? "not authorized"} />
        </div>
      )}

      <div className="two-col">
        <div>
          <div className="card-label">ATTACHED RECEIPTS</div>
          {record.receipts.length === 0 ? <p className="card-footnote">none attached</p> : record.receipts.map((r) => (
            <p key={r.id} className="card-footnote" style={{ borderTop: "none", paddingTop: 0 }}>
              <strong>{r.kind}</strong> · attests {r.state_attested} · by {r.created_by} · sha256 {r.sha256.slice(0, 12)}…
              <br /><span style={{ color: "var(--ink-dim)" }}>{r.content.slice(0, 140)}</span>
            </p>
          ))}
          {record.contradictions.length > 0 && <>
            <div className="card-label" style={{ marginTop: 10 }}>CONTRADICTIONS</div>
            {record.contradictions.map((c) => <div key={c.id}>
              <p className="card-footnote" style={{ color: c.resolved ? "var(--ink-dim)" : "var(--warn)", borderTop: "none" }}>
                {c.resolved ? "RESOLVED — " : "UNRESOLVED — "}{c.detail}{c.resolution && <> · {c.resolution}</>}
              </p>
              {!c.resolved && <button type="button" className="btn" disabled={busy} onClick={() => {
                const resolution = window.prompt("How was this contradiction resolved?")?.trim();
                if (resolution) void run(() => resolveContradiction(record.id, c.id, resolution));
              }}>RESOLVE (kept on record)</button>}
            </div>)}
          </>}
        </div>
        <div>
          <div className="card-label">AUDIT HISTORY (append-only)</div>
          <div style={{ display: "grid", gap: 4, maxHeight: 180, overflowY: "auto" }}>
            {record.audit_entries.map((a, i) => <p key={i} className="card-footnote" style={{ borderTop: "none", paddingTop: 0 }}>
              {new Date(a.created_at).toLocaleString()} · <strong>{a.state}</strong> · {a.actor} — {a.reason}
            </p>)}
          </div>
        </div>
      </div>

      <div className="card-label" style={{ marginTop: 12 }}>ALLOWED NEXT STATE — COMPUTED BY SERVER</div>
      {record.allowed_next_states.length === 0 ? <p className="card-footnote">none — {record.next_state_blocker ?? "terminal"}</p> : (
        <div className="btn-row">{record.allowed_next_states.map((s) => <button key={s} type="button" className="btn btn--accent" disabled={busy}
          onClick={() => void run(() => advance(record.id, s, "advanced from Evidence workspace", record.version))}>ADVANCE → {s}</button>)}</div>
      )}

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
          {record.receipts.map((r) => <option key={r.id} value={r.id}>{r.kind} · {r.sha256.slice(0, 10)}</option>)}
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

      <div className="card-label" style={{ marginTop: 14 }}>CONTRADICTION</div>
      <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <input value={contradiction} placeholder="raises a blocker for VERIFIED and every later state" onChange={(e) => setContradiction(e.target.value)}
          style={{ ...INPUT, minWidth: 260, flex: 1 }} />
        <button type="button" className="btn" disabled={busy || !contradiction.trim()}
          onClick={() => void run(() => addContradiction(record.id, contradiction.trim()), () => setContradiction(""))}>RAISE CONTRADICTION</button>
      </div>

      <div className="card-label" style={{ marginTop: 14 }}>STATE-BOUND FIELDS</div>
      <div style={{ display: "grid", gap: 6 }}>
        {FIELDS.map((f) => {
          const current = (record as unknown as Record<string, string | null>)[f.key];
          const editable = record.state === f.editableAt;
          return <div key={f.key} className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <span className="card-footnote" style={{ borderTop: "none", paddingTop: 0, minWidth: 240 }}>{f.label} · file at {f.editableAt} → {f.unlocks}</span>
            <input value={fieldDraft[f.key] ?? current ?? ""} onChange={(e) => setFieldDraft({ ...fieldDraft, [f.key]: e.target.value })}
              style={{ ...INPUT, minWidth: 220, flex: 1 }} disabled={!editable} />
            <button type="button" className="btn" disabled={busy || !editable}
              onClick={() => void run(() => setFields(record.id, { [f.key]: fieldDraft[f.key] ?? current ?? "" }))}>SAVE</button>
          </div>;
        })}
        {record.is_financial && <>
          <BoundField label="INTENT TOKEN ID" field="intent_token_id" value={fieldDraft.intent_token_id ?? record.intent_token_id ?? ""}
            setValue={(v) => setFieldDraft({ ...fieldDraft, intent_token_id: v })} editable={record.state === "PROPOSED"} busy={busy}
            save={() => run(() => setFields(record.id, { intent_token_id: fieldDraft.intent_token_id ?? record.intent_token_id ?? "" }))} />
          <BoundField label="SPEND VERDICT ID" field="spend_verdict_id" value={fieldDraft.spend_verdict_id ?? record.spend_verdict_id ?? ""}
            setValue={(v) => setFieldDraft({ ...fieldDraft, spend_verdict_id: v })} editable={record.state === "PROPOSED"} busy={busy}
            save={() => run(() => setFields(record.id, { spend_verdict_id: fieldDraft.spend_verdict_id ?? record.spend_verdict_id ?? "" }))} />
        </>}
      </div>

      <div className="card-label" style={{ marginTop: 14 }}>ATTEMPT ANY TRANSITION — SERVER DECIDES</div>
      <div className="btn-row" style={{ alignItems: "center" }}>
        <select value={attemptTarget} onChange={(e) => { setAttemptTarget(e.target.value); setResult(null); }} style={INPUT}>
          {ALL_TARGETS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button type="button" className="btn" disabled={busy}
          onClick={() => void run(() => advance(record.id, attemptTarget, "attempted from Evidence workspace", record.version))}>ATTEMPT TRANSITION</button>
      </div>
      {result && <p className="card-footnote" style={{ color: result.ok ? "var(--ok)" : "var(--warn)", borderTop: "none" }} role="status">
        {result.ok ? "ACCEPTED — server applied it." : `REFUSED BY SERVER — ${result.detail}`}
      </p>}
    </PanelCard>
  );
}

function BoundField(props: { label: string; field: string; value: string; setValue: (v: string) => void; editable: boolean; busy: boolean; save: () => Promise<void> }) {
  return <div className="btn-row" style={{ alignItems: "center", flexWrap: "wrap" }}>
    <span className="card-footnote" style={{ borderTop: "none", paddingTop: 0, minWidth: 240 }}>{props.label} · bind while PROPOSED</span>
    <input value={props.value} onChange={(e) => props.setValue(e.target.value)} style={{ ...INPUT, minWidth: 220, flex: 1 }} disabled={!props.editable} aria-label={props.field} />
    <button type="button" className="btn" disabled={props.busy || !props.editable} onClick={() => void props.save()}>SAVE</button>
  </div>;
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="token-row"><span className="token-k">{k}</span><span>{v}</span></div>;
}
