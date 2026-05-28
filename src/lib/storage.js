const KEY = 'beach_locations_v2'

export function loadLocations() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveLocations(locations) {
  localStorage.setItem(KEY, JSON.stringify(locations))
}

export function addLocation(loc) {
  const locations = loadLocations()
  const newLoc = { ...loc, id: crypto.randomUUID(), active: true, created_at: new Date().toISOString() }
  locations.push(newLoc)
  saveLocations(locations)
  return newLoc
}

export function removeLocation(id) {
  const locations = loadLocations().filter(l => l.id !== id)
  saveLocations(locations)
}

export function updateLocation(id, patch) {
  const locations = loadLocations().map(l => l.id === id ? { ...l, ...patch } : l)
  saveLocations(locations)
}
