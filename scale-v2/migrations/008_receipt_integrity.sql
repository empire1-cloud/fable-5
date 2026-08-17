-- FABLE-5 receipt integrity hardening.
--
-- Existing receipts are preserved exactly as historical records and are
-- sealed by the application the first time their tenant writes/verifies the
-- upgraded chain. New receipts cannot enter the table without a server-made
-- hash, chain position, and Ed25519 signature.

ALTER TABLE evidence_receipts
  ADD COLUMN IF NOT EXISTS source_digest text,
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS receipt_hash text,
  ADD COLUMN IF NOT EXISTS chain_sequence bigint,
  ADD COLUMN IF NOT EXISTS canonical_version text,
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signature_algorithm text,
  ADD COLUMN IF NOT EXISTS key_id text,
  ADD COLUMN IF NOT EXISTS signing_key_fingerprint text,
  ADD COLUMN IF NOT EXISTS public_key_b64 text,
  ADD COLUMN IF NOT EXISTS integrity_origin text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS intent_token_id uuid REFERENCES intent_tokens(id),
  ADD COLUMN IF NOT EXISTS external_reference text,
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES evidence_receipts(id),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS evidence_receipts_tenant_chain_sequence_uq
  ON evidence_receipts (tenant_id, chain_sequence)
  WHERE chain_sequence IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS evidence_receipts_tenant_hash_uq
  ON evidence_receipts (tenant_id, receipt_hash)
  WHERE receipt_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS evidence_receipts_single_reversal_uq
  ON evidence_receipts (tenant_id, reversal_of)
  WHERE reversal_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS evidence_receipts_external_reference_idx
  ON evidence_receipts (tenant_id, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION fable5_guard_receipt_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.receipt_hash IS NULL
       OR NEW.digest IS DISTINCT FROM NEW.receipt_hash
       OR NEW.chain_sequence IS NULL
       OR NEW.chain_sequence < 1
       OR NEW.canonical_version IS NULL
       OR NEW.signature IS NULL
       OR NEW.signature_algorithm IS DISTINCT FROM 'Ed25519'
       OR NEW.key_id IS NULL
       OR NEW.signing_key_fingerprint IS NULL
       OR NEW.public_key_b64 IS NULL
       OR NEW.integrity_origin IS NULL
       OR NEW.sealed_at IS NULL THEN
      RAISE EXCEPTION 'RECEIPT_INTEGRITY_REQUIRED: unsigned or unchained receipt refused'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY_RECEIPT: receipt deletion refused'
      USING ERRCODE = '55000';
  END IF;

  -- The one permitted UPDATE is a one-way upgrade of a pre-008 legacy row.
  -- The application must explicitly enable it transaction-locally, and none
  -- of the historical receipt facts may change. Only integrity fields (plus
  -- moving the old caller digest into source_digest) can be populated.
  IF current_setting('app.allow_receipt_seal', true) = 'on'
     AND OLD.receipt_hash IS NULL
     AND NEW.receipt_hash IS NOT NULL
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.evidence_id IS NOT DISTINCT FROM OLD.evidence_id
     AND NEW.receipt_type IS NOT DISTINCT FROM OLD.receipt_type
     AND NEW.uri IS NOT DISTINCT FROM OLD.uri
     AND NEW.description IS NOT DISTINCT FROM OLD.description
     AND NEW.grade IS NOT DISTINCT FROM OLD.grade
     AND NEW.is_demo IS NOT DISTINCT FROM OLD.is_demo
     AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.correlation_id IS NOT DISTINCT FROM OLD.correlation_id
     AND NEW.intent_token_id IS NOT DISTINCT FROM OLD.intent_token_id
     AND NEW.external_reference IS NOT DISTINCT FROM OLD.external_reference
     AND NEW.reversal_of IS NOT DISTINCT FROM OLD.reversal_of
     AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'APPEND_ONLY_RECEIPT: receipt mutation refused; issue a reversal/superseding receipt instead'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS evidence_receipts_integrity_guard ON evidence_receipts;
CREATE TRIGGER evidence_receipts_integrity_guard
BEFORE INSERT OR UPDATE OR DELETE ON evidence_receipts
FOR EACH ROW EXECUTE FUNCTION fable5_guard_receipt_integrity();

CREATE OR REPLACE FUNCTION fable5_reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY_AUDIT: % mutation refused', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS evidence_events_append_only ON evidence_events;
CREATE TRIGGER evidence_events_append_only
BEFORE UPDATE OR DELETE ON evidence_events
FOR EACH ROW EXECUTE FUNCTION fable5_reject_append_only_mutation();

DROP TRIGGER IF EXISTS evidence_verifications_append_only ON evidence_verifications;
CREATE TRIGGER evidence_verifications_append_only
BEFORE UPDATE OR DELETE ON evidence_verifications
FOR EACH ROW EXECUTE FUNCTION fable5_reject_append_only_mutation();

DROP TRIGGER IF EXISTS evidence_measurements_append_only ON evidence_measurements;
CREATE TRIGGER evidence_measurements_append_only
BEFORE UPDATE OR DELETE ON evidence_measurements
FOR EACH ROW EXECUTE FUNCTION fable5_reject_append_only_mutation();
