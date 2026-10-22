-- ============================================================
-- 000 App schema in the shared NGG Supabase project
-- ============================================================
-- The NGG apps (auction, boards, quiz, simulations) share one Supabase
-- project. Each app keeps its tables, functions and policies in a schema
-- of its own so their names never collide; this app's schema is `auction`.
-- Every later migration starts with `set search_path to auction;`, so its
-- unqualified names land here, and every function pins the same path.
--
-- The grants mirror what Supabase gives the `public` schema: the API roles
-- may use the schema and receive the default privileges on new objects.
-- RLS and the explicit REVOKEs in later migrations narrow access exactly as
-- they did when the app had a project of its own.
--
-- Run this first, then 001 onward, then seed.sql. The schema must also be
-- listed under Project Settings -> Data API -> Exposed schemas, or the API
-- answers every request with "Invalid schema: auction".

create schema if not exists auction;

grant usage on schema auction to anon, authenticated, service_role;

alter default privileges in schema auction grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema auction grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema auction grant all on functions to anon, authenticated, service_role;
