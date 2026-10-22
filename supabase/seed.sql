-- ============================================================
-- Seed — the first room: leadership auction with 7 statements
-- ============================================================
-- Run after every migration (000 → 011). Safe to re-run: the room is
-- matched by slug and the statements are only inserted when the room has
-- none yet.

-- Shared NGG Supabase project: this app lives in the `auction` schema (see 000).
set search_path to auction;

insert into rooms (id, slug, title, client_name, status, game_mode, starting_coins, created_by_email)
values (
  '00000000-0000-0000-0000-000000000001',
  'leadership-auction',
  'מכירה פומבית — תכונות ניהוליות',
  '',
  'draft',
  'auction',
  1000,
  null
)
on conflict (slug) do nothing;

-- The 7 statements. No descriptions were supplied, so `description` is
-- stored empty and every surface omits the description line. Categories
-- use the four fixed labels (מנהיגות / יחסים / שיפוט / למידה) that drive
-- the analytics breakdown and the profile archetype.
insert into traits (room_id, title, description, category, sort_order)
select r.id, v.title, '', v.category, v.sort_order
from rooms r
cross join (values
  (1, 'להניע אנשים וצוותים', 'מנהיגות'),
  (2, 'לפתח אנשים', 'יחסים'),
  (3, 'ליצור מרחב בטוח לחשיבה משותפת', 'יחסים'),
  (4, 'להניע ללא סמכות פורמלית', 'מנהיגות'),
  (5, 'למפות', 'שיפוט'),
  (6, 'לתעדף', 'שיפוט'),
  (7, 'לייצר בסיס להחלטה', 'שיפוט')
) as v(sort_order, title, category)
where r.slug = 'leadership-auction'
  and not exists (select 1 from traits t where t.room_id = r.id);
