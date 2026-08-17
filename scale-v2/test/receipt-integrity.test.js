import test from "node:test";
import assert from "node:assert/strict";
import {
  RECEIPT_CANONICAL_VERSION,
  buildReceiptEnvelope,
  canonicalJson,
  receiptSignerInfo,
  signReceiptEnvelope,
  verifyReceiptProof,
} from "../src/domain/receipt-integrity.js";

test("canonical JSON is independent of object key insertion order", () => {
  assert.equal(
    canonicalJson({ z: 1, nested: { b: 2, a: 1 }, a: 2 }),
    canonicalJson({ a: 2, nested: { a: 1, b: 2 }, z: 1 }),
  );
});

test("receipt proof verifies and any signed-field mutation is detected", () => {
  const signer = receiptSignerInfo();
  const envelope = buildReceiptEnvelope({
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    evidence_id: "33333333-3333-4333-8333-333333333333",
    receipt_type: "stripe.payment_intent",
    uri: "stripe://pi_123",
    source_digest: "processor-digest",
    description: "Payment intent succeeded",
    grade: "A",
    is_demo: false,
    intent_token_id: null,
    external_reference: "pi_123",
    reversal_of: null,
    metadata: { amount: 1250, currency: "USD" },
    chain_sequence: 1,
    previous_hash: null,
    created_by: "44444444-4444-4444-8444-444444444444",
    correlation_id: "corr-1",
    created_at: "2026-08-16T22:30:00.000Z",
    integrity_origin: signer.development_only ? "native-v1-dev" : "native-v1",
    canonical_version: RECEIPT_CANONICAL_VERSION,
    key_id: signer.key_id,
    signing_key_fingerprint: signer.fingerprint,
  });
  const signed = signReceiptEnvelope(envelope);
  const proof = {
    envelope,
    receipt_hash: signed.receipt_hash,
    signature: signed.signature,
    signature_algorithm: signed.signature_algorithm,
    key_id: signed.key_id,
    signing_key_fingerprint: signed.signing_key_fingerprint,
    public_key_b64: signed.public_key_b64,
  };

  assert.equal(verifyReceiptProof(proof).verified, true);

  const changedDescription = {
    ...proof,
    envelope: { ...proof.envelope, description: "Payment intent failed" },
  };
  assert.equal(verifyReceiptProof(changedDescription).verified, false);
  assert.equal(verifyReceiptProof(changedDescription).checks.hash, false);

  const changedLink = {
    ...proof,
    envelope: { ...proof.envelope, previous_hash: "0".repeat(64) },
  };
  assert.equal(verifyReceiptProof(changedLink).verified, false);
  assert.equal(verifyReceiptProof(changedLink).checks.hash, false);
});

test("signature cannot be replaced without detection", () => {
  const signer = receiptSignerInfo();
  const envelope = buildReceiptEnvelope({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    evidence_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    receipt_type: "artifact",
    uri: null,
    source_digest: null,
    description: "Artifact emitted",
    grade: "B",
    is_demo: false,
    intent_token_id: null,
    external_reference: null,
    reversal_of: null,
    metadata: {},
    chain_sequence: 2,
    previous_hash: "a".repeat(64),
    created_by: null,
    correlation_id: null,
    created_at: "2026-08-16T22:31:00.000Z",
    integrity_origin: signer.development_only ? "native-v1-dev" : "native-v1",
    canonical_version: RECEIPT_CANONICAL_VERSION,
    key_id: signer.key_id,
    signing_key_fingerprint: signer.fingerprint,
  });
  const signed = signReceiptEnvelope(envelope);
  const proof = {
    envelope,
    receipt_hash: signed.receipt_hash,
    signature: Buffer.alloc(64).toString("base64"),
    signature_algorithm: signed.signature_algorithm,
    key_id: signed.key_id,
    signing_key_fingerprint: signed.signing_key_fingerprint,
    public_key_b64: signed.public_key_b64,
  };

  const result = verifyReceiptProof(proof);
  assert.equal(result.verified, false);
  assert.equal(result.checks.signature, false);
});
