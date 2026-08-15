-- Genome content, with provenness derived instead of asserted.
--
-- The demo genome carried `proven: boolean` on every section and rendered an
-- "evidence coverage" meter from it. That boolean was typed by hand — a claim
-- of proof with nothing behind it, which is the exact failure this system
-- exists to refuse.
--
-- Here a section carries an OPTIONAL LINK to an evidence record instead. It is
-- proven only when that record has actually reached VERIFIED or later in the
-- state machine. Attaching evidence is therefore not the same as being proven:
-- a section linked to a PROPOSED record still reads unproven, and the only way
-- to change that is to move the record through the gates. Nobody can set the
-- flag directly, because there is no flag to set.

BEGIN;

CREATE TABLE IF NOT EXISTS genome_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  genome_id uuid NOT NULL REFERENCES company_genomes(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_group text NOT NULL,
  label text NOT NULL,
  value text NOT NULL DEFAULT '',
  -- NULL = nothing claimed yet. Non-NULL is a claim awaiting the gates, NOT
  -- a proof; provenness is computed from this record's state, never stored.
  evidence_id uuid REFERENCES evidence_records(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (genome_id, section_key)
);

-- A genome's verified playbooks are canon entries, not free text. Canon is
-- only written when evidence reaches CANONIZED (see transitionEvidence), so a
-- playbook cannot appear here without having survived the whole machine.
CREATE TABLE IF NOT EXISTS genome_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  genome_id uuid NOT NULL REFERENCES company_genomes(id) ON DELETE CASCADE,
  canon_entry_id uuid NOT NULL REFERENCES canon_entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (genome_id, canon_entry_id)
);

CREATE INDEX IF NOT EXISTS genome_sections_genome_idx ON genome_sections(genome_id, sort_order);
CREATE INDEX IF NOT EXISTS genome_sections_evidence_idx ON genome_sections(evidence_id);

DO $rls$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['genome_sections','genome_playbooks']
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

GRANT SELECT, INSERT, UPDATE, DELETE ON genome_sections, genome_playbooks TO fable5_app;

INSERT INTO schema_migrations(version) VALUES ('005_genome_sections') ON CONFLICT DO NOTHING;

COMMIT;
