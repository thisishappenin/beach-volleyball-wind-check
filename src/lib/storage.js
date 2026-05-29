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
  if (!userId) return loadGuest()
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
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
