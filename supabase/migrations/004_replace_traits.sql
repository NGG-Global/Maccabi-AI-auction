-- ============================================================
-- 004 Replace leadership traits with final workshop content
-- ============================================================
-- Clears all round data that references the old traits, then
-- replaces the 8 traits for the maccabi-2024 event.
-- Safe to run before the live session — reset is expected.

-- 1. Remove round-related data in dependency order
delete from wallet_transactions
  where event_id = (select id from events where slug = 'maccabi-2024');

delete from bids
  where round_id in (
    select id from auction_rounds
    where event_id = (select id from events where slug = 'maccabi-2024')
  );

delete from auction_rounds
  where event_id = (select id from events where slug = 'maccabi-2024');

update events
  set current_round_id = null
  where slug = 'maccabi-2024';

-- 2. Remove old traits
delete from traits
  where event_id = (select id from events where slug = 'maccabi-2024');

-- 3. Insert the 8 new traits
insert into traits (event_id, title, description, category, sort_order)
select e.id, v.title, v.description, v.category, v.sort_order
from events e
cross join (values
  (1, 'ניהול מבוסס נתונים',
      'שימוש בנתונים, מדדים ועובדות לקבלת החלטות ניהוליות מדויקות ואפקטיביות.',
      'שיפוט'),
  (2, 'יכולות חניכה ומנטורינג ופיתוח ההון האנושי',
      'ליווי מקצועי של אנשים, העברת ידע וניסיון, ופיתוח הפוטנציאל של כל אחד בצוות.',
      'יחסים'),
  (3, 'אומץ ניהולי',
      'נכונות לקבל החלטות קשות, לומר את האמת גם כשקשה, ולקחת אחריות מלאה.',
      'מנהיגות'),
  (4, 'יכולות הפקת לקחים ויישום',
      'למידה שיטתית מניסיון וכישלונות, והפיכת תובנות למהלכים מעשיים בפועל.',
      'למידה'),
  (5, 'הסתגלות לשינויים והובלה בתנאי אי וודאות',
      'שמירה על יעילות וכיוון ברור גם כאשר המציאות משתנה ואי הוודאות גבוהה.',
      'מנהיגות'),
  (6, 'שיפור שגרות עבודה',
      'זיהוי חסמים ותהליכים לא יעילים ויצירת שגרות עבודה שמשפרות ביצועים לאורך זמן.',
      'שיפוט'),
  (7, 'חשיבה ביקורתית וקידום חדשנות',
      'ערעור על הנחות קיימות, שאילת שאלות נכונות ועידוד פתרונות יצירתיים וחדשניים.',
      'למידה'),
  (8, 'זיהוי ומימוש הזדמנויות להתפתחות שלי ושל אחרים',
      'ראייה יזמית של הזדמנויות לצמיחה ופעולה ממשית לפיתוח מיומנויות, שלי ושל הסביבה שלי.',
      'יחסים')
) as v(sort_order, title, description, category)
where e.slug = 'maccabi-2024';
