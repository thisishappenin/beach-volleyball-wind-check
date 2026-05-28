function key(accountId) {
  return `beach_locations_v2_${accountId}`
}

export function loadLocations(accountId) {
  try {
    return JSON.parse(localStorage.getItem(key(accountId)) ?? '[]')
  } catch {
    return []
  }
}

export function saveLocations(accountId, locations) {
  localStorage.setItem(key(accountId), JSON.stringify(locations))
}

export function addLocation(accountId, loc) {
  const locations = loadLocations(accountId)
  const newLoc = { ...loc, id: crypto.randomUUID(), active: true, created_at: new Date().toISOString() }
  locations.push(newLoc)
  saveLocations(accountId, locations)
  return newLoc
}

export function removeLocation(accountId, id) {
  const locations = loadLocations(accountId).filter(l => l.id !== id)
  saveLocations(accountId, locations)
}

export function updateLocation(accountId, id, patch) {
  const locations = loadLocations(accountId).map(l => l.id === id ? { ...l, ...patch } : l)
  saveLocations(accountId, locations)
}
