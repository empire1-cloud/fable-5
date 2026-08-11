-- Real backing for the three control-plane metrics that had none.
--
-- company genomes, market nodes, and resource pressure were rendered from
-- seeded client-side demo files with no server table behind them, while the
-- rest of the status strip reported real records. This migration gives them
-- the same treatment as everything else in this schema: tenant-scoped rows,
-- FORCE ROW LEVEL SECURITY, and CHECK constraints that mirror the domain
-- unions in app/src/types/index.ts so the database refuses a state the
-- product does not define.

BEGIN;

CREATE TABLE IF NOT EXISTS company_genomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  thesis text NOT NULL DEFAULT '',
  -- mirrors GenomeMaturity
  maturity text NOT NULL DEFAULT 'Draft'
    CHECK (maturity IN ('Draft','Tested','Verified','Replication-Ready')),
  economic_gate_type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS market_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  genome_id uuid REFERENCES company_genomes(id) ON DELETE SET NULL,
  geography text NOT NULL,
  vertical text NOT NULL DEFAULT '',
  segment text NOT NULL DEFAULT '',
  offer text NOT NULL DEFAULT '',
  gate_type text NOT NULL DEFAULT '',
  -- mirrors EvidenceState; a node's proof level is the same vocabulary the
  -- evidence machine uses, not a parallel one
  evidence_state text NOT NULL DEFAULT 'PROPOSED'
    CHECK (evidence_state IN (
      'PROPOSED','AUTHORIZED','EXECUTED','RECEIPTED',
      'VERIFIED','MEASURED','LEARNED','CANONIZED')),
  autonomy_level text NOT NULL DEFAULT 'L0'
    CHECK (autonomy_level IN ('L0','L1','L2','L3','L4','L5')),
  -- mirrors NodeStatus
  status text NOT NULL DEFAULT 'Exploring'
    CHECK (status IN ('Exploring','Validating','Active','Scaling','Paused','Killed','Archived')),
  status_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- Capacity per resource type. resource_allocations (001) is a spend-verdict
-- ledger tied to opportunities and is deliberately left alone; this table
-- answers a different question: how much of a scarce pool is committed.
CREATE TABLE IF NOT EXISTS resource_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  capacity numeric(15,2) NOT NULL CHECK (capacity >= 0),
  allocated numeric(15,2) NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  unit text NOT NULL DEFAULT '',
  financial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, resource_type),
  -- A pool cannot be committed beyond its own capacity. Over-allocation is a
  -- refusal at the database, not a number the UI quietly renders above 100%.
  CHECK (allocated <= capacity)
);

CREATE INDEX IF NOT EXISTS market_nodes_genome_idx ON market_nodes(genome_id);
CREATE INDEX IF NOT EXISTS market_nodes_status_idx ON market_nodes(status);

DO $rls$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['company_genomes','market_nodes','resource_pools']
  LOOP
    policy_name := 'tenant_isolation_' || table_name;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      policy_name,
      table_name
    );
  END LOOP;
END
$rls$;

GRANT SELECT, INSERT, UPDATE, DELETE ON company_genomes, market_nodes, resource_pools TO fable5_app;

INSERT INTO schema_migrations(version) VALUES ('004_genomes_nodes_resources') ON CONFLICT DO NOTHING;

COMMIT;
