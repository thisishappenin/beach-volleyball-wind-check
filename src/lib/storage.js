import { supabase } from './supabase'

const GUEST_KEY = 'beach_locations_v2_guest'
const SAMPLE_IDS = new Set(['sample-1', 'sample-2', 'sample-3'])

function loadGuest() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]') } catch { return [] }
}
function saveGuest(locs) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(locs))
}

export async function loadLocations(userId) {
  if (userId) {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  }
  // Guest: try Supabase public read first so visitors see the owner's beaches.
  // Requires the "Public read all locations" RLS policy (002_public_read_locations.sql).
  // Falls back to localStorage if the policy isn't applied yet or the request fails.
  try {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data && data.length > 0) return data
  } catch {}
  return loadGuest()
}

export async function addLocation(userId, loc) {
  if (!userId) {
    const newLoc = { ...loc, id: crypto.randomUUID(), active: true, created_at: new Date().toISOString() }
    const locs = loadGuest()
    locs.push(newLoc)
    saveGuest(locs)
    return newLoc
  }
  const { data, error } = await supabase
    .from('locations')
    .insert({ ...loc, user_id: userId, active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeLocation(userId, id) {
  if (!userId) {
    saveGuest(loadGuest().filter(l => l.id !== id))
    return
  }
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) throw error
}

export async function updateLocation(userId, id, patch) {
  if (!userId) {
    saveGuest(loadGuest().map(l => l.id === id ? { ...l, ...patch } : l))
    return
  }
  const { error } = await supabase.from('locations').update(patch).eq('id', id)
  if (error) throw error
}

// Called after signup — moves non-sample guest locations into the new account
export async function migrateGuestLocations(userId) {
  const guestLocs = loadGuest().filter(l => !SAMPLE_IDS.has(l.id) && l.active !== false)
  if (guestLocs.length === 0) return
  const rows = guestLocs.map(({ id: _id, ...l }) => ({ ...l, user_id: userId }))
  await supabase.from('locations').insert(rows)
  localStorage.removeItem(GUEST_KEY)
}

// Guest helpers used by App for seeding sample data
export function loadGuestRaw() { return loadGuest() }
export function saveGuestRaw(locs) { saveGuest(locs) }

// ─── Session ratings ───────────────────────────────────────────────────────

const RATINGS_KEY = 'beach_ratings_v1'

function loadGuestRatings() {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) ?? '[]') } catch { return [] }
}
function saveGuestRatings(ratings) {
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings))
}

export async function loadRatings(userId) {
  if (!userId) return loadGuestRatings()
  const { data } = await supabase
    .from('session_ratings')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function saveRating(userId, { location_id, date, slot, rating, would_play, model_score }) {
  if (!userId) {
    const all = loadGuestRatings()
    const idx = all.findIndex(r => r.location_id === location_id && r.date === date && r.slot === slot)
    const entry = { location_id, date, slot, rating, would_play, model_score }
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...entry, updated_at: new Date().toISOString() }
    } else {
      all.unshift({ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() })
    }
    saveGuestRatings(all)
    return
  }
  await supabase.from('session_ratings').upsert(
    { user_id: userId, location_id, date, slot, rating, would_play, model_score, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,location_id,date,slot' }
  )
}
