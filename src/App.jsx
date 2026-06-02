import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, LogOut, User } from 'lucide-react'
import LocationCard from './components/LocationCard'
import AddLocationModal from './components/AddLocationModal'
import AuthScreen from './components/AuthScreen'
import { loadLocations, addLocation, removeLocation, updateLocation, migrateGuestLocations, loadGuestRaw, saveGuestRaw, loadRatings, saveRating } from './lib/storage'
import { fetchWeather } from './lib/openmeteo'
import { onAuthChange, logout } from './lib/auth'
import { supabase } from './lib/supabase'

const SAMPLE_LOCATIONS = [
  { id: 'sample-1', name: 'Newland Beach', latitude: 33.6793, longitude: -118.0201, court_bearing_deg: 135, notes: null, active: true },
  { id: 'sample-2', name: 'Huntington Beach Pier', latitude: 33.6553, longitude: -118.0018, court_bearing_deg: 125, notes: null, active: true },
  { id: 'sample-3', name: 'Corona del Mar Beach', latitude: 33.5927, longitude: -117.8699, court_bearing_deg: 10, notes: null, active: true },
]

function displayName(session) {
  if (!session) return null
  const meta = session.user?.user_metadata
  return meta?.display_name || meta?.full_name || session.user?.email?.split('@')[0] || 'Account'
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [locations, setLocations] = useState([])
  const [weather, setWeather] = useState({})
  const [loadingIds, setLoadingIds] = useState(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [ratings, setRatings] = useState([])

  const userId = session?.user?.id ?? null

  // Subscribe to auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })
    return onAuthChange(setSession)
  }, [])

  // Load locations + ratings whenever auth resolves or user changes
  useEffect(() => {
    if (!authReady) return
    loadLocations(userId).then(locs => {
      if (locs.length === 0 && !userId) {
        saveGuestRaw(SAMPLE_LOCATIONS)
        setLocations(SAMPLE_LOCATIONS)
      } else {
        setLocations(locs.filter(l => l.active !== false))
      }
      setWeather({})
    })
    loadRatings(userId).then(setRatings)
  }, [userId, authReady])

  const handleRate = async (locationId, date, slot, rating, wouldPlay, modelScore) => {
    await saveRating(userId, { location_id: locationId, date, slot, rating, would_play: wouldPlay, model_score: modelScore })
    setRatings(prev => {
      const idx = prev.findIndex(r => r.location_id === locationId && r.date === date && r.slot === slot)
      const entry = { location_id: locationId, date, slot, rating, would_play: wouldPlay, model_score: modelScore }
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...entry }
        return next
      }
      return [{ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...prev]
    })
  }

  const fetchAllWeather = useCallback(async (locs) => {
    setLoadingIds(new Set(locs.map(l => l.id)))
    const results = await Promise.allSettled(
      locs.map(async loc => {
        const data = await fetchWeather(loc.latitude, loc.longitude)
        return { id: loc.id, data }
      })
    )
    setWeather(prev => {
      const next = { ...prev }
      results.forEach(r => {
        if (r.status === 'fulfilled') next[r.value.id] = r.value.data
      })
      return next
    })
    setLoadingIds(new Set())
    setLastRefresh(new Date())
  }, [])

  useEffect(() => {
    if (locations.length > 0) fetchAllWeather(locations)
  }, [locations.map(l => l.id).join(',')])

  const handleAdd = async (locData) => {
    const newLoc = await addLocation(userId, locData)
    setLocations(prev => [...prev, newLoc])
    setShowAdd(false)
    fetchAllWeather([newLoc])
  }

  const handleDelete = async (id) => {
    await removeLocation(userId, id)
    setLocations(prev => prev.filter(l => l.id !== id))
    setWeather(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleSetBearing = async (id, newBearing) => {
    await updateLocation(userId, id, { court_bearing_deg: newBearing })
    setLocations(prev => prev.map(l => l.id === id ? { ...l, court_bearing_deg: newBearing } : l))
  }

  const handleEdit = async (id, patch) => {
    await updateLocation(userId, id, patch)
    setLocations(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
    if (patch.latitude !== undefined || patch.longitude !== undefined) {
      setWeather(prev => { const n = { ...prev }; delete n[id]; return n })
      const base = locations.find(l => l.id === id)
      if (base) fetchAllWeather([{ ...base, ...patch }])
    }
  }

  const handleAuth = async (newSession, isNewAccount) => {
    if (isNewAccount && newSession?.user?.id) {
      await migrateGuestLocations(newSession.user.id)
    }
    setSession(newSession)
    setShowAuth(false)
  }

  const handleLogout = async () => {
    await logout()
    setSession(null)
  }

  const anyLoading = loadingIds.size > 0
  const name = displayName(session)

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-blue-50">
      <div className="px-6 pb-10">
        <div className="pt-8 pb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🏐 Beach Wind Check</h1>
            <p className="text-xs text-slate-400 mt-0.5">8–11 AM · 4–7 PM · last 7 + next 7 days</p>
          </div>
          <div className="flex items-center gap-2">
            {name && (
              <span className="text-xs text-slate-500 hidden sm:block">{name}</span>
            )}
            <button
              onClick={() => fetchAllWeather(locations)}
              disabled={anyLoading}
              className="p-2 rounded-full text-slate-400 hover:text-sky-600 hover:bg-sky-100 transition-colors disabled:opacity-40"
              title="Refresh weather"
            >
              <RefreshCw size={18} className={anyLoading ? 'animate-spin' : ''} />
            </button>
            {session ? (
              <button
                onClick={handleLogout}
                className="p-2 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-600 border border-sky-200 rounded-full hover:bg-sky-50 transition-colors"
                title="Sign in or create account"
              >
                <User size={13} /> Sign in
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 items-start justify-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 380px))' }}>
          {locations.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400">
              <p className="text-5xl mb-3">🏖</p>
              <p className="font-medium">No beaches yet</p>
              <p className="text-sm mt-1">Add a location to get started</p>
            </div>
          )}

          {locations.map(loc => (
            <LocationCard
              key={loc.id}
              location={loc}
              hourlyData={weather[loc.id]}
              loading={loadingIds.has(loc.id)}
              onDelete={handleDelete}
              onSetBearing={handleSetBearing}
              onEdit={handleEdit}
              ratings={ratings.filter(r => r.location_id === loc.id)}
              onRate={handleRate}
            />
          ))}
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-sky-300 rounded-2xl text-sky-600 font-medium hover:bg-sky-50 hover:border-sky-400 transition-colors"
        >
          <Plus size={18} /> Add location
        </button>

        {lastRefresh && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' · '}Cached 30 min
          </p>
        )}
      </div>

      {showAdd && (
        <AddLocationModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />
      )}

      {showAuth && (
        <AuthScreen onAuth={handleAuth} onClose={() => setShowAuth(false)} />
      )}
    </div>
  )
}
