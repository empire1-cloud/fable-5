# FABLE-5 Production Gate

The product may be called production-ready only after every check below captures a receipt.

## Database and isolation
- Clean migration passes
- Migration rerun passes
- `fable5_app` is NOSUPERUSER and NOBYPASSRLS
- Tenant A cannot select, insert, update, or delete Tenant B records
- Transaction-local tenant context is cleared when a connection returns to the pool
- Backup restoration reproduces evidence, canon, and audit history

## Evidence integrity
- Skipped evidence states are refused
- RECEIPTED requires a receipt
- VERIFIED requires an independent verification
- MEASURED requires a typed measurement
- LEARNED requires a supported learning
- CANONIZED requires explicit promotion approval
- Contradictory evidence opens an escalation before canon promotion

## Engines
- Engine 00 refuses weak evidence even when market excitement is high
- Engine 01 cannot run before Engine 00 authorization
- Engine 02 requires willingness-to-pay evidence
- Engine 03 requires artifact verification
- Engine 04 requires measured distribution evidence
- Engine 05 revenue has a processor or ledger receipt
- Engine 06 requires REPLICATION-READY maturity
- Every engine reads and writes Engine 07
- Engine 08 returns `executed=false` without an enabled approved connector

## Operations
- Health endpoint fails closed when PostgreSQL is unavailable
- Startup does not print ready before database health succeeds
- Session tokens are hashed at rest and expire
- Outbox jobs are retryable without duplicate effects
- Structured logs contain correlation IDs
- Secrets are not committed
