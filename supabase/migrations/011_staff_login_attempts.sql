-- ============================================================
-- 011 Staff login attempts (rate limiting)
-- ============================================================
-- The admin screens are protected by a staff login (e-mail on the NGG
-- domain + shared password, see lib/auth). Vercel functions are stateless,
-- so a per-IP attempt counter kept in memory would reset on every cold
-- start and differ between instances; it lives here instead.
--
-- Only failed attempts are recorded: a successful login never counts
-- against the team. Rows older than a day are pruned by the login route.
--
-- RLS is on with no policies: only the service role can touch this table.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

CREATE TABLE IF NOT EXISTS staff_login_attempts (
  id           bigserial PRIMARY KEY,
  ip           text        NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_login_attempts_ip_time
  ON staff_login_attempts(ip, attempted_at DESC);

ALTER TABLE staff_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON staff_login_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE staff_login_attempts_id_seq FROM anon, authenticated;
