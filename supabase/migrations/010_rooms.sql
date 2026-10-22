-- ============================================================
-- 010 Rooms: one app, many auction rooms
-- ============================================================
-- The app becomes a platform: NGG staff create "rooms", each with its own
-- settings (statements, game mode, starting coins, client logo), and run
-- every room as a separate live event with its own projected screen.
--
-- What this migration does:
--
--   1. events  ->  rooms. The table is renamed (not copied), `name` becomes
--      `title`, and every `event_id` column becomes `room_id`. All of this
--      is metadata only: no row is deleted or rewritten. It does mean the
--      matching application code must be deployed together with it.
--   2. Room settings: client_name, logo_path, starting_coins,
--      default_round_seconds, created_by_email, updated_at, and the live
--      window (activated_at / active_until). Status gains 'archived'.
--   3. traits.category becomes mandatory and limited to the four fixed
--      categories the profile archetype depends on. The migration fails
--      (and rolls back as a whole) if an existing trait violates this.
--   4. Isolation at the database level: bids and round_winners carry
--      room_id, and composite foreign keys guarantee a bid can only link
--      a participant and a round of the same room.
--   5. Every RPC takes p_room_id and verifies that everything it touches
--      belongs to that room. Functions whose parameters change are dropped
--      and recreated in the same transaction (DROP FUNCTION only, no data).
--   6. New room-management RPCs: create_room, update_room, set_room_status,
--      duplicate_room, delete_room, reset_room, register_participant.
--   7. The existing 'leadership-auction' event becomes the first room,
--      live for 12 hours from the moment this migration runs, after which
--      the facilitator re-activates it from the admin screen like any room.
--
-- Pre-check (read-only), run before applying:
--   select id, title, category from auction.traits
--   where category is null or category not in ('מנהיגות','יחסים','שיפוט','למידה');
-- It must return no rows.
--
-- Run as a single transaction (the Supabase SQL editor does this). Every
-- step is guarded so a re-run is a no-op.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. events -> rooms
-- ─────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('auction.events') IS NOT NULL AND to_regclass('auction.rooms') IS NULL THEN
    ALTER TABLE auction.events RENAME TO rooms;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'auction' AND table_name = 'rooms' AND column_name = 'name') THEN
    ALTER TABLE auction.rooms RENAME COLUMN name TO title;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'auction' AND table_name = 'participants' AND column_name = 'event_id') THEN
    ALTER TABLE auction.participants RENAME COLUMN event_id TO room_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'auction' AND table_name = 'traits' AND column_name = 'event_id') THEN
    ALTER TABLE auction.traits RENAME COLUMN event_id TO room_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'auction' AND table_name = 'auction_rounds' AND column_name = 'event_id') THEN
    ALTER TABLE auction.auction_rounds RENAME COLUMN event_id TO room_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'auction' AND table_name = 'wallet_transactions' AND column_name = 'event_id') THEN
    ALTER TABLE auction.wallet_transactions RENAME COLUMN event_id TO room_id;
  END IF;
END;
$$;

-- Indexes keep working after a rename; only their names are updated.
ALTER INDEX IF EXISTS uq_one_open_round_per_event RENAME TO uq_one_open_round_per_room;
ALTER INDEX IF EXISTS idx_auction_rounds_event_status RENAME TO idx_auction_rounds_room_status;
ALTER INDEX IF EXISTS idx_wallet_transactions_event RENAME TO idx_wallet_transactions_room;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Room settings
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS client_name           text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_path             text        NULL,
  ADD COLUMN IF NOT EXISTS starting_coins        integer     NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS default_round_seconds integer     NULL,
  ADD COLUMN IF NOT EXISTS created_by_email      text        NULL,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS activated_at          timestamptz NULL,
  ADD COLUMN IF NOT EXISTS active_until          timestamptz NULL;

-- `game_mode` exists since 008; this makes 010 safe on a project where
-- 008 was never applied.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'auction';
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS events_game_mode_check;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_mode_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_game_mode_check
  CHECK (game_mode IN ('auction', 'allocation'));

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check
  CHECK (status IN ('draft', 'active', 'ended', 'archived'));

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_starting_coins_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_starting_coins_check
  CHECK (starting_coins BETWEEN 1 AND 1000000);

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_default_round_seconds_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_default_round_seconds_check
  CHECK (default_round_seconds IS NULL OR default_round_seconds BETWEEN 10 AND 3600);

-- The slug is part of the join URL (and the printed QR), so it is limited
-- to URL-safe characters. NOT VALID: enforced for every new or edited row,
-- existing rows are left as they are.
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_slug_format_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_slug_format_check
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60) NOT VALID;

-- A live room always has an end to its live window (set_room_status below).
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_active_window_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_active_window_check
  CHECK (status <> 'active' OR active_until IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = auction
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON rooms(status, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Statements: category is mandatory and fixed
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE traits ALTER COLUMN category SET NOT NULL;
ALTER TABLE traits DROP CONSTRAINT IF EXISTS traits_category_check;
ALTER TABLE traits ADD CONSTRAINT traits_category_check
  CHECK (category IN ('מנהיגות', 'יחסים', 'שיפוט', 'למידה'));
ALTER TABLE traits ALTER COLUMN description SET DEFAULT '';
ALTER TABLE traits ALTER COLUMN sort_order SET DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Room isolation at the database level
-- ─────────────────────────────────────────────────────────────────────────
-- (id, room_id) uniqueness lets child rows reference a parent *and* its
-- room in one foreign key, so a bid cannot pair a participant of room A
-- with a round of room B whatever the application does.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_id_room_key') THEN
    ALTER TABLE participants ADD CONSTRAINT participants_id_room_key UNIQUE (id, room_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'traits_id_room_key') THEN
    ALTER TABLE traits ADD CONSTRAINT traits_id_room_key UNIQUE (id, room_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auction_rounds_id_room_key') THEN
    ALTER TABLE auction_rounds ADD CONSTRAINT auction_rounds_id_room_key UNIQUE (id, room_id);
  END IF;
END;
$$;

-- auction_rounds: the trait and the winner must belong to the round's room.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auction_rounds_trait_room_fkey') THEN
    ALTER TABLE auction_rounds ADD CONSTRAINT auction_rounds_trait_room_fkey
      FOREIGN KEY (trait_id, room_id) REFERENCES traits(id, room_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auction_rounds_winner_room_fkey') THEN
    ALTER TABLE auction_rounds ADD CONSTRAINT auction_rounds_winner_room_fkey
      FOREIGN KEY (winner_participant_id, room_id) REFERENCES participants(id, room_id);
  END IF;
END;
$$;

-- bids
ALTER TABLE bids ADD COLUMN IF NOT EXISTS room_id uuid NULL;
UPDATE bids b
SET    room_id = r.room_id
FROM   auction_rounds r
WHERE  r.id = b.round_id AND b.room_id IS NULL;
ALTER TABLE bids ALTER COLUMN room_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_round_room_fkey') THEN
    ALTER TABLE bids ADD CONSTRAINT bids_round_room_fkey
      FOREIGN KEY (round_id, room_id) REFERENCES auction_rounds(id, room_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bids_participant_room_fkey') THEN
    ALTER TABLE bids ADD CONSTRAINT bids_participant_room_fkey
      FOREIGN KEY (participant_id, room_id) REFERENCES participants(id, room_id) ON DELETE CASCADE;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_bids_room ON bids(room_id);

-- round_winners (009). Created here too, so 010 works without 009.
CREATE TABLE IF NOT EXISTS round_winners (
  round_id       uuid NOT NULL REFERENCES auction_rounds(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  amount         integer NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, participant_id)
);
ALTER TABLE round_winners ADD COLUMN IF NOT EXISTS room_id uuid NULL;
UPDATE round_winners w
SET    room_id = r.room_id
FROM   auction_rounds r
WHERE  r.id = w.round_id AND w.room_id IS NULL;
ALTER TABLE round_winners ALTER COLUMN room_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'round_winners_round_room_fkey') THEN
    ALTER TABLE round_winners ADD CONSTRAINT round_winners_round_room_fkey
      FOREIGN KEY (round_id, room_id) REFERENCES auction_rounds(id, room_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'round_winners_participant_room_fkey') THEN
    ALTER TABLE round_winners ADD CONSTRAINT round_winners_participant_room_fkey
      FOREIGN KEY (participant_id, room_id) REFERENCES participants(id, room_id) ON DELETE CASCADE;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_round_winners_room ON round_winners(room_id);
ALTER TABLE round_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read round winners" ON round_winners;
CREATE POLICY "Public read round winners" ON round_winners FOR SELECT USING (true);

-- wallet_transactions: the participant must belong to the ledger row's room.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_participant_room_fkey') THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_participant_room_fkey
      FOREIGN KEY (participant_id, room_id) REFERENCES participants(id, room_id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Browser reads of rooms are limited to the columns the join, play and
-- projection screens need. Staff e-mails and the live window stay
-- server-side (service_role bypasses this).
REVOKE SELECT ON rooms FROM anon, authenticated;
GRANT SELECT (id, slug, title, client_name, logo_path, game_mode, status, starting_coins,
              default_round_seconds, current_round_id, created_at)
  ON rooms TO anon, authenticated;
DROP POLICY IF EXISTS "Public read events" ON rooms;
DROP POLICY IF EXISTS "Public read rooms" ON rooms;
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);

-- Admin room list: every room with its participant, round and statement
-- counts in one read. Server-only (service role); the browser never needs it.
CREATE OR REPLACE VIEW room_overview AS
SELECT r.*,
       (SELECT count(*) FROM participants   p WHERE p.room_id = r.id)::integer AS participant_count,
       (SELECT count(*) FROM auction_rounds x WHERE x.room_id = r.id)::integer AS round_count,
       (SELECT count(*) FROM traits         t WHERE t.room_id = r.id)::integer AS trait_count
FROM rooms r;
REVOKE ALL ON room_overview FROM anon, authenticated;
GRANT SELECT ON room_overview TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Drop the functions whose parameters change
-- ─────────────────────────────────────────────────────────────────────────
-- CREATE OR REPLACE cannot rename a parameter, so the old signatures go.
-- Nothing else references them: the app calls them by name through
-- PostgREST, and the new versions are created right below.

DROP FUNCTION IF EXISTS set_game_mode(uuid, text);
DROP FUNCTION IF EXISTS open_auction_round(uuid, uuid);
DROP FUNCTION IF EXISTS close_auction_round(uuid);
DROP FUNCTION IF EXISTS submit_bid(text, uuid, integer);
DROP FUNCTION IF EXISTS open_allocation(uuid);
DROP FUNCTION IF EXISTS submit_allocation(text, jsonb);
DROP FUNCTION IF EXISTS close_allocation(uuid);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Helpers
-- ─────────────────────────────────────────────────────────────────────────

-- A room is live while it is active and inside its 12-hour window.
CREATE OR REPLACE FUNCTION room_is_live(p_status text, p_active_until timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = auction
AS $$
  SELECT p_status = 'active' AND p_active_until IS NOT NULL AND p_active_until > now();
$$;

-- Settings that shape the game are locked while the room holds play data.
-- A reset (which deletes rounds and participants) unlocks them again, so a
-- rehearsal never freezes the statement list.
CREATE OR REPLACE FUNCTION room_has_play_data(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = auction
AS $$
  SELECT EXISTS (SELECT 1 FROM auction_rounds r WHERE r.room_id = p_room_id)
      OR EXISTS (SELECT 1 FROM participants p WHERE p.room_id = p_room_id);
$$;

-- Validates and writes a statement list for a room. p_traits is a JSON
-- array of { id?, title, description?, category, sort_order }. Statements
-- with an id are updated, without an id inserted, and any existing
-- statement missing from the list is deleted. Raises invalid_traits.
CREATE OR REPLACE FUNCTION apply_room_traits(p_room_id uuid, p_traits jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_item     jsonb;
  v_id       uuid;
  v_title    text;
  v_desc     text;
  v_category text;
  v_order    integer;
  v_keep     uuid[] := '{}';
  v_count    integer := 0;
BEGIN
  IF p_traits IS NULL OR jsonb_typeof(p_traits) <> 'array' THEN
    RAISE EXCEPTION 'invalid_traits';
  END IF;
  IF jsonb_array_length(p_traits) > 50 THEN
    RAISE EXCEPTION 'invalid_traits';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_traits)
  LOOP
    v_title    := btrim(COALESCE(v_item->>'title', ''));
    v_desc     := COALESCE(v_item->>'description', '');
    v_category := v_item->>'category';
    v_order    := COALESCE((v_item->>'sort_order')::integer, v_count + 1);

    IF length(v_title) < 2 OR length(v_title) > 120 THEN
      RAISE EXCEPTION 'invalid_traits';
    END IF;
    IF length(v_desc) > 500 THEN
      RAISE EXCEPTION 'invalid_traits';
    END IF;
    IF v_category IS NULL OR v_category NOT IN ('מנהיגות', 'יחסים', 'שיפוט', 'למידה') THEN
      RAISE EXCEPTION 'invalid_traits';
    END IF;

    v_id := NULL;
    IF COALESCE(v_item->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_id := (v_item->>'id')::uuid;
    END IF;

    IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM traits t WHERE t.id = v_id AND t.room_id = p_room_id) THEN
      UPDATE traits
      SET    title = v_title, description = v_desc, category = v_category, sort_order = v_order
      WHERE  id = v_id AND room_id = p_room_id;
    ELSE
      INSERT INTO traits (room_id, title, description, category, sort_order)
      VALUES (p_room_id, v_title, v_desc, v_category, v_order)
      RETURNING id INTO v_id;
    END IF;

    v_keep  := v_keep || v_id;
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM traits t
  WHERE  t.room_id = p_room_id
    AND  NOT (t.id = ANY (v_keep));

  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Room management
-- ─────────────────────────────────────────────────────────────────────────
-- Lock ordering, as in 008: rooms row -> auction_rounds rows (ORDER BY id)
-- -> participants row(s). Room rows are locked FOR NO KEY UPDATE so that
-- participant registration (FOR KEY SHARE through the FK) is never blocked.

-- Error codes: invalid_slug, slug_taken, invalid_title, invalid_mode,
-- invalid_coins, invalid_round_seconds, invalid_traits
CREATE OR REPLACE FUNCTION create_room(
  p_slug                  text,
  p_title                 text,
  p_client_name           text,
  p_game_mode             text,
  p_starting_coins        integer,
  p_default_round_seconds integer,
  p_created_by_email      text,
  p_traits                jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room_id uuid;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_slug) NOT BETWEEN 3 AND 60 THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;
  IF EXISTS (SELECT 1 FROM rooms r WHERE r.slug = p_slug) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;
  IF p_game_mode IS NULL OR p_game_mode NOT IN ('auction', 'allocation') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;
  IF p_starting_coins IS NULL OR p_starting_coins NOT BETWEEN 1 AND 1000000 THEN
    RAISE EXCEPTION 'invalid_coins';
  END IF;
  IF p_default_round_seconds IS NOT NULL AND p_default_round_seconds NOT BETWEEN 10 AND 3600 THEN
    RAISE EXCEPTION 'invalid_round_seconds';
  END IF;

  INSERT INTO rooms (slug, title, client_name, game_mode, starting_coins,
                     default_round_seconds, created_by_email, status)
  VALUES (p_slug, btrim(p_title), btrim(COALESCE(p_client_name, '')), p_game_mode,
          p_starting_coins, p_default_round_seconds, p_created_by_email, 'draft')
  RETURNING id INTO v_room_id;

  PERFORM apply_room_traits(v_room_id, COALESCE(p_traits, '[]'::jsonb));

  RETURN v_room_id;
END;
$$;

-- Updates a room. Title, client name and slug can change at any time
-- (slug only while the room has no play data, since the QR may be
-- printed); game mode, starting coins, round length and statements only
-- while the room has no play data.
-- Error codes: room_not_found, room_archived, invalid_slug, slug_taken,
-- invalid_title, invalid_mode, invalid_coins, invalid_round_seconds,
-- invalid_traits, settings_locked
CREATE OR REPLACE FUNCTION update_room(
  p_room_id               uuid,
  p_slug                  text,
  p_title                 text,
  p_client_name           text,
  p_game_mode             text,
  p_starting_coins        integer,
  p_default_round_seconds integer,
  p_traits                jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room   rooms%ROWTYPE;
  v_locked boolean;
BEGIN
  SELECT * INTO v_room FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;
  IF v_room.status = 'archived' THEN
    RAISE EXCEPTION 'room_archived';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_slug) NOT BETWEEN 3 AND 60 THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;
  IF p_game_mode IS NULL OR p_game_mode NOT IN ('auction', 'allocation') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;
  IF p_starting_coins IS NULL OR p_starting_coins NOT BETWEEN 1 AND 1000000 THEN
    RAISE EXCEPTION 'invalid_coins';
  END IF;
  IF p_default_round_seconds IS NOT NULL AND p_default_round_seconds NOT BETWEEN 10 AND 3600 THEN
    RAISE EXCEPTION 'invalid_round_seconds';
  END IF;

  v_locked := room_has_play_data(p_room_id);

  IF v_locked THEN
    -- Game-shaping settings may be sent back unchanged, never changed.
    IF p_slug <> v_room.slug
       OR p_game_mode <> v_room.game_mode
       OR p_starting_coins <> v_room.starting_coins
       OR p_default_round_seconds IS DISTINCT FROM v_room.default_round_seconds THEN
      RAISE EXCEPTION 'settings_locked';
    END IF;
    IF p_traits IS NOT NULL THEN
      RAISE EXCEPTION 'settings_locked';
    END IF;
  ELSE
    IF p_slug <> v_room.slug AND EXISTS (SELECT 1 FROM rooms r WHERE r.slug = p_slug) THEN
      RAISE EXCEPTION 'slug_taken';
    END IF;
  END IF;

  UPDATE rooms
  SET    slug                  = p_slug,
         title                 = btrim(p_title),
         client_name           = btrim(COALESCE(p_client_name, '')),
         game_mode             = p_game_mode,
         starting_coins        = p_starting_coins,
         default_round_seconds = p_default_round_seconds
  WHERE  id = p_room_id;

  IF NOT v_locked AND p_traits IS NOT NULL THEN
    PERFORM apply_room_traits(p_room_id, p_traits);
  END IF;
END;
$$;

-- Status transitions:
--   active   from draft / active / ended  -> opens (or extends) a 12-hour
--            live window; the room's data is kept, so a workshop that spans
--            two days simply re-activates.
--   ended    from active                   -> closes the live window.
--   archived from draft / ended            -> read-only; never from active.
-- Error codes: room_not_found, invalid_status, invalid_transition
CREATE OR REPLACE FUNCTION set_room_status(p_room_id uuid, p_status text)
RETURNS TABLE (status text, activated_at timestamptz, active_until timestamptz)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('active', 'ended', 'archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_room FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  IF p_status = 'active' THEN
    IF v_room.status NOT IN ('draft', 'active', 'ended') THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    UPDATE rooms
    SET    status       = 'active',
           activated_at = COALESCE(rooms.activated_at, now()),
           active_until = now() + interval '12 hours'
    WHERE  id = p_room_id;
  ELSIF p_status = 'ended' THEN
    IF v_room.status <> 'active' THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    UPDATE rooms SET status = 'ended', active_until = now() WHERE id = p_room_id;
  ELSE
    IF v_room.status NOT IN ('draft', 'ended') THEN
      RAISE EXCEPTION 'invalid_transition';
    END IF;
    UPDATE rooms SET status = 'archived' WHERE id = p_room_id;
  END IF;

  RETURN QUERY
    SELECT r.status, r.activated_at, r.active_until FROM rooms r WHERE r.id = p_room_id;
END;
$$;

-- Copies a room's settings and statements into a new draft room.
-- Error codes: room_not_found, invalid_slug, slug_taken, invalid_title
CREATE OR REPLACE FUNCTION duplicate_room(
  p_source_room_id   uuid,
  p_slug             text,
  p_title            text,
  p_created_by_email text,
  p_logo_path        text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_source  rooms%ROWTYPE;
  v_room_id uuid;
BEGIN
  SELECT * INTO v_source FROM rooms r WHERE r.id = p_source_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(p_slug) NOT BETWEEN 3 AND 60 THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;
  IF EXISTS (SELECT 1 FROM rooms r WHERE r.slug = p_slug) THEN
    RAISE EXCEPTION 'slug_taken';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;

  INSERT INTO rooms (slug, title, client_name, logo_path, game_mode, starting_coins,
                     default_round_seconds, created_by_email, status)
  VALUES (p_slug, btrim(p_title), v_source.client_name, p_logo_path, v_source.game_mode,
          v_source.starting_coins, v_source.default_round_seconds, p_created_by_email, 'draft')
  RETURNING id INTO v_room_id;

  INSERT INTO traits (room_id, title, description, category, sort_order)
  SELECT v_room_id, t.title, t.description, t.category, t.sort_order
  FROM   traits t
  WHERE  t.room_id = p_source_room_id
  ORDER  BY t.sort_order, t.created_at;

  RETURN v_room_id;
END;
$$;

-- Deletes a room that never hosted a game: a draft with no participants
-- and no rounds. Anything else is archived instead.
-- Error codes: room_not_found, room_has_history
CREATE OR REPLACE FUNCTION delete_room(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;
  IF v_room.status <> 'draft' OR v_room.activated_at IS NOT NULL OR room_has_play_data(p_room_id) THEN
    RAISE EXCEPTION 'room_has_history';
  END IF;
  DELETE FROM traits WHERE room_id = p_room_id;
  DELETE FROM rooms  WHERE id = p_room_id;
END;
$$;

-- Clears one room's play data in a single transaction: rounds, bids,
-- winners, ledger and participants (sessions cascade), and marks every
-- statement unused. Settings, status and the live window are untouched.
-- Error codes: room_not_found
CREATE OR REPLACE FUNCTION reset_room(p_room_id uuid)
RETURNS TABLE (participants_removed integer, rounds_removed integer)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_participants integer;
  v_rounds       integer;
BEGIN
  PERFORM 1 FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  -- Waits for in-flight bids and closes (they hold locks on these rows).
  PERFORM 1 FROM auction_rounds r WHERE r.room_id = p_room_id ORDER BY r.id FOR UPDATE;

  -- The FK from rooms.current_round_id blocks deleting rounds until cleared.
  UPDATE rooms SET current_round_id = NULL WHERE id = p_room_id;

  DELETE FROM wallet_transactions WHERE room_id = p_room_id;
  DELETE FROM round_winners       WHERE room_id = p_room_id;
  DELETE FROM bids                WHERE room_id = p_room_id;

  DELETE FROM auction_rounds WHERE room_id = p_room_id;
  GET DIAGNOSTICS v_rounds = ROW_COUNT;

  DELETE FROM participants WHERE room_id = p_room_id;
  GET DIAGNOSTICS v_participants = ROW_COUNT;

  UPDATE traits SET is_used = false WHERE room_id = p_room_id AND is_used;

  RETURN QUERY SELECT v_participants, v_rounds;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Participant registration
-- ─────────────────────────────────────────────────────────────────────────
-- Creates the participant, their private session row and the opening
-- ledger entry together. The wallet starts at the room's starting_coins.
-- Error codes: room_not_found, room_not_live, invalid_name
CREATE OR REPLACE FUNCTION register_participant(
  p_room_id       uuid,
  p_display_name  text,
  p_session_token text
)
RETURNS TABLE (participant_id uuid, wallet_balance integer)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room           rooms%ROWTYPE;
  v_name           text;
  v_participant_id uuid;
BEGIN
  SELECT * INTO v_room FROM rooms r WHERE r.id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;
  IF NOT room_is_live(v_room.status, v_room.active_until) THEN
    RAISE EXCEPTION 'room_not_live';
  END IF;

  v_name := btrim(COALESCE(p_display_name, ''));
  IF length(v_name) NOT BETWEEN 2 AND 40 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF p_session_token IS NULL OR length(p_session_token) < 16 THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  INSERT INTO participants (room_id, display_name, wallet_balance)
  VALUES (p_room_id, v_name, v_room.starting_coins)
  RETURNING id INTO v_participant_id;

  INSERT INTO participant_sessions (participant_id, session_token)
  VALUES (v_participant_id, p_session_token);

  INSERT INTO wallet_transactions (room_id, participant_id, amount_delta, reason)
  VALUES (p_room_id, v_participant_id, v_room.starting_coins, 'initial_grant');

  RETURN QUERY SELECT v_participant_id, v_room.starting_coins;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Game functions, room-scoped
-- ─────────────────────────────────────────────────────────────────────────

-- Error codes: invalid_mode, room_not_found, game_in_progress
CREATE OR REPLACE FUNCTION set_game_mode(p_room_id uuid, p_mode text)
RETURNS text
LANGUAGE plpgsql
SET search_path = auction
AS $$
BEGIN
  IF p_mode IS NULL OR p_mode NOT IN ('auction', 'allocation') THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  PERFORM 1 FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM auction_rounds r WHERE r.room_id = p_room_id) THEN
    RAISE EXCEPTION 'game_in_progress';
  END IF;

  UPDATE rooms SET game_mode = p_mode WHERE id = p_room_id;
  RETURN p_mode;
END;
$$;

-- Error codes: room_not_found, room_not_live, wrong_mode, trait_unavailable
-- (a second open round is rejected by uq_one_open_round_per_room, 23505)
CREATE OR REPLACE FUNCTION open_auction_round(p_room_id uuid, p_trait_id uuid)
RETURNS TABLE (round_id uuid)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room     rooms%ROWTYPE;
  v_round_id uuid;
BEGIN
  SELECT * INTO v_room FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;
  IF NOT room_is_live(v_room.status, v_room.active_until) THEN
    RAISE EXCEPTION 'room_not_live';
  END IF;
  IF v_room.game_mode <> 'auction' THEN
    RAISE EXCEPTION 'wrong_mode';
  END IF;

  PERFORM 1
  FROM   traits
  WHERE  id = p_trait_id
    AND  room_id = p_room_id
    AND  NOT is_used
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trait_unavailable';
  END IF;

  UPDATE traits SET is_used = true WHERE id = p_trait_id;

  INSERT INTO auction_rounds (room_id, trait_id, status, opened_at, mode)
  VALUES (p_room_id, p_trait_id, 'open', now(), 'auction')
  RETURNING id INTO v_round_id;

  UPDATE rooms SET current_round_id = v_round_id WHERE id = p_room_id;

  RETURN QUERY SELECT v_round_id;
END;
$$;

-- Closing is allowed even after the live window lapsed, so a facilitator
-- can always finish a round that is open.
-- Error codes: round_not_open
CREATE OR REPLACE FUNCTION close_auction_round(p_room_id uuid, p_round_id uuid)
RETURNS TABLE (
  winner_id        uuid,
  winning_amount   integer,
  bidder_count     bigint
)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_trait_id       uuid;
  v_winner_id      uuid;
  v_winning_amount integer;
  v_bidder_count   bigint;
BEGIN
  SELECT trait_id
  INTO   v_trait_id
  FROM   auction_rounds
  WHERE  id = p_round_id
    AND  room_id = p_room_id
    AND  status = 'open'
    AND  mode = 'auction'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_open';
  END IF;

  UPDATE auction_rounds
  SET    status    = 'closed',
         closed_at = now()
  WHERE  id = p_round_id;

  SELECT COUNT(*) INTO v_bidder_count
  FROM   bids
  WHERE  round_id = p_round_id;

  SELECT participant_id, amount
  INTO   v_winner_id, v_winning_amount
  FROM   bids
  WHERE  round_id = p_round_id
  ORDER  BY amount DESC, updated_at ASC
  LIMIT  1;

  IF v_winner_id IS NOT NULL THEN
    UPDATE participants
    SET    wallet_balance = GREATEST(0, wallet_balance - v_winning_amount)
    WHERE  id = v_winner_id AND room_id = p_room_id;

    INSERT INTO wallet_transactions
      (room_id, participant_id, round_id, amount_delta, reason)
    VALUES
      (p_room_id, v_winner_id, p_round_id, -v_winning_amount, 'round_bid_payment');

    UPDATE auction_rounds
    SET    winner_participant_id = v_winner_id,
           winning_bid_amount    = v_winning_amount
    WHERE  id = p_round_id;
  END IF;

  UPDATE traits SET is_used = true WHERE id = v_trait_id;

  RETURN QUERY SELECT v_winner_id, v_winning_amount, v_bidder_count;
END;
$$;

-- Error codes: invalid_session, room_mismatch, room_not_live, round_not_found,
-- wrong_mode, round_not_open, invalid_amount, insufficient_balance, bid_not_higher
CREATE OR REPLACE FUNCTION submit_bid(
  p_session_token text,
  p_room_id       uuid,
  p_round_id      uuid,
  p_amount        integer
)
RETURNS TABLE (bid_amount integer)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_participant_id uuid;
  v_room_id        uuid;
  v_balance        integer;
  v_status         text;
  v_active_until   timestamptz;
  v_round_room_id  uuid;
  v_round_status   text;
  v_round_mode     text;
  v_existing       integer;
BEGIN
  SELECT p.id, p.room_id, p.wallet_balance
  INTO   v_participant_id, v_room_id, v_balance
  FROM   participant_sessions s
  JOIN   participants p ON p.id = s.participant_id
  WHERE  s.session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF v_room_id <> p_room_id THEN
    RAISE EXCEPTION 'room_mismatch';
  END IF;

  SELECT r.status, r.active_until INTO v_status, v_active_until
  FROM   rooms r WHERE r.id = p_room_id;
  IF NOT room_is_live(v_status, v_active_until) THEN
    RAISE EXCEPTION 'room_not_live';
  END IF;

  -- Share lock: many bids proceed in parallel, close_auction_round
  -- (FOR UPDATE) waits for in-flight bids, and a bid arriving after the
  -- close sees status = 'closed'.
  SELECT r.room_id, r.status, r.mode
  INTO   v_round_room_id, v_round_status, v_round_mode
  FROM   auction_rounds r
  WHERE  r.id = p_round_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'round_not_found';
  END IF;
  IF v_round_room_id <> p_room_id THEN
    RAISE EXCEPTION 'room_mismatch';
  END IF;
  IF v_round_mode <> 'auction' THEN
    RAISE EXCEPTION 'wrong_mode';
  END IF;
  IF v_round_status <> 'open' THEN
    RAISE EXCEPTION 'round_not_open';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_amount > v_balance THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  SELECT b.amount INTO v_existing
  FROM   bids b
  WHERE  b.round_id = p_round_id
    AND  b.participant_id = v_participant_id
  FOR UPDATE;

  IF v_existing IS NOT NULL AND p_amount <= v_existing THEN
    RAISE EXCEPTION 'bid_not_higher';
  END IF;

  INSERT INTO bids AS b (room_id, round_id, participant_id, amount, created_at, updated_at)
  VALUES (p_room_id, p_round_id, v_participant_id, p_amount, now(), now())
  ON CONFLICT (round_id, participant_id) DO UPDATE
    SET amount     = EXCLUDED.amount,
        updated_at = now()
    WHERE b.amount < EXCLUDED.amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bid_not_higher';
  END IF;

  RETURN QUERY SELECT p_amount;
END;
$$;

-- Error codes: room_not_found, room_not_live, wrong_mode,
-- allocation_already_open, no_traits
CREATE OR REPLACE FUNCTION open_allocation(p_room_id uuid)
RETURNS TABLE (round_count integer)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room  rooms%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_room FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;
  IF NOT room_is_live(v_room.status, v_room.active_until) THEN
    RAISE EXCEPTION 'room_not_live';
  END IF;
  IF v_room.game_mode <> 'allocation' THEN
    RAISE EXCEPTION 'wrong_mode';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auction_rounds r
    WHERE  r.room_id = p_room_id AND r.status = 'open'
  ) THEN
    RAISE EXCEPTION 'allocation_already_open';
  END IF;

  PERFORM 1
  FROM   traits t
  WHERE  t.room_id = p_room_id AND NOT t.is_used
  ORDER  BY t.id
  FOR UPDATE;

  INSERT INTO auction_rounds (room_id, trait_id, status, opened_at, mode)
  SELECT p_room_id, t.id, 'open', now(), 'allocation'
  FROM   traits t
  WHERE  t.room_id = p_room_id AND NOT t.is_used;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_traits';
  END IF;

  UPDATE traits
  SET    is_used = true
  WHERE  room_id = p_room_id AND NOT is_used;

  RETURN QUERY SELECT v_count;
END;
$$;

-- Error codes: invalid_session, room_mismatch, room_not_live,
-- allocation_not_open, round_not_open, invalid_amount, insufficient_balance
CREATE OR REPLACE FUNCTION submit_allocation(
  p_session_token text,
  p_room_id       uuid,
  p_allocations   jsonb
)
RETURNS TABLE (total_allocated integer)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_participant_id uuid;
  v_room_id        uuid;
  v_status         text;
  v_active_until   timestamptz;
  v_balance        integer;
  v_open_ids       uuid[] := '{}';
  v_round_ids      uuid[] := '{}';
  v_amounts        integer[] := '{}';
  v_total          bigint := 0;
  v_id             uuid;
  v_key            text;
  v_value          jsonb;
  v_num            numeric;
BEGIN
  SELECT p.id, p.room_id
  INTO   v_participant_id, v_room_id
  FROM   participant_sessions s
  JOIN   participants p ON p.id = s.participant_id
  WHERE  s.session_token = p_session_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  IF v_room_id <> p_room_id THEN
    RAISE EXCEPTION 'room_mismatch';
  END IF;

  SELECT r.status, r.active_until INTO v_status, v_active_until
  FROM   rooms r WHERE r.id = p_room_id;
  IF NOT room_is_live(v_status, v_active_until) THEN
    RAISE EXCEPTION 'room_not_live';
  END IF;

  FOR v_id IN
    SELECT r.id
    FROM   auction_rounds r
    WHERE  r.room_id = p_room_id
      AND  r.mode = 'allocation'
      AND  r.status = 'open'
    ORDER  BY r.id
    FOR SHARE
  LOOP
    v_open_ids := v_open_ids || v_id;
  END LOOP;

  IF cardinality(v_open_ids) = 0 THEN
    RAISE EXCEPTION 'allocation_not_open';
  END IF;

  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'object' THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT p.wallet_balance INTO v_balance
  FROM   participants p
  WHERE  p.id = v_participant_id
  FOR NO KEY UPDATE;

  FOR v_key, v_value IN SELECT e.key, e.value FROM jsonb_each(p_allocations) e
  LOOP
    IF v_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'round_not_open';
    END IF;
    v_id := v_key::uuid;
    IF NOT (v_id = ANY (v_open_ids)) THEN
      RAISE EXCEPTION 'round_not_open';
    END IF;
    IF v_id = ANY (v_round_ids) THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;

    IF jsonb_typeof(v_value) <> 'number' THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;
    v_num := v_value::numeric;
    IF v_num < 0 OR v_num <> trunc(v_num) OR v_num > 2147483647 THEN
      RAISE EXCEPTION 'invalid_amount';
    END IF;

    v_round_ids := v_round_ids || v_id;
    v_amounts   := v_amounts || v_num::integer;
    v_total     := v_total + v_num::integer;
  END LOOP;

  IF v_total > v_balance THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  DELETE FROM bids b
  WHERE  b.participant_id = v_participant_id
    AND  b.round_id = ANY (v_open_ids)
    AND  NOT EXISTS (
      SELECT 1
      FROM   unnest(v_round_ids, v_amounts) AS w(round_id, amount)
      WHERE  w.round_id = b.round_id AND w.amount > 0
    );

  INSERT INTO bids AS b (room_id, round_id, participant_id, amount, created_at, updated_at)
  SELECT p_room_id, w.round_id, v_participant_id, w.amount, now(), now()
  FROM   unnest(v_round_ids, v_amounts) AS w(round_id, amount)
  WHERE  w.amount > 0
  ON CONFLICT (round_id, participant_id) DO UPDATE
    SET amount     = EXCLUDED.amount,
        updated_at = now()
    WHERE b.amount IS DISTINCT FROM EXCLUDED.amount;

  RETURN QUERY SELECT v_total::integer;
END;
$$;

-- Error codes: room_not_found, allocation_not_open
CREATE OR REPLACE FUNCTION close_allocation(p_room_id uuid)
RETURNS TABLE (
  rounds_closed        integer,
  participants_charged integer,
  total_charged        bigint,
  tied_traits          integer
)
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_round_ids    uuid[] := '{}';
  v_id           uuid;
  v_participants integer;
  v_total        bigint;
  v_tied         integer;
BEGIN
  PERFORM 1 FROM rooms r WHERE r.id = p_room_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  FOR v_id IN
    SELECT r.id
    FROM   auction_rounds r
    WHERE  r.room_id = p_room_id
      AND  r.mode = 'allocation'
      AND  r.status = 'open'
    ORDER  BY r.id
    FOR UPDATE
  LOOP
    v_round_ids := v_round_ids || v_id;
  END LOOP;

  IF cardinality(v_round_ids) = 0 THEN
    RAISE EXCEPTION 'allocation_not_open';
  END IF;

  UPDATE auction_rounds
  SET    status    = 'closed',
         closed_at = now()
  WHERE  id = ANY (v_round_ids);

  INSERT INTO round_winners (room_id, round_id, participant_id, amount)
  SELECT p_room_id, b.round_id, b.participant_id, b.amount
  FROM   bids b
  JOIN (
    SELECT round_id, MAX(amount) AS top
    FROM   bids
    WHERE  round_id = ANY (v_round_ids)
    GROUP  BY round_id
  ) m ON m.round_id = b.round_id AND b.amount = m.top
  ON CONFLICT (round_id, participant_id) DO NOTHING;

  UPDATE auction_rounds r
  SET    winning_bid_amount    = w.top,
         winner_participant_id = CASE WHEN w.winner_count = 1 THEN w.first_winner END
  FROM (
    SELECT round_id,
           MAX(amount)                    AS top,
           COUNT(*)                       AS winner_count,
           (array_agg(participant_id))[1] AS first_winner
    FROM   round_winners
    WHERE  round_id = ANY (v_round_ids)
    GROUP  BY round_id
  ) w
  WHERE  r.id = w.round_id;

  SELECT COUNT(*) INTO v_tied
  FROM (
    SELECT round_id
    FROM   round_winners
    WHERE  round_id = ANY (v_round_ids)
    GROUP  BY round_id
    HAVING COUNT(*) > 1
  ) t;

  INSERT INTO wallet_transactions
    (room_id, participant_id, round_id, amount_delta, reason)
  SELECT p_room_id, b.participant_id, b.round_id, -b.amount, 'round_bid_payment'
  FROM   bids b
  WHERE  b.round_id = ANY (v_round_ids);

  UPDATE participants p
  SET    wallet_balance = GREATEST(0, p.wallet_balance - t.total)
  FROM (
    SELECT b.participant_id, SUM(b.amount) AS total
    FROM   bids b
    WHERE  b.round_id = ANY (v_round_ids)
    GROUP  BY b.participant_id
  ) t
  WHERE  p.id = t.participant_id;

  GET DIAGNOSTICS v_participants = ROW_COUNT;

  SELECT COALESCE(SUM(b.amount), 0) INTO v_total
  FROM   bids b
  WHERE  b.round_id = ANY (v_round_ids);

  RETURN QUERY SELECT cardinality(v_round_ids), v_participants, v_total, v_tied;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Privileges: every function here is server-only (service_role)
-- ─────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'room_is_live(text, timestamptz)',
    'room_has_play_data(uuid)',
    'apply_room_traits(uuid, jsonb)',
    'create_room(text, text, text, text, integer, integer, text, jsonb)',
    'update_room(uuid, text, text, text, text, integer, integer, jsonb)',
    'set_room_status(uuid, text)',
    'duplicate_room(uuid, text, text, text, text)',
    'delete_room(uuid)',
    'reset_room(uuid)',
    'register_participant(uuid, text, text)',
    'set_game_mode(uuid, text)',
    'open_auction_round(uuid, uuid)',
    'close_auction_round(uuid, uuid)',
    'submit_bid(text, uuid, uuid, integer)',
    'open_allocation(uuid)',
    'submit_allocation(text, uuid, jsonb)',
    'close_allocation(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION auction.%s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION auction.%s TO service_role', v_sig);
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. The existing event becomes the first room
-- ─────────────────────────────────────────────────────────────────────────
-- Rooms that are 'active' today get a live window starting now, so a
-- running event keeps working for 12 hours; after that the facilitator
-- presses "activate" on the admin screen like for any other room.

UPDATE rooms
SET    activated_at = COALESCE(activated_at, created_at),
       active_until = COALESCE(active_until, now() + interval '12 hours')
WHERE  status = 'active';
