-- ============================================================
-- 006 Final auctioned statements + brand-neutral event slug
-- ============================================================
-- Two changes ahead of the live workshop:
--
--   1. The event slug becomes 'leadership-auction'. The join URL
--      (/join?event=:slug) and the projection URL (/screen/:slug)
--      change with it, so any printed QR codes must be regenerated.
--
--   2. The auctioned statements are replaced with the final set of 7.
--      No descriptions were supplied for them, so `description` is
--      stored empty and every surface omits the description line.
--
-- Round data referencing the previous statements is cleared first, and
-- starting wallets are restored so balances match the emptied ledger.
-- Intended for pre-event use only: re-running it wipes round data and
-- rewrites the statement list again.

-- 1. Brand-neutral slug (no-op once renamed)
update events
  set slug = 'leadership-auction'
  where slug = 'maccabi-2024';

-- 2. Remove round-related data in dependency order
delete from wallet_transactions
  where event_id = (select id from events where slug = 'leadership-auction');

delete from bids
  where round_id in (
    select id from auction_rounds
    where event_id = (select id from events where slug = 'leadership-auction')
  );

update events
  set current_round_id = null
  where slug = 'leadership-auction';

delete from auction_rounds
  where event_id = (select id from events where slug = 'leadership-auction');

-- 3. Restore starting wallets — the ledger above was emptied
update participants
  set wallet_balance = 1000
  where event_id = (select id from events where slug = 'leadership-auction');

-- 4. Remove the previous statements
delete from traits
  where event_id = (select id from events where slug = 'leadership-auction');

-- 5. Insert the final 7 statements
--    Categories reuse the existing four-label vocabulary
--    (מנהיגות / יחסים / שיפוט / למידה) that drives the analytics
--    breakdown and the participant profile archetype.
insert into traits (event_id, title, description, category, sort_order)
select e.id, v.title, '', v.category, v.sort_order
from events e
cross join (values
  (1, 'להניע אנשים וצוותים', 'מנהיגות'),
  (2, 'לפתח אנשים', 'יחסים'),
  (3, 'ליצור מרחב בטוח לחשיבה משותפת', 'יחסים'),
  (4, 'להניע ללא סמכות פורמלית', 'מנהיגות'),
  (5, 'למפות', 'שיפוט'),
  (6, 'לתעדף', 'שיפוט'),
  (7, 'לייצר בסיס להחלטה', 'שיפוט')
) as v(sort_order, title, category)
where e.slug = 'leadership-auction';
