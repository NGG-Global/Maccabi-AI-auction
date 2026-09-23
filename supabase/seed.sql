-- ============================================================
-- Seed — leadership auction event with 7 auctioned statements
-- ============================================================

-- Insert event
insert into events (id, slug, name, status) values
  ('00000000-0000-0000-0000-000000000001', 'leadership-auction', 'מכירה פומבית — תכונות ניהוליות', 'active')
  on conflict (slug) do nothing;

-- Insert the 7 auctioned statements.
-- No descriptions were supplied, so `description` is stored empty and
-- every surface omits the description line. Categories reuse the
-- existing four-label vocabulary (מנהיגות / יחסים / שיפוט / למידה)
-- that drives the analytics breakdown and the profile archetype.
insert into traits (event_id, title, description, category, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'להניע אנשים וצוותים', '', 'מנהיגות', 1),
  ('00000000-0000-0000-0000-000000000001', 'לפתח אנשים', '', 'יחסים', 2),
  ('00000000-0000-0000-0000-000000000001', 'ליצור מרחב בטוח לחשיבה משותפת', '', 'יחסים', 3),
  ('00000000-0000-0000-0000-000000000001', 'להניע ללא סמכות פורמלית', '', 'מנהיגות', 4),
  ('00000000-0000-0000-0000-000000000001', 'למפות', '', 'שיפוט', 5),
  ('00000000-0000-0000-0000-000000000001', 'לתעדף', '', 'שיפוט', 6),
  ('00000000-0000-0000-0000-000000000001', 'לייצר בסיס להחלטה', '', 'שיפוט', 7)
  on conflict do nothing;
