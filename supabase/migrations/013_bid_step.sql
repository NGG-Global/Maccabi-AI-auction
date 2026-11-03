-- ============================================================
-- 013 Step per click (rooms.bid_step)
-- ============================================================
-- The "Evening Sale" phone moves the amount with − / + buttons. The size
-- of that step is now a room setting: 10 coins by default in auction
-- mode, 50 in allocation mode (the values the phones used before), and
-- never more than half the starting budget. Like the other game-shaping
-- settings it is locked while the room holds play data.
--
-- Changes: the column, its constraint, the browser grant, the
-- room_overview view (r.* was expanded at creation time) and the three
-- room functions. create_room / update_room take the step as a trailing
-- optional parameter, so existing callers keep working: NULL means the
-- mode's default on create, and "keep the current step" on update.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bid_step integer NOT NULL DEFAULT 10;

-- Rooms created before this migration keep the steps their phones used.
UPDATE rooms SET bid_step = LEAST(50, starting_coins) WHERE game_mode = 'allocation' AND bid_step = 10;
UPDATE rooms SET bid_step = starting_coins WHERE bid_step > starting_coins;

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_bid_step_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_bid_step_check
  CHECK (bid_step BETWEEN 1 AND 1000000 AND bid_step <= starting_coins);

-- The phones read the step with the other public room columns.
REVOKE SELECT ON rooms FROM anon, authenticated;
GRANT SELECT (id, slug, title, client_name, logo_path, game_mode, status, starting_coins,
              default_round_seconds, bid_step, current_round_id, created_at)
  ON rooms TO anon, authenticated;

-- r.* in a view is expanded when the view is created: recreate it so the
-- admin list sees the new column.
DROP VIEW IF EXISTS room_overview;
CREATE VIEW room_overview AS
SELECT r.*,
       (SELECT count(*) FROM participants   p WHERE p.room_id = r.id)::integer AS participant_count,
       (SELECT count(*) FROM auction_rounds x WHERE x.room_id = r.id)::integer AS round_count,
       (SELECT count(*) FROM traits         t WHERE t.room_id = r.id)::integer AS trait_count
FROM rooms r;
REVOKE ALL ON room_overview FROM anon, authenticated;
GRANT SELECT ON room_overview TO service_role;

-- The mode's default step when a caller sends none.
CREATE OR REPLACE FUNCTION default_bid_step(p_game_mode text, p_starting_coins integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = auction
AS $$
  SELECT LEAST(CASE WHEN p_game_mode = 'allocation' THEN 50 ELSE 10 END, GREATEST(1, p_starting_coins / 2));
$$;

-- The parameter lists change, so the old signatures go (PostgREST cannot
-- resolve overloaded functions by named arguments).
DROP FUNCTION IF EXISTS create_room(text, text, text, text, integer, integer, text, jsonb);
DROP FUNCTION IF EXISTS update_room(uuid, text, text, text, text, integer, integer, jsonb);

-- Error codes: invalid_slug, slug_taken, invalid_title, invalid_mode,
-- invalid_coins, invalid_round_seconds, invalid_step, invalid_traits
CREATE FUNCTION create_room(
  p_slug                  text,
  p_title                 text,
  p_client_name           text,
  p_game_mode             text,
  p_starting_coins        integer,
  p_default_round_seconds integer,
  p_created_by_email      text,
  p_traits                jsonb,
  p_bid_step              integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room_id uuid;
  v_step    integer;
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
  v_step := COALESCE(p_bid_step, default_bid_step(p_game_mode, p_starting_coins));
  IF v_step < 1 OR v_step * 2 > p_starting_coins THEN
    RAISE EXCEPTION 'invalid_step';
  END IF;

  INSERT INTO rooms (slug, title, client_name, game_mode, starting_coins,
                     default_round_seconds, bid_step, created_by_email, status)
  VALUES (p_slug, btrim(p_title), btrim(COALESCE(p_client_name, '')), p_game_mode,
          p_starting_coins, p_default_round_seconds, v_step, p_created_by_email, 'draft')
  RETURNING id INTO v_room_id;

  PERFORM apply_room_traits(v_room_id, COALESCE(p_traits, '[]'::jsonb));

  RETURN v_room_id;
END;
$$;

-- Updates a room. Title, client name and slug can change at any time
-- (slug only while the room has no play data, since the QR may be
-- printed); game mode, starting coins, round length, step and statements
-- only while the room has no play data.
-- Error codes: room_not_found, room_archived, invalid_slug, slug_taken,
-- invalid_title, invalid_mode, invalid_coins, invalid_round_seconds,
-- invalid_step, invalid_traits, settings_locked
CREATE FUNCTION update_room(
  p_room_id               uuid,
  p_slug                  text,
  p_title                 text,
  p_client_name           text,
  p_game_mode             text,
  p_starting_coins        integer,
  p_default_round_seconds integer,
  p_traits                jsonb,
  p_bid_step              integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = auction
AS $$
DECLARE
  v_room   rooms%ROWTYPE;
  v_locked boolean;
  v_step   integer;
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
  -- NULL keeps the current step; a step that no longer fits the budget falls back to the mode's default.
  v_step := COALESCE(p_bid_step, v_room.bid_step);
  IF p_bid_step IS NULL AND v_step * 2 > p_starting_coins THEN
    v_step := default_bid_step(p_game_mode, p_starting_coins);
  END IF;
  IF v_step < 1 OR v_step * 2 > p_starting_coins THEN
    RAISE EXCEPTION 'invalid_step';
  END IF;

  v_locked := room_has_play_data(p_room_id);

  IF v_locked THEN
    -- Game-shaping settings may be sent back unchanged, never changed.
    IF p_slug <> v_room.slug
       OR p_game_mode <> v_room.game_mode
       OR p_starting_coins <> v_room.starting_coins
       OR p_default_round_seconds IS DISTINCT FROM v_room.default_round_seconds
       OR v_step <> v_room.bid_step THEN
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
         default_round_seconds = p_default_round_seconds,
         bid_step              = v_step
  WHERE  id = p_room_id;

  IF NOT v_locked AND p_traits IS NOT NULL THEN
    PERFORM apply_room_traits(p_room_id, p_traits);
  END IF;
END;
$$;

-- duplicate_room keeps its signature; only the copied columns change.
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
                     default_round_seconds, bid_step, created_by_email, status)
  VALUES (p_slug, btrim(p_title), v_source.client_name, p_logo_path, v_source.game_mode,
          v_source.starting_coins, v_source.default_round_seconds, v_source.bid_step, p_created_by_email, 'draft')
  RETURNING id INTO v_room_id;

  INSERT INTO traits (room_id, title, description, category, sort_order)
  SELECT v_room_id, t.title, t.description, t.category, t.sort_order
  FROM   traits t
  WHERE  t.room_id = p_source_room_id
  ORDER  BY t.sort_order, t.created_at;

  RETURN v_room_id;
END;
$$;

-- The recreated functions are staff-only, like every room-management RPC
-- (service_role through the API routes; never the browser).
REVOKE EXECUTE ON FUNCTION create_room(text, text, text, text, integer, integer, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION create_room(text, text, text, text, integer, integer, text, jsonb, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION update_room(uuid, text, text, text, text, integer, integer, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION update_room(uuid, text, text, text, text, integer, integer, jsonb, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION duplicate_room(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION duplicate_room(uuid, text, text, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION default_bid_step(text, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION default_bid_step(text, integer) TO service_role;
