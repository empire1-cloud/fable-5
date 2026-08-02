-- Pre-auth lookup functions.
--
-- memberships and tenants are FORCE ROW LEVEL SECURITY, so the app role
-- (fable5_app) cannot see any membership row until a tenant context exists.
-- But login/session validation happen BEFORE we know the tenant. These two
-- SECURITY DEFINER functions run with the owner's (superuser) privileges and
-- therefore bypass RLS, exposing only the minimal pre-auth lookup surface.
-- Everything post-auth still flows through withTenant() under app.tenant_id.

CREATE OR REPLACE FUNCTION public.fable5_authenticate(p_email text)
RETURNS TABLE(
  user_id uuid,
  email text,
  password_hash text,
  tenant_id uuid,
  role text,
  tenant_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.email, u.password_hash, m.tenant_id, m.role::text, t.name
      FROM users u
      JOIN memberships m ON m.user_id = u.id AND m.is_active = true
      JOIN tenants t ON t.id = m.tenant_id
     WHERE lower(u.email) = lower(p_email)
     ORDER BY m.created_at
     LIMIT 1;
END
$$;

CREATE OR REPLACE FUNCTION public.fable5_session_actor(p_token_hash text)
RETURNS TABLE(
  user_id uuid,
  tenant_id uuid,
  email text,
  role text,
  tenant_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
    SELECT s.user_id, s.tenant_id, u.email, m.role::text, t.name
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id AND m.is_active = true
      JOIN tenants t ON t.id = s.tenant_id
     WHERE s.token_hash = p_token_hash
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     LIMIT 1;
END
$$;

REVOKE ALL ON FUNCTION public.fable5_authenticate(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fable5_session_actor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fable5_authenticate(text) TO fable5_app;
GRANT EXECUTE ON FUNCTION public.fable5_session_actor(text) TO fable5_app;

INSERT INTO schema_migrations(version) VALUES ('002_fable5_auth_definer') ON CONFLICT DO NOTHING;

COMMIT;
