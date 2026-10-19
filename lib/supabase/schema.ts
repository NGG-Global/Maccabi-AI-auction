/**
 * Postgres schema that holds this app's tables and functions.
 *
 * The NGG apps share one Supabase project, each in a schema of its own
 * (supabase/migrations/000_app_schema.sql). Every client and every Realtime
 * subscription must name it, or requests land on the empty `public` schema.
 */
export const DB_SCHEMA = 'auction'
