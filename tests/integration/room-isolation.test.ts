/**
 * Room isolation, verified against a real Postgres running the auction
 * schema (migrations 000 → 011). The game logic lives in the database, so
 * these are the tests that matter.
 *
 * Run:  DATABASE_URL=postgres://postgres@127.0.0.1:54329/auction_test npm run test:integration
 * (see scripts/test-db/migrate.sh for preparing that database)
 *
 * Never point DATABASE_URL at the shared NGG project: the suite creates and
 * deletes rooms. Without DATABASE_URL the suite is skipped.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

const suffix = Math.random().toString(36).slice(2, 8)
const SLUG_A = `it-a-${suffix}`
const SLUG_B = `it-b-${suffix}`
const SLUG_C = `it-c-${suffix}`

async function rpc<T = Record<string, unknown>>(db: Client, sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query(sql, params)
  return res.rows as T[]
}

async function expectError(promise: Promise<unknown>, code: string) {
  let message = ''
  try { await promise } catch (err) { message = (err as Error).message }
  expect(message, `expected error "${code}"`).toContain(code)
}

describeDb('room isolation (database)', () => {
  const db = new Client({ connectionString: url })
  let roomA = ''
  let roomB = ''
  let roomC = ''
  const tokens = {
    dana: `tok-dana-${suffix}-0000000`,
    yossi: `tok-yossi-${suffix}-000000`,
    ruth: `tok-ruth-${suffix}-0000000`,
    avi: `tok-avi-${suffix}-00000000`,
    gal: `tok-gal-${suffix}-00000000`,
  }
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    await db.connect()
    await db.query('set search_path to auction')
    const traits = JSON.stringify([
      { title: 'היגד 1', category: 'מנהיגות', sort_order: 1 },
      { title: 'היגד 2', category: 'שיפוט', sort_order: 2 },
    ])
    ;[{ create_room: roomA }] = await rpc<{ create_room: string }>(db,
      `select create_room($1, 'חדר א', 'לקוח א', 'auction', 1000, 90, 'test@nggconsult.com', $2::jsonb)`, [SLUG_A, traits])
    ;[{ create_room: roomB }] = await rpc<{ create_room: string }>(db,
      `select create_room($1, 'חדר ב', 'לקוח ב', 'auction', 500, null, 'test@nggconsult.com', $2::jsonb)`, [SLUG_B, traits])
    ;[{ create_room: roomC }] = await rpc<{ create_room: string }>(db,
      `select create_room($1, 'חדר ג', 'לקוח ג', 'allocation', 800, null, 'test@nggconsult.com', $2::jsonb)`, [SLUG_C, traits])
  })

  afterAll(async () => {
    for (const id of [roomA, roomB, roomC]) {
      if (!id) continue
      await db.query('select reset_room($1)', [id]).catch(() => {})
      await db.query('delete from traits where room_id = $1', [id]).catch(() => {})
      await db.query('delete from rooms where id = $1', [id]).catch(() => {})
    }
    await db.end()
  })

  it('refuses participants while a room is a draft, accepts them once it is live', async () => {
    await expectError(rpc(db, `select * from register_participant($1, 'דנה', $2)`, [roomA, tokens.dana]), 'room_not_live')

    for (const id of [roomA, roomB, roomC]) {
      const [row] = await rpc<{ status: string; active_until: Date }>(db, `select * from set_room_status($1, 'active')`, [id])
      expect(row.status).toBe('active')
      expect(new Date(row.active_until).getTime()).toBeGreaterThan(Date.now() + 11 * 3600 * 1000)
    }

    const reg = async (room: string, name: string, token: string) => {
      const [row] = await rpc<{ participant_id: string; wallet_balance: number }>(db,
        `select * from register_participant($1, $2, $3)`, [room, name, token])
      return row
    }
    const dana = await reg(roomA, 'דנה', tokens.dana)
    const yossi = await reg(roomA, 'יוסי', tokens.yossi)
    const ruth = await reg(roomB, 'רות', tokens.ruth)
    const avi = await reg(roomC, 'אבי', tokens.avi)
    const gal = await reg(roomC, 'גל', tokens.gal)
    Object.assign(ids, { dana: dana.participant_id, yossi: yossi.participant_id, ruth: ruth.participant_id, avi: avi.participant_id, gal: gal.participant_id })

    // Wallets follow the room's starting coins, not a fixed 1,000.
    expect(dana.wallet_balance).toBe(1000)
    expect(ruth.wallet_balance).toBe(500)
    expect(avi.wallet_balance).toBe(800)
  })

  it('lets two rooms run an open round at the same time', async () => {
    const trait = async (room: string) => (await rpc<{ id: string }>(db, `select id from traits where room_id = $1 order by sort_order limit 1`, [room]))[0].id
    ;[{ round_id: ids.roundA }] = await rpc<{ round_id: string }>(db, `select * from open_auction_round($1, $2)`, [roomA, await trait(roomA)])
    ;[{ round_id: ids.roundB }] = await rpc<{ round_id: string }>(db, `select * from open_auction_round($1, $2)`, [roomB, await trait(roomB)])
    const [{ count }] = await rpc<{ count: string }>(db, `select count(*) from auction_rounds where status = 'open' and room_id in ($1, $2)`, [roomA, roomB])
    expect(Number(count)).toBe(2)
  })

  it('keeps a bid inside its room', async () => {
    await rpc(db, `select * from submit_bid($1, $2, $3, 300)`, [tokens.dana, roomA, ids.roundA])
    await rpc(db, `select * from submit_bid($1, $2, $3, 200)`, [tokens.ruth, roomB, ids.roundB])

    const bidsB = await rpc<{ amount: number; participant_id: string }>(db, `select amount, participant_id from bids where room_id = $1`, [roomB])
    expect(bidsB).toEqual([{ amount: 200, participant_id: ids.ruth }])
    const bidsA = await rpc<{ amount: number }>(db, `select amount from bids where room_id = $1`, [roomA])
    expect(bidsA).toEqual([{ amount: 300 }])
  })

  it('reports round stats for one room in a single call', async () => {
    const [stats] = await rpc<Record<string, number | string | null>>(db,
      `select * from get_round_stats($1, $2, $3)`, [roomA, ids.roundA, ids.yossi])
    // Room A: Dana bid 300, Yossi did not; Ruth (room B) is not counted.
    expect(stats).toMatchObject({ bidder_count: 1, no_bid_count: 1, folded_count: 0, highest_bid: 300, leader_participant_id: ids.dana, my_amount: 0 })
    const [mine] = await rpc<Record<string, number>>(db, `select my_amount from get_round_stats($1, $2, $3)`, [roomA, ids.roundA, ids.dana])
    expect(mine.my_amount).toBe(300)
  })

  it("rejects a participant bidding on another room's round, whichever room id is sent", async () => {
    // Ruth (room B) on room A's round, claiming room A
    await expectError(rpc(db, `select * from submit_bid($1, $2, $3, 100)`, [tokens.ruth, roomA, ids.roundA]), 'room_mismatch')
    // Ruth (room B) on room A's round, claiming her own room
    await expectError(rpc(db, `select * from submit_bid($1, $2, $3, 100)`, [tokens.ruth, roomB, ids.roundA]), 'room_mismatch')
    // Closing room A's round through room B
    await expectError(rpc(db, `select * from close_auction_round($1, $2)`, [roomB, ids.roundA]), 'round_not_open')
    // Even a direct insert (bypassing the functions) cannot pair a room B participant with a room A round
    await expectError(
      rpc(db, `insert into bids (room_id, round_id, participant_id, amount) values ($1, $2, $3, 50)`, [roomA, ids.roundA, ids.ruth]),
      'bids_participant_room_fkey',
    )
    // ... nor mislabel the room of a bid
    await expectError(
      rpc(db, `insert into bids (room_id, round_id, participant_id, amount) values ($1, $2, $3, 50)`, [roomB, ids.roundA, ids.yossi]),
      'bids_round_room_fkey',
    )
    const [{ count }] = await rpc<{ count: string }>(db, `select count(*) from bids where room_id in ($1, $2)`, [roomA, roomB])
    expect(Number(count)).toBe(2)
  })

  it('charges only the winner of the closed room', async () => {
    const [res] = await rpc<{ winner_id: string; winning_amount: number }>(db, `select * from close_auction_round($1, $2)`, [roomA, ids.roundA])
    expect(res.winner_id).toBe(ids.dana)
    expect(res.winning_amount).toBe(300)

    const wallets = await rpc<{ display_name: string; wallet_balance: number }>(db,
      `select display_name, wallet_balance from participants where room_id in ($1, $2) order by display_name`, [roomA, roomB])
    expect(wallets).toEqual([
      { display_name: 'דנה', wallet_balance: 700 },
      { display_name: 'יוסי', wallet_balance: 1000 },
      { display_name: 'רות', wallet_balance: 500 },
    ])
    // Room B's round is still open and unaffected.
    const [{ status }] = await rpc<{ status: string }>(db, `select status from auction_rounds where id = $1`, [ids.roundB])
    expect(status).toBe('open')
  })

  it('locks game settings while a room holds play data', async () => {
    await expectError(
      rpc(db, `select update_room($1, $2, 'חדר א', 'לקוח א', 'allocation', 1000, 90, null)`, [roomA, SLUG_A]),
      'settings_locked',
    )
    // Title and client name may still change.
    await rpc(db, `select update_room($1, $2, 'חדר א (שם חדש)', 'לקוח א', 'auction', 1000, 90, null)`, [roomA, SLUG_A])
    const [{ title }] = await rpc<{ title: string }>(db, `select title from rooms where id = $1`, [roomA])
    expect(title).toBe('חדר א (שם חדש)')
  })

  it('resets one room and leaves the other untouched', async () => {
    const [res] = await rpc<{ participants_removed: number; rounds_removed: number }>(db, `select * from reset_room($1)`, [roomA])
    expect(res.participants_removed).toBe(2)
    expect(res.rounds_removed).toBe(1)

    const countA = async (table: string) => Number((await rpc<{ count: string }>(db, `select count(*) from ${table} where room_id = $1`, [roomA]))[0].count)
    expect(await countA('participants')).toBe(0)
    expect(await countA('bids')).toBe(0)
    expect(await countA('auction_rounds')).toBe(0)
    expect(await countA('wallet_transactions')).toBe(0)
    const [{ used }] = await rpc<{ used: string }>(db, `select count(*) as used from traits where room_id = $1 and is_used`, [roomA])
    expect(Number(used)).toBe(0)

    // Room B: participant, open round and bid all still there.
    const [{ wallet_balance }] = await rpc<{ wallet_balance: number }>(db, `select wallet_balance from participants where id = $1`, [ids.ruth])
    expect(wallet_balance).toBe(500)
    const [{ status }] = await rpc<{ status: string }>(db, `select status from auction_rounds where id = $1`, [ids.roundB])
    expect(status).toBe('open')
    const bidsB = await rpc<{ amount: number }>(db, `select amount from bids where room_id = $1`, [roomB])
    expect(bidsB).toEqual([{ amount: 200 }])

    // After the reset the settings are editable again.
    await rpc(db, `select update_room($1, $2, 'חדר א', 'לקוח א', 'auction', 1500, null, null)`, [roomA, SLUG_A])
    const [{ starting_coins }] = await rpc<{ starting_coins: number }>(db, `select starting_coins from rooms where id = $1`, [roomA])
    expect(starting_coins).toBe(1500)
  })

  it('keeps allocation saves inside their room and shares tied wins', async () => {
    const [{ round_count }] = await rpc<{ round_count: number }>(db, `select * from open_allocation($1)`, [roomC])
    expect(round_count).toBe(2)
    const rounds = await rpc<{ id: string }>(db, `select id from auction_rounds where room_id = $1 and status = 'open'`, [roomC])
    const split = Object.fromEntries(rounds.map(r => [r.id, 300]))

    // Ruth (room B) cannot save an allocation into room C.
    await expectError(rpc(db, `select * from submit_allocation($1, $2, $3::jsonb)`, [tokens.ruth, roomC, JSON.stringify(split)]), 'room_mismatch')

    await rpc(db, `select * from submit_allocation($1, $2, $3::jsonb)`, [tokens.avi, roomC, JSON.stringify(split)])
    await rpc(db, `select * from submit_allocation($1, $2, $3::jsonb)`, [tokens.gal, roomC, JSON.stringify(split)])
    const [res] = await rpc<{ rounds_closed: number; participants_charged: number; total_charged: string; tied_traits: number }>(db,
      `select * from close_allocation($1)`, [roomC])
    expect(res.rounds_closed).toBe(2)
    expect(res.participants_charged).toBe(2)
    expect(Number(res.total_charged)).toBe(1200)
    expect(res.tied_traits).toBe(2)

    const winners = await rpc<{ count: string }>(db, `select count(*) from round_winners where room_id = $1`, [roomC])
    expect(Number(winners[0].count)).toBe(4)
    const wallets = await rpc<{ wallet_balance: number }>(db, `select wallet_balance from participants where room_id = $1`, [roomC])
    expect(wallets.map(w => w.wallet_balance)).toEqual([200, 200])
    // Room B still untouched by all of this.
    const [{ wallet_balance }] = await rpc<{ wallet_balance: number }>(db, `select wallet_balance from participants where id = $1`, [ids.ruth])
    expect(wallet_balance).toBe(500)
  })

  it('refuses bids once the live window is closed, and accepts them after re-activation', async () => {
    await rpc(db, `select * from set_room_status($1, 'ended')`, [roomB])
    await expectError(rpc(db, `select * from submit_bid($1, $2, $3, 250)`, [tokens.ruth, roomB, ids.roundB]), 'room_not_live')
    await rpc(db, `select * from set_room_status($1, 'active')`, [roomB])
    const [{ bid_amount }] = await rpc<{ bid_amount: number }>(db, `select * from submit_bid($1, $2, $3, 250)`, [tokens.ruth, roomB, ids.roundB])
    expect(bid_amount).toBe(250)
  })

  it('never deletes a room that hosted a game; archives it instead', async () => {
    await expectError(rpc(db, `select delete_room($1)`, [roomB]), 'room_has_history')
    await rpc(db, `select * from set_room_status($1, 'ended')`, [roomB])
    const [{ status }] = await rpc<{ status: string }>(db, `select * from set_room_status($1, 'archived')`, [roomB])
    expect(status).toBe('archived')
    await expectError(rpc(db, `select * from set_room_status($1, 'active')`, [roomB]), 'invalid_transition')
  })
})
